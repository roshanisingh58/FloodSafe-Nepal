"""FloodSafe Nepal backend (FastAPI).
Run:  CITY=kathmandu uvicorn main:app --reload        (real OSM + Open-Meteo, needs internet)
Dev:  DEMO=1 uvicorn main:app --reload                (synthetic grid, works offline)
Other cities: CITY=pokhara | biratnagar, or CENTER="lat,lon" for any location.
Cache: the first online start saves roads + terrain to cache/; later starts load it with no internet.
       REFRESH=1 forces a fresh download."""
import csv, io, math, os, pickle, random, time
from pathlib import Path
import httpx, networkx as nx, numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

CITIES = {"kathmandu": (27.7172, 85.3240), "pokhara": (28.2096, 83.9856), "biratnagar": (26.4525, 87.2718)}
CITY = os.getenv("CITY", "kathmandu")
CENTER = tuple(map(float, os.getenv("CENTER").split(","))) if os.getenv("CENTER") else CITIES[CITY]
RADIUS = int(os.getenv("RADIUS_M", "1500"))
DEMO = os.getenv("DEMO") == "1"
W = dict(el=.1531, bs=.1764, rv=.156, lu=.0848)  # AHP weights from the Mumbai study: re-derive or validate for Nepal
TH, CN = [.2, .4, .6, .8], ["Very low", "Low", "Moderate", "High", "Very high"]
V = {"ambulance": dict(sp=35, bk=4, lam=1.2), "car": dict(sp=25, bk=4, lam=1.8),
     "bike": dict(sp=25, bk=3, lam=2.2), "walk": dict(sp=4.5, bk=3, lam=2.5)}  # placeholder class limits, not depth guidance
IMP = dict(motorway=5, trunk=5, primary=5, secondary=4, tertiary=3, unclassified=2, residential=1.5, living_street=1)
ST = dict(I=0.0, A=0.0, ts="", src="manual", closed=set(), warn="")
E, F, G, NODE = [], [], nx.Graph(), {}
clip = lambda x, a=0., b=1.: min(b, max(a, x))
cls = lambda r: -1 if r is None else sum(r >= t for t in TH)
norm = lambda a: (lambda x: (x - x.min()) / ((x.max() - x.min()) or 1))(np.asarray(a, float))


def rf(m=1., x=0.):  # rainfall loading 0..1 from intensity (mm/h) and 24 h total (mm)
    return clip((.65 * ST["I"] / 40 + .35 * (ST["A"] + x) / 150) * m)


def risk(e, m=1., x=0., fix=None):  # static susceptibility scaled by rainfall
    return None if e["S"] is None else e["S"] * (.12 + .88 * (rf(m, x) if fix is None else fix))


def rk(e, rob):  # robust routing: worst case over rain -20% / 0 / +30%
    if not rob: return risk(e)
    a = [risk(e, m) for m in (.8, 1, 1.3)]
    return None if a[0] is None else max(a)


def load_osm():
    import osmnx as ox
    g = ox.graph_from_point(CENTER, dist=RADIUS, network_type="drive")
    nodes, edges = ox.graph_to_gdfs(g)
    eu = edges.to_crs(edges.estimate_utm_crs())
    try:
        w = ox.features_from_point(CENTER, {"waterway": ["river", "stream", "canal", "drain"]}, dist=RADIUS).to_crs(eu.crs).geometry.unary_union
    except Exception:
        w = None
    seen = set()
    for i, ((u, v, k), r) in enumerate(edges.iterrows()):
        if (min(u, v), max(u, v)) in seen: continue
        seen.add((min(u, v), max(u, v)))
        hw = r["highway"][0] if isinstance(r["highway"], list) else r["highway"]
        nm = r.get("name"); nm = nm[0] if isinstance(nm, list) else (nm if isinstance(nm, str) else "")
        rv = None if w is None else float(w.distance(eu.geometry.iloc[i].interpolate(.5, normalized=True)))
        E.append(dict(u=u, v=v, c=[(y, x) for x, y in r.geometry.coords], len=float(r["length"]), hw=hw, nm=nm, tun=str(r.get("tunnel")) == "yes", rv=rv))
    for n, r in nodes.iterrows(): NODE[n] = (r.y, r.x)
    fac = ox.features_from_point(CENTER, {"amenity": ["hospital", "clinic", "school", "community_centre", "shelter"]}, dist=int(RADIUS * 1.3))
    for _, r in fac.iterrows():
        p, t = r.geometry.centroid, r["amenity"]
        F.append(dict(n=r["name"] if isinstance(r.get("name"), str) else t, lat=p.y, lon=p.x, t="hospital" if t in ("hospital", "clinic") else "shelter", src="osm"))


