import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Dashboard.css";
import {
  CENTER, CLASSES, NODATA, VEHICLES, PRESETS, RIVER_LINE,
  buildNetwork, buildFacilities, nearestNode, route, confidence,
  edgeRisk, riskClass, edgeClassInfo, isLikelySoon, explainEdge,
  chokepoints, demoReplay, rainfallLoading,
} from "./FloodEngine";

const net = buildNetwork();
const facilities = buildFacilities(net);
const replay = demoReplay();
const fmtKm = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const fmtMin = (t) => `${t.toFixed(1)} min`;

export default function Dashboard() {
  const [mode, setMode] = useState("respond");
  const [source, setSource] = useState("manual");
  const [manual, setManual] = useState({ intensity: 25, rain24: 110 });
  const [live, setLive] = useState({ status: "idle", intensity: 0, rain24: 0, at: null });
  const [frame, setFrame] = useState(26);
  const [playing, setPlaying] = useState(false);
  const [start, setStart] = useState(net.nodes[2 * 16 + 1].id);
  const [dest, setDest] = useState("hospital");
  const [vehicle, setVehicle] = useState("ambulance");
  const [lam, setLam] = useState(3);
  const [robust, setRobust] = useState(true);
  const [closed, setClosed] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [showFastest, setShowFastest] = useState(true);
  const [copied, setCopied] = useState(false);
  const calcMs = useRef(0);

  // ---- rain input ----
  const rain = source === "live" ? live : source === "replay" ? replay[frame] : manual;
  const { intensity, rain24 } = rain;
  const isLive = source === "live" && live.status === "ok";

  const fetchLive = useCallback(async () => {
    setLive((l) => ({ ...l, status: "loading" }));
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${CENTER[0]}&longitude=${CENTER[1]}&current=precipitation&hourly=precipitation&past_days=1&forecast_days=1&timezone=auto`;
      const d = await (await fetch(url)).json();
      const now = new Date(d.current.time).getTime();
      const past = d.hourly.time
        .map((t, i) => ({ t: new Date(t).getTime(), p: d.hourly.precipitation[i] ?? 0 }))
        .filter((x) => x.t <= now && x.t > now - 24 * 3600e3);
      setLive({
        status: "ok",
        intensity: d.current.precipitation ?? 0,
        rain24: Math.round(past.reduce((s, x) => s + x.p, 0) * 10) / 10,
        at: d.current.time,
      });
    } catch {
      setLive((l) => ({ ...l, status: "error" }));
    }
  }, []);
  useEffect(() => { if (source === "live" && live.status === "idle") fetchLive(); }, [source, live.status, fetchLive]);

  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => setFrame((f) => {
      if (f >= replay.length - 1) { setPlaying(false); return f; }
      return f + 1;
    }), 450);
    return () => clearInterval(t);
  }, [playing]);

  // ---- risk per edge ----
  const risks = useMemo(() => net.edges.map((e) => edgeRisk(e.S, intensity, rain24)), [intensity, rain24]);
  const stats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    risks.forEach((r, i) => { if (net.edges[i].S == null) counts[5]++; else counts[riskClass(r)]++; });
    return { counts, high: counts[3] + counts[4] };
  }, [risks]);
  const alerts = useMemo(
    () => net.edges.filter((e) => !closed.has(e.id) && isLikelySoon(e.S, intensity, rain24)),
    [intensity, rain24, closed],
  );
  const chokes = useMemo(() => chokepoints(net, intensity, rain24), [intensity, rain24]);

  // ---- routes ----
  const targets = useMemo(() => {
    if (dest === "hospital" || dest === "shelter") return facilities.filter((f) => f.type === dest).map((f) => f.node);
    const f = facilities.find((x) => x.id === dest);
    return f ? [f.node] : [];
  }, [dest]);

  const { safe, fastest } = useMemo(() => {
    const t0 = performance.now();
    const base = { start, targets, vehicle, closed, intensity, rain24 };
    const s = route(net, { ...base, lam, robust });
    const f = route(net, { ...base, lam: 0, robust: false, ignoreRisk: true });
    calcMs.current = performance.now() - t0;
    return { safe: s, fastest: f };
  }, [start, targets, vehicle, closed, intensity, rain24, lam, robust]);

  const conf = useMemo(() => confidence(safe, { robust, live: isLive }), [safe, robust, isLive]);
  const destFacility = safe ? facilities.find((f) => f.node === safe.target) : null;
  const avoided = safe && fastest ? Math.max(0, fastest.highMeters - safe.highMeters) : 0;

  const toggleClosed = useCallback((id) => {
    setClosed((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  // ---- Leaflet map ----
  const mapEl = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const handlers = useRef({});
  handlers.current = { toggleClosed, setSelected, setStart };

  useEffect(() => {
    if (map.current || !mapEl.current) return undefined;
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: true, zoomSnap: 0.25 }).setView(CENTER, 14);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(m);
    L.polyline(RIVER_LINE, { color: "#38bdf8", weight: 9, opacity: 0.22, interactive: false }).addTo(m);
    L.polyline(RIVER_LINE, { color: "#7dd3fc", weight: 2, opacity: 0.7, dashArray: "2 6", interactive: false }).addTo(m);
    layers.current = {
      roads: L.layerGroup().addTo(m),
      routes: L.layerGroup().addTo(m),
      marks: L.layerGroup().addTo(m),
    };
    m.on("click", (ev) => handlers.current.setStart(nearestNode(net, [ev.latlng.lat, ev.latlng.lng])));
    const bounds = L.latLngBounds(net.nodes.map((n) => n.pos));
    m.fitBounds(bounds, { padding: [20, 20] });
    map.current = m;
    let first = true;
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      if (first) { m.fitBounds(bounds, { padding: [30, 30] }); first = false; }
    });
    ro.observe(mapEl.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  // roads
  useEffect(() => {
    const g = layers.current.roads;
    if (!g) return;
    g.clearLayers();
    const alertIds = new Set(alerts.map((e) => e.id));
    net.edges.forEach((e, i) => {
      const isClosed = closed.has(e.id);
      const info = edgeClassInfo(e, risks[i]);
      const line = L.polyline(e.coords, {
        color: isClosed ? "#0b0f19" : info.color,
        weight: e.primary ? 6 : 4,
        opacity: isClosed ? 0.95 : 0.85,
        dashArray: isClosed ? "4 6" : mode === "alert" && alertIds.has(e.id) ? "1 8" : null,
        lineCap: "round",
        className: mode === "alert" && alertIds.has(e.id) ? "dash-road-pulse" : "",
      });
      if (isClosed) L.polyline(e.coords, { color: "#ef4444", weight: 2, opacity: 0.9, interactive: false }).addTo(g);
      line.bindTooltip(`${e.name} · ${isClosed ? "CLOSED" : info.label}`, { sticky: true, className: "dash-tip" });
      line.on("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        handlers.current.toggleClosed(e.id);
        handlers.current.setSelected(e.id);
      });
      line.addTo(g);
    });
  }, [risks, closed, alerts, mode]);

  // routes + markers
  useEffect(() => {
    const g = layers.current.routes, mk = layers.current.marks;
    if (!g || !mk) return;
    g.clearLayers(); mk.clearLayers();
    if (fastest && showFastest)
      L.polyline(fastest.coords, { color: "#ff8a3d", weight: 4, opacity: 0.95, dashArray: "8 8", interactive: false }).addTo(g);
    if (safe) {
      L.polyline(safe.coords, { color: "#22d3ee", weight: 16, opacity: 0.18, interactive: false }).addTo(g);
      L.polyline(safe.coords, { color: "#22d3ee", weight: 5, opacity: 1, interactive: false, className: "dash-route-flow" }).addTo(g);
    }
    facilities.forEach((f) => {
      const active = safe && safe.target === f.node;
      L.marker(f.pos, {
        icon: L.divIcon({
          className: "",
          html: `<div class="dash-pin dash-pin--${f.type}${active ? " is-active" : ""}">${f.type === "hospital" ? "H" : "S"}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        }),
      }).bindTooltip(`${f.name}${f.capacity ? ` · cap ${f.capacity}` : ""}`, { className: "dash-tip" }).addTo(mk);
    });
    L.marker(net.nodes[start].pos, {
      icon: L.divIcon({ className: "", html: `<div class="dash-start"><span></span></div>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
      interactive: false,
    }).addTo(mk);
  }, [safe, fastest, showFastest, start]);

  // ---- helpers ----
  const sel = selected ? net.edges.find((e) => e.id === selected) : null;
  const selIdx = sel ? net.edges.indexOf(sel) : -1;
  const alertText = `FLOOD ALERT (FloodSafe demo) — Rain ${intensity} mm/h, ${rain24} mm in 24 h. ${alerts.length} road(s) likely to reach HIGH risk within 30 min: ${alerts.slice(0, 6).map((e) => e.name).join(", ") || "none"}. ${closed.size} road(s) closed. Avoid low-lying roads near the river. Decision support only.`;

  const downloadCsv = () => {
    const rows = [["rank", "road_id", "name", "risk", "class", "static_susceptibility", "river_distance_m"]];
    chokes.forEach((c, i) => rows.push([i + 1, c.e.id, c.e.name, c.risk.toFixed(3), edgeClassInfo(c.e, c.risk).label, c.e.S == null ? "no data" : c.e.S.toFixed(3), c.e.factors.creekM]));
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "floodsafe_chokepoints.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sourceLabel = source === "live"
    ? live.status === "ok" ? "Live · Open-Meteo" : live.status === "loading" ? "Live · loading…" : live.status === "error" ? "Live feed failed" : "Live"
    : source === "replay" ? "Storm replay (illustrative)" : "Manual scenario";

  return (
    <div className="dash">
      {/* ---------- Top bar ---------- */}
      <header className="dash-top">
        <div className="dash-brand">
          <div className="dash-logo">≈</div>
          <div>
            <div className="dash-brand-name">FloodSafe</div>
            <div className="dash-brand-sub">Flood Risk & Safe-Route Control Centre · Kathmandu</div>
          </div>
        </div>
        <nav className="dash-modes">
          {[["plan", "Plan"], ["alert", "Alert"], ["respond", "Respond"]].map(([k, l]) => (
            <button key={k} className={`dash-mode${mode === k ? " is-on" : ""} dash-mode--${k}`} onClick={() => setMode(k)}>{l}</button>
          ))}
        </nav>
        <div className="dash-top-right">
          <span className={`dash-chip${isLive ? " is-live" : ""}`}><i />{sourceLabel}</span>
          <span className="dash-chip dash-chip--warn">Demo network</span>
        </div>
      </header>

      {/* ---------- KPI cards ---------- */}
      <section className="dash-kpis">
        <Kpi icon="☔" label="Rain now" value={intensity} unit="mm/h" sub={`Loading ${(rainfallLoading(intensity, rain24) * 100).toFixed(0)}%`} tone="cyan" />
        <Kpi icon="🌧" label="Rain last 24 h" value={rain24} unit="mm" sub={sourceLabel} tone="blue" />
        <Kpi icon="⚠" label="High-risk roads" value={stats.high} unit={`/ ${net.edges.length}`} sub={`${alerts.length} likely within 30 min`} tone="orange" />
        <Kpi icon="⛔" label="Closed roads" value={closed.size} unit="roads" sub="Click a road to close" tone="red" />
        <Kpi icon="➜" label="Safe route time" value={safe ? safe.time.toFixed(1) : "—"} unit="min" sub={`Confidence: ${conf.label}`} tone={conf.level} />
      </section>

      <main className="dash-grid">
        {/* ---------- Left panel ---------- */}
        <aside className="dash-panel dash-left">
          <Card title="Rainfall input" tag="D8">
            <div className="dash-seg">
              {[["live", "Live"], ["replay", "Replay"], ["manual", "Manual"]].map(([k, l]) => (
                <button key={k} className={source === k ? "is-on" : ""} onClick={() => { setSource(k); setPlaying(false); }}>{l}</button>
              ))}
            </div>
            {source === "live" && (
              <div className="dash-block">
                <p className="dash-note">
                  {live.status === "ok" && <>Open-Meteo at {live.at?.replace("T", " ")}. A dry day reading 0 mm is the correct answer.</>}
                  {live.status === "loading" && "Fetching live Kathmandu rainfall…"}
                  {live.status === "error" && "Could not reach Open-Meteo. Use Replay or Manual."}
                </p>
                <button className="dash-btn dash-btn--ghost" onClick={fetchLive}>↻ Refresh live rain</button>
              </div>
            )}
            {source === "replay" && (
              <div className="dash-block">
                <div className="dash-replay">
                  <button className="dash-play" onClick={() => { if (frame >= replay.length - 1) setFrame(0); setPlaying((p) => !p); }}>{playing ? "❚❚" : "▶"}</button>
                  <input type="range" min="0" max={replay.length - 1} value={frame} onChange={(e) => { setPlaying(false); setFrame(+e.target.value); }} />
                  <span className="dash-mono">H{String(frame).padStart(2, "0")}</span>
                </div>
                <div className="dash-spark">
                  {replay.map((f, i) => (
                    <i key={i} style={{ height: `${Math.max(3, (f.intensity / 45) * 100)}%` }} className={i === frame ? "is-now" : i < frame ? "is-past" : ""} />
                  ))}
                </div>
                <p className="dash-note">Illustrative storm curve, not real data. Swap in the ERA5 replay of Sep 2024 from <code>/api/rain/replay</code>.</p>
              </div>
            )}
            {source === "manual" && (
              <div className="dash-block">
                <div className="dash-presets">
                  {Object.entries(PRESETS).map(([k, p]) => (
                    <button key={k} className={manual.intensity === p.intensity && manual.rain24 === p.rain24 ? "is-on" : ""} onClick={() => setManual({ intensity: p.intensity, rain24: p.rain24 })}>{p.label}</button>
                  ))}
                </div>
                <Slider label="Intensity" unit="mm/h" min={0} max={60} value={manual.intensity} onChange={(v) => setManual((m) => ({ ...m, intensity: v }))} />
                <Slider label="Rain in 24 h" unit="mm" min={0} max={250} value={manual.rain24} onChange={(v) => setManual((m) => ({ ...m, rain24: v }))} />
              </div>
            )}
          </Card>

          <Card title="Route planner" tag="D5">
            <p className="dash-note">Click the map to set the start point.</p>
            <label className="dash-label">Destination</label>
            <select className="dash-select" value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="hospital">Nearest hospital</option>
              <option value="shelter">Nearest shelter</option>
              <optgroup label="Hospitals">
                {facilities.filter((f) => f.type === "hospital").map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>
              <optgroup label="Shelters">
                {facilities.filter((f) => f.type === "shelter").map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>
            </select>
            <label className="dash-label">Vehicle</label>
            <div className="dash-vehicles">
              {Object.entries(VEHICLES).map(([k, v]) => (
                <button key={k} className={vehicle === k ? "is-on" : ""} onClick={() => setVehicle(k)}>
                  <span>{v.icon}</span>{v.label}
                </button>
              ))}
            </div>
            <p className="dash-note">Blocked from <b>{CLASSES[VEHICLES[vehicle].blockedFrom].label}</b> risk roads (placeholder rule){VEHICLES[vehicle].signalPriority ? " · signal priority on main roads" : ""}.</p>
            <Slider label="Avoid risk (λ)" unit="" min={0} max={10} step={0.5} value={lam} onChange={setLam} />
            <label className="dash-toggle">
              <input type="checkbox" checked={robust} onChange={(e) => setRobust(e.target.checked)} />
              <span />Plan for worse rain than forecast
            </label>
            <label className="dash-toggle">
              <input type="checkbox" checked={showFastest} onChange={(e) => setShowFastest(e.target.checked)} />
              <span />Show fastest route for comparison
            </label>
            <button className="dash-btn dash-btn--ghost" onClick={() => { setClosed(new Set()); setSelected(null); }} disabled={!closed.size}>Reopen all roads ({closed.size})</button>
          </Card>
        </aside>

        {/* ---------- Map ---------- */}
        <section className="dash-mapwrap">
          <div ref={mapEl} className="dash-map" />
          <div className="dash-map-title">
            <span className={`dash-dot dash-dot--${mode}`} />{mode.toUpperCase()} MODE
            <em>{mode === "plan" ? "Pre-monsoon risk map" : mode === "alert" ? "Roads likely to flood in 30 min pulse" : "Click roads to close / reopen"}</em>
          </div>
          <div className="dash-legend">
            <div className="dash-legend-row">
              {[...CLASSES, NODATA].map((c) => <span key={c.key}><i style={{ background: c.color }} />{c.label}</span>)}
            </div>
            <div className="dash-legend-row">
              <span><i className="lg-safe" />Safe route</span>
              <span><i className="lg-fast" />Fastest route</span>
              <span><i className="lg-closed" />Closed</span>
              <span><i className="lg-river" />River</span>
            </div>
          </div>
          <div className="dash-map-calc dash-mono">Recalculated in {calcMs.current.toFixed(1)} ms</div>
        </section>

        {/* ---------- Right panel ---------- */}
        <aside className="dash-panel dash-right">
          {mode === "respond" && (
            <>
              <Card title="Safe vs fastest" tag={VEHICLES[vehicle].label}>
                {safe ? (
                  <>
                    <div className="dash-dest">→ {destFacility?.name}</div>
                    <table className="dash-compare">
                      <thead><tr><th /><th className="c-safe">Safe</th><th className="c-fast">Fastest</th></tr></thead>
                      <tbody>
                        <tr><td>Distance</td><td>{fmtKm(safe.distance)}</td><td>{fastest ? fmtKm(fastest.distance) : "—"}</td></tr>
                        <tr><td>Time</td><td>{fmtMin(safe.time)}</td><td>{fastest ? fmtMin(fastest.time) : "—"}</td></tr>
                        <tr><td>Avg risk</td><td>{safe.avgRisk.toFixed(2)}</td><td>{fastest ? fastest.avgRisk.toFixed(2) : "—"}</td></tr>
                        <tr><td>Max risk</td><td>{CLASSES[riskClass(safe.maxRisk)].label}</td><td>{fastest ? CLASSES[riskClass(fastest.maxRisk)].label : "—"}</td></tr>
                        <tr><td>High-risk road</td><td>{fmtKm(safe.highMeters)}</td><td>{fastest ? fmtKm(fastest.highMeters) : "—"}</td></tr>
                      </tbody>
                    </table>
                    <div className="dash-impact">
                      <div><b>{fmtKm(avoided)}</b><span>high-risk road avoided</span></div>
                      <div><b>+{fastest ? Math.max(0, safe.time - fastest.time).toFixed(1) : "0"}</b><span>extra min vs fastest</span></div>
                    </div>
                  </>
                ) : (
                  <p className="dash-empty">No passable route for a {VEHICLES[vehicle].label.toLowerCase()}. Reopen roads, lower the rain or pick another vehicle.</p>
                )}
              </Card>
              <Card title="Route confidence" tag={conf.label}>
                <div className={`dash-conf dash-conf--${conf.level}`}>
                  <div className="dash-conf-ring" style={{ "--p": `${conf.score ?? 0}%` }}><span>{conf.score ?? 0}</span></div>
                  <ul>{conf.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                </div>
              </Card>
            </>
          )}

          {mode === "alert" && (
            <>
              <Card title="Likely to flood in 30 min" tag={`${alerts.length}`}>
                {alerts.length ? (
                  <ul className="dash-list">
                    {alerts.slice(0, 12).map((e) => {
                      const now = edgeRisk(e.S, intensity, rain24);
                      const later = edgeRisk(e.S, intensity, rain24 + intensity * 0.5);
                      return (
                        <li key={e.id} onClick={() => setSelected(e.id)}>
                          <span className="dash-mono">{e.id}</span>
                          <b>{e.name}</b>
                          <em><i style={{ background: CLASSES[riskClass(now)].color }} />→<i style={{ background: CLASSES[riskClass(later)].color }} /></em>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="dash-empty">No roads are about to cross into High risk at the current rain rate.</p>}
              </Card>
              <Card title="Alert message" tag="Copy">
                <p className="dash-alert-text">{alertText}</p>
                <button className="dash-btn dash-btn--gold" onClick={() => { navigator.clipboard?.writeText(alertText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy alert text"}</button>
              </Card>
            </>
          )}

          {mode === "plan" && (
            <>
              <Card title="Roads by risk class" tag={`${net.edges.length} roads`}>
                <div className="dash-bars">
                  {[...CLASSES, NODATA].map((c, i) => (
                    <div key={c.key} className="dash-bar">
                      <span>{c.label}</span>
                      <div><i style={{ width: `${(stats.counts[i] / net.edges.length) * 100}%`, background: c.color }} /></div>
                      <b className="dash-mono">{stats.counts[i]}</b>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Municipal chokepoints" tag="Top 10">
                <ol className="dash-rank">
                  {chokes.map((c) => (
                    <li key={c.e.id} onClick={() => setSelected(c.e.id)}>
                      <i style={{ background: edgeClassInfo(c.e, c.risk).color }} />
                      <b>{c.e.name}</b>
                      <span className="dash-mono">{c.risk.toFixed(2)}</span>
                    </li>
                  ))}
                </ol>
                <button className="dash-btn dash-btn--ghost" onClick={downloadCsv}>⬇ Download CSV</button>
              </Card>
            </>
          )}

          <Card title="Road details" tag={sel ? sel.id : "—"}>
            {sel ? (
              <div className="dash-road">
                <div className="dash-road-head">
                  <b>{sel.name}</b>
                  <span className="dash-pill" style={{ background: edgeClassInfo(sel, risks[selIdx]).color }}>
                    {closed.has(sel.id) ? "Closed" : edgeClassInfo(sel, risks[selIdx]).label}
                  </span>
                </div>
                <div className="dash-road-meta dash-mono">risk {risks[selIdx].toFixed(2)} · {fmtKm(sel.length)}</div>
                <ul>{explainEdge(sel, intensity, rain24).map((x) => <li key={x}>{x}</li>)}</ul>
                <button className="dash-btn dash-btn--ghost" onClick={() => toggleClosed(sel.id)}>{closed.has(sel.id) ? "Reopen road" : "Close road"}</button>
              </div>
            ) : <p className="dash-empty">Click any road on the map to see why it has its risk level.</p>}
          </Card>
        </aside>
      </main>

      {/* ---------- Limitations strip ---------- */}
      <footer className="dash-limits">
        <b>Limitations</b>
        <span>Decision support, not a safety guarantee</span>
        <span>Demo road grid, hospitals and shelters</span>
        <span>Risk weights are reference values, to be validated for Nepal</span>
        <span>Vehicle limits are placeholders</span>
        <span>No accuracy claim without ground-truth data</span>
      </footer>
    </div>
  );
}

function Card({ title, tag, children }) {
  return (
    <div className="dash-card">
      <div className="dash-card-head"><h3>{title}</h3>{tag != null && <span>{tag}</span>}</div>
      {children}
    </div>
  );
}

function Kpi({ icon, label, value, unit, sub, tone }) {
  return (
    <div className={`dash-kpi dash-kpi--${tone}`}>
      <div className="dash-kpi-icon">{icon}</div>
      <div>
        <div className="dash-kpi-label">{label}</div>
        <div className="dash-kpi-value">{value}<small>{unit}</small></div>
        <div className="dash-kpi-sub">{sub}</div>
      </div>
    </div>
  );
}

function Slider({ label, unit, min, max, step = 1, value, onChange }) {
  return (
    <div className="dash-slider">
      <div><span>{label}</span><b className="dash-mono">{value}{unit && ` ${unit}`}</b></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}