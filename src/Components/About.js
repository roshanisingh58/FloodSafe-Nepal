// About.js — SETU About page · English / Hindi / Nepali
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./About.css";
import setuLogo from "./Setu.jpg"; // Setu.jpg sits in the same Components folder

// ---------- LANGUAGE ----------
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ne", label: "नेपाली" },
];

// Remember the chosen language (key "setu-lang") so it can be shared with other pages
function getSavedLang() {
  try {
    const v = localStorage.getItem("setu-lang");
    return LANGUAGES.some((l) => l.code === v) ? v : "en";
  } catch (e) {
    return "en";
  }
}

// ---------- CONTENT ----------
const FACTS = [
  {
    label: { en: "Project", hi: "परियोजना", ne: "परियोजना" },
    value: {
      en: "SETU — Flood Risk & Emergency Safe-Route Mapper",
      hi: "SETU — बाढ़ जोखिम और आपातकालीन सुरक्षित-मार्ग मैपर",
      ne: "SETU — बाढी जोखिम र आपतकालीन सुरक्षित-मार्ग म्यापर",
    },
  },
  { label: { en: "Team", hi: "टीम", ne: "टोली" }, value: "TheLadyBugz_5" },
  {
    label: { en: "Built for", hi: "इसके लिए बना", ne: "यसका लागि निर्मित" },
    value: {
      en: "Katathon 6.0 · Problem Statement 103",
      hi: "Katathon 6.0 · समस्या कथन 103",
      ne: "Katathon 6.0 · समस्या कथन 103",
    },
  },
  {
    label: { en: "Focus regions", hi: "फोकस क्षेत्र", ne: "केन्द्रित क्षेत्र" },
    value: { en: "Nepal and India", hi: "नेपाल और भारत", ne: "नेपाल र भारत" },
  },
  {
    label: { en: "What we build", hi: "हम क्या बनाते हैं", ne: "हामी के बनाउँछौँ" },
    value: {
      en: "Road-level flood risk, closures and safe rerouting",
      hi: "सड़क-स्तर पर बाढ़ जोखिम, बंदी और सुरक्षित मार्ग परिवर्तन",
      ne: "सडक-स्तरमा बाढी जोखिम, बन्दी र सुरक्षित मार्ग परिवर्तन",
    },
  },
  {
    label: { en: "Who we serve", hi: "हम किनके लिए", ne: "हामी कसका लागि" },
    value: {
      en: "Commuters, ambulances, shelters and municipalities",
      hi: "यात्री, एम्बुलेंस, आश्रय और नगरपालिकाएँ",
      ne: "यात्रु, एम्बुलेन्स, आश्रयस्थल र नगरपालिकाहरू",
    },
  },
  {
    label: { en: "Data", hi: "डेटा", ne: "डेटा" },
    value: {
      en: "OpenStreetMap and Open-Meteo (open data)",
      hi: "OpenStreetMap और Open-Meteo (खुला डेटा)",
      ne: "OpenStreetMap र Open-Meteo (खुला डेटा)",
    },
  },
];

