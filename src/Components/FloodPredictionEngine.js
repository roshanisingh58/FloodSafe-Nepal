// src/Components/FloodPredictionEngine.js
// Data + scoring for the Alert page. No React in here.
// Roshani's FloodEngine.js is NOT touched: this is a separate file.
//
// 1) RISK INDEX (the preview's existing categories)
//      index = 0.64 x past-flood score + 0.36 x rain score
//      rain score = 0.4 x rain(last 72 h) + 1.0 x rain(next 24 h), capped at 100
//      Severe >= 80 | High >= 60 | Moderate >= 35 | Low < 35
//
// 2) FLOOD PREDICTION (new)
//      Local flood-risk score = rainfall (0-40) + terrain/elevation (0-30) + river proximity (0-30)
//      Status Normal / Watch / Worsening: external river-flow forecast first (Open-Meteo GloFAS),
//      local rainfall-trend estimate when the external forecast is unavailable.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isNum = (v) => typeof v === "number" && !Number.isNaN(v);
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const r4 = (n) => Number(n).toFixed(4);

/* ------------------------------------------------------------------ */
/* Settings you can tune                                                */
/* ------------------------------------------------------------------ */
export const REFRESH_MS = 5 * 60 * 1000; // auto-refresh every 5 minutes
export const WEIGHTS = { rain: 40, terrain: 30, river: 30 };
const PAST_WEIGHT = 0.64;
const RAIN_WEIGHT = 0.36;
export const SAMPLE_NEXT24 = 40; // mm, used by the 27-29 Sep 2024 replay

export const CATEGORIES = [
  { key: "severe", min: 80, color: "#ef5b5b" },
  { key: "high", min: 60, color: "#f2a14a" },
  { key: "moderate", min: 35, color: "#4aa8e0" },
  { key: "low", min: 0, color: "#4cc38a" },
];
export const categoryFor = (score) =>
  CATEGORIES.find((c) => score >= c.min) || CATEGORIES[CATEGORIES.length - 1];

const VALLEY_FLOOR_M = 1280;
const TERRAIN_SAFE_M = 1400;
const RIVER_NEAR_M = 150;
const RIVER_FAR_M = 1500;
const MIN_RISE_M3S = 5; // ignore river-flow "rises" smaller than this (noise)