def load_demo():
    random.seed(7); n = 12; la0, lo0 = CENTER[0] - .007, CENTER[1] - .0075
    for i in range(n):
        for j in range(n): NODE[i * n + j] = (la0 + i * .0013, lo0 + j * .0014)
    for i in range(n):
        for j in range(n):
            for di, dj in ((0, 1), (1, 0)):
                if i + di < n and j + dj < n and random.random() > .06:
                    u, v = i * n + j, (i + di) * n + j + dj
                    E.append(dict(u=u, v=v, c=[NODE[u], NODE[v]], len=140., hw="tertiary" if i == 6 else "residential", nm=f"Road {i}-{j}", tun=(j == 3 and i == 5), rv=(NODE[u][0] - la0) * 111320))
    for k, (a, t) in enumerate([(5 * n + 9, "hospital"), (3 * n + 2, "shelter"), (9 * n + 8, "shelter")]):
        F.append(dict(n=f"Demo {t} {k}", lat=NODE[a][0], lon=NODE[a][1], t=t, src="demo"))


DATA = Path(__file__).parent / "data"
CACHE = Path(__file__).parent / "cache" / f"{os.getenv('CENTER', CITY).replace(',', '_')}_{RADIUS}.pkl"


def num(x, f=float):
    try: return f(float(x))
    except (TypeError, ValueError): return None


def parse_shelters(rows, src="csv"):  # feature 5: shelter database (name,lat,lon[,type,capacity,source,area_m2,flood_prone,municipality])
    out = []
    for r in rows:
        r = {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        lat, lon = num(r.get("lat") or r.get("latitude")), num(r.get("lon") or r.get("lng") or r.get("longitude"))
        if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180): continue
        out.append(dict(n=r.get("name") or "Unnamed shelter", lat=lat, lon=lon, t="shelter", kind=r.get("type") or "shelter",
                        src=r.get("source") or src, cap=num(r.get("capacity"), int), area=num(r.get("area_m2"), int),
                        fp=(r.get("flood_prone") or "").lower() in ("yes", "y", "true", "1"), mun=r.get("municipality", "")))
    return out


def load_csv():  # curated database + anything imported from the UI (kept across restarts)
    for name in ("shelters.csv", "shelters_imported.csv"):
        p = DATA / name
        if p.exists(): add_shelters(parse_shelters(csv.DictReader(p.open(encoding="utf-8")), "imported" if "imported" in name else "csv"))


def add_shelters(new):  # CSV sites win over an OSM school/community centre in the same place (within 80 m)
    added = []
    for s in new:
        dup = lambda f: f["t"] == "shelter" and abs(f["lat"] - s["lat"]) * 111320 < 80 and abs(f["lon"] - s["lon"]) * 98000 < 80
        F[:] = [f for f in F if not (f["src"] == "osm" and dup(f))]
        if not any(f["src"] != "osm" and f["n"] == s["n"] and dup(f) for f in F): F.append(s); added.append(s)
    return added


