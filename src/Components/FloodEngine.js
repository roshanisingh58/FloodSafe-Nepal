// FloodSafe risk + routing engine (front-end demo version).
// Formulas follow the PS103 Team Alignment Report, Section 5.
// All network / facility / replay data here is DEMO data, not real measurements.

export const CENTER = [27.7045, 85.322]; // Kathmandu (code default, D2)
export const CLASS_THRESHOLDS = [0.2, 0.4, 0.6, 0.8];
export const CLASSES = [
  { key: "vlow", label: "Very low", color: "#22c55e" },
  { key: "low", label: "Low", color: "#a3e635" },
  { key: "mod", label: "Moderate", color: "#facc15" },
  { key: "high", label: "High", color: "#fb923c" },
  { key: "vhigh", label: "Very high", color: "#ef4444" },
];
export const NODATA = { key: "nodata", label: "No data", color: "#7c8798" };
export const NODATA_RISK = 0.5; // D7: no data counts as moderate, never safe

// Vehicle rules use risk-class limits (D6). PLACEHOLDERS, not flood-depth numbers.
export const VEHICLES = {
  ambulance: { label: "Ambulance", icon: "🚑", kmh: 45, blockedFrom: 4, signalPriority: true },
  car: { label: "Car", icon: "🚗", kmh: 32, blockedFrom: 4 },
  bike: { label: "Bike", icon: "🏍️", kmh: 18, blockedFrom: 3 },
  walk: { label: "Walk", icon: "🚶", kmh: 5, blockedFrom: 3 },
};

export const PRESETS = {
  dry: { label: "Dry", intensity: 0, rain24: 0 },
  moderate: { label: "Moderate", intensity: 8, rain24: 40 },
  heavy: { label: "Heavy", intensity: 25, rain24: 110 },
  extreme: { label: "Extreme", intensity: 45, rain24: 200 },
};

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function rainfallLoading(intensity, rain24) {
  return clamp01(0.65 * (intensity / 40) + 0.35 * (rain24 / 150));
}

export function edgeRisk(S, intensity, rain24) {
  if (S == null) return NODATA_RISK;
  return clamp01(S * (0.12 + 0.88 * rainfallLoading(intensity, rain24)));
}

export function riskClass(risk) {
  let i = 0;
  while (i < CLASS_THRESHOLDS.length && risk >= CLASS_THRESHOLDS[i]) i++;
  return i; // 0..4
}

export function edgeClassInfo(edge, risk) {
  return edge.S == null ? NODATA : CLASSES[riskClass(risk)];
}

// Robust routing: worst case of rain -20%, 0, +30%
export function robustRisk(S, intensity, rain24) {
  return Math.max(
    ...[0.8, 1, 1.3].map((f) => edgeRisk(S, intensity * f, rain24 * f)),
  );
}

// "Likely soon": below High now, High or above after 30 more minutes at current intensity
export function isLikelySoon(S, intensity, rain24) {
  if (S == null) return false;
  const now = riskClass(edgeRisk(S, intensity, rain24));
  const later = riskClass(edgeRisk(S, intensity, rain24 + intensity * 0.5));
  return now < 3 && later >= 3;
}

// ---------- Demo network ----------
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const RIVER = [
  [27.6935, 85.282], [27.6975, 85.298], [27.6965, 85.312],
  [27.7005, 85.326], [27.6985, 85.341], [27.7025, 85.356], [27.705, 85.37],
];
export const RIVER_LINE = RIVER;

