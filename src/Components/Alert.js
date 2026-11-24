// Alert.js — SETU · Alert page, same look as the main project (uses Home.css)
// Navbar = Home navbar style. "Home" goes to "/" (your real Home page).
// Content follows the FloodSafe Kathmandu preview: hero + map, past vs live, ranked risk index,
// Nepal floods, method. NEW: "Flood prediction" section (rain + terrain + river proximity,
// external forecast first, auto-refreshing).
// Uses Home.css classes for the look; only new pieces live in Alert.css (all prefixed "alr-").
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Home.css";
import "./Alert.css";
import setuLogo from "./Setu.jpg";
import {
  AREAS, RIVERS, CATEGORIES, WEIGHTS, REFRESH_MS,
  fetchLiveInputs, buildRows, countByCategory, rainStats,
} from "./FloodPredictionEngine";

/* ---------------- language ---------------- */
const T = (en, hi, ne) => ({ en, hi: hi ?? en, ne: ne ?? hi ?? en });
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ne", label: "नेपाली" },
];
const LangContext = createContext(null);

function LangProvider({ children }) {
  const [lang, setLangState] = useState("en");
  useEffect(() => {
    try {
      const s = localStorage.getItem("setu-lang");
      if (s === "en" || s === "hi" || s === "ne") setLangState(s);
    } catch { /* ignore */ }
  }, []);
  const setLang = (c) => {
    setLangState(c);
    try { localStorage.setItem("setu-lang", c); } catch { /* ignore */ }
  };
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}
function useLang() {
  const { lang, setLang } = useContext(LangContext);
  const tr = (o) => (typeof o === "string" ? o : o[lang] ?? o.en);
  return { lang, setLang, tr };
}

const CAT_LABEL = {
  severe: T("Severe", "गंभीर", "गम्भीर"),
  high: T("High", "उच्च", "उच्च"),
  moderate: T("Moderate", "मध्यम", "मध्यम"),
  low: T("Low", "कम", "कम"),
};
const STATUS_LABEL = {
  normal: { label: T("Normal", "सामान्य", "सामान्य"), text: T("Conditions are normal", "स्थिति सामान्य है", "अवस्था सामान्य छ") },
  watch: { label: T("Watch", "निगरानी", "निगरानी"), text: T("Conditions are rising", "स्थिति बढ़ रही है", "अवस्था बढ्दै छ") },
  worsening: { label: T("Worsening", "बिगड़ रही", "बिग्रँदै"), text: T("Conditions are worsening", "स्थिति बिगड़ रही है", "अवस्था बिग्रँदै छ") },
};
const DRIVER_LABEL = {
  rain: T("Rainfall", "बारिश", "वर्षा"),
  terrain: T("Terrain / elevation", "भू-भाग / ऊँचाई", "भू-बनोट / उचाइ"),
  river: T("River proximity", "नदी से निकटता", "नदीसँग निकटता"),
};

const mmss = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const fmtPeople = (n) => n.toLocaleString("en-US");

/* ---------------- brand, background, navbar, footer (same as Home) ---------------- */
function SetuLogo({ className = "setu-mark" }) {
  const [ok, setOk] = useState(true);
  return (
    <span className={className} aria-hidden="true">
      {ok ? <img src={setuLogo} alt="" onError={() => setOk(false)} /> : <span className="setu-mark-fallback">S</span>}
    </span>
  );
}

function SetuBrand({ to = "/" }) {
  const { tr } = useLang();
  return (
    <Link to={to} className="nav-brand" aria-label="Setu home">
      <SetuLogo />
      <span className="setu-word">
        <span className="nav-name">Setu</span>
        <span className="nav-sub">{tr(T("FLOOD SAFE ROUTES", "बाढ़ सुरक्षित रास्ते", "बाढी सुरक्षित मार्ग"))}</span>
      </span>
    </Link>
  );
}

const RIPPLES = [
  { left: 12, top: 78, delay: 0 }, { left: 32, top: 88, delay: 1.6 }, { left: 55, top: 82, delay: 3.1 },
  { left: 74, top: 90, delay: 0.8 }, { left: 88, top: 76, delay: 2.4 }, { left: 44, top: 70, delay: 4.2 },
];
function AnimatedBackground() {
  return (
    <div className="home-bg" aria-hidden="true">
      <div className="home-bg-img" />
      <div className="home-bg-overlay" />
      <span className="bg-orb bg-orb-1" />
      <span className="bg-orb bg-orb-2" />
      <span className="bg-orb bg-orb-3" />
      <div className="home-bg-rain" />
      {RIPPLES.map((r, i) => (
        <span key={i} className="bg-ripple" style={{ left: `${r.left}%`, top: `${r.top}%`, animationDelay: `${r.delay}s` }} />
      ))}
      <div className="home-bg-vignette" />
    </div>
  );
}