/* ------------------------------------------------------------------ */
/* The 15 areas.                                                        */
/* Rows 1-4 come from your preview screenshots (names, wards, people,   */
/* risk values). Rows 5-15 are PLACEHOLDERS (placeholder: true): replace */
/* names, people, past score, floods and sample72 with your real data.  */
/* past      = past-flood score 0-100                                   */
/* sample72  = sample rain (mm, 72 h) for the 27-29 Sep 2024 replay     */
/*             (these 15 values average 247 mm, peak 300 mm)            */
/* ------------------------------------------------------------------ */
export const AREAS = [
  {
    id: "balkhu", name: "Balkhu / Kuleshwor", ward: "KMC Ward 14", river: "Bagmati–Balkhu confluence",
    people: 42000, past: 95, floods: 3, floodDates: "Sep 2024 · Jun 2021 · Jul 2018", sample72: 300,
    desc: "Confluence pinch point, dense riverside settlements, narrow channel under Ring Road bridge",
    lat: 27.685, lng: 85.299,
  },
  {
    id: "teku", name: "Teku & Tripureshwor", ward: "KMC Ward 11–12", river: "Bishnumati–Bagmati junction",
    people: 31500, past: 90, floods: 3, sample72: 285, lat: 27.695, lng: 85.309,
  },
  {
    id: "shankhamul", name: "Shankhamul & Buddhanagar", ward: "KMC Ward 10 / 31", river: "Bagmati River corridor",
    people: 28000, past: 83, floods: 3, sample72: 275, lat: 27.684, lng: 85.338,
  },
  {
    id: "hanumante", name: "Radhe Radhe / Hanumante Basin", ward: "Madhyapur Thimi / Bhaktapur", river: "Hanumante Khola",
    people: 36000, past: 81, floods: 2, sample72: 262, lat: 27.671, lng: 85.425, placeholder: true,
  },
  { id: "thapathali", name: "Thapathali", ward: "KMC Ward 11", river: "Bagmati River", people: 24000, past: 78, floods: 2, sample72: 270, lat: 27.693, lng: 85.318, placeholder: true },
  { id: "kalimati", name: "Kalimati", ward: "KMC Ward 13", river: "Bishnumati River", people: 26000, past: 74, floods: 2, sample72: 255, lat: 27.698, lng: 85.299, placeholder: true },
  { id: "balaju", name: "Balaju / Bishnumati", ward: "KMC Ward 16", river: "Bishnumati River", people: 22000, past: 72, floods: 2, sample72: 250, lat: 27.734, lng: 85.305, placeholder: true },
  { id: "pashupati", name: "Pashupati / Gaushala", ward: "KMC Ward 8–9", river: "Bagmati River", people: 30000, past: 66, floods: 2, sample72: 245, lat: 27.711, lng: 85.349, placeholder: true },
  { id: "sinamangal", name: "Sinamangal / Tilganga", ward: "KMC Ward 9", river: "Bagmati River", people: 19000, past: 64, floods: 1, sample72: 240, lat: 27.696, lng: 85.356, placeholder: true },
  { id: "koteshwor", name: "Koteshwor / Manohara", ward: "KMC Ward 35", river: "Manohara Khola", people: 33000, past: 61, floods: 2, sample72: 235, lat: 27.678, lng: 85.349, placeholder: true },
  { id: "imadol", name: "Imadol / Hanumante", ward: "Lalitpur", river: "Hanumante Khola", people: 27000, past: 58, floods: 1, sample72: 230, lat: 27.654, lng: 85.345, placeholder: true },
  { id: "satdobato", name: "Satdobato / Nakkhu", ward: "Lalitpur", river: "Nakkhu Khola", people: 21000, past: 50, floods: 1, sample72: 225, lat: 27.65, lng: 85.32, placeholder: true },
  { id: "chobhar", name: "Chobhar", ward: "KMC Ward 14 (south)", river: "Bagmati gorge", people: 8000, past: 44, floods: 1, sample72: 220, lat: 27.66, lng: 85.296, placeholder: true },
  { id: "bhaktapur", name: "Bhaktapur / Manohara", ward: "Bhaktapur", river: "Manohara Khola", people: 17000, past: 34, floods: 1, sample72: 215, lat: 27.677, lng: 85.418, placeholder: true },
  { id: "kirtipur", name: "Kirtipur", ward: "Kirtipur", river: "Bagmati (distant)", people: 15000, past: 28, floods: 0, sample72: 198, lat: 27.667, lng: 85.279, placeholder: true },
];

// Approximate river centrelines [lat, lng]. Replace with a real GIS layer for accuracy.
export const RIVERS = {
  Bagmati: [[27.758, 85.426], [27.7395, 85.379], [27.7105, 85.348], [27.693, 85.317], [27.6955, 85.306], [27.685, 85.2965], [27.67, 85.295], [27.659, 85.2955]],
  Bishnumati: [[27.765, 85.32], [27.74, 85.305], [27.725, 85.305], [27.71, 85.306], [27.699, 85.3055], [27.6945, 85.3055]],
  Manohara: [[27.678, 85.43], [27.67, 85.4], [27.669, 85.38], [27.682, 85.35], [27.689, 85.333]],
  Hanumante: [[27.67, 85.435], [27.665, 85.415], [27.66, 85.39], [27.666, 85.37], [27.677, 85.352], [27.682, 85.34]],
  Nakkhu: [[27.635, 85.33], [27.65, 85.32], [27.662, 85.311], [27.67, 85.305], [27.673, 85.3]],
};

/* ------------------------------------------------------------------ */
/* River proximity                                                      */
/* ------------------------------------------------------------------ */
function distToSegmentM(lat, lng, a, b) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const ax = (a[1] - lng) * kx, ay = (a[0] - lat) * ky;
  const bx = (b[1] - lng) * kx, by = (b[0] - lat) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function nearestRiver(lat, lng) {
  let best = { name: "none", distance: Infinity };
  Object.entries(RIVERS).forEach(([name, pts]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegmentM(lat, lng, pts[i], pts[i + 1]);
      if (d < best.distance) best = { name, distance: d };
    }
  });
  return best;
}

/* ------------------------------------------------------------------ */
/* Scores                                                               */
/* ------------------------------------------------------------------ */
export const rainScore100 = (past72, next24) => clamp(0.4 * past72 + 1.0 * next24, 0, 100);