export function haversine(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function distToRiver(p) {
  let best = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i], b = RIVER[i + 1];
    const dx = b[1] - a[1], dy = b[0] - a[0];
    const t = clamp01(((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / (dx * dx + dy * dy));
    best = Math.min(best, haversine(p, [a[0] + t * dy, a[1] + t * dx]));
  }
  return best;
}

export function buildNetwork() {
  const rand = rng(103);
  const ROWS = 11, COLS = 16, dLat = 0.0034, dLon = 0.0042;
  const lat0 = CENTER[0] - (ROWS / 2) * dLat, lon0 = CENTER[1] - (COLS / 2) * dLon;
  const nodes = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      nodes.push({
        id: r * COLS + c, r, c,
        pos: [lat0 + r * dLat + (rand() - 0.5) * 0.0011, lon0 + c * dLon + (rand() - 0.5) * 0.0013],
      });

  const raw = [];
  const add = (a, b, primary) => raw.push({ a, b, primary });
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c;
      const rowMain = r % 4 === 1, colMain = c % 5 === 2;
      if (c < COLS - 1 && (rowMain || rand() > 0.12)) add(id, id + 1, rowMain);
      if (r < ROWS - 1 && (colMain || rand() > 0.12)) add(id, id + COLS, colMain);
      if (r < ROWS - 1 && c < COLS - 1 && rand() > 0.9) add(id, id + COLS + 1, false);
    }

  // static susceptibility factors
  const feats = raw.map((e) => {
    const A = nodes[e.a].pos, B = nodes[e.b].pos;
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const creek = distToRiver(mid);
    const elev = 1290 + creek * 0.06 + (mid[0] - CENTER[0]) * 4000 + rand() * 12; // synthetic metres
    const basin = rand() ** 2; // how far below surroundings (0..1)
    const built = 0.4 + rand() * 0.6;
    return { mid, creek, elev, basin, built };
  });
  const minE = Math.min(...feats.map((f) => f.elev)), maxE = Math.max(...feats.map((f) => f.elev));
  const rawS = feats.map((f) =>
    0.35 * (1 - (f.elev - minE) / (maxE - minE)) + 0.2 * f.basin +
    0.35 * Math.exp(-f.creek / 450) + 0.1 * f.built,
  );
  const minS = Math.min(...rawS), maxS = Math.max(...rawS);

  const edges = raw.map((e, i) => {
    const f = feats[i];
    const noData = rand() < 0.06;
    const A = nodes[e.a].pos, B = nodes[e.b].pos;
    return {
      id: `R${String(i + 1).padStart(3, "0")}`,
      a: e.a, b: e.b, primary: e.primary,
      name: e.primary ? `Main road ${String.fromCharCode(65 + (i % 26))}${(i % 9) + 1}` : `Lane ${i + 1}`,
      coords: [A, B],
      length: haversine(A, B),
      S: noData ? null : ((rawS[i] - minS) / (maxS - minS)) ** 0.6,
      factors: { creekM: Math.round(f.creek), elevM: Math.round(f.elev), basin: f.basin, built: f.built },
    };
  });

  const adj = nodes.map(() => []);
  edges.forEach((e, idx) => {
    adj[e.a].push({ to: e.b, idx });
    adj[e.b].push({ to: e.a, idx });
  });
  return { nodes, edges, adj };
}

export function buildFacilities(net) {
  const pick = (r, c) => net.nodes[r * 16 + c];
  const list = [
    { id: "H1", type: "hospital", name: "Demo General Hospital", n: pick(9, 3) },
    { id: "H2", type: "hospital", name: "Demo Teaching Hospital", n: pick(8, 12) },
    { id: "H3", type: "hospital", name: "Demo Trauma Centre", n: pick(1, 9) },
    { id: "S1", type: "shelter", name: "Demo School Shelter", n: pick(10, 7), capacity: 400 },
    { id: "S2", type: "shelter", name: "Demo Community Hall", n: pick(6, 14), capacity: 250 },
    { id: "S3", type: "shelter", name: "Demo Ward Office Ground", n: pick(2, 2), capacity: 600 },
    { id: "S4", type: "shelter", name: "Demo Temple Courtyard", n: pick(0, 13), capacity: 180 },
  ];
  return list.map((f) => ({ ...f, node: f.n.id, pos: f.n.pos, n: undefined }));
}

export function nearestNode(net, latlng) {
  let best = 0, bd = Infinity;
  net.nodes.forEach((n) => {
    const d = haversine(n.pos, latlng);
    if (d < bd) { bd = d; best = n.id; }
  });
  return best;
}

// ---------- Routing (Dijkstra, D5) ----------
export function route(net, opts) {
  const { start, targets, vehicle, lam, robust, closed, intensity, rain24, ignoreRisk } = opts;
  const V = VEHICLES[vehicle];
  const N = net.nodes.length;
  const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(null), done = new Array(N).fill(false);
  dist[start] = 0;
  const targetSet = new Set(targets);
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = true;
    if (targetSet.has(u)) break; // first settled target = cheapest
    for (const { to, idx } of net.adj[u]) {
      const e = net.edges[idx];
      if (closed.has(e.id)) continue;
      const r = robust ? robustRisk(e.S, intensity, rain24) : edgeRisk(e.S, intensity, rain24);
      if (!ignoreRisk && e.S != null && riskClass(r) >= V.blockedFrom) continue;
      const kmh = V.kmh * (e.primary ? 1 : 0.75) * (V.signalPriority && e.primary ? 1.15 : 1);
      const tMin = (e.length / 1000 / kmh) * 60;
      const cost = tMin + (ignoreRisk ? 0 : lam * r * (e.length / 100));
      if (dist[u] + cost < dist[to]) { dist[to] = dist[u] + cost; prev[to] = { node: u, idx, tMin }; }
    }
  }
  const reached = targets.filter((t) => dist[t] < Infinity).sort((a, b) => dist[a] - dist[b])[0];
  if (reached == null) return null;
  const path = [], seq = [reached];
  let cur = reached, time = 0;
  while (prev[cur]) { path.unshift(prev[cur].idx); time += prev[cur].tMin; cur = prev[cur].node; seq.unshift(cur); }
  return summarise(net, path, seq, time, reached, intensity, rain24);
}