// TODO: replace these placeholders with your real team members
const TEAM = [
  {
    initials: "AB",
    name: { en: "Team Member 1", hi: "टीम सदस्य 1", ne: "टोली सदस्य 1" },
    role: { en: "Frontend Developer", hi: "फ्रंटएंड डेवलपर", ne: "फ्रन्टएन्ड डेभलपर" },
    bio: {
      en: "Builds the maps, dashboard and the pages people use to check their route.",
      hi: "मानचित्र, डैशबोर्ड और वे पेज बनाते हैं जिनसे लोग अपना रास्ता जाँचते हैं।",
      ne: "नक्सा, ड्यासबोर्ड र मानिसहरूले आफ्नो बाटो जाँच गर्ने पृष्ठहरू बनाउँछन्।",
    },
    link: "https://www.linkedin.com/",
  },
  {
    initials: "CD",
    name: { en: "Team Member 2", hi: "टीम सदस्य 2", ne: "टोली सदस्य 2" },
    role: { en: "Backend & Data Engineer", hi: "बैकएंड और डेटा इंजीनियर", ne: "ब्याकएन्ड र डेटा इन्जिनियर" },
    bio: {
      en: "Connects OpenStreetMap roads and Open-Meteo rainfall into a flood risk score.",
      hi: "OpenStreetMap की सड़कों और Open-Meteo की बारिश को जोड़कर बाढ़ जोखिम स्कोर बनाते हैं।",
      ne: "OpenStreetMap का सडक र Open-Meteo को वर्षालाई जोडेर बाढी जोखिम स्कोर बनाउँछन्।",
    },
    link: "https://www.linkedin.com/",
  },
  {
    initials: "EF",
    name: { en: "Team Member 3", hi: "टीम सदस्य 3", ne: "टोली सदस्य 3" },
    role: { en: "Routing & Algorithms", hi: "रूटिंग और एल्गोरिदम", ne: "रुटिङ र एल्गोरिदम" },
    bio: {
      en: "Works on the engine that closes blocked roads and recalculates safer routes.",
      hi: "उस इंजन पर काम करते हैं जो बंद सड़कों को हटाकर सुरक्षित मार्ग दोबारा निकालता है।",
      ne: "बन्द सडक हटाएर सुरक्षित मार्ग पुनः निकाल्ने इन्जिनमा काम गर्छन्।",
    },
    link: "https://www.linkedin.com/",
  },
  {
    initials: "GH",
    name: { en: "Team Member 4", hi: "टीम सदस्य 4", ne: "टोली सदस्य 4" },
    role: { en: "Research & Design", hi: "शोध और डिज़ाइन", ne: "अनुसन्धान र डिजाइन" },
    bio: {
      en: "Researches flood history and shapes how risk is shown to people under stress.",
      hi: "बाढ़ के इतिहास पर शोध करते हैं और तय करते हैं कि तनाव में लोगों को जोखिम कैसे दिखाया जाए।",
      ne: "बाढीको इतिहासमा अनुसन्धान गर्छन् र तनावमा रहेका मानिसलाई जोखिम कसरी देखाउने भन्ने आकार दिन्छन्।",
    },
    link: "https://www.linkedin.com/",
  },
];

const PRINCIPLES = [
  {
    title: { en: "Science first", hi: "विज्ञान पहले", ne: "विज्ञान पहिले" },
    text: {
      en: "Every risk score starts from an observed record and open data, never a guess dressed up as a number.",
      hi: "हर जोखिम स्कोर देखे गए रिकॉर्ड और खुले डेटा से शुरू होता है, संख्या का रूप दिया गया अंदाज़ा नहीं।",
      ne: "हरेक जोखिम स्कोर अवलोकन गरिएको अभिलेख र खुला डेटाबाट सुरु हुन्छ, सङ्ख्याको रूप दिइएको अनुमान होइन।",
    },
  },
  {
    title: { en: "Built for the road", hi: "सड़क के लिए बना", ne: "सडकका लागि बनेको" },
    text: {
      en: "Risk is scored for each road, because people decide which road to take, not which district to avoid.",
      hi: "जोखिम हर सड़क के लिए आँका जाता है, क्योंकि लोग यह तय करते हैं कि कौन-सी सड़क लें, यह नहीं कि कौन-सा ज़िला छोड़ें।",
      ne: "जोखिम हरेक सडकका लागि अङ्कन गरिन्छ, किनकि मानिसले कुन सडक लिने भनेर निर्णय गर्छन्, कुन जिल्ला छल्ने भनेर होइन।",
    },
  },
  {
    title: { en: "Ready to act on", hi: "कार्रवाई के लिए तैयार", ne: "कारबाहीका लागि तयार" },
    text: {
      en: "Plain colours, clear alerts and one-tap rerouting, so the answer is usable in an emergency.",
      hi: "सादे रंग, स्पष्ट अलर्ट और एक टैप में मार्ग बदलना, ताकि जवाब आपात स्थिति में काम आए।",
      ne: "सरल रङ, स्पष्ट अलर्ट र एक ट्यापमै मार्ग परिवर्तन, ताकि जवाफ आपतकालमा प्रयोग गर्न सकियोस्।",
    },
  },
  {
    title: { en: "Honest about uncertainty", hi: "अनिश्चितता को लेकर ईमानदार", ne: "अनिश्चिततामा इमानदार" },
    text: {
      en: "Some roads have no data. We show them in grey and say so. SETU is decision support, not a safety guarantee.",
      hi: "कुछ सड़कों का डेटा नहीं है। हम उन्हें धूसर रंग में दिखाते हैं और यह बताते हैं। SETU निर्णय-सहायता है, सुरक्षा की गारंटी नहीं।",
      ne: "केही सडकको डेटा छैन। हामी तिनलाई खैरो रङमा देखाउँछौँ र त्यो भन्छौँ। SETU निर्णय-सहायता हो, सुरक्षाको ग्यारेन्टी होइन।",
    },
  },
];