function scoreLocal({ past72, next24, elevation, riverDistance, riverName }) {
  const rainPts = (rainScore100(past72, next24) / 100) * WEIGHTS.rain;
  const elevKnown = isNum(elevation);
  const terrainPts = elevKnown
    ? clamp(((TERRAIN_SAFE_M - elevation) / (TERRAIN_SAFE_M - VALLEY_FLOOR_M)) * WEIGHTS.terrain, 0, WEIGHTS.terrain)
    : WEIGHTS.terrain / 2;
  const riverPts = clamp(((RIVER_FAR_M - riverDistance) / (RIVER_FAR_M - RIVER_NEAR_M)) * WEIGHTS.river, 0, WEIGHTS.river);

  const drivers = [
    {
      key: "rain", points: rainPts, max: WEIGHTS.rain,
      detail: `${past72.toFixed(1)} mm in the last 72 h, ${next24.toFixed(1)} mm forecast in the next 24 h`,
    },
    {
      key: "terrain", points: terrainPts, max: WEIGHTS.terrain,
      detail: elevKnown
        ? `${Math.round(elevation)} m above sea level (valley floor is about ${VALLEY_FLOOR_M.toLocaleString("en-US")} m)`
        : "Elevation unavailable, neutral value used",
    },
    {
      key: "river", points: riverPts, max: WEIGHTS.river,
      detail: riverDistance > 3000 ? "No modelled river within 3 km" : `${Math.round(riverDistance)} m from the ${riverName}`,
    },
  ];
  const score = Math.round(rainPts + terrainPts + riverPts);
  const top = [...drivers].sort((a, b) => b.points / b.max - a.points / a.max)[0];
  return { score, category: categoryFor(score), drivers, topDriver: top.key };
}

/* ------------------------------------------------------------------ */
/* Flood prediction status                                              */
/* ------------------------------------------------------------------ */
function localPrediction({ past72, next24, replay }) {
  const dailyPast = past72 / 3;
  let status = "normal";
  if (next24 >= 50 || (past72 >= 150 && next24 >= 20) || (next24 >= 20 && next24 > dailyPast * 1.5)) status = "worsening";
  else if (next24 >= 10 || (next24 >= 5 && next24 > dailyPast * 1.2)) status = "watch";
  return {
    status,
    source: "local",
    sourceLabel: replay
      ? "Local estimate from the replayed 27–29 Sept 2024 sample rainfall (no external forecast in replay)"
      : "Local estimate (external river forecast unavailable for this point)",
    reasons: [
      `Forecast rain for the next 24 h is ${next24.toFixed(1)} mm, against a recent average of ${dailyPast.toFixed(1)} mm per day.`,
      `Rain over the last 72 h totals ${past72.toFixed(1)} mm.`,
    ],
  };
}