function summarise(net, path, seq, time, target, intensity, rain24) {
  let len = 0, wRisk = 0, maxRisk = 0, high = 0, noData = 0;
  const coords = seq.map((n) => net.nodes[n].pos);
  path.forEach((idx) => {
    const e = net.edges[idx];
    const r = edgeRisk(e.S, intensity, rain24);
    len += e.length; wRisk += r * e.length; maxRisk = Math.max(maxRisk, r);
    if (e.S != null && riskClass(r) >= 3) high += e.length;
    if (e.S == null) noData += e.length;
  });
  return {
    edges: path, coords, target,
    distance: len, time, avgRisk: len ? wRisk / len : 0, maxRisk,
    highMeters: high, noDataShare: len ? noData / len : 0,
  };
}

export function confidence(r, { robust, live }) {
  if (!r) return { level: "red", label: "No route", reasons: ["No passable route for this vehicle"] };
  let score = 100;
  const reasons = [];
  const mc = riskClass(r.maxRisk);
  if (mc >= 3) { score -= 40; reasons.push(`Passes a ${CLASSES[mc].label.toLowerCase()} risk road`); }
  else if (mc === 2) { score -= 15; reasons.push("Highest road on route is moderate risk"); }
  else reasons.push("No road on route above low risk");
  if (r.avgRisk > 0.4) { score -= 20; reasons.push(`Average risk is high (${r.avgRisk.toFixed(2)})`); }
  if (r.noDataShare > 0.1) { score -= 15; reasons.push(`${Math.round(r.noDataShare * 100)}% of route has no data`); }
  if (robust) reasons.push("Planned for worse rain than forecast (robust)");
  else { score -= 5; reasons.push("Not using robust routing"); }
  if (!live) { score -= 10; reasons.push("Rain input is not a live feed"); }
  else reasons.push("Rain input is live");
  const level = score >= 70 ? "green" : score >= 45 ? "amber" : "red";
  return { level, label: { green: "High", amber: "Medium", red: "Low" }[level], score, reasons };
}

export function explainEdge(e, intensity, rain24) {
  if (e.S == null) return ["No terrain data for this road", "Treated as moderate risk, never as safe"];
  const f = e.factors, out = [];
  if (f.creekM < 400) out.push(`Close to the river (${f.creekM} m)`);
  else out.push(`${f.creekM} m from the river`);
  out.push(`Elevation about ${f.elevM} m (demo terrain)`);
  if (f.basin > 0.5) out.push("Sits in a local dip where water collects");
  if (f.built > 0.8) out.push("Dense built-up area, little drainage");
  out.push(`Static susceptibility ${e.S.toFixed(2)} x rain loading ${rainfallLoading(intensity, rain24).toFixed(2)}`);
  return out;
}

export function chokepoints(net, intensity, rain24, n = 10) {
  const deg = net.adj.map((a) => a.length);
  return net.edges
    .map((e) => {
      const r = edgeRisk(e.S, intensity, rain24);
      const importance = (e.primary ? 1.5 : 1) * ((deg[e.a] + deg[e.b]) / 8);
      return { e, risk: r, score: (e.S == null ? 0.35 : e.S) * importance };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, n);
}

// Illustrative storm curve for the replay demo. NOT real ERA5 data.
export function demoReplay(hours = 48) {
  const frames = [];
  const hourly = [];
  for (let h = 0; h < hours; h++) {
    const i = 38 * Math.exp(-((h - 26) ** 2) / 40) + 12 * Math.exp(-((h - 12) ** 2) / 18);
    hourly.push(Math.round(i * 10) / 10);
    const r24 = hourly.slice(Math.max(0, h - 23)).reduce((s, v) => s + v, 0);
    frames.push({ hour: h, intensity: hourly[h], rain24: Math.round(r24) });
  }
  return frames;
}