const SOURCES = [
  { name: "OpenStreetMap", note: { en: "Road network and shelters", hi: "सड़क नेटवर्क और आश्रय", ne: "सडक सञ्जाल र आश्रयस्थल" } },
  { name: "Open-Meteo", note: { en: "Rainfall and forecasts", hi: "बारिश और पूर्वानुमान", ne: "वर्षा र पूर्वानुमान" } },
  { name: "Katathon 6.0", note: { en: "Where this project began", hi: "जहाँ से यह परियोजना शुरू हुई", ne: "जहाँबाट यो परियोजना सुरु भयो" } },
];

// ---------- LOGO + BRAND (same as Home) ----------
function SetuLogo() {
  const [ok, setOk] = useState(true);
  return (
    <span className="ab-mark" aria-hidden="true">
      {ok ? <img src={setuLogo} alt="" onError={() => setOk(false)} /> : <span className="ab-mark-fallback">S</span>}
    </span>
  );
}

function SetuBrand({ tr }) {
  return (
    <Link to="/" className="ab-brand" aria-label="Setu home">
      <SetuLogo />
      <span className="ab-word">
        <span className="ab-name">Setu</span>
        <span className="ab-sub">{tr({ en: "FLOOD SAFE ROUTES", hi: "बाढ़ सुरक्षित रास्ते", ne: "बाढी सुरक्षित मार्ग" })}</span>
      </span>
    </Link>
  );
}