function externalPrediction(daily, dayKey, { next24 }) {
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily.river_discharge)) return null;
  const i = daily.time.indexOf(dayKey);
  if (i < 0) return null;
  const q = daily.river_discharge;
  const past = q.slice(Math.max(0, i - 3), i).filter(isNum);
  const ahead = q.slice(i, i + 4).filter(isNum);
  if (!ahead.length) return null;
  const base = past.length ? avg(past) : ahead[0];
  const peak = Math.max(...ahead);
  const ratio = peak / Math.max(base, 0.1);
  const rise = peak - base;
  let status = "normal";
  if (rise >= MIN_RISE_M3S && ratio >= 2) status = "worsening";
  else if (rise >= MIN_RISE_M3S && ratio >= 1.3) status = "watch";
  const trend = status === "normal" ? "no significant rise is forecast" : `a rise of about ${Math.round((ratio - 1) * 100)}% is forecast`;
  return {
    status,
    source: "external",
    sourceLabel: "External forecast: Open-Meteo GloFAS river discharge",
    reasons: [
      `River discharge nearby averaged ${base.toFixed(1)} m³/s over the last 3 days and is forecast to peak at ${peak.toFixed(1)} m³/s within 3 days, so ${trend}.`,
      `Forecast rain for the next 24 h is ${next24.toFixed(1)} mm.`,
      "GloFAS uses a coarse grid, so very small streams may not be resolved.",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Evaluate one area                                                    */
/* ------------------------------------------------------------------ */
export function evaluate(area, inp) {
  const { past72, next24, elevation, floodDaily, dayKey, replay } = inp;
  const river = nearestRiver(area.lat, area.lng);
  const rain100 = rainScore100(past72, next24);
  const index = Math.round(PAST_WEIGHT * area.past + RAIN_WEIGHT * rain100);
  const local = scoreLocal({ past72, next24, elevation, riverDistance: river.distance, riverName: river.name });
  const prediction =
    (!replay && externalPrediction(floodDaily, dayKey, { next24 })) || localPrediction({ past72, next24, replay });
  return { ...area, past72, next24, elevation, nearRiver: river, rain100, index, category: categoryFor(index), local, prediction };
}

/* ------------------------------------------------------------------ */
/* Fetching live inputs (rainfall, elevation, river-flow forecast)      */
/* ------------------------------------------------------------------ */
const elevCache = new Map();
const ek = (a) => `${r4(a.lat)},${r4(a.lng)}`;
const cachedElevation = (a) => (elevCache.has(ek(a)) ? elevCache.get(ek(a)) : null);

async function getJson(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const asArray = (j) => (Array.isArray(j) ? j : [j]);

function ktmNow() {
  const s = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kathmandu" }); // "2026-11-21 01:47:12"
  return { hourKey: s.slice(0, 13).replace(" ", "T") + ":00", dayKey: s.slice(0, 10) };
}

function summariseRain(hourly, hourKey) {
  const p = (hourly && hourly.precipitation) || [];
  const t = (hourly && hourly.time) || [];
  let idx = t.indexOf(hourKey);
  if (idx < 0) idx = Math.min(72, p.length);
  const sum = (arr) => arr.reduce((s, v) => s + (isNum(v) ? v : 0), 0);
  return { past72: sum(p.slice(Math.max(0, idx - 72), idx)), next24: sum(p.slice(idx, idx + 24)) };
}

export async function fetchLiveInputs(signal) {
  const lat = AREAS.map((a) => r4(a.lat)).join(",");
  const lng = AREAS.map((a) => r4(a.lng)).join(",");

  const rainP = getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation&past_days=3&forecast_days=2&timezone=Asia%2FKathmandu`,
    signal
  );
  const floodP = getJson(
    `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}&daily=river_discharge&past_days=3&forecast_days=7`,
    signal
  );
  const need = AREAS.filter((a) => !elevCache.has(ek(a)));
  const elevP = need.length
    ? getJson(
        `https://api.open-meteo.com/v1/elevation?latitude=${need.map((a) => r4(a.lat)).join(",")}&longitude=${need.map((a) => r4(a.lng)).join(",")}`,
        signal
      )
    : Promise.resolve(null);

  const [rainR, floodR, elevR] = await Promise.allSettled([rainP, floodP, elevP]);
  if (rainR.status !== "fulfilled") throw new Error("Live rainfall data is unavailable right now");

  if (elevR.status === "fulfilled" && elevR.value && Array.isArray(elevR.value.elevation)) {
    need.forEach((a, i) => {
      if (isNum(elevR.value.elevation[i])) elevCache.set(ek(a), elevR.value.elevation[i]);
    });
  }

  const rainArr = asArray(rainR.value);
  const floodArr = floodR.status === "fulfilled" ? asArray(floodR.value) : null;
  const { hourKey, dayKey } = ktmNow();

  return {
    fetchedAt: new Date(),
    dayKey,
    floodOk: !!floodArr,
    perArea: AREAS.map((a, i) => ({
      rain: summariseRain(rainArr[i] && rainArr[i].hourly, hourKey),
      elevation: cachedElevation(a),
      floodDaily: floodArr && floodArr[i] ? floodArr[i].daily : null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Rows for the page                                                    */
/* ------------------------------------------------------------------ */
export function buildRows(mode, live) {
  if (mode === "past") {
    return AREAS.map((a) =>
      evaluate(a, { past72: a.sample72, next24: SAMPLE_NEXT24, elevation: cachedElevation(a), floodDaily: null, replay: true })
    );
  }
  if (!live) return [];
  return AREAS.map((a, i) =>
    evaluate(a, {
      ...live.perArea[i].rain,
      elevation: live.perArea[i].elevation,
      floodDaily: live.perArea[i].floodDaily,
      dayKey: live.dayKey,
      replay: false,
    })
  );
}

export function countByCategory(rows) {
  const c = { severe: 0, high: 0, moderate: 0, low: 0 };
  rows.forEach((r) => { c[r.category.key] += 1; });
  return c;
}

export function rainStats(rows) {
  if (!rows.length) return { avg: 0, peak: 0 };
  const v = rows.map((r) => r.past72);
  return { avg: Math.round(avg(v)), peak: Math.round(Math.max(...v)) };
}