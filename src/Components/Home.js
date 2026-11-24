// Home.js — SETU (Flood Risk & Emergency Safe-Route Mapper) · English / Hindi / Nepali
import React, { createContext, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { geoConicConformal, geoMercator, geoCentroid, geoPath, geoGraticule10 } from "d3-geo";
import { feature, mesh } from "topojson-client";
import "./Home.css";
import setuLogo from "./Setu.jpg"; // Setu.jpg sits in the same Components folder

// ---------- LANGUAGE ----------
const LangContext = createContext(null);

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ne", label: "नेपाली" },
];

function LangProvider({ children }) {
  const [lang, setLang] = useState("en");
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

// tr({ en: "...", hi: "...", ne: "..." }) -> string in the active language (falls back to English)
function useLang() {
  const { lang, setLang } = useContext(LangContext);
  const tr = (o) => (typeof o === "string" ? o : o[lang] ?? o.en);
  return { lang, setLang, tr };
}

// ---------- INDIA MAP (hero) ----------
const MAP_URL = "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@main/topojson/india.json";
const W = 600, H = 680;

const HOTSPOTS = [
  { name: { en: "Mumbai", hi: "मुंबई", ne: "मुम्बई" }, note: { en: "Recorded flood · 2005", hi: "रिकॉर्ड बाढ़ · 2005", ne: "रेकर्ड बाढी · 2005" }, coords: [72.88, 19.07] },
  { name: { en: "Chennai", hi: "चेन्नई", ne: "चेन्नई" }, note: { en: "Recorded flood · 2015", hi: "रिकॉर्ड बाढ़ · 2015", ne: "रेकर्ड बाढी · 2015" }, coords: [80.27, 13.08] },
  { name: { en: "Kerala", hi: "केरल", ne: "केरल" }, note: { en: "Recorded floods · 2018", hi: "रिकॉर्ड बाढ़ें · 2018", ne: "रेकर्ड बाढी · 2018" }, coords: [76.27, 9.93] },
];

const STATE_RISK = {
  Assam: 0.9, Bihar: 0.85, "West Bengal": 0.75, Kerala: 0.8, Odisha: 0.7,
  "Uttar Pradesh": 0.6, Maharashtra: 0.55, Gujarat: 0.5, "Andhra Pradesh": 0.55,
  "Tamil Nadu": 0.5, Uttarakhand: 0.45, "Jammu and Kashmir": 0.4,
};
const COLORS = ["#0f3644", "#14516a", "#1d7792", "#2fa3b8", "#7fcfb0", "#e2b04f", "#e07a3a"];

function riskColor(d, i) {
  const base = STATE_RISK[d.properties.st_nm] ?? 0.3;
  const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const r = Math.min(0.999, Math.max(0, base + (Math.abs(noise) - 0.5) * 0.5));
  return COLORS[Math.floor(r * COLORS.length)];
}

function IndiaMap() {
  const { tr } = useLang();
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    fetch(MAP_URL)
      .then((r) => r.json())
      .then((topo) => {
        const districts = feature(topo, topo.objects.districts);
        const borders = mesh(topo, topo.objects.states, (a, b) => a !== b);
        const projection = geoConicConformal()
          .rotate([-80, 0]).parallels([12, 28])
          .fitExtent([[30, 30], [W - 30, H - 30]], districts);
        setGeo({ districts, borders, path: geoPath(projection), projection });
      })
      .catch(() => setGeo(null));
  }, []);

  return (
    <svg className="india-svg" viewBox={`0 0 ${W} ${H}`}>
      {geo && (
        <>
          <path className="graticule" d={geo.path(geoGraticule10())} />
          <g>
            {geo.districts.features.map((d, i) => (
              <path key={i} className="district" d={geo.path(d)} fill={riskColor(d, i)}>
                <title>{d.properties.district}, {d.properties.st_nm}</title>
              </path>
            ))}
          </g>
          <path className="state-border" d={geo.path(geo.borders)} />
          {HOTSPOTS.map((h) => {
            const [x, y] = geo.projection(h.coords);
            return (
              <g key={h.name.en} className="hotspot-g">
                <line x1={x} y1={y} x2={x + 40} y2={y} className="tip-line" />
                <circle cx={x} cy={y} r="7" className="pin-dot" />
                <foreignObject x={x + 40} y={y - 24} width="170" height="50">
                  <div className="tip"><strong>{tr(h.name)}</strong><span>{tr(h.note)}</span></div>
                </foreignObject>
              </g>
            );
          })}
        </>
      )}
      {!geo && <text x={W / 2} y={H / 2} className="map-loading">{tr({ en: "Loading map…", hi: "मानचित्र लोड हो रहा है…", ne: "नक्सा लोड हुँदैछ…" })}</text>}
    </svg>
  );
}

// ---------- NEPAL DATA + MAP ----------
const NEPAL_URLS = [
  "https://cdn.jsdelivr.net/gh/mesaugat/geoJSON-Nepal@master/nepal-districts.geojson",
  "https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-districts.geojson",
];
const NW = 640, NH = 360;

const NEPAL_CITIES = [
  { name: { en: "Kathmandu", hi: "काठमांडू", ne: "काठमाडौँ" }, note: { en: "Floods · Sept 2024", hi: "बाढ़ · सितंबर 2024", ne: "बाढी · सेप्टेम्बर 2024" }, coords: [85.32, 27.71] },
  { name: { en: "Biratnagar", hi: "बिराटनगर", ne: "बिराटनगर" }, note: { en: "Koshi plains", hi: "कोसी के मैदान", ne: "कोसी तटीय मैदान" }, coords: [87.28, 26.45] },
  { name: { en: "Nepalgunj", hi: "नेपालगंज", ne: "नेपालगञ्ज" }, note: { en: "Terai floods · 2017", hi: "तराई बाढ़ · 2017", ne: "तराई बाढी · 2017" }, coords: [81.62, 28.05] },
];