// ---------- PAGE ----------
export default function About() {
  const [lang, setLang] = useState(getSavedLang);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const tr = (o) => (typeof o === "string" ? o : o[lang] ?? o.en);

  useEffect(() => {
    try { localStorage.setItem("setu-lang", lang); } catch (e) { /* ignore */ }
  }, [lang]);

  // Hindi and Nepali both use Devanagari, so both reuse the "lang-hi" font styles
  const langClass = lang === "en" ? "" : `lang-hi lang-${lang}`;

  return (
    <div className={`about ${langClass}`} lang={lang}>
      {/* NAVBAR (same as Home) */}
      <header className="ab-nav">
        <SetuBrand tr={tr} />

        <nav className={`ab-links ${menuOpen ? "open" : ""}`}>
          <Link to="/" onClick={closeMenu}>{tr({ en: "Home", hi: "होम", ne: "होम" })}</Link>
          <Link to="/Features" onClick={closeMenu}>{tr({ en: "Features", hi: "सुविधाएँ", ne: "सुविधाहरू" })}</Link>
          <a href="/#ways" onClick={closeMenu}>{tr({ en: "Three Ways", hi: "तीन तरीके", ne: "तीन तरिका" })}</a>
          <Link to="/About" className="ab-current" onClick={closeMenu}>{tr({ en: "About", hi: "परिचय", ne: "बारेमा" })}</Link>
        </nav>

        <div className="ab-actions">
          <div className="ab-lang" role="group" aria-label="Language">
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
          <Link to="/dashboard" className="ab-btn ab-btn-primary ab-btn-sm ab-hide-mobile">
            {tr({ en: "Open Dashboard", hi: "डैशबोर्ड खोलें", ne: "ड्यासबोर्ड खोल्नुहोस्" })}
          </Link>
          <button className="ab-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="ab-hero">
        <p className="ab-eyebrow">{tr({ en: "About us", hi: "हमारे बारे में", ne: "हाम्रो बारेमा" })}</p>
        <h1>
          {tr({
            en: "Helping people find the safe way through a flood.",
            hi: "बाढ़ में सुरक्षित रास्ता खोजने में लोगों की मदद।",
            ne: "बाढीमा सुरक्षित बाटो खोज्न मानिसलाई मद्दत।",
          })}
        </h1>
        <p className="ab-hero-sub">
          {tr({
            en: "We are a team working across flood data, maps and routing to make flood risk easier to understand and easier to act on, for the people who have to move when the water rises.",
            hi: "हम बाढ़ डेटा, मानचित्र और रूटिंग पर काम करने वाली एक टीम हैं, जो बाढ़ जोखिम को समझना और उस पर अमल करना आसान बनाती है — उन लोगों के लिए जिन्हें पानी बढ़ने पर निकलना पड़ता है।",
            ne: "हामी बाढी डेटा, नक्सा र रुटिङमा काम गर्ने टोली हौँ, जसले बाढी जोखिम बुझ्न र त्यसमा कारबाही गर्न सजिलो बनाउँछ — पानी बढ्दा हिँड्नुपर्ने मानिसहरूका लागि।",
          })}
        </p>
        <p className="ab-values">
          {tr({
            en: "Science first · Built for the road · Ready to act on · Honest about uncertainty",
            hi: "विज्ञान पहले · सड़क के लिए बना · कार्रवाई के लिए तैयार · अनिश्चितता पर ईमानदार",
            ne: "विज्ञान पहिले · सडकका लागि बनेको · कारबाहीका लागि तयार · अनिश्चिततामा इमानदार",
          })}
        </p>
      </section>

      {/* BUILT ON */}
      <section className="ab-strip">
        <span className="ab-strip-title">{tr({ en: "Built on", hi: "इन पर आधारित", ne: "यिनमा आधारित" })}</span>
        <div className="ab-strip-items">
          {SOURCES.map((s) => (
            <div className="ab-strip-item" key={s.name}>
              <strong>{s.name}</strong>
              <span>{tr(s.note)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* WHO WE ARE */}
      <section className="ab-section">
        <div className="ab-two">
          <div>
            <p className="ab-eyebrow">{tr({ en: "Who we are", hi: "हम कौन हैं", ne: "हामी को हौँ" })}</p>
            <h2>
              {tr({
                en: "A flood-safety project, built for the monsoon.",
                hi: "मानसून के लिए बनी एक बाढ़-सुरक्षा परियोजना।",
                ne: "मनसुनका लागि बनेको बाढी-सुरक्षा परियोजना।",
              })}
            </h2>
            <p className="ab-text">
              {tr({
                en: "Floods cut roads, delay ambulances and strand people far from shelter. Most maps show the road but not the water. SETU scores the flood risk of every road, lets you close blocked roads and recalculates a safer route straight away.",
                hi: "बाढ़ सड़कें काट देती है, एम्बुलेंस को देर कराती है और लोगों को आश्रय से दूर फँसा देती है। ज़्यादातर मानचित्र सड़क दिखाते हैं, पानी नहीं। SETU हर सड़क का बाढ़ जोखिम आँकता है, बंद सड़कों को चिह्नित करने देता है और तुरंत सुरक्षित मार्ग दोबारा निकालता है।",
                ne: "बाढीले सडक काट्छ, एम्बुलेन्सलाई ढिलो पार्छ र मानिसलाई आश्रयस्थलबाट टाढा फसाउँछ। धेरैजसो नक्सामा सडक देखिन्छ, पानी देखिँदैन। SETU ले हरेक सडकको बाढी जोखिम अङ्कन गर्छ, बन्द सडक चिन्ह लगाउन दिन्छ र तुरुन्तै सुरक्षित मार्ग पुनः निकाल्छ।",
              })}
            </p>
            <p className="ab-text">
              {tr({
                en: "We started with Nepal's steep rivers and Terai plains, and with India's long record of monsoon floods. The same idea works for a commuter, an ambulance driver or a family heading to the nearest shelter.",
                hi: "हमने नेपाल की तेज़ नदियों और तराई के मैदानों से, और भारत के मानसूनी बाढ़ के लंबे रिकॉर्ड से शुरुआत की। यही विचार यात्री, एम्बुलेंस चालक या निकटतम आश्रय की ओर जा रहे परिवार, सबके काम आता है।",
                ne: "हामीले नेपालका तेज नदी र तराईका मैदान, अनि भारतको मनसुनी बाढीको लामो अभिलेखबाट सुरु गर्‍यौँ। यही विचार यात्रु, एम्बुलेन्स चालक वा नजिकको आश्रयस्थल जाँदै गरेको परिवार, सबैका लागि काम लाग्छ।",
              })}
            </p>
          </div>
          <dl className="ab-facts">
            {FACTS.map((f) => (
              <div className="ab-fact" key={f.label.en}>
                <dt>{tr(f.label)}</dt>
                <dd>{tr(f.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* TEAM */}
      <section className="ab-section">
        <p className="ab-eyebrow">{tr({ en: "The team", hi: "टीम", ne: "टोली" })}</p>
        <h2>{tr({ en: "The people behind SETU.", hi: "SETU के पीछे के लोग।", ne: "SETU पछाडिका मानिसहरू।" })}</h2>
        <div className="ab-team">
          {TEAM.map((m) => (
            <article className="ab-member" key={m.name.en}>
              <span className="ab-avatar">{m.initials}</span>
              <h3>{tr(m.name)}</h3>
              <p className="ab-role">{tr(m.role)}</p>
              <p className="ab-bio">{tr(m.bio)}</p>
              <a href={m.link} target="_blank" rel="noreferrer" className="ab-link">LinkedIn</a>
            </article>
          ))}
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="ab-section">
        <p className="ab-eyebrow">
          {tr({ en: "What we hold ourselves to", hi: "हम खुद से क्या अपेक्षा रखते हैं", ne: "हामी आफैँलाई के मा जवाफदेही राख्छौँ" })}
        </p>
        <h2>
          {tr({
            en: "Principles you can check us against.",
            hi: "ऐसे सिद्धांत जिन पर आप हमें परख सकते हैं।",
            ne: "यस्ता सिद्धान्त जसमा तपाईं हामीलाई जाँच्न सक्नुहुन्छ।",
          })}
        </h2>
        <div className="ab-principles">
          {PRINCIPLES.map((p) => (
            <div className="ab-principle" key={p.title.en}>
              <h3>{tr(p.title)}</h3>
              <p>{tr(p.text)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="ab-section">
        <div className="ab-cta-grid">
          <div className="ab-cta">
            <p className="ab-eyebrow">{tr({ en: "Plan", hi: "योजना", ne: "योजना" })}</p>
            <h3>{tr({ en: "See the flood risk map.", hi: "बाढ़ जोखिम मानचित्र देखें।", ne: "बाढी जोखिम नक्सा हेर्नुहोस्।" })}</h3>
            <p>
              {tr({
                en: "Open the dashboard to explore road risk, closures and shelters.",
                hi: "सड़क जोखिम, बंदी और आश्रय देखने के लिए डैशबोर्ड खोलें।",
                ne: "सडक जोखिम, बन्दी र आश्रयस्थल हेर्न ड्यासबोर्ड खोल्नुहोस्।",
              })}
            </p>
            <Link to="/dashboard" className="ab-btn ab-btn-primary">
              {tr({ en: "Open Dashboard", hi: "डैशबोर्ड खोलें", ne: "ड्यासबोर्ड खोल्नुहोस्" })}
            </Link>
          </div>
          <div className="ab-cta">
            <p className="ab-eyebrow">{tr({ en: "Learn", hi: "सीखें", ne: "सिक्नुहोस्" })}</p>
            <h3>{tr({ en: "Explore what SETU can do.", hi: "जानें कि SETU क्या कर सकता है।", ne: "SETU ले के गर्न सक्छ, हेर्नुहोस्।" })}</h3>
            <p>
              {tr({
                en: "Read about each feature, from alerts to ambulance routing.",
                hi: "अलर्ट से लेकर एम्बुलेंस रूटिंग तक, हर सुविधा के बारे में पढ़ें।",
                ne: "अलर्टदेखि एम्बुलेन्स रुटिङसम्म, हरेक सुविधाबारे पढ्नुहोस्।",
              })}
            </p>
            <Link to="/Features" className="ab-btn ab-btn-ghost">
              {tr({ en: "View Features", hi: "सुविधाएँ देखें", ne: "सुविधाहरू हेर्नुहोस्" })}
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER (same as Home) */}
      <footer className="ab-footer" id="about">
        <svg className="ab-footer-wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">
          <path className="ab-wave-a" d="M0 35 Q180 5 360 35 T720 35 T1080 35 T1440 35 T1800 35 T2160 35 T2520 35 T2880 35 V70 H0 Z" />
          <path className="ab-wave-b" d="M0 45 Q180 20 360 45 T720 45 T1080 45 T1440 45 T1800 45 T2160 45 T2520 45 T2880 45 V70 H0 Z" />
        </svg>
        <div className="ab-footer-inner">
          <div className="ab-footer-brand">
            <SetuBrand tr={tr} />
            <p>
              {tr({
                en: "Flood risk & emergency safe-route mapper. Pilot: Kathmandu, Nepal.",
                hi: "बाढ़ जोखिम और आपातकालीन सुरक्षित-मार्ग मैपर। पायलट: काठमांडू, नेपाल।",
                ne: "बाढी जोखिम र आपतकालीन सुरक्षित-मार्ग म्यापर। पाइलट: काठमाडौँ, नेपाल।",
              })}
            </p>
            <span className="ab-footer-chip">
              <span className="ab-footer-dot" />
              {tr({ en: "Prototype · not deployed yet", hi: "प्रोटोटाइप · अभी लागू नहीं", ne: "प्रोटोटाइप · अहिलेसम्म लागू भएको छैन" })}
            </span>
          </div>
          <div className="ab-footer-col">
            <h4>{tr({ en: "Platform", hi: "प्लेटफ़ॉर्म", ne: "प्लेटफर्म" })}</h4>
            <Link to="/dashboard">{tr({ en: "Dashboard", hi: "डैशबोर्ड", ne: "ड्यासबोर्ड" })}</Link>
            <a href="/risk-map">{tr({ en: "Flood Risk Map", hi: "बाढ़ जोखिम मानचित्र", ne: "बाढी जोखिम नक्सा" })}</a>
            <a href="/route-planner">{tr({ en: "Safe Route Planner", hi: "सुरक्षित मार्ग योजनाकार", ne: "सुरक्षित मार्ग योजनाकार" })}</a>
            <Link to="/Alert">{tr({ en: "Flood Risk Alerts", hi: "बाढ़ जोखिम अलर्ट", ne: "बाढी जोखिम अलर्ट" })}</Link>
          </div>
          <div className="ab-footer-col">
            <h4>{tr({ en: "Respond", hi: "प्रतिक्रिया", ne: "प्रतिक्रिया" })}</h4>
            <a href="/closures">{tr({ en: "Road Closures", hi: "सड़क बंदी", ne: "सडक बन्दी" })}</a>
            <a href="/shelters">{tr({ en: "Shelters & Hospitals", hi: "आश्रय व अस्पताल", ne: "आश्रयस्थल र अस्पताल" })}</a>
            <a href="/ambulance">{tr({ en: "Ambulance Mode", hi: "एम्बुलेंस मोड", ne: "एम्बुलेन्स मोड" })}</a>
            <a href="/chokepoints">{tr({ en: "Chokepoint Report", hi: "अवरोध रिपोर्ट", ne: "अवरोध प्रतिवेदन" })}</a>
            <Link to="/Respond">{tr({ en: "Respond Plan", hi: "प्रतिक्रिया योजना", ne: "प्रतिक्रिया योजना" })}</Link>
          </div>
          <div className="ab-footer-col">
            <h4>{tr({ en: "Learn", hi: "सीखें", ne: "सिक्नुहोस्" })}</h4>
            <Link to="/Features">{tr({ en: "Features", hi: "सुविधाएँ", ne: "सुविधाहरू" })}</Link>
            <a href="/#nepal">{tr({ en: "Nepal Floods", hi: "नेपाल बाढ़", ne: "नेपालको बाढी" })}</a>
            <a href="/#data">{tr({ en: "The Data", hi: "डेटा", ne: "डेटा" })}</a>
            <a href="/#ways">{tr({ en: "Three Ways", hi: "तीन तरीके", ne: "तीन तरिका" })}</a>
            <Link to="/About">{tr({ en: "About", hi: "परिचय", ne: "बारेमा" })}</Link>
          </div>
          <div className="ab-footer-col">
            <h4>{tr({ en: "Open data", hi: "खुला डेटा", ne: "खुला डेटा" })}</h4>
            <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
            <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
            <a href="https://bipadportal.gov.np" target="_blank" rel="noopener noreferrer">NDRRMA · BIPAD</a>
          </div>
        </div>
        <div className="ab-footer-bottom">
          <span>© 2026 SETU · Team TheLadyBugz_5 · Katathon 6.0 · PS 103</span>
          <span>{tr({ en: "Decision support, not a safety guarantee.", hi: "निर्णय-सहायता, सुरक्षा की गारंटी नहीं।", ne: "निर्णय-सहायता, सुरक्षाको ग्यारेन्टी होइन।" })}</span>
          <a
            href="#top"
            className="ab-footer-top"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            {tr({ en: "↑ Back to top", hi: "↑ ऊपर जाएँ", ne: "↑ माथि जानुहोस्" })}
          </a>
        </div>
      </footer>
    </div>
  );
}