def elevation_grid(g=10):  # GIS terrain: Open-Meteo elevation (Copernicus 90 m) on a grid
    k = math.cos(math.radians(CENTER[0])); dl, dn = RADIUS * 1.3 / 111320, RADIUS * 1.3 / (111320 * k)
    la, lo = np.linspace(CENTER[0] - dl, CENTER[0] + dl, g), np.linspace(CENTER[1] - dn, CENTER[1] + dn, g)
    pts = [(a, b) for a in la for b in lo]
    r = httpx.get("https://api.open-meteo.com/v1/elevation", params={"latitude": ",".join(f"{a:.5f}" for a, _ in pts), "longitude": ",".join(f"{b:.5f}" for _, b in pts)}, timeout=30)
    r.raise_for_status()
    return la, lo, np.array(r.json()["elevation"]).reshape(g, g)


def interp(grid):
    from scipy.interpolate import RegularGridInterpolator
    f = RegularGridInterpolator(grid[:2], grid[2], bounds_error=False, fill_value=None)
    return lambda a, b: float(f([[a, b]])[0])


def score(zf):  # static susceptibility from terrain factors; None = no data (grey, never "safe")
    mids = np.array([e["c"][len(e["c"]) // 2] for e in E])
    if zf is None:
        for e in E: e.update(S=None, f={})
        return
    d = .0022
    for e, m in zip(E, mids):
        e["z"] = zf(*m); e["bs"] = sum(zf(m[0] + a, m[1] + b) for a, b in ((d, 0), (-d, 0), (0, d), (0, -d))) / 4 - e["z"]
        e["den"] = int(np.sum((np.abs(mids[:, 0] - m[0]) < .0009) & (np.abs(mids[:, 1] - m[1]) < .0009)))
    nz, nb, nl = (norm([e[k] for e in E]) for k in ("z", "bs", "den"))
    for i, e in enumerate(E):
        e["f"] = dict(el=1 - nz[i], bs=nb[i], rv=.5 if e["rv"] is None else 1 - min(1, e["rv"] / 500), lu=nl[i])
        s = sum(W[k] * e["f"][k] for k in W) / sum(W.values()); e["S"] = min(1, s * 1.2 + .08) if e["tun"] else s
    ns = norm([e["S"] for e in E])
    for i, e in enumerate(E): e["S"] = float(ns[i])


def nearest(lat, lon):
    k = math.cos(math.radians(lat))
    return min(NODE, key=lambda n: (NODE[n][0] - lat) ** 2 + ((NODE[n][1] - lon) * k) ** 2)


def meters(a, b, c, d): return math.hypot((a - c) * 111320, (b - d) * 111320 * math.cos(math.radians(a)))


def snap(f):  # attach a facility to the road graph; >400 m from any road = outside the study area, not routable
    f["k"] = nearest(f["lat"], f["lon"]); f["snap"] = meters(f["lat"], f["lon"], *NODE[f["k"]]); f["in_area"] = f["snap"] <= 400
    f["near"] = [e["id"] for e in E if meters(f["lat"], f["lon"], *e["c"][len(e["c"]) // 2]) < 200]


def build():
    E.clear(); F.clear(); G.clear(); NODE.clear(); ST["warn"] = ""; grid = None
    try:
        if DEMO: raise RuntimeError("demo mode")
        if CACHE.exists() and os.getenv("REFRESH") != "1":
            c = pickle.loads(CACHE.read_bytes()); E.extend(c["E"]); F.extend(c["F"]); NODE.update(c["NODE"]); grid = c["grid"]
            ST["warn"] = f"Offline cache from {c['saved']} (REFRESH=1 to re-download). "
        else:
            load_osm()
    except Exception as ex:
        E.clear(); F.clear(); NODE.clear(); load_demo()
        ST["warn"] = "Showing DEMO grid: " + str(ex)
    demo = ST["warn"].startswith("Showing DEMO")
    try:
        if not demo and grid is None:
            grid = elevation_grid()
            CACHE.parent.mkdir(exist_ok=True)
            CACHE.write_bytes(pickle.dumps(dict(E=E, F=F, NODE=NODE, grid=grid, saved=time.strftime("%Y-%m-%d %H:%M"))))
        zf = (lambda a, b: 1300 + (a - CENTER[0]) * 3000 + 6 * math.sin(b * 900)) if demo else interp(grid)
    except Exception as ex: zf = None; ST["warn"] += f" Terrain unavailable: {ex}"
    load_csv()
    score(zf)
    px = lambda e, f: math.hypot((e["c"][0][0] - f["lat"]) * 111320, (e["c"][0][1] - f["lon"]) * 111320 * .88) < 250
    for i, e in enumerate(E):
        e["id"] = i; e["px"] = sum((2 if f["t"] == "hospital" else 1) * px(e, f) for f in F if f.get("in_area", True)); G.add_edge(e["u"], e["v"], i=i)
    for f in F: snap(f)


def status(f):  # is this shelter itself usable right now? (an earthquake open space on a riverbank is not a flood shelter)
    rs = [risk(E[i]) for i in f.get("near", [])]; rs = [r for r in rs if r is not None]
    mx = float(np.percentile(rs, 75)) if rs else None; k = cls(mx); wet = rf()
    if not f.get("in_area", True): return dict(st="outside", why="Outside the mapped road network", risk=mx, cls=k)
    if k >= 3: return dict(st="unsafe", why=f"Roads around it are {CN[k].lower()} flood risk", risk=mx, cls=k)
    if f.get("fp") and wet >= .5: return dict(st="unsafe", why="Riverbank site: not usable in heavy rain", risk=mx, cls=k)
    if k == 2 or (f.get("fp") and wet >= .25): return dict(st="watch", why="Riverbank site: check before sending people" if f.get("fp") else "Moderate risk around it", risk=mx, cls=k)
    if k < 0: return dict(st="watch", why="No road data around it: verify before sending people", risk=mx, cls=k)
    return dict(st="safe", why="Low flood risk around it" if k >= 0 else "No terrain data nearby", risk=mx, cls=k)


from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(_):
    build(); yield


app = FastAPI(title="FloodSafe Nepal", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def why(e):
    r = risk(e)
    if r is None: return []
    parts = [("Low elevation", W["el"] * e["f"]["el"], f'{e["z"]:.0f} m'), ("Basin depth", W["bs"] * e["f"]["bs"], f'{max(0, e["bs"]):.1f} m below surroundings'),
             ("Creek distance", W["rv"] * e["f"]["rv"], "no waterway found" if e["rv"] is None else f'{e["rv"]:.0f} m'), ("Built-up density", W["lu"] * e["f"]["lu"], "")]
    t = sum(p[1] for p in parts) or 1
    return [dict(label=a, pct=round(100 * b / t), value=c) for a, b, c in sorted(parts, key=lambda p: -p[1])]


@app.get("/api/city")
def city():
    return dict(city=CITY, center=CENTER, edges=len(E), facilities=len(F), warn=ST["warn"], rain={k: ST[k] for k in ("I", "A", "ts", "src")}, weights=W)


def fac_json(i, f):
    d = dict(id=i, **{k: f[k] for k in ("n", "lat", "lon", "t", "src")}, cap=f.get("cap"), area=f.get("area"), kind=f.get("kind", f["t"]),
             flood_prone=f.get("fp", False), municipality=f.get("mun", ""), in_area=f.get("in_area", True))
    if f["t"] == "shelter":
        s = status(f); d.update(status=s["st"], why=s["why"], risk=None if s["risk"] is None else round(s["risk"], 3), label=CN[s["cls"]] if s["cls"] >= 0 else "No data")
    return d


@app.get("/api/facilities")  # hospitals + shelters; shelters carry a live status: safe / watch / unsafe / outside
def facilities(): return [fac_json(i, f) for i, f in enumerate(F)]


@app.get("/api/shelters")
def shelters():
    L = [fac_json(i, f) for i, f in enumerate(F) if f["t"] == "shelter"]
    cnt = {k: sum(s["status"] == k for s in L) for k in ("safe", "watch", "unsafe", "outside")}
    return dict(counts=cnt, capacity_open=sum(s["cap"] or 0 for s in L if s["status"] in ("safe", "watch")), shelters=L)


class Import(BaseModel):
    csv: str; save: bool = True


@app.post("/api/shelters/import")  # "map import": paste/upload a CSV of camps (name,lat,lon[,capacity,...]) and they appear on the map
def import_shelters(b: Import):
    rows = parse_shelters(csv.DictReader(io.StringIO(b.csv.lstrip("﻿"))), "imported")
    if not rows: raise HTTPException(400, "No valid rows. Need a header with name,lat,lon (lat/lon in decimal degrees).")
    added = add_shelters(rows)
    for f in added: snap(f)
    if b.save:
        p = DATA / "shelters_imported.csv"; new = not p.exists()
        with p.open("a", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            if new: w.writerow(["name", "lat", "lon", "type", "capacity", "source", "area_m2", "flood_prone", "municipality"])
            for s in added: w.writerow([s["n"], s["lat"], s["lon"], s["kind"], s["cap"] or "", s["src"], s["area"] or "", "yes" if s["fp"] else "no", s["mun"]])
    return dict(added=len(added), outside_area=sum(not s["in_area"] for s in added), skipped=len(rows) - len(added))


@app.get("/api/risk")  # features 1, 2, 7: road-level risk as GeoJSON for the map
def risk_map():
    out = []
    for e in E:
        r = risk(e); k = cls(r)
        out.append(dict(type="Feature", geometry=dict(type="LineString", coordinates=[(x, y) for y, x in e["c"]]),
                        properties=dict(id=e["id"], name=e["nm"] or e["hw"], hw=e["hw"], risk=None if r is None else round(r, 3), cls=k, label=CN[k] if k >= 0 else "No data",
                                        closed=e["id"] in ST["closed"], tunnel=e["tun"], why=why(e))))
    return dict(type="FeatureCollection", features=out)


class Rain(BaseModel):
    I: float = 0; A: float = 0; ts: str = ""; src: str = "manual"


@app.post("/api/rain")  # feature 8: rainfall slider / replay frame
def set_rain(r: Rain): ST.update(I=r.I, A=r.A, ts=r.ts or "manual", src=r.src); return city()["rain"]


@app.get("/api/rain/live")  # live rainfall feed (Open-Meteo)
def rain_live():
    j = httpx.get("https://api.open-meteo.com/v1/forecast", params=dict(latitude=CENTER[0], longitude=CENTER[1], current="precipitation", hourly="precipitation", past_days=1, forecast_days=1, timezone="auto"), timeout=20).json()
    h, now = j["hourly"], j["current"]["time"]; i = max(k for k, t in enumerate(h["time"]) if t <= now)
    ST.update(I=j["current"].get("precipitation") or 0, A=sum(x or 0 for x in h["precipitation"][max(0, i - 23):i + 1]), ts=now, src="live")
    return city()["rain"]


@app.get("/api/rain/replay")  # real past storm from ERA5 (default: Kathmandu flood, 26-28 Sep 2024)
def rain_replay(start: str = "2024-09-26", end: str = "2024-09-29"):
    j = httpx.get("https://archive-api.open-meteo.com/v1/archive", params=dict(latitude=CENTER[0], longitude=CENTER[1], start_date=start, end_date=end, hourly="precipitation", timezone="Asia/Kathmandu"), timeout=30).json()
    return [dict(t=t.replace("T", " "), p=p or 0) for t, p in zip(j["hourly"]["time"], j["hourly"]["precipitation"])]


@app.post("/api/block/{i}")  # features 3, 11: click to close, click again to reopen
def block(i: int):
    if not 0 <= i < len(E): raise HTTPException(404)
    ST["closed"] ^= {i}; return dict(closed=sorted(ST["closed"]))


@app.post("/api/reset")
def reset(): ST["closed"].clear(); return dict(closed=[])


def cost(e, v, lam, rob):
    if e["id"] in ST["closed"]: return None
    r = rk(e, rob)
    if cls(r) >= v["bk"]: return None
    return e["len"] / 1000 / v["sp"] * 60 + lam * (.5 if r is None else r) * e["len"] / 1000 * 10  # time + lambda x risk


def stats(P, v, rob):
    d = t = sm = sl = hl = uk = mx = 0
    for a, b in zip(P, P[1:]):
        e = E[G[a][b]["i"]]; r = risk(e); d += e["len"]; t += e["len"] / 1000 / v["sp"] * 60
        if r is None: uk += e["len"]
        else: mx = max(mx, r); sm += r * e["len"]; sl += e["len"]; hl += e["len"] * (cls(r) >= 3)
    mean = sm / sl if sl else 0
    conf = 1 - (.5 * clip((mx - .3) / .5) + .3 * clip((mean - .15) / .4) + .2 * min(1, uk / (d or 1) * 4)) + (.08 if rob else 0) - (0 if ST["src"] == "live" else .05)
    reasons = [f"Riskiest road on route: {CN[cls(mx)]} ({mx:.2f})", f"Rain data: {ST['src']}" + ("" if ST["src"] == "live" else " (not live)"),
               "Holds up when rain is 20% lower or 30% higher" if rob else "Not tested against other rain scenarios"] + ([f"{uk:.0f} m without terrain data, treated as moderate"] if uk else [])
    return dict(distance_m=round(d), time_min=round(t, 1), avg_risk=round(mean, 3), max_risk=round(mx, 3), high_risk_m=round(hl),
                confidence="High" if conf >= .6 else "Medium" if conf >= .4 else "Low", confidence_score=round(conf, 2), reasons=reasons)


@app.get("/api/route")  # features 4, 9, 10, 12, 14, plus shelter/hospital routing and ambulance mode
def route(lat: float, lon: float, to: str = "hospital", vehicle: str = "ambulance", lam: float = 1, robust: bool = False):
    if vehicle not in V: raise HTTPException(400, "vehicle must be one of " + ", ".join(V))
    v, s = V[vehicle], nearest(lat, lon)
    if to not in ("hospital", "shelter") and not (to.isdigit() and int(to) < len(F)): raise HTTPException(404, "Unknown destination")
    T = [f for f in F if f["t"] == to and f.get("in_area", True)] if to in ("hospital", "shelter") else [F[int(to)]]
    bad = []
    if to == "shelter":  # nearest SAFE shelter: shelters that are flooding themselves are skipped, and we say which
        bad = [f for f in T if status(f)["st"] == "unsafe"]; T = [f for f in T if status(f)["st"] != "unsafe"]
    if not T: return dict(found=False, message="No usable shelter in the mapped area right now." if to == "shelter" else "No such facility in the mapped area: add rows to data/shelters.csv")
    D = {}

    def run(l, keep=False):
        d, p = nx.single_source_dijkstra(G, s, weight=lambda a, b, dd: cost(E[dd["i"]], v, l, robust))
        if keep: D.update(d=d, p=p)
        pen = lambda f: 5 if to == "shelter" and status(f)["st"] == "watch" else 0  # "check first" shelters count as 5 min further
        ok = [(d[f["k"]] + pen(f), f) for f in T if f["k"] in d]
        des = [x for x in ok if x[1]["src"] != "osm"] if to == "shelter" else []
        ok = des or ok
        if not ok: return None
        f = min(ok, key=lambda x: x[0])[1]; return p[f["k"]], f
    m = run(lam * v["lam"], keep=True)
    if not m: return dict(found=False, message="No passable route for this vehicle. Try another vehicle, reopen a road, or lower risk avoidance.")
    P, f = m; fast = run(0); S1 = stats(P, v, robust); S0 = stats(fast[0], v, robust) if fast else None
    alts, skipped = [], []
    if to == "shelter":
        d, p = D["d"], D["p"]
        for g in sorted((g for g in T if g["k"] in d and g is not f), key=lambda g: d[g["k"]])[:3]:
            st = stats(p[g["k"]], v, robust); alts.append(dict(id=F.index(g), n=g["n"], cap=g.get("cap"), time_min=st["time_min"], distance_m=st["distance_m"], status=status(g)["st"]))
        # unsafe shelters that are closer by straight line than the one we chose: the demo moment
        dch = meters(lat, lon, f["lat"], f["lon"])
        skipped = [dict(n=g["n"], why=status(g)["why"], distance_m=round(meters(lat, lon, g["lat"], g["lon"]))) for g in sorted(bad, key=lambda g: meters(lat, lon, g["lat"], g["lon"])) if meters(lat, lon, g["lat"], g["lon"]) < dch][:3]
    coords = []
    for a, b in zip(P, P[1:]):
        e = E[G[a][b]["i"]]; c = e["c"] if e["u"] == a else e["c"][::-1]; coords += [(x, y) for y, x in c]
    sig = [list(NODE[n]) for n in P[1:-1] if G.degree(n) >= 3 and any(IMP.get(E[G[n][q]["i"]]["hw"], 0) >= 4 for q in G[n])] if vehicle == "ambulance" else []
    dst = dict(id=F.index(f), n=f["n"], lat=f["lat"], lon=f["lon"], t=f["t"], cap=f.get("cap"), src=f["src"])
    if f["t"] == "shelter": dst.update(status=status(f)["st"], why=status(f)["why"])
    return dict(found=True, destination=dst, geometry=coords, metrics=S1, same_as_fastest=bool(fast and fast[0] == P), alternatives=alts, skipped_shelters=skipped,
                vs_fastest=None if not S0 else dict(extra_min=round(S1["time_min"] - S0["time_min"], 1), high_risk_m_avoided=S0["high_risk_m"] - S1["high_risk_m"]), signal_priority_junctions=sig)


@app.get("/api/chokepoints")  # municipal chokepoint report (Heavy design storm, rain loading fixed at 0.8)
def chokepoints(limit: int = 10):
    best = {}
    for e in E:
        r = risk(e, fix=.8)
        if r is None: continue
        k = (e["nm"] or "Unnamed " + e["hw"]) + (" (underpass)" if e["tun"] else ""); sc = r * IMP.get(e["hw"], 1) * (1 + e["px"])
        if k not in best or best[k]["score"] < sc: best[k] = dict(street=k, risk_class=CN[cls(r)], risk=round(r, 3), road_class=e["hw"], facility_proximity=e["px"], score=round(sc, 3), edge=e["id"])
    return sorted(best.values(), key=lambda x: -x["score"])[:limit]


@app.get("/api/alerts")  # ALERT mode: roads likely to flood within 30 min
def alerts():
    soon = sorted((e for e in E if e["id"] not in ST["closed"] and risk(e) is not None and cls(risk(e)) < 3 <= cls(risk(e, 1, ST["I"] * .5))), key=lambda e: -risk(e, 1, ST["I"] * .5))
    names = ", ".join(dict.fromkeys(e["nm"] or e["hw"] for e in soon[:3])) or "none"
    return dict(likely_soon=len(soon), roads=[e["id"] for e in soon[:50]],
                message=f"Flood alert: rain {ST['I']:.0f} mm/h. {len(soon)} roads may flood within 30 min. Avoid: {names}. Open FloodSafe for a safer route. Follow official instructions.")