const NEPAL_EVENTS = [
  {
    year: "2008",
    title: { en: "Koshi embankment breach", hi: "कोसी तटबंध टूटा", ne: "कोसी तटबन्ध फुट्यो" },
    text: {
      en: "The Koshi river broke its embankment and changed course, displacing tens of thousands of people in Nepal and India.",
      hi: "कोसी नदी ने अपना तटबंध तोड़ा और धारा बदल दी, जिससे नेपाल और भारत में हज़ारों लोग विस्थापित हुए।",
      ne: "कोसी नदीले तटबन्ध तोडेर आफ्नो बहाव बदल्यो, जसले नेपाल र भारतमा हजारौँ मानिसलाई विस्थापित गर्‍यो।",
    },
  },
  {
    year: "2017",
    title: { en: "Terai floods", hi: "तराई में बाढ़", ne: "तराईमा बाढी" },
    text: {
      en: "Heavy August monsoon rain flooded much of the southern plains, affecting over a million people and cutting key highways.",
      hi: "अगस्त के मानसून की भारी बारिश ने दक्षिणी मैदानों के बड़े हिस्से को डुबो दिया, दस लाख से अधिक लोग प्रभावित हुए और प्रमुख राजमार्ग कट गए।",
      ne: "अगस्टको मनसुनी भारी वर्षाले दक्षिणी मैदानको ठूलो भाग डुबायो, दस लाखभन्दा बढी मानिस प्रभावित भए र प्रमुख राजमार्गहरू अवरुद्ध भए।",
    },
  },
  {
    year: "2021",
    title: { en: "Melamchi flood", hi: "मेलामची बाढ़", ne: "मेलम्ची बाढी" },
    text: {
      en: "A sudden flood in June 2021 destroyed the Melamchi water-supply headworks and washed away bridges and homes.",
      hi: "जून 2021 में अचानक आई बाढ़ ने मेलामची जल-आपूर्ति का मुख्य स्रोत नष्ट कर दिया और पुल व घर बहा दिए।",
      ne: "जुन 2021 मा आएको अचानक बाढीले मेलम्ची खानेपानी आयोजनाको हेडवर्क्स नष्ट गर्‍यो र पुल तथा घरहरू बगायो।",
    },
  },
  {
    year: "2024",
    title: { en: "Kathmandu valley floods", hi: "काठमांडू घाटी में बाढ़", ne: "काठमाडौँ उपत्यकामा बाढी" },
    text: {
      en: "In late September, record rainfall caused floods and landslides across the country, with over 200 deaths and heavy damage in and around Kathmandu.",
      hi: "सितंबर के अंत में रिकॉर्ड बारिश से देशभर में बाढ़ और भूस्खलन हुए, 200 से अधिक मौतें हुईं और काठमांडू में व उसके आसपास भारी नुकसान हुआ।",
      ne: "सेप्टेम्बरको अन्त्यमा रेकर्ड वर्षाले देशभर बाढी र पहिरो ल्यायो, 200 भन्दा बढीको मृत्यु भयो र काठमाडौँ र वरपर ठूलो क्षति भयो।",
    },
  },
];

const NEPAL_FACTS = [
  { value: "~80%", label: { en: "of Nepal's yearly rain falls in the June–September monsoon", hi: "नेपाल की सालाना बारिश का लगभग हिस्सा जून–सितंबर के मानसून में गिरता है", ne: "नेपालको वार्षिक वर्षाको लगभग 80% जुन–सेप्टेम्बरको मनसुनमा पर्छ" } },
  { value: "6,000+", label: { en: "rivers and streams drain steep Himalayan slopes to the Terai plains", hi: "नदियाँ और नाले हिमालय की ढलानों से तराई के मैदानों तक पानी पहुँचाते हैं", ne: "खोला र नदीहरूले हिमाली भिरालोबाट तराईका मैदानसम्म पानी बगाउँछन्" } },
  { value: "GLOF", label: { en: "glacial lake outburst floods are a growing mountain risk", hi: "हिमनद झील फटने से आने वाली बाढ़ पहाड़ों में बढ़ता खतरा है", ne: "हिमताल विस्फोटबाट आउने बाढी पहाडमा बढ्दो जोखिम हो" } },
];

// Load the Nepal map once and share it between all Nepal maps on the page
let nepalPromise = null;
function loadNepal() {
  if (!nepalPromise) {
    nepalPromise = (async () => {
      for (const url of NEPAL_URLS) {
        try {
          const data = await (await fetch(url)).json();
          const projection = geoMercator().fitExtent([[20, 20], [NW - 20, NH - 20]], data);
          return { data, path: geoPath(projection), projection };
        } catch (e) { /* try next URL */ }
      }
      nepalPromise = null;
      return null;
    })();
  }
  return nepalPromise;
}

const PAST_COLORS = ["#eef6f7", "#d6e9eb", "#b8dadf", "#8fc4cc", "#6fb3b8", "#e2b04f", "#e07a3a"];
const RAIN_CELLS = [[85.3, 27.8], [83.9, 27.6], [87.0, 26.9], [81.9, 28.3]];

function NepalMap({ variant = "atlas", showCities = false }) {
  const { tr } = useLang();
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadNepal().then((g) => { if (!cancelled) setGeo(g); });
    return () => { cancelled = true; };
  }, []);

  const colorFor = (d, i) => {
    const lat = geoCentroid(d)[1];
    let base = lat < 27 ? 0.85 : lat < 27.8 ? 0.6 : lat < 28.8 ? 0.35 : 0.15;
    if (variant === "atlas") base += 0.12;
    const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const r = Math.min(0.999, Math.max(0, base + (Math.abs(noise) - 0.5) * 0.3));
    const idx = Math.floor(r * COLORS.length);
    if (variant === "past") return PAST_COLORS[idx];
    if (variant === "live") return COLORS[Math.max(0, idx - 1)];
    return COLORS[idx];
  };

  return (
    <svg className="nepal-svg" viewBox={`0 0 ${NW} ${NH}`} preserveAspectRatio="xMidYMid meet">
      {geo && (
        <>
          <g>
            {geo.data.features.map((d, i) => {
              const p = d.properties || {};
              const name = p.DISTRICT || p.FIRST_DIST || p.district || p.name || "District";
              return (
                <path
                  key={i}
                  className={`district ${variant === "past" ? "district-light" : ""}`}
                  d={geo.path(d)}
                  fill={colorFor(d, i)}
                >
                  <title>{name}</title>
                </path>
              );
            })}
          </g>
          {variant === "live" && RAIN_CELLS.map((c, i) => {
            const [x, y] = geo.projection(c);
            return <circle key={i} cx={x} cy={y} r="26" className="rain-cell" style={{ animationDelay: `${i * 0.5}s` }} />;
          })}
          {showCities && NEPAL_CITIES.map((h) => {
            const [x, y] = geo.projection(h.coords);
            return (
              <g key={h.name.en}>
                <circle cx={x} cy={y} r="5" className="pin-dot" />
                <foreignObject x={x + 8} y={y - 22} width="150" height="46">
                  <div className="tip"><strong>{tr(h.name)}</strong><span>{tr(h.note)}</span></div>
                </foreignObject>
              </g>
            );
          })}
        </>
      )}
      {!geo && <text x={NW / 2} y={NH / 2} className="map-loading">{tr({ en: "Loading Nepal map…", hi: "नेपाल मानचित्र लोड हो रहा है…", ne: "नेपालको नक्सा लोड हुँदैछ…" })}</text>}
    </svg>
  );
}

// ---------- PLAN / ALERT / RESPOND ----------
// Icons removed: each card now shows a large title word instead.
const CYCLE = [
  {
    key: "plan",
    num: "01",
    title: { en: "Plan", hi: "योजना", ne: "योजना" },
    tag: { en: "BEFORE THE RAIN", hi: "बारिश से पहले", ne: "वर्षा अघि" },
    desc: {
      en: "Study the historical flood record for your district and check which roads are safe before the monsoon begins. Build your safest route in advance.",
      hi: "मानसून शुरू होने से पहले अपने ज़िले का ऐतिहासिक बाढ़ रिकॉर्ड देखें और जानें कि कौन-सी सड़कें सुरक्षित हैं। अपना सबसे सुरक्षित मार्ग पहले से तय करें।",
      ne: "मनसुन सुरु हुनुअघि आफ्नो जिल्लाको ऐतिहासिक बाढी अभिलेख हेर्नुहोस् र कुन सडक सुरक्षित छन् जाँच गर्नुहोस्। आफ्नो सबैभन्दा सुरक्षित मार्ग पहिल्यै तय गर्नुहोस्।",
    },
    chips: [
      { en: "Past records", hi: "पुराने रिकॉर्ड", ne: "पुराना अभिलेख" },
      { en: "Route check", hi: "मार्ग जाँच", ne: "मार्ग जाँच" },
      { en: "Dashboard", hi: "डैशबोर्ड", ne: "ड्यासबोर्ड" },
    ],
    to: "/dashboard",
    cta: { en: "Open dashboard →", hi: "डैशबोर्ड खोलें →", ne: "ड्यासबोर्ड खोल्नुहोस् →" },
  },
  {
    key: "alert",
    num: "02",
    title: { en: "Alert", hi: "अलर्ट", ne: "अलर्ट" },
    tag: { en: "WHEN IT RAINS", hi: "बारिश के समय", ne: "वर्षाको समयमा" },
    desc: {
      en: "Rain is tracked in millimetres. When risk rises, you are notified with quick measures, the nearest shelter and a safer route.",
      hi: "बारिश को मिलीमीटर में मापा जाता है। जोखिम बढ़ने पर आपको त्वरित उपायों, नज़दीकी आश्रय और सुरक्षित मार्ग की सूचना मिलती है।",
      ne: "वर्षा मिलिमिटरमा नापिन्छ। जोखिम बढ्दा तपाईंलाई छिटो उपाय, नजिकको आश्रयस्थल र सुरक्षित मार्गबारे सूचना दिइन्छ।",
    },
    chips: [
      { en: "Notify", hi: "सूचना", ne: "सूचना" },
      { en: "Quick measures", hi: "त्वरित उपाय", ne: "छिटो उपाय" },
      { en: "Find shelter", hi: "आश्रय खोजें", ne: "आश्रय खोज्नुहोस्" },
      { en: "Find route", hi: "मार्ग खोजें", ne: "मार्ग खोज्नुहोस्" },
      { en: "Rain (mm)", hi: "बारिश (मिमी)", ne: "वर्षा (मिमी)" },
    ],
    to: "/Alert",
    cta: { en: "View alerts →", hi: "अलर्ट देखें →", ne: "अलर्ट हेर्नुहोस् →" },
  },
  {
    key: "respond",
    num: "03",
    title: { en: "Respond", hi: "प्रतिक्रिया", ne: "प्रतिक्रिया" },
    tag: { en: "AFTER THE FLOOD", hi: "बाढ़ के बाद", ne: "बाढीपछि" },
    desc: {
      en: "After a flood, ambulances reach people first. Food and medical supplies are then routed to where they are needed most.",
      hi: "बाढ़ के बाद सबसे पहले एम्बुलेंस लोगों तक पहुँचती हैं। फिर भोजन और चिकित्सा सामग्री वहाँ पहुँचाई जाती है जहाँ उनकी सबसे ज़्यादा ज़रूरत हो।",
      ne: "बाढीपछि सबैभन्दा पहिले एम्बुलेन्सले मानिसहरूसम्म पुग्छ। त्यसपछि खाद्यान्न र औषधि सामग्री सबैभन्दा बढी आवश्यक ठाउँमा पुर्‍याइन्छ।",
    },
    chips: [
      { en: "Ambulance", hi: "एम्बुलेंस", ne: "एम्बुलेन्स" },
      { en: "Food supply", hi: "खाद्य आपूर्ति", ne: "खाद्य आपूर्ति" },
      { en: "Medical supply", hi: "चिकित्सा आपूर्ति", ne: "औषधि आपूर्ति" },
    ],
    to: "/Respond",
    cta: { en: "See response plan →", hi: "प्रतिक्रिया योजना देखें →", ne: "प्रतिक्रिया योजना हेर्नुहोस् →" },
  },
];

// Big title style (replaces the old icon). Inline so Home.css needs no change.
const CYCLE_TITLE_STYLE = {
  fontSize: "clamp(2.6rem, 4.6vw, 3.8rem)",
  lineHeight: 1.05,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: "6px 0 14px",
};