function Navbar() {
  const { lang, setLang, tr } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  return (
    <header className="nav">
      <SetuBrand />
      <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
        <Link to="/" onClick={close}>{tr(T("Home", "होम", "होम"))}</Link>
        <Link to="/dashboard" onClick={close}>{tr(T("Dashboard", "डैशबोर्ड", "ड्यासबोर्ड"))}</Link>
        <Link to="/Features" onClick={close}>{tr(T("Features", "सुविधाएँ", "सुविधाहरू"))}</Link>
        <Link to="/About" onClick={close}>{tr(T("About", "परिचय", "बारेमा"))}</Link>
        <Link to="/Respond" onClick={close}>{tr(T("Respond", "प्रतिक्रिया", "प्रतिक्रिया"))}</Link>
        <Link to="/Alert" className="alr-current" aria-current="page" onClick={close}>{tr(T("Alerts", "अलर्ट", "अलर्ट"))}</Link>
      </nav>
      <div className="nav-actions">
        <div className="lang-toggle" role="group" aria-label="Language">
          {LANGUAGES.map((l) => (
            <button key={l.code} className={lang === l.code ? "on" : ""} onClick={() => setLang(l.code)} lang={l.code}>
              {l.label}
            </button>
          ))}
        </div>
        <Link to="/Respond" className="btn btn-primary btn-sm hide-mobile">
          {tr(T("Live SOS", "लाइव SOS", "लाइभ SOS"))}
        </Link>
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}

function Footer() {
  const { tr } = useLang();
  return (
    <footer className="home-footer" id="about">
      <svg className="home-footer-wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">
        <path className="hf-wave-a" d="M0 35 Q180 5 360 35 T720 35 T1080 35 T1440 35 T1800 35 T2160 35 T2520 35 T2880 35 V70 H0 Z" />
        <path className="hf-wave-b" d="M0 45 Q180 20 360 45 T720 45 T1080 45 T1440 45 T1800 45 T2160 45 T2520 45 T2880 45 V70 H0 Z" />
      </svg>
      <div className="home-footer-inner">
        <div className="home-footer-brand">
          <SetuBrand />
          <p>{tr(T("Flood risk & emergency safe-route mapper. Pilot: Kathmandu, Nepal.", "बाढ़ जोखिम और आपातकालीन सुरक्षित-मार्ग मैपर। पायलट: काठमांडू, नेपाल।", "बाढी जोखिम र आपतकालीन सुरक्षित-मार्ग म्यापर। पाइलट: काठमाडौँ, नेपाल।"))}</p>
          <span className="home-footer-chip">
            <span className="home-footer-dot" />
            {tr(T("Prototype · not deployed yet", "प्रोटोटाइप · अभी लागू नहीं", "प्रोटोटाइप · अहिलेसम्म लागू भएको छैन"))}
          </span>
        </div>
        <div className="home-footer-col">
          <h4>{tr(T("Platform", "प्लेटफ़ॉर्म", "प्लेटफर्म"))}</h4>
          <Link to="/dashboard">{tr(T("Dashboard", "डैशबोर्ड", "ड्यासबोर्ड"))}</Link>
          <Link to="/Alert">{tr(T("Flood Risk Alerts", "बाढ़ जोखिम अलर्ट", "बाढी जोखिम अलर्ट"))}</Link>
          <Link to="/Respond">{tr(T("Respond Plan", "प्रतिक्रिया योजना", "प्रतिक्रिया योजना"))}</Link>
        </div>
        <div className="home-footer-col">
          <h4>{tr(T("Learn", "सीखें", "सिक्नुहोस्"))}</h4>
          <Link to="/Features">{tr(T("Features", "सुविधाएँ", "सुविधाहरू"))}</Link>
          <a href="#nepal">{tr(T("Nepal Floods", "नेपाल बाढ़", "नेपालको बाढी"))}</a>
          <a href="#method">{tr(T("Method", "विधि", "विधि"))}</a>
          <Link to="/About">{tr(T("About", "परिचय", "बारेमा"))}</Link>
        </div>
        <div className="home-footer-col">
          <h4>{tr(T("Open data", "खुला डेटा", "खुला डेटा"))}</h4>
          <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
          <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
          <a href="https://bipadportal.gov.np" target="_blank" rel="noopener noreferrer">NDRRMA · BIPAD</a>
        </div>
      </div>
      <div className="home-footer-bottom">
        <span>© 2026 SETU · Team TheLadyBugz_5 · Katathon 6.0 · PS 103</span>
        <span className="home-footer-muted">{tr(T("Decision support, not a safety guarantee.", "निर्णय-सहायता, सुरक्षा की गारंटी नहीं।", "निर्णय-सहायता, सुरक्षाको ग्यारेन्टी होइन।"))}</span>
        <a href="#top" className="home-footer-top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          {tr(T("↑ Back to top", "↑ ऊपर जाएँ", "↑ माथि जानुहोस्"))}
        </a>
      </div>
    </footer>
  );
}

/* ---------------- Nepal data ---------------- */
const NEPAL_EVENTS = [
  {
    year: "1993", coords: [27.6, 85.17], color: "#ef5b5b",
    title: T("Kulekhani & central Nepal", "कुलेखानी और मध्य नेपाल", "कुलेखानी र मध्य नेपाल"),
    text: T("Over 500 mm of rain in a day triggered floods and debris flows, killing more than 1,000 people."),
  },
  {
    year: "2008", coords: [26.55, 87.12], color: "#f2a14a",
    title: T("Koshi embankment breach", "कोसी तटबंध टूटा", "कोसी तटबन्ध फुट्यो"),
    text: T("The Koshi river broke its embankment and changed course, displacing tens of thousands of people in Nepal and India."),
  },
  {
    year: "2017", coords: [28.05, 81.62], color: "#f2a14a",
    title: T("Terai floods", "तराई में बाढ़", "तराईमा बाढी"),
    text: T("Heavy August monsoon rain flooded much of the southern plains, affecting over a million people and cutting key highways."),
  },
  {
    year: "2021", coords: [27.83, 85.57], color: "#f2a14a",
    title: T("Melamchi flood", "मेलामची बाढ़", "मेलम्ची बाढी"),
    text: T("A sudden flood in June 2021 destroyed the Melamchi water-supply headworks and washed away bridges and homes."),
  },
  {
    year: "2024", coords: [27.71, 85.32], color: "#ef5b5b",
    title: T("Kathmandu valley floods", "काठमांडू घाटी में बाढ़", "काठमाडौँ उपत्यकामा बाढी"),
    text: T("In late September, record rainfall caused floods and landslides across the country, with over 200 deaths and heavy damage in and around Kathmandu."),
  },
];

const NEPAL_FACTS = [
  { value: "240mm", label: T("Rain in 24h at Kathmandu airport, 28 Sept 2024 — highest since 1970") },
  { value: "240+", label: T("Lives lost nationwide in the late-September 2024 floods") },
  { value: "6,000+", label: T("Rivers and streams draining Nepal's steep Himalayan terrain") },
];

/* ---------------- page ---------------- */
function AlertPage() {
  const { lang, tr } = useLang();
  const [mode, setMode] = useState("live"); // "live" | "past"
  const [live, setLive] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [nextAt, setNextAt] = useState(Date.now() + REFRESH_MS);
  const [now, setNow] = useState(Date.now());
  const [selectedId, setSelectedId] = useState(AREAS[0].id);
  const [catFilter, setCatFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score");
  const [query, setQuery] = useState("");

  const reqRef = useRef(0);
  const lastRef = useRef(0);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const nepalEl = useRef(null);
  const prevSel = useRef(selectedId);

  /* ----- live data + auto-refresh ----- */
  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    try {
      const res = await fetchLiveInputs();
      if (id !== reqRef.current) return;
      setLive(res);
      setError("");
    } catch (e) {
      if (id !== reqRef.current) return;
      setError(e.message || "Could not refresh data");
    } finally {
      if (id === reqRef.current) {
        setLoading(false);
        lastRef.current = Date.now();
        setNextAt(Date.now() + REFRESH_MS);
      }
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRef.current > REFRESH_MS) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ----- rows ----- */
  const pastRows = useMemo(() => buildRows("past", live), [live]);
  const liveRows = useMemo(() => buildRows("live", live), [live]);
  const rows = mode === "past" ? pastRows : liveRows;
  const pastCounts = useMemo(() => countByCategory(pastRows), [pastRows]);
  const liveCounts = useMemo(() => countByCategory(liveRows), [liveRows]);
  const pastStats = useMemo(() => rainStats(pastRows), [pastRows]);
  const liveStats = useMemo(() => rainStats(liveRows), [liveRows]);
  const sel = rows.find((r) => r.id === selectedId) || null;

  /* ----- hero map ----- */
  useEffect(() => {
    const m = L.map(mapEl.current, { zoomControl: false, zoomSnap: 0.25 });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(m);
    Object.values(RIVERS).forEach((pts) =>
      L.polyline(pts, { color: "#7dd3fc", weight: 2, opacity: 0.35, dashArray: "4 6", interactive: false }).addTo(m)
    );
    layerRef.current = L.layerGroup().addTo(m);
    m.fitBounds(L.latLngBounds(AREAS.map((a) => [a.lat, a.lng])), { padding: [60, 60] });
    mapRef.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(mapEl.current);
    return () => { ro.disconnect(); m.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    rows.forEach((a) => {
      const on = a.id === selectedId;
      const c = L.circle([a.lat, a.lng], {
        radius: 450 + a.index * 5,
        color: on ? "#ffffff" : a.category.color,
        weight: on ? 3 : 1.5,
        fillColor: a.category.color,
        fillOpacity: on ? 0.55 : 0.32,
      }).addTo(layer);
      c.bindTooltip(`${a.name} · ${a.index}`, { direction: "top" });
      c.on("click", () => setSelectedId(a.id));
      L.circleMarker([a.lat, a.lng], { radius: 3, color: "#fff", fillColor: "#fff", fillOpacity: 1, weight: 0, interactive: false }).addTo(layer);
    });
  }, [rows, selectedId]);

  useEffect(() => {
    if (prevSel.current === selectedId) return;
    prevSel.current = selectedId;
    const a = AREAS.find((x) => x.id === selectedId);
    if (a && mapRef.current) mapRef.current.flyTo([a.lat, a.lng], 13.5, { duration: 0.8 });
  }, [selectedId]);

  /* ----- Nepal map ----- */
  useEffect(() => {
    const m = L.map(nepalEl.current, { zoomControl: false, zoomSnap: 0.25 });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 12,
      attribution: "© OpenStreetMap contributors",
    }).addTo(m);
    NEPAL_EVENTS.forEach((e) => {
      L.circleMarker(e.coords, { radius: 9, color: "#fff", weight: 2, fillColor: e.color, fillOpacity: 0.9 })
        .bindTooltip(`${e.year} · ${tr(e.title)}`, { direction: "top" })
        .addTo(m);
    });
    m.fitBounds([[26.3, 80.0], [30.5, 88.3]]);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(nepalEl.current);
    return () => { ro.disconnect(); m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /* ----- table ----- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const r = rows.filter(
      (a) =>
        (catFilter === "all" || a.category.key === catFilter) &&
        (!q || `${a.name} ${a.ward} ${a.river}`.toLowerCase().includes(q))
    );
    const cmp =
      sortBy === "rain" ? (a, b) => b.past72 - a.past72 || b.index - a.index
      : sortBy === "people" ? (a, b) => b.people - a.people
      : (a, b) => b.index - a.index || b.people - a.people;
    return [...r].sort(cmp);
  }, [rows, catFilter, sortBy, query]);

  const pickArea = (id, scrollTo) => {
    setSelectedId(id);
    if (scrollTo) document.getElementById(scrollTo)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const showMode = (m) => {
    setMode(m);
    document.getElementById("top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const langClass = lang === "en" ? "" : `lang-hi lang-${lang}`;
  const updatedLabel = live ? `${tr(T("Updated", "अपडेट", "अपडेट"))} ${live.fetchedAt.toLocaleTimeString()}` : tr(T("Loading live data…", "लाइव डेटा लोड हो रहा है…", "प्रत्यक्ष डेटा लोड हुँदैछ…"));
  const catChip = (k) => (
    <button key={k} type="button" className={`alr-chipbtn ${catFilter === k ? "on" : ""}`} onClick={() => setCatFilter(k)}>
      {k !== "all" && <i style={{ background: CATEGORIES.find((c) => c.key === k).color }} />}
      {k === "all" ? tr(T("All", "सभी", "सबै")) : tr(CAT_LABEL[k])}
    </button>
  );

  return (
    <div className={`home alert-page alr-page ${langClass}`} lang={lang} id="top">
      <AnimatedBackground />
      <Navbar />

      {/* ================= HERO ================= */}
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">{tr(T("KATHMANDU VALLEY · FLOOD RISK INDEX", "काठमांडू घाटी · बाढ़ जोखिम सूचकांक", "काठमाडौँ उपत्यका · बाढी जोखिम सूचकांक"))}</p>
          <h1>
            {tr(T("Know where the", "जानिए कहाँ", "थाहा पाउनुहोस् कहाँ"))}<br />
            <span className="accent">{tr(T("water", "पानी", "पानी"))}</span> {tr(T("will rise.", "चढ़ेगा।", "बढ्नेछ।"))}
          </h1>
          <p className="hero-sub">
            {tr(T(
              "FloodSafe scores fifteen flood-prone areas of Kathmandu, Lalitpur and Bhaktapur by blending past flood records with recent and forecast rainfall — so you can see which wards are most at risk today.",
              "FloodSafe काठमांडू, ललितपुर और भक्तपुर के पंद्रह बाढ़-संभावित इलाकों को पिछली बाढ़ों के रिकॉर्ड और हाल की व पूर्वानुमानित बारिश के मेल से अंक देता है — ताकि आप देख सकें कि आज कौन-से वार्ड सबसे अधिक जोखिम में हैं।",
              "FloodSafe ले काठमाडौँ, ललितपुर र भक्तपुरका पन्ध्र बाढी-सम्भावित क्षेत्रलाई विगतका बाढी अभिलेख र हालको तथा पूर्वानुमानित वर्षाको मिश्रणबाट अंक दिन्छ — ताकि आज कुन वडा सबैभन्दा जोखिममा छन् हेर्न सकियोस्।"
            ))}
          </p>
          <div className="hero-cta">
            <a href="#risk-index" className="btn btn-primary">{tr(T("View risk index →", "जोखिम सूचकांक देखें →", "जोखिम सूचकांक हेर्नुहोस् →"))}</a>
            <a href="#past-live" className="btn alr-textbtn">{tr(T("Past vs live data", "पुराना बनाम लाइव डेटा", "विगत बनाम प्रत्यक्ष डेटा"))}</a>
          </div>
        </div>

        <div className="hero-map alr-hero-map">
          <div ref={mapEl} className="alr-map" />
          <div className="alr-chip">
            <b>KATHMANDU VALLEY · 27.70°N 85.32°E</b>
            <br />
            {mode === "live"
              ? tr(T("Live · Open-Meteo rainfall, last 72h + next 24h forecast", "लाइव · Open-Meteo वर्षा, पिछले 72 घंटे + अगले 24 घंटे का पूर्वानुमान", "प्रत्यक्ष · Open-Meteo वर्षा, पछिल्लो 72 घण्टा + अर्को 24 घण्टाको पूर्वानुमान"))
              : tr(T("Past · replay of the 27–29 Sept 2024 sample rainfall", "अतीत · 27–29 सितंबर 2024 की नमूना बारिश का रिप्ले", "विगत · 27–29 सेप्टेम्बर 2024 को नमुना वर्षाको रिप्ले"))}
          </div>
          <div className="alr-toggle" role="group" aria-label="Data mode">
            <button type="button" className={mode === "past" ? "on" : ""} onClick={() => setMode("past")}>{tr(T("Past data", "पुराना डेटा", "विगत डेटा"))}</button>
            <button type="button" className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>
              <span className="alr-livedot" />{tr(T("Live data", "लाइव डेटा", "प्रत्यक्ष डेटा"))}
            </button>
          </div>

          {sel && (
            <div className="alr-pop">
              <div className="alr-pop-top">
                <span className="alr-pill" style={{ borderColor: sel.category.color, color: sel.category.color }}>{tr(CAT_LABEL[sel.category.key])}</span>
                <span className="alr-pop-score">{sel.index}</span>
              </div>
              <h3>{sel.name}</h3>
              <p className="alr-pop-sub">{sel.ward} · {sel.river}</p>
              <div className="alr-pop-grid">
                <div><small>{tr(T("PAST FLOODS", "पिछली बाढ़ें", "विगतका बाढी"))}</small><b>{sel.past}/100</b></div>
                <div><small>{tr(T("RAIN 72H", "बारिश 72घं", "वर्षा 72घ"))}</small><b>{Math.round(sel.past72)} mm</b></div>
                <div><small>{tr(T("NEXT 24H", "अगले 24घं", "अर्को 24घ"))}</small><b>{Math.round(sel.next24)} mm</b></div>
                <div><small>{tr(T("PEOPLE", "लोग", "मानिस"))}</small><b>{fmtPeople(sel.people)}</b></div>
              </div>
              {sel.desc && <p className="alr-pop-desc">{sel.desc}</p>}
              {sel.floodDates && <p className="alr-pop-desc">{tr(T("Recorded floods:", "दर्ज बाढ़ें:", "अभिलेखित बाढी:"))} {sel.floodDates}</p>}
            </div>
          )}
          {!sel && mode === "live" && <div className="alr-pop alr-pop-loading">{tr(T("Loading live data…", "लाइव डेटा लोड हो रहा है…", "प्रत्यक्ष डेटा लोड हुँदैछ…"))}</div>}

          <div className="alr-legend">
            {[...CATEGORIES].reverse().map((c) => (
              <span key={c.key}><i style={{ background: c.color }} />{tr(CAT_LABEL[c.key])}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PAST vs LIVE ================= */}
      <section className="section" id="past-live">
        <p className="eyebrow">{tr(T("PAST & LIVE", "अतीत और लाइव", "विगत र प्रत्यक्ष"))}</p>
        <h2>{tr(T("Two views of the same valley.", "एक ही घाटी के दो नज़रिए।", "एउटै उपत्यकाका दुई दृष्टिकोण।"))}</h2>
        <div className="alr-modes">
          {[
            { key: "past", counts: pastCounts, stats: pastStats, rowsFor: pastRows },
            { key: "live", counts: liveCounts, stats: liveStats, rowsFor: liveRows },
          ].map((m) => (
            <article key={m.key} className={`alr-mode alr-mode--${m.key} ${mode === m.key ? "is-active" : ""}`}>
              <div className="alr-mode-art">
                {m.rowsFor.map((a, i) => (
                  <span
                    key={a.id}
                    className="alr-dot"
                    style={{
                      left: `${(i * 37 + 11) % 86 + 5}%`,
                      top: `${(i * 53 + 9) % 52 + 8}%`,
                      width: 18 + (a.index % 5) * 6,
                      height: 18 + (a.index % 5) * 6,
                      background: a.category.color,
                    }}
                  />
                ))}
                <div className="alr-badges">
                  <span className="alr-badge"><i style={{ background: m.key === "past" ? "#f2a14a" : "#ef5b5b" }} />{m.key === "past" ? tr(T("PAST DATA", "पुराना डेटा", "विगत डेटा")) : tr(T("LIVE DATA", "लाइव डेटा", "प्रत्यक्ष डेटा"))}</span>
                  {m.key === "live" && <span className="alr-badge">{tr(T("ON MAP", "नक्शे पर", "नक्सामा"))}</span>}
                </div>
              </div>
              <div className="alr-mode-body">
                <h3>{m.key === "past" ? tr(T("Past flood data", "पिछली बाढ़ का डेटा", "विगतको बाढी डेटा")) : tr(T("Live rainfall", "लाइव वर्षा", "प्रत्यक्ष वर्षा"))}</h3>
                <p className="alr-mode-lead">
                  {m.key === "past"
                    ? tr(T("Recorded floods from 2015–2024, replayed with sample rainfall from the 27–29 September 2024 deluge."))
                    : tr(T("Open-Meteo rainfall from the last 72 hours plus the next 24-hour forecast, scored against every ward."))}
                </p>
                <p className="alr-mode-meta">
                  {m.rowsFor.length
                    ? `${tr(T("Valley average", "घाटी का औसत", "उपत्यकाको औसत"))} ${m.stats.avg} mm ${tr(T("in 72h", "72 घंटे में", "72 घण्टामा"))} · ${tr(T("peak", "अधिकतम", "उच्चतम"))} ${m.stats.peak} mm.`
                    : tr(T("Loading live data…", "लाइव डेटा लोड हो रहा है…", "प्रत्यक्ष डेटा लोड हुँदैछ…"))}
                </p>
                <div className="alr-stats">
                  {CATEGORIES.map((c) => (
                    <div key={c.key} className="alr-stat">
                      <b style={{ color: c.color }}>{m.rowsFor.length ? m.counts[c.key] : "–"}</b>
                      <span>{tr(CAT_LABEL[c.key])}</span>
                    </div>
                  ))}
                </div>
                {mode === m.key ? (
                  <span className="alr-showing">{tr(T("Showing on map →", "नक्शे पर दिख रहा है →", "नक्सामा देखाइँदै →"))}</span>
                ) : (
                  <button type="button" className="btn btn-primary alr-showbtn" onClick={() => showMode(m.key)}>
                    {m.key === "past" ? tr(T("Show past data on map →", "पुराना डेटा नक्शे पर दिखाएँ →", "विगत डेटा नक्सामा देखाउनुहोस् →")) : tr(T("Show live data on map →", "लाइव डेटा नक्शे पर दिखाएँ →", "प्रत्यक्ष डेटा नक्सामा देखाउनुहोस् →"))}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ================= RISK INDEX TABLE ================= */}
      <section className="section" id="risk-index">
        <p className="eyebrow">{tr(T("RISK INDEX", "जोखिम सूचकांक", "जोखिम सूचकांक"))}</p>
        <h2>
          {tr(T("Every ward,", "हर वार्ड,", "हरेक वडा,"))} <span className="accent">{tr(T("ranked", "क्रमबद्ध", "क्रमबद्ध"))}</span> {tr(T("by flood risk", "बाढ़ जोखिम के अनुसार", "बाढी जोखिम अनुसार"))}
        </h2>

        <div className="alr-filters">
          <label className="alr-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr(T("Search area, ward or river (e.g. Balkhu, Teku)", "इलाका, वार्ड या नदी खोजें (जैसे Balkhu, Teku)", "क्षेत्र, वडा वा नदी खोज्नुहोस् (जस्तै Balkhu, Teku)"))}
            />
          </label>
          <div className="alr-chiprow">
            {["all", "severe", "high", "moderate", "low"].map(catChip)}
            {[
              ["score", T("Sort: Risk score", "क्रम: जोखिम अंक", "क्रम: जोखिम अंक")],
              ["rain", T("Sort: 72h rain", "क्रम: 72घं बारिश", "क्रम: 72घ वर्षा")],
              ["people", T("Sort: People", "क्रम: लोग", "क्रम: मानिस")],
            ].map(([k, label]) => (
              <button key={k} type="button" className={`alr-chipbtn alr-sort ${sortBy === k ? "on" : ""}`} onClick={() => setSortBy(k)}>{tr(label)}</button>
            ))}
          </div>
        </div>

        <div className="alr-table" role="table">
          <div className="alr-tr alr-th" role="row">
            <span>#</span>
            <span>{tr(T("AREA", "इलाका", "क्षेत्र"))}</span>
            <span>{tr(T("RIVER", "नदी", "नदी"))}</span>
            <span>{tr(T("PAST FLOODS", "पिछली बाढ़ें", "विगतका बाढी"))}</span>
            <span>{tr(T("RAIN 72H", "बारिश 72घं", "वर्षा 72घ"))}</span>
            <span>{tr(T("NEXT 24H", "अगले 24घं", "अर्को 24घ"))}</span>
            <span>{tr(T("RISK INDEX", "जोखिम सूचकांक", "जोखिम सूचकांक"))}</span>
            <span>{tr(T("CATEGORY", "श्रेणी", "श्रेणी"))}</span>
          </div>
          {!rows.length && <div className="alr-empty">{tr(T("Loading live data…", "लाइव डेटा लोड हो रहा है…", "प्रत्यक्ष डेटा लोड हुँदैछ…"))}</div>}
          {rows.length > 0 && !filtered.length && <div className="alr-empty">{tr(T("No areas match your search.", "कोई इलाका नहीं मिला।", "कुनै क्षेत्र फेला परेन।"))}</div>}
          {filtered.map((a, i) => (
            <button type="button" key={a.id} className={`alr-tr alr-row ${a.id === selectedId ? "is-sel" : ""}`} role="row" onClick={() => pickArea(a.id, "prediction")}>
              <span className="alr-rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="alr-area"><b>{a.name}</b><small>{a.ward} · {fmtPeople(a.people)} {tr(T("people", "लोग", "मानिस"))}</small></span>
              <span className="alr-river">{a.river}</span>
              <span>{a.floods} {tr(T("events", "घटनाएँ", "घटना"))}</span>
              <span>{Math.round(a.past72)} mm</span>
              <span>{Math.round(a.next24)} mm</span>
              <span className="alr-idx">
                <b>{a.index}</b>
                <i><em style={{ width: `${a.index}%`, background: a.category.color }} /></i>
              </span>
              <span><span className="alr-pill alr-pill--sm" style={{ borderColor: a.category.color, color: a.category.color }}>{tr(CAT_LABEL[a.category.key])}</span></span>
            </button>
          ))}
        </div>
        <p className="note">{tr(T("Click a row to see the flood prediction for that area."))}</p>
      </section>

      {/* ================= FLOOD PREDICTION (new) ================= */}
      <section className="section" id="prediction">
        <p className="eyebrow">{tr(T("FLOOD PREDICTION", "बाढ़ पूर्वानुमान", "बाढी पूर्वानुमान"))}</p>
        <h2>
          {tr(T("Is it getting", "क्या स्थिति", "के अवस्था"))} <span className="accent">{tr(T("worse", "बिगड़ रही है", "बिग्रँदै छ"))}</span>?
        </h2>

        <div className="alr-predbar">
          <label className="alr-selectwrap">
            <span className="alr-mono">{tr(T("SELECTED AREA", "चुना हुआ इलाका", "छानिएको क्षेत्र"))}</span>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={load} disabled={loading}>
            {loading ? tr(T("Refreshing…", "रिफ्रेश हो रहा है…", "रिफ्रेस हुँदैछ…")) : tr(T("Refresh now", "अभी रिफ्रेश करें", "अहिले रिफ्रेस गर्नुहोस्"))}
          </button>
          <div className="alr-live">
            <span className={`alr-pulse ${error ? "is-err" : ""}`} />
            <span className="alr-mono">{updatedLabel} · {tr(T("AUTO-REFRESH IN", "ऑटो-रिफ्रेश", "स्वतः-रिफ्रेस"))} {mmss(nextAt - now)}</span>
          </div>
        </div>
        {mode === "past" && (
          <div className="alr-notice">{tr(T("Past data is selected, so this section shows the replayed September 2024 sample rainfall. Switch to Live data for current conditions."))}</div>
        )}
        {error && (
          <div className="alr-error">{error}.{live ? " Showing the last data that loaded. Will retry automatically." : " Will retry automatically."}</div>
        )}

        {!sel ? (
          <div className="alr-card alr-skeleton">{tr(T("Loading live data for the selected area…", "चुने हुए इलाके का लाइव डेटा लोड हो रहा है…", "छानिएको क्षेत्रको प्रत्यक्ष डेटा लोड हुँदैछ…"))}</div>
        ) : (
          <div className="alr-predgrid">
            {/* existing risk category */}
            <div className="alr-card">
              <div className="alr-mono alr-label">{tr(T("RISK CATEGORY", "जोखिम श्रेणी", "जोखिम श्रेणी"))} · {sel.ward.toUpperCase()}</div>
              <h3 className="alr-h3">{sel.name}</h3>
              <div className="alr-bigrow">
                <span className="alr-bignum" style={{ color: sel.category.color }}>{sel.index}</span>
                <span className="alr-pill" style={{ borderColor: sel.category.color, color: sel.category.color }}>{tr(CAT_LABEL[sel.category.key])}</span>
              </div>
              <div className="alr-bar"><em style={{ width: `${sel.index}%`, background: sel.category.color }} /></div>
              <p className="alr-sub">
                {tr(T("Past floods", "पिछली बाढ़ें", "विगतका बाढी"))} {sel.past}/100 · {tr(T("rain score", "बारिश अंक", "वर्षा अंक"))} {Math.round(sel.rain100)}/100
              </p>
              <div className="alr-bands">
                {CATEGORIES.map((c) => <span key={c.key} style={{ color: c.color }}>{tr(CAT_LABEL[c.key])} {c.min}+</span>)}
              </div>
            </div>

            {/* separate flood prediction status */}
            <div className={`alr-card alr-pred alr-pred--${sel.prediction.status}`}>
              <div className="alr-mono alr-label">{tr(T("FLOOD PREDICTION", "बाढ़ पूर्वानुमान", "बाढी पूर्वानुमान"))}</div>
              <div className="alr-predrow">
                <span className="alr-predbadge">{tr(STATUS_LABEL[sel.prediction.status].label)}</span>
                <span className="alr-predtext">{tr(STATUS_LABEL[sel.prediction.status].text)}</span>
              </div>
              <ul className="alr-reasons">
                {sel.prediction.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              <div className="alr-source">
                <span className={`alr-tag alr-tag--${sel.prediction.source}`}>{sel.prediction.source === "external" ? "EXTERNAL" : "LOCAL"}</span>
                {sel.prediction.sourceLabel}
              </div>
            </div>

            {/* local score + drivers */}
            <div className="alr-card alr-local">
              <div className="alr-mono alr-label">{tr(T("LOCAL FLOOD-RISK SCORE · RAINFALL + TERRAIN + RIVER", "स्थानीय बाढ़-जोखिम अंक · बारिश + भू-भाग + नदी", "स्थानीय बाढी-जोखिम अंक · वर्षा + भू-बनोट + नदी"))}</div>
              <div className="alr-bigrow">
                <span className="alr-bignum" style={{ color: sel.local.category.color }}>{sel.local.score}<small>/100</small></span>
                <span className="alr-pill" style={{ borderColor: sel.local.category.color, color: sel.local.category.color }}>{tr(CAT_LABEL[sel.local.category.key])}</span>
              </div>
              <div className="alr-drivers">
                {sel.local.drivers.map((d) => (
                  <div key={d.key} className="alr-driver">
                    <div className="alr-driver-top">
                      <strong>
                        {tr(DRIVER_LABEL[d.key])}
                        {sel.local.topDriver === d.key && <span className="alr-top">{tr(T("TOP DRIVER", "मुख्य कारक", "मुख्य कारक"))}</span>}
                      </strong>
                      <span className="alr-mono">{d.points.toFixed(1)} / {d.max}</span>
                    </div>
                    <div className="alr-bar alr-bar--sm"><em style={{ width: `${(d.points / d.max) * 100}%`, background: sel.local.category.color }} /></div>
                    <p>{d.detail}</p>
                  </div>
                ))}
              </div>
              <p className="alr-sub">
                {tr(T("Score = rainfall", "अंक = बारिश", "अंक = वर्षा"))} ({WEIGHTS.rain}) + {tr(T("terrain", "भू-भाग", "भू-बनोट"))} ({WEIGHTS.terrain}) + {tr(T("river proximity", "नदी निकटता", "नदी निकटता"))} ({WEIGHTS.river}). {tr(T("The category above says how exposed the area is; the prediction says whether conditions are changing."))}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ================= NEPAL FLOODS ================= */}
      <section className="section nepal" id="nepal">
        <p className="eyebrow">{tr(T("FLOODS IN NEPAL", "नेपाल में बाढ़", "नेपालमा बाढी"))}</p>
        <h2>
          {tr(T("A valley that", "एक घाटी जो", "एउटा उपत्यका जसले"))} <span className="accent">{tr(T("drains", "समेटती है", "बगाउँछ"))}</span> {tr(T("a nation's monsoon", "एक देश का मानसून", "एउटा देशको मनसुन"))}
        </h2>
        <div className="nepal-grid">
          <div className="nepal-text">
            <p className="nepal-intro">
              {tr(T("Kathmandu sits in a bowl where the Bagmati, Bishnumati, Manohara, Hanumante and Nakkhu meet. Rapid urbanisation has narrowed their banks, so a single intense storm can turn riverside wards into floodplains within hours."))}
            </p>
            <div className="nepal-facts">
              {NEPAL_FACTS.map((f) => (
                <div className="nepal-fact" key={f.value}>
                  <div className="nepal-fact-value">{f.value}</div>
                  <div className="nepal-fact-label">{tr(f.label)}</div>
                </div>
              ))}
            </div>
            <div className="timeline">
              {NEPAL_EVENTS.map((e) => (
                <div className="timeline-item" key={e.year}>
                  <span className="timeline-year">{e.year}</span>
                  <div>
                    <h3>{tr(e.title)}</h3>
                    <p>{tr(e.text)}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="note">{tr(T("Figures are approximate. Check official sources (DHM, NDRRMA) for current numbers.", "आँकड़े अनुमानित हैं। ताज़ा संख्याओं के लिए DHM, NDRRMA जैसे आधिकारिक स्रोत देखें।", "आँकडा अनुमानित हुन्। हालको तथ्यांकका लागि DHM, NDRRMA जस्ता आधिकारिक स्रोत हेर्नुहोस्।"))}</p>
          </div>

          <div className="hero-map nepal-map alr-nepal">
            <div ref={nepalEl} className="alr-map" />
            <div className="alr-chip alr-chip--sm">
              <b>{tr(T("NEPAL · MAJOR FLOOD EVENTS", "नेपाल · प्रमुख बाढ़ घटनाएँ", "नेपाल · प्रमुख बाढी घटना"))}</b>
              <br />
              {tr(T("Hover over a marker for details", "विवरण के लिए मार्कर पर जाएँ", "विवरणका लागि मार्करमा जानुहोस्"))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= METHOD ================= */}
      <section className="section" id="method">
        <p className="eyebrow">{tr(T("METHOD", "विधि", "विधि"))}</p>
        <h2>{tr(T("Transparent maths, not a black box.", "पारदर्शी गणित, ब्लैक बॉक्स नहीं।", "पारदर्शी गणित, ब्ल्याक बक्स होइन।"))}</h2>
        <div className="alr-method">
          <div className="alr-card">
            <span className="alr-mono alr-label">{tr(T("RISK INDEX", "जोखिम सूचकांक", "जोखिम सूचकांक"))}</span>
            <h3 className="alr-h3">{tr(T("Past floods + rain", "पिछली बाढ़ + बारिश", "विगतका बाढी + वर्षा"))}</h3>
            <pre>{"index = 0.64 × past-flood score\n      + 0.36 × rain score\nrain score = 0.4 × rain 72h\n           + 1.0 × rain next 24h\n(max 100)"}</pre>
            <p>Severe 80+ · High 60+ · Moderate 35+ · Low below 35.</p>
          </div>
          <div className="alr-card">
            <span className="alr-mono alr-label">{tr(T("LOCAL SCORE", "स्थानीय अंक", "स्थानीय अंक"))}</span>
            <h3 className="alr-h3">{tr(T("Rain + terrain + river", "बारिश + भू-भाग + नदी", "वर्षा + भू-बनोट + नदी"))}</h3>
            <pre>{"score = rainfall   (0–40)\n      + terrain    (0–30)\n      + river      (0–30)\nterrain: 1,280 m → 30, 1,400 m+ → 0\nriver:   150 m → 30, 1,500 m+ → 0"}</pre>
            <p>Elevation from Open-Meteo (about 90 m grid). Rivers are approximate centrelines.</p>
          </div>
          <div className="alr-card">
            <span className="alr-mono alr-label">{tr(T("PREDICTION", "पूर्वानुमान", "पूर्वानुमान"))}</span>
            <h3 className="alr-h3">{tr(T("External first, local fallback", "पहले बाहरी, फिर स्थानीय", "पहिले बाह्य, पछि स्थानीय"))}</h3>
            <pre>{"1. river-flow forecast (GloFAS):\n   peak next 3 days ÷ last 3 days\n2. else: next-24h rain vs the\n   recent daily average\nNormal · Watch · Worsening"}</pre>
            <p>Refreshes every 5 minutes. Decision support, not a safety guarantee.</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default function Alert() {
  return (
    <LangProvider>
      <AlertPage />
    </LangProvider>
  );
}