function CycleSection() {
  const { tr } = useLang();
  return (
    <section className="section cycle" id="cycle">
      <div className="cycle-head">
        <p className="eyebrow">{tr({ en: "THE SETU CYCLE", hi: "SETU चक्र", ne: "SETU चक्र" })}</p>
        <h2>{tr({ en: "Plan. Alert. Respond.", hi: "योजना। अलर्ट। प्रतिक्रिया।", ne: "योजना। अलर्ट। प्रतिक्रिया।" })}</h2>
        <p className="cycle-intro">
          {tr({
            en: "Dealing with a flood happens in three stages: preparing before the rain, getting warned while it falls, and giving fast help once the water has risen. SETU connects all three, so the right information reaches you at each stage.",
            hi: "बाढ़ से निपटना तीन चरणों में होता है: बारिश से पहले तैयारी, बारिश के दौरान चेतावनी, और पानी बढ़ने के बाद त्वरित सहायता। SETU तीनों को जोड़ता है, ताकि हर चरण पर सही जानकारी सही समय पर आपके पास पहुँचे।",
            ne: "बाढीको सामना तीन चरणमा हुन्छ: वर्षाअघि तयारी, वर्षाको बेला चेतावनी, र पानी बढेपछि छिटो सहयोग। SETU ले तीनै चरणलाई जोड्छ, ताकि हरेक चरणमा सही जानकारी तपाईंसम्म पुगोस्।",
          })}
        </p>
      </div>

      <div className="cycle-grid">
        {CYCLE.map((c) => (
          <Link to={c.to} key={c.key} className={`cycle-card cycle-${c.key}`}>
            <div className="cycle-top">
              <span className="cycle-num">{c.num}</span>
            </div>
            <span className="cycle-tag">{tr(c.tag)}</span>
            <h3 style={CYCLE_TITLE_STYLE}>{tr(c.title)}</h3>
            <p>{tr(c.desc)}</p>
            <div className="cycle-chips">
              {c.chips.map((ch) => (
                <span key={ch.en}>{tr(ch)}</span>
              ))}
            </div>
            <span className="cycle-cta">{tr(c.cta)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NepalSection() {
  const { tr } = useLang();
  return (
    <section className="section nepal" id="nepal">
      <p className="eyebrow">{tr({ en: "FLOODS IN NEPAL", hi: "नेपाल में बाढ़", ne: "नेपालमा बाढी" })}</p>
      <h2>{tr({ en: "Why Nepal floods, and why it matters.", hi: "नेपाल में बाढ़ क्यों आती है, और यह क्यों मायने रखता है।", ne: "नेपालमा बाढी किन आउँछ, र यो किन महत्त्वपूर्ण छ।" })}</h2>
      <div className="nepal-grid">
        <div className="nepal-text">
          <p className="nepal-intro">
            {tr({
              en: "Nepal drops from the Himalaya to the Terai plains in under 200 km. During the monsoon, heavy rain runs fast down steep slopes, swelling rivers like the Koshi, Gandaki and Karnali, and triggering landslides and flash floods. The same rain then slows and spreads across the low southern plains, flooding roads and settlements.",
              hi: "नेपाल हिमालय से तराई के मैदानों तक 200 किमी से कम दूरी में उतरता है। मानसून के दौरान तेज़ बारिश खड़ी ढलानों से तेज़ी से बहती है, कोसी, गंडकी और कर्णाली जैसी नदियों को उफनाती है, और भूस्खलन व अचानक बाढ़ लाती है। यही बारिश फिर दक्षिणी निचले मैदानों में धीमी पड़कर फैलती है और सड़कों व बस्तियों को डुबो देती है।",
              ne: "नेपाल हिमालदेखि तराईका मैदानसम्म 200 किमीभन्दा कम दूरीमा झर्छ। मनसुनमा भारी वर्षा ठाडा भिरालोबाट तीव्र गतिमा बग्छ, कोसी, गण्डकी र कर्णाली जस्ता नदीलाई उर्लिन लगाउँछ, र पहिरो तथा अचानक बाढी ल्याउँछ। त्यही वर्षा दक्षिणका होचा मैदानमा ढिलो भएर फैलिन्छ र सडक तथा बस्तीलाई डुबाउँछ।",
            })}
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
          <p className="note">
            {tr({
              en: "Figures are approximate. Check official sources (DHM, NDRRMA) for current numbers.",
              hi: "आँकड़े अनुमानित हैं। ताज़ा संख्याओं के लिए DHM, NDRRMA जैसे आधिकारिक स्रोत देखें।",
              ne: "आँकडा अनुमानित हुन्। हालको तथ्यांकका लागि DHM, NDRRMA जस्ता आधिकारिक स्रोत हेर्नुहोस्।",
            })}
          </p>
        </div>

        <div className="hero-map nepal-map">
          <div className="map-label">
            {tr({ en: "Nepal districts", hi: "नेपाल के ज़िले", ne: "नेपालका जिल्लाहरू" })}<br />
            <small>{tr({ en: "○ Illustrative risk · Terai = higher", hi: "○ उदाहरण जोखिम · तराई = अधिक", ne: "○ उदाहरणात्मक जोखिम · तराई = बढी" })}</small>
          </div>
          <NepalMap variant="atlas" showCities />
          <div className="legend">
            <span className="legend-title">{tr({ en: "FLOOD RISK", hi: "बाढ़ जोखिम", ne: "बाढी जोखिम" })}</span>
            <div className="legend-bar" />
            <div className="legend-scale"><span>{tr({ en: "Low", hi: "कम", ne: "कम" })}</span><span>{tr({ en: "High", hi: "अधिक", ne: "बढी" })}</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- DATA PIPELINE SECTION ----------
const PIPE_INPUTS = [
  { icon: "🌧️", label: { en: "Rainfall", hi: "बारिश", ne: "वर्षा" }, tile: "tile-rain" },
  { icon: "🕒", label: { en: "Flood history", hi: "बाढ़ का इतिहास", ne: "बाढीको इतिहास" }, tile: "tile-history" },
  { icon: "⛰️", label: { en: "Terrain & elevation", hi: "भू-भाग और ऊँचाई", ne: "भू-बनोट र उचाइ" }, tile: "tile-terrain" },
  { icon: "🔀", label: { en: "Drainage network", hi: "जल-निकासी नेटवर्क", ne: "जल निकासी सञ्जाल" }, tile: "tile-drain" },
  { icon: "🛰️", label: { en: "Satellite observations", hi: "उपग्रह अवलोकन", ne: "उपग्रह अवलोकन" }, tile: "tile-sat" },
  { icon: "🌡️", label: { en: "Climate projections", hi: "जलवायु अनुमान", ne: "जलवायु अनुमान" }, tile: "tile-climate" },
];

const PIPE_TOOLS = [
  { icon: "🌐", label: { en: "Geospatial processing", hi: "भू-स्थानिक प्रसंस्करण", ne: "भू-स्थानिक प्रशोधन" } },
  { icon: "🔗", label: { en: "Risk modelling", hi: "जोखिम मॉडलिंग", ne: "जोखिम मोडलिङ" } },
  { icon: "📊", label: { en: "Scenario analysis", hi: "परिदृश्य विश्लेषण", ne: "परिदृश्य विश्लेषण" } },
];

const PIPE_OUTPUTS = [
  { icon: "🌊", title: { en: "Hazard", hi: "खतरा", ne: "खतरा" }, desc: { en: "Where flooding may occur", hi: "बाढ़ कहाँ आ सकती है", ne: "बाढी कहाँ आउन सक्छ" }, tile: "tile-hazard" },
  { icon: "🏢", title: { en: "Exposure", hi: "प्रभाव", ne: "जोखिमको सम्पर्क" }, desc: { en: "What may be affected", hi: "किन पर असर पड़ सकता है", ne: "के कुरा प्रभावित हुन सक्छ" }, tile: "tile-exposure" },
  { icon: "📊", title: { en: "Risk & scenarios", hi: "जोखिम व परिदृश्य", ne: "जोखिम र परिदृश्य" }, desc: { en: "What it means for you", hi: "आपके लिए इसका मतलब", ne: "तपाईंका लागि यसको अर्थ" }, tile: "tile-risk" },
];

const PIPE_USES = [
  { icon: "🛡️", title: { en: "Assess risk", hi: "जोखिम का आकलन", ne: "जोखिम मूल्याङ्कन" }, desc: { en: "Identify vulnerable areas and assets", hi: "संवेदनशील क्षेत्र और संपत्तियाँ पहचानें", ne: "संवेदनशील क्षेत्र र सम्पत्ति पहिचान गर्नुहोस्" } },
  { icon: "📄", title: { en: "Plan and prepare", hi: "योजना और तैयारी", ne: "योजना र तयारी" }, desc: { en: "Strengthen preparedness and response", hi: "तैयारी और प्रतिक्रिया मज़बूत करें", ne: "तयारी र प्रतिक्रिया सुदृढ गर्नुहोस्" } },
  { icon: "📈", title: { en: "Monitor conditions", hi: "स्थिति पर नज़र", ne: "अवस्थाको निगरानी" }, desc: { en: "Track evolving risk in near real time", hi: "बदलते जोखिम को लगभग वास्तविक समय में देखें", ne: "बदलिँदो जोखिम लगभग वास्तविक समयमा हेर्नुहोस्" } },
  { icon: "🚧", title: { en: "Close and reroute", hi: "बंद करें और मार्ग बदलें", ne: "बन्द गर्नुहोस् र मार्ग बदल्नुहोस्" }, desc: { en: "Block flooded roads and recalculate safe routes", hi: "बाढ़ग्रस्त सड़कें बंद करें और सुरक्षित मार्ग दोबारा निकालें", ne: "बाढीले ढाकेका सडक बन्द गर्नुहोस् र सुरक्षित मार्ग पुनः निकाल्नुहोस्" } },
  { icon: "🎯", title: { en: "Prioritise investments", hi: "निवेश की प्राथमिकता", ne: "लगानीको प्राथमिकता" }, desc: { en: "Focus on high-risk areas", hi: "उच्च जोखिम वाले क्षेत्रों पर ध्यान दें", ne: "उच्च जोखिमका क्षेत्रमा ध्यान दिनुहोस्" } },
  { icon: "👥", title: { en: "Respond and build resilience", hi: "प्रतिक्रिया और सहनशीलता", ne: "प्रतिक्रिया र उत्थानशीलता" }, desc: { en: "Support long-term planning", hi: "दीर्घकालिक योजना को सहारा दें", ne: "दीर्घकालीन योजनालाई सहयोग गर्नुहोस्" } },
];

function DataPipeline() {
  const { tr } = useLang();
  return (
    <section className="section" id="data">
      <p className="eyebrow">{tr({ en: "THE DATA BEHIND IT", hi: "इसके पीछे का डेटा", ne: "यसको पछाडिको डेटा" })}</p>
      <h2>{tr({ en: "From raw data to a safe decision.", hi: "कच्चे डेटा से सुरक्षित निर्णय तक।", ne: "कच्चा डेटाबाट सुरक्षित निर्णयसम्म।" })}</h2>
      <div className="pipe">
        <div className="pipe-col pipe-inputs">
          {PIPE_INPUTS.map((p) => (
            <div className="pipe-row" key={p.label.en}>
              <div className="pipe-card"><span className="pipe-icon">{p.icon}</span>{tr(p.label)}</div>
              <div className={`tile ${p.tile}`} />
            </div>
          ))}
        </div>

        <div className="pipe-arrow">›</div>

        <div className="pipe-col pipe-engine">
          <div className="pipe-tools">
            {PIPE_TOOLS.map((t) => (
              <div className="pipe-tool" key={t.label.en}><span>{t.icon}</span>{tr(t.label)}</div>
            ))}
          </div>
          <div className="stack">
            <div className="stack-layer" />
            <div className="stack-layer" />
            <div className="stack-layer"><span className="stack-logo">≈</span></div>
          </div>
        </div>

        <div className="pipe-arrow">›</div>

        <div className="pipe-col pipe-outputs">
          {PIPE_OUTPUTS.map((o) => (
            <div className="pipe-row pipe-row-out" key={o.title.en}>
              <div className={`tile ${o.tile}`} />
              <div className="pipe-card pipe-card-out">
                <strong><span className="pipe-icon">{o.icon}</span>{tr(o.title)}</strong>
                <span>{tr(o.desc)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pipe-arrow">›</div>

        <div className="pipe-col pipe-uses">
          {PIPE_USES.map((u) => (
            <div className="pipe-use" key={u.title.en}>
              <span className="pipe-icon">{u.icon}</span>
              <div>
                <strong>{tr(u.title)}</strong>
                <span>{tr(u.desc)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- THREE WAYS SECTION ----------
const WAYS = [
  {
    variant: "past",
    badges: [{ text: { en: "PAST", hi: "अतीत", ne: "विगत" }, color: "#7fcfb0" }],
    title: { en: "Explorer — explore the past.", hi: "Explorer — अतीत को खोजें।", ne: "Explorer — विगतलाई खोज्नुहोस्।" },
    lead: { en: "Explore district-level historical flood risk across Nepal.", hi: "नेपाल में ज़िला-स्तर पर ऐतिहासिक बाढ़ जोखिम देखें।", ne: "नेपालभरि जिल्ला-स्तरमा ऐतिहासिक बाढी जोखिम हेर्नुहोस्।" },
    text: { en: "Understand where floods have occurred and how historical flood risk varies across Nepal's districts.", hi: "समझें कि बाढ़ कहाँ आई है और नेपाल के ज़िलों में ऐतिहासिक बाढ़ जोखिम कैसे अलग-अलग है।", ne: "बाढी कहाँ आएको छ र नेपालका जिल्लाहरूमा ऐतिहासिक बाढी जोखिम कसरी फरक छ भन्ने बुझ्नुहोस्।" },
  },
  {
    variant: "atlas",
    badges: [
      { text: { en: "PAST +", hi: "अतीत +", ne: "विगत +" }, color: "#7fcfb0" },
      { text: { en: "FUTURE", hi: "भविष्य", ne: "भविष्य" }, color: "#2fa3b8" },
    ],
    title: { en: "Atlas — understand risk across time.", hi: "Atlas — समय के साथ जोखिम समझें।", ne: "Atlas — समयसँगै जोखिम बुझ्नुहोस्।" },
    lead: { en: "Assess historical flood risk and explore how risk could evolve under future scenarios.", hi: "ऐतिहासिक बाढ़ जोखिम का आकलन करें और भविष्य के परिदृश्यों में जोखिम कैसे बदल सकता है, यह देखें।", ne: "ऐतिहासिक बाढी जोखिमको मूल्याङ्कन गर्नुहोस् र भविष्यका परिदृश्यमा जोखिम कसरी बदलिन सक्छ हेर्नुहोस्।" },
    text: { en: "Deeper flood-risk intelligence for planners and professional users.", hi: "योजनाकारों और पेशेवर उपयोगकर्ताओं के लिए गहरी बाढ़-जोखिम जानकारी।", ne: "योजनाकार र पेशेवर प्रयोगकर्ताका लागि गहिरो बाढी-जोखिम जानकारी।" },
  },
  {
    variant: "live",
    badges: [{ text: { en: "NOW", hi: "अभी", ne: "अहिले" }, color: "#e2b04f" }],
    title: { en: "Live — know what's happening now.", hi: "Live — अभी क्या हो रहा है, जानें।", ne: "Live — अहिले के भइरहेको छ, जान्नुहोस्।" },
    lead: { en: "Monitor real-time rainfall and conditions as they evolve.", hi: "वास्तविक समय में बारिश और हालात पर नज़र रखें।", ne: "वास्तविक समयमा वर्षा र अवस्थाको निगरानी गर्नुहोस्।" },
    text: { en: "Built for operational monitoring during the monsoon.", hi: "मानसून के दौरान परिचालन निगरानी के लिए बना।", ne: "मनसुनको समयमा सञ्चालन निगरानीका लागि बनाइएको।" },
  },
];

function ThreeWays() {
  const { tr } = useLang();
  return (
    <section className="section" id="ways">
      <h2 className="center-title">{tr({ en: "Three ways to understand flood risk.", hi: "बाढ़ जोखिम को समझने के तीन तरीके।", ne: "बाढी जोखिम बुझ्ने तीन तरिका।" })}</h2>
      <p className="center-sub">
        {tr({
          en: "Explorer, Atlas and Live are the same flood record at three different depths — start free, go deeper, monitor in real time.",
          hi: "Explorer, Atlas और Live एक ही बाढ़ रिकॉर्ड की तीन अलग गहराइयाँ हैं — मुफ़्त शुरू करें, गहराई में जाएँ, और वास्तविक समय में निगरानी करें।",
          ne: "Explorer, Atlas र Live एउटै बाढी अभिलेखका तीन फरक गहिराइ हुन् — निःशुल्क सुरु गर्नुहोस्, गहिरिनुहोस्, र वास्तविक समयमा निगरानी गर्नुहोस्।",
        })}
      </p>
      <div className="ways-grid">
        {WAYS.map((w) => (
          <article className={`way-card way-${w.variant}`} key={w.variant}>
            <div className="way-map">
              <NepalMap variant={w.variant} />
              <div className="way-badges">
                {w.badges.map((b) => (
                  <span className="way-badge" key={b.text.en}><i style={{ background: b.color }} />{tr(b.text)}</span>
                ))}
              </div>
            </div>
            <div className="way-body">
              <h3>{tr(w.title)}</h3>
              <p className="way-lead">{tr(w.lead)}</p>
              <p className="way-text">{tr(w.text)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------- SPLASH ----------
const DROPS = Array.from({ length: 90 }, (_, i) => ({
  left: (i * 37.7) % 100,
  delay: ((i * 0.53) % 1.6).toFixed(2),
  dur: (0.6 + ((i * 0.29) % 0.6)).toFixed(2),
  h: 14 + ((i * 7) % 18),
}));

const SPLASH_WORD = "Setu";
const SPLASH_SPLIT = 2;

function Splash({ hide }) {
  const { tr } = useLang();
  return (
    <div className={`splash ${hide ? "splash-hide" : ""}`}>
      <div className="splash-bg" aria-hidden="true" />
      <div className="rain">
        {DROPS.map((d, i) => (
          <span key={i} className="drop" style={{ left: `${d.left}%`, height: d.h, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }} />
        ))}
      </div>

      <div className="splash-center">
        <SetuLogo className="splash-logo" />
        <h1 className="splash-name" aria-label="Setu">
          {SPLASH_WORD.split("").map((ch, i) => (
            <span
              key={i}
              className="ltr"
              aria-hidden="true"
              style={{
                "--from": `${(i < SPLASH_SPLIT ? -1 : 1) * (26 + i * 7)}px`,
                "--rot": `${(i < SPLASH_SPLIT ? -1 : 1) * (9 - i)}deg`,
                animationDelay: `${0.15 + i * 0.12}s`,
              }}
            >
              {ch}
            </span>
          ))}
        </h1>
        <p className="splash-place">{tr({ en: "KATHMANDU · NEPAL", hi: "काठमांडू · नेपाल", ne: "काठमाडौँ · नेपाल" })}</p>
        <p className="splash-tag">{tr({ en: "Know the flood. Find the safe way through.", hi: "बाढ़ को जानिए। सुरक्षित रास्ता पाइए।", ne: "बाढीलाई चिन्नुहोस्। सुरक्षित बाटो भेट्टाउनुहोस्।" })}</p>
        <div className="splash-bar"><span /></div>
        <p className="splash-ready">{tr({ en: "Getting your safe routes ready…", hi: "आपके सुरक्षित रास्ते तैयार हो रहे हैं…", ne: "तपाईंका सुरक्षित मार्ग तयार हुँदैछन्…" })}</p>
      </div>
      <div className="waves">
        <svg className="wave wave1" viewBox="0 0 1440 200" preserveAspectRatio="none"><path d="M0,100 C240,160 480,40 720,100 C960,160 1200,40 1440,100 L1440,200 L0,200 Z" /></svg>
        <svg className="wave wave2" viewBox="0 0 1440 200" preserveAspectRatio="none"><path d="M0,120 C240,60 480,180 720,120 C960,60 1200,180 1440,120 L1440,200 L0,200 Z" /></svg>
        <svg className="wave wave3" viewBox="0 0 1440 200" preserveAspectRatio="none"><path d="M0,90 C240,150 480,50 720,90 C960,150 1200,50 1440,90 L1440,200 L0,200 Z" /></svg>
      </div>
    </div>
  );
}

// ---------- ANIMATED BACKGROUND ----------
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

// ---------- SETU LOGO + BRAND (same look as Features) ----------
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
        <span className="nav-sub">{tr({ en: "FLOOD SAFE ROUTES", hi: "बाढ़ सुरक्षित रास्ते", ne: "बाढी सुरक्षित मार्ग" })}</span>
      </span>
    </Link>
  );
}

// ---------- PAGE ----------
function HomePage() {
  const { lang, setLang, tr } = useLang();
  const [loading, setLoading] = useState(true);
  const [hideSplash, setHideSplash] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setHideSplash(true), 2600);
    const t2 = setTimeout(() => setLoading(false), 3300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  // Hindi and Nepali both use Devanagari, so both reuse the "lang-hi" font styles in Home.css
  const langClass = lang === "en" ? "" : `lang-hi lang-${lang}`;

  return (
    <div className={`home ${langClass}`} lang={lang}>
      <AnimatedBackground />
      {loading && <Splash hide={hideSplash} />}

      {/* NAVBAR */}
      <header className="nav">
        <SetuBrand />

        <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
          <Link to="/" onClick={closeMenu}>{tr({ en: "Home", hi: "होम", ne: "होम" })}</Link>
          <Link to="/Features" onClick={closeMenu}>{tr({ en: "Features", hi: "सुविधाएँ", ne: "सुविधाहरू" })}</Link>
          <a href="#ways" onClick={closeMenu}>{tr({ en: "Three Ways", hi: "तीन तरीके", ne: "तीन तरिका" })}</a>
          <Link to="/About" onClick={closeMenu}>{tr({ en: "About", hi: "परिचय", ne: "बारेमा" })}</Link>
        </nav>

        <div className="nav-actions">
          <div className="lang-toggle" role="group" aria-label="Language">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                className={lang === l.code ? "on" : ""}
                onClick={() => setLang(l.code)}
                lang={l.code}
              >
                {l.label}
              </button>
            ))}
          </div>
          <Link to="/dashboard" className="btn btn-primary btn-sm hide-mobile">
            {tr({ en: "Open Dashboard", hi: "डैशबोर्ड खोलें", ne: "ड्यासबोर्ड खोल्नुहोस्" })}
          </Link>
          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="hero-text">
          <h1>
            {tr({ en: "Know the flood.", hi: "बाढ़ को जानिए।", ne: "बाढीलाई चिन्नुहोस्।" })}<br />
            <span className="accent">
              {tr({ en: "Find the safe", hi: "सुरक्षित", ne: "सुरक्षित" })}<br />
              {tr({ en: "way through.", hi: "रास्ता खोजिए।", ne: "बाटो खोज्नुहोस्।" })}
            </span>
          </h1>
          <p className="hero-sub">
            {tr({
              en: "SETU scores flood risk for every road, lets you close blocked roads and instantly recalculates safer routes — for commuters, ambulances and people heading to the nearest shelter.",
              hi: "SETU हर सड़क के लिए बाढ़ जोखिम आँकता है, बंद सड़कों को चिह्नित करने देता है और तुरंत सुरक्षित मार्ग दोबारा तैयार करता है — यात्रियों, एम्बुलेंस और सबसे नज़दीकी आश्रय तक जाने वालों के लिए।",
              ne: "SETU ले हरेक सडकको बाढी जोखिम अङ्कन गर्छ, बन्द सडक चिन्ह लगाउन दिन्छ र तुरुन्तै सुरक्षित मार्ग पुनः गणना गर्छ — यात्रु, एम्बुलेन्स र नजिकको आश्रयस्थल जानेहरूका लागि।",
            })}
          </p>
          <div className="hero-cta">
            <Link to="/dashboard" className="btn btn-primary">{tr({ en: "Explore Risk Map →", hi: "जोखिम मानचित्र देखें →", ne: "जोखिम नक्सा हेर्नुहोस् →" })}</Link>
            <a href="/dashboard" className="btn btn-ghost">{tr({ en: "Plan a Safe Route", hi: "सुरक्षित मार्ग की योजना बनाएँ", ne: "सुरक्षित मार्ग योजना बनाउनुहोस्" })}</a>
          </div>
          <div className="hero-card">
            <span className="live-dot" />
            <span className="hero-card-tag">{tr({ en: "LIVE MONSOON ALERT", hi: "सीधा मानसून अलर्ट", ne: "प्रत्यक्ष मनसुन अलर्ट" })}</span>
            <h3>{tr({ en: "Heavy rain expected. Check your route before you go.", hi: "भारी बारिश की संभावना। जाने से पहले रास्ता जाँचें।", ne: "भारी वर्षाको सम्भावना। जानुअघि आफ्नो बाटो जाँच गर्नुहोस्।" })}</h3>
            <p>{tr({ en: "Roads likely to flood in the next 30 minutes are flagged in red.", hi: "अगले 30 मिनट में बाढ़ की संभावना वाली सड़कें लाल रंग में चिह्नित हैं।", ne: "अबको 30 मिनेटमा बाढी आउन सक्ने सडकहरू रातो रङमा चिन्ह लगाइएका छन्।" })}</p>
            <Link to="/Alert" className="hero-card-link">{tr({ en: "View flood risk alerts →", hi: "बाढ़ जोखिम अलर्ट देखें →", ne: "बाढी जोखिम अलर्ट हेर्नुहोस् →" })}</Link>
          </div>
        </div>

        <div className="hero-map">
          <div className="map-label">
            {tr({ en: "Observed record · 1951–2025", hi: "देखा गया रिकॉर्ड · 1951–2025", ne: "अवलोकन गरिएको अभिलेख · 1951–2025" })}<br />
            <small>{tr({ en: "○ Illustrative data", hi: "○ उदाहरण डेटा", ne: "○ उदाहरणात्मक डेटा" })}</small>
          </div>
          <IndiaMap />
          <div className="legend">
            <span className="legend-title">{tr({ en: "HISTORICAL FLOOD RISK", hi: "ऐतिहासिक बाढ़ जोखिम", ne: "ऐतिहासिक बाढी जोखिम" })}</span>
            <div className="legend-bar" />
            <div className="legend-scale"><span>{tr({ en: "Low", hi: "कम", ne: "कम" })}</span><span>{tr({ en: "High", hi: "अधिक", ne: "बढी" })}</span></div>
          </div>
        </div>
      </section>

      {/* PLAN / ALERT / RESPOND */}
      <CycleSection />

      {/* NEPAL FLOOD DETAILS */}
      <NepalSection />

      {/* DATA PIPELINE */}
      <DataPipeline />

      {/* THREE WAYS */}
      <ThreeWays />

      {/* FOOTER (same style as Features) */}
      <footer className="home-footer" id="about">
        <svg className="home-footer-wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">
          <path className="hf-wave-a" d="M0 35 Q180 5 360 35 T720 35 T1080 35 T1440 35 T1800 35 T2160 35 T2520 35 T2880 35 V70 H0 Z" />
          <path className="hf-wave-b" d="M0 45 Q180 20 360 45 T720 45 T1080 45 T1440 45 T1800 45 T2160 45 T2520 45 T2880 45 V70 H0 Z" />
        </svg>
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <SetuBrand />
            <p>
              {tr({
                en: "Flood risk & emergency safe-route mapper. Pilot: Kathmandu, Nepal.",
                hi: "बाढ़ जोखिम और आपातकालीन सुरक्षित-मार्ग मैपर। पायलट: काठमांडू, नेपाल।",
                ne: "बाढी जोखिम र आपतकालीन सुरक्षित-मार्ग म्यापर। पाइलट: काठमाडौँ, नेपाल।",
              })}
            </p>
            <span className="home-footer-chip">
              <span className="home-footer-dot" />
              {tr({ en: "Prototype · not deployed yet", hi: "प्रोटोटाइप · अभी लागू नहीं", ne: "प्रोटोटाइप · अहिलेसम्म लागू भएको छैन" })}
            </span>
          </div>
          <div className="home-footer-col">
            <h4>{tr({ en: "Platform", hi: "प्लेटफ़ॉर्म", ne: "प्लेटफर्म" })}</h4>
            <Link to="/dashboard">{tr({ en: "Dashboard", hi: "डैशबोर्ड", ne: "ड्यासबोर्ड" })}</Link>
            <a href="/risk-map">{tr({ en: "Flood Risk Map", hi: "बाढ़ जोखिम मानचित्र", ne: "बाढी जोखिम नक्सा" })}</a>
            <a href="/dashboard">{tr({ en: "Safe Route Planner", hi: "सुरक्षित मार्ग योजनाकार", ne: "सुरक्षित मार्ग योजनाकार" })}</a>
            <Link to="/Alert">{tr({ en: "Flood Risk Alerts", hi: "बाढ़ जोखिम अलर्ट", ne: "बाढी जोखिम अलर्ट" })}</Link>
          </div>
          <div className="home-footer-col">
            <h4>{tr({ en: "Respond", hi: "प्रतिक्रिया", ne: "प्रतिक्रिया" })}</h4>
            <a href="/closures">{tr({ en: "Road Closures", hi: "सड़क बंदी", ne: "सडक बन्दी" })}</a>
            <a href="/shelters">{tr({ en: "Shelters & Hospitals", hi: "आश्रय व अस्पताल", ne: "आश्रयस्थल र अस्पताल" })}</a>
            <a href="/ambulance">{tr({ en: "Ambulance Mode", hi: "एम्बुलेंस मोड", ne: "एम्बुलेन्स मोड" })}</a>
            <a href="/chokepoints">{tr({ en: "Chokepoint Report", hi: "अवरोध रिपोर्ट", ne: "अवरोध प्रतिवेदन" })}</a>
            <Link to="/Respond">{tr({ en: "Respond Plan", hi: "प्रतिक्रिया योजना", ne: "प्रतिक्रिया योजना" })}</Link>
          </div>
          <div className="home-footer-col">
            <h4>{tr({ en: "Learn", hi: "सीखें", ne: "सिक्नुहोस्" })}</h4>
            <Link to="/Features">{tr({ en: "Features", hi: "सुविधाएँ", ne: "सुविधाहरू" })}</Link>
            <a href="#nepal">{tr({ en: "Nepal Floods", hi: "नेपाल बाढ़", ne: "नेपालको बाढी" })}</a>
            <a href="#data">{tr({ en: "The Data", hi: "डेटा", ne: "डेटा" })}</a>
            <a href="#ways">{tr({ en: "Three Ways", hi: "तीन तरीके", ne: "तीन तरिका" })}</a>
            <Link to="/About">{tr({ en: "About", hi: "परिचय", ne: "बारेमा" })}</Link>
          </div>
          <div className="home-footer-col">
            <h4>{tr({ en: "Open data", hi: "खुला डेटा", ne: "खुला डेटा" })}</h4>
            <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
            <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
            <a href="https://bipadportal.gov.np" target="_blank" rel="noopener noreferrer">NDRRMA · BIPAD</a>
          </div>
        </div>
        <div className="home-footer-bottom">
          <span>© 2026 SETU · Team TheLadyBugz_5 · Katathon 6.0 · PS 103</span>
          <span className="home-footer-muted">{tr({ en: "Decision support, not a safety guarantee.", hi: "निर्णय-सहायता, सुरक्षा की गारंटी नहीं।", ne: "निर्णय-सहायता, सुरक्षाको ग्यारेन्टी होइन।" })}</span>
          <a
            href="#top"
            className="home-footer-top"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            {tr({ en: "↑ Back to top", hi: "↑ ऊपर जाएँ", ne: "↑ माथि जानुहोस्" })}
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <LangProvider>
      <HomePage />
    </LangProvider>
  );
}