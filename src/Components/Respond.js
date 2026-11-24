// Respond.js — SETU · RESPOND (after the flood) · English / हिन्दी / नेपाली
// Runs fully in the browser on FloodEngine.js (same demo network as the Dashboard).
// Ambulance first (rescue points -> nearest hospital), then supplies (base -> relief camps).
// One component, five pages (prop `view`): plan, closures, shelters, ambulance, chokepoints.
// All roads, hospitals, shelters, capacities and incident points are DEMO data, not measurements.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Respond.css";
import setuLogo from "./Setu.jpg";
import {
  CENTER, CLASSES, NODATA, PRESETS, RIVER_LINE,
  buildNetwork, buildFacilities, nearestNode, route, confidence,
  edgeRisk, riskClass, edgeClassInfo, explainEdge, demoReplay, rainfallLoading, chokepoints,
} from "./FloodEngine";

// ---------- demo data (built once, same network as the Dashboard) ----------
const net = buildNetwork();
const facilities = buildFacilities(net);
const hospitals = facilities.filter((f) => f.type === "hospital");
const shelters = facilities.filter((f) => f.type === "shelter");
const hospitalNodes = hospitals.map((f) => f.node);
const replay = demoReplay();
const gridNode = (r, c) => net.nodes[r * 16 + c].id;

const START_INCIDENTS = [{ id: 1, node: gridNode(3, 5) }, { id: 2, node: gridNode(7, 10) }];
const START_BASE = gridNode(5, 7);

// Emergency numbers. Police, fire, ambulance: Nepal telecom and foreign-ministry travel pages.
// Disaster hotline 1234 replaced 1149 (Home Ministry notice, July 2026, per press). Confirm before public use.
const CONTACTS = [
  { key: "police", number: "100", label: { en: "Police", hi: "पुलिस", ne: "प्रहरी" } },
  { key: "fire", number: "101", label: { en: "Fire", hi: "दमकल", ne: "दमकल" } },
  { key: "ambulance", number: "102", label: { en: "Ambulance", hi: "एम्बुलेंस", ne: "एम्बुलेन्स" } },
  { key: "disaster", number: "1234", label: { en: "Disaster hotline", hi: "आपदा हॉटलाइन", ne: "विपद् हटलाइन" } },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ne", label: "नेपाली" },
];

const T = {
  navHome: { en: "Home", hi: "होम", ne: "होम" },
  navFeatures: { en: "Features", hi: "सुविधाएँ", ne: "सुविधाहरू" },
  navDashboard: { en: "Dashboard", hi: "डैशबोर्ड", ne: "ड्यासबोर्ड" },
  navAbout: { en: "About", hi: "परिचय", ne: "बारेमा" },
  navSub: { en: "RESPOND", hi: "प्रतिक्रिया", ne: "प्रतिक्रिया" },
  openDash: { en: "Open Dashboard", hi: "डैशबोर्ड खोलें", ne: "ड्यासबोर्ड खोल्नुहोस्" },
  eyebrow: { en: "RESPOND · AFTER THE FLOOD", hi: "प्रतिक्रिया · बाढ़ के बाद", ne: "प्रतिक्रिया · बाढीपछि" },
  h1a: { en: "Ambulances first.", hi: "पहले एम्बुलेंस।", ne: "पहिले एम्बुलेन्स।" },
  h1b: { en: "Then food and medicine.", hi: "फिर भोजन और दवाइयाँ।", ne: "त्यसपछि खाना र औषधि।" },
  sub: {
    en: "Set the rain, close flooded roads and drop rescue points on the map. SETU recalculates the safest ambulance routes to hospitals and the supply routes to relief camps instantly.",
    hi: "बारिश तय करें, डूबी सड़कें बंद करें और नक्शे पर बचाव बिंदु रखें। SETU अस्पतालों तक सबसे सुरक्षित एम्बुलेंस मार्ग और राहत शिविरों तक आपूर्ति मार्ग तुरंत दोबारा निकालता है।",
    ne: "वर्षा तय गर्नुहोस्, डुबानमा परेका सडक बन्द गर्नुहोस् र नक्सामा उद्धार बिन्दु राख्नुहोस्। SETU ले अस्पतालसम्म सबैभन्दा सुरक्षित एम्बुलेन्स मार्ग र राहत शिविरसम्म आपूर्ति मार्ग तुरुन्तै पुनः निकाल्छ।",
  },
  demoChip: { en: "Demo network, hospitals and shelters", hi: "डेमो नेटवर्क, अस्पताल और आश्रय", ne: "डेमो सञ्जाल, अस्पताल र आश्रयस्थल" },

  kHigh: { en: "High-risk roads", hi: "उच्च जोखिम वाली सड़कें", ne: "उच्च जोखिमका सडक" },
  kClosed: { en: "Closed roads", hi: "बंद सड़कें", ne: "बन्द सडक" },
  kInc: { en: "Rescue points", hi: "बचाव बिंदु", ne: "उद्धार बिन्दु" },
  kAmb: { en: "Reach a hospital", hi: "अस्पताल पहुँच सकते हैं", ne: "अस्पताल पुग्न सक्छन्" },
  kCamps: { en: "Camps reachable", hi: "पहुँच योग्य शिविर", ne: "पुग्न सकिने शिविर" },
  of: { en: "of", hi: "में से", ne: "मध्ये" },

  rainTitle: { en: "Rainfall input", hi: "बारिश इनपुट", ne: "वर्षा इनपुट" },
  live: { en: "Live", hi: "लाइव", ne: "प्रत्यक्ष" },
  replayT: { en: "Replay", hi: "रिप्ले", ne: "रिप्ले" },
  manual: { en: "Manual", hi: "मैनुअल", ne: "म्यानुअल" },
  dry: { en: "Dry", hi: "सूखा", ne: "सुक्खा" },
  moderate: { en: "Moderate", hi: "मध्यम", ne: "मध्यम" },
  heavy: { en: "Heavy", hi: "भारी", ne: "भारी" },
  extreme: { en: "Extreme", hi: "अत्यधिक", ne: "अत्यधिक" },
  intensity: { en: "Intensity", hi: "तीव्रता", ne: "तीव्रता" },
  rain24: { en: "Rain in 24 h", hi: "24 घंटे में बारिश", ne: "२४ घण्टामा वर्षा" },
  liveOk: { en: "Open-Meteo reading. A dry day showing 0 mm is the correct answer.", hi: "Open-Meteo रीडिंग। सूखे दिन 0 मिमी सही उत्तर है।", ne: "Open-Meteo रिडिङ। सुक्खा दिन ० मिमी सही उत्तर हो।" },
  liveLoading: { en: "Fetching live Kathmandu rainfall…", hi: "काठमांडू की लाइव बारिश ला रहे हैं…", ne: "काठमाडौँको प्रत्यक्ष वर्षा ल्याउँदै…" },
  liveErr: { en: "Could not reach Open-Meteo. Use Replay or Manual.", hi: "Open-Meteo तक नहीं पहुँच सके। रिप्ले या मैनुअल उपयोग करें।", ne: "Open-Meteo सम्म पुग्न सकिएन। रिप्ले वा म्यानुअल प्रयोग गर्नुहोस्।" },
  refresh: { en: "Refresh live rain", hi: "लाइव बारिश ताज़ा करें", ne: "प्रत्यक्ष वर्षा ताजा गर्नुहोस्" },
  replayNote: { en: "Illustrative storm curve, not real data.", hi: "उदाहरण तूफ़ान वक्र, असली डेटा नहीं।", ne: "उदाहरणात्मक आँधी वक्र, वास्तविक डेटा होइन।" },

  toolsTitle: { en: "Map tools", hi: "नक्शा उपकरण", ne: "नक्सा उपकरण" },
  toolIncident: { en: "Add rescue point", hi: "बचाव बिंदु जोड़ें", ne: "उद्धार बिन्दु थप्नुहोस्" },
  toolBase: { en: "Set base", hi: "बेस तय करें", ne: "बेस तोक्नुहोस्" },
  toolOff: { en: "Off", hi: "बंद", ne: "बन्द" },
  toolHint: { en: "Click a road to close or reopen it. With a tool on, click empty map to place a point.", hi: "सड़क बंद या दोबारा खोलने के लिए उस पर क्लिक करें। उपकरण चालू हो तो खाली नक्शे पर क्लिक करके बिंदु रखें।", ne: "सडक बन्द वा फेरि खोल्न त्यसमा क्लिक गर्नुहोस्। उपकरण खोलेर खाली नक्सामा क्लिक गरी बिन्दु राख्नुहोस्।" },
  reopenAll: { en: "Reopen all roads", hi: "सभी सड़कें खोलें", ne: "सबै सडक खोल्नुहोस्" },
  resetPoints: { en: "Reset demo points", hi: "डेमो बिंदु रीसेट करें", ne: "डेमो बिन्दु रिसेट गर्नुहोस्" },
  recalc: { en: "Recalculated in", hi: "पुनर्गणना में लगा", ne: "पुनर्गणनामा लागेको" },

  contactsTitle: { en: "Emergency contacts", hi: "आपातकालीन संपर्क", ne: "आपतकालीन सम्पर्क" },
  contactsNote: { en: "Disaster hotline 1234 replaced 1149 in July 2026 (press reports). Confirm with NDRRMA before public use.", hi: "आपदा हॉटलाइन 1234 ने जुलाई 2026 में 1149 की जगह ली (समाचार रिपोर्ट)। सार्वजनिक उपयोग से पहले NDRRMA से पुष्टि करें।", ne: "विपद् हटलाइन १२३४ ले जुलाई २०२६ मा ११४९ को ठाउँ लियो (समाचार प्रतिवेदन)। सार्वजनिक प्रयोगअघि NDRRMA सँग पुष्टि गर्नुहोस्।" },

  mapLegendRoute: { en: "Ambulance route", hi: "एम्बुलेंस मार्ग", ne: "एम्बुलेन्स मार्ग" },
  mapLegendSupply: { en: "Supply route", hi: "आपूर्ति मार्ग", ne: "आपूर्ति मार्ग" },

  roadTitle: { en: "Road details", hi: "सड़क विवरण", ne: "सडक विवरण" },
  roadEmpty: { en: "Click any road on the map to see why it has its risk level.", hi: "किसी भी सड़क पर क्लिक करके देखें कि उसका जोखिम स्तर क्यों है।", ne: "कुनै पनि सडकमा क्लिक गरेर जोखिम स्तर किन छ हेर्नुहोस्।" },
  closed: { en: "Closed", hi: "बंद", ne: "बन्द" },
  closeRoad: { en: "Close road", hi: "सड़क बंद करें", ne: "सडक बन्द गर्नुहोस्" },
  reopenRoad: { en: "Reopen road", hi: "सड़क खोलें", ne: "सडक खोल्नुहोस्" },
  risk: { en: "risk", hi: "जोखिम", ne: "जोखिम" },

  incTitle: { en: "Rescue requests: ambulance dispatch", hi: "बचाव अनुरोध: एम्बुलेंस भेजना", ne: "उद्धार अनुरोध: एम्बुलेन्स पठाउने" },
  incNote: { en: "Each point is routed to its nearest reachable hospital as an ambulance, with signal priority on main roads. Points hold a location only, no personal details.", hi: "हर बिंदु को एम्बुलेंस के रूप में उसके निकटतम पहुँच योग्य अस्पताल तक रूट किया जाता है, मुख्य सड़कों पर सिग्नल प्राथमिकता के साथ। बिंदु में केवल स्थान है, कोई निजी जानकारी नहीं।", ne: "हरेक बिन्दुलाई एम्बुलेन्सका रूपमा नजिकको पुग्न सकिने अस्पतालसम्म रुट गरिन्छ, मुख्य सडकमा सिग्नल प्राथमिकतासहित। बिन्दुमा स्थान मात्र हुन्छ, व्यक्तिगत विवरण छैन।" },
  incEmpty: { en: "No rescue points. Turn on “Add rescue point” and click the map.", hi: "कोई बचाव बिंदु नहीं। “बचाव बिंदु जोड़ें” चालू करके नक्शे पर क्लिक करें।", ne: "कुनै उद्धार बिन्दु छैन। “उद्धार बिन्दु थप्नुहोस्” खोलेर नक्सामा क्लिक गर्नुहोस्।" },
  colPoint: { en: "Point", hi: "बिंदु", ne: "बिन्दु" },
  colHospital: { en: "Nearest hospital", hi: "निकटतम अस्पताल", ne: "नजिकको अस्पताल" },
  colTime: { en: "Time", hi: "समय", ne: "समय" },
  colDist: { en: "Distance", hi: "दूरी", ne: "दूरी" },
  colConf: { en: "Confidence", hi: "विश्वास", ne: "विश्वास" },
  noRoute: { en: "No passable route", hi: "कोई पार करने योग्य मार्ग नहीं", ne: "पार गर्न मिल्ने मार्ग छैन" },
  remove: { en: "Remove", hi: "हटाएँ", ne: "हटाउनुहोस्" },
  lvlGreen: { en: "High", hi: "उच्च", ne: "उच्च" },
  lvlAmber: { en: "Medium", hi: "मध्यम", ne: "मध्यम" },
  lvlRed: { en: "Low", hi: "कम", ne: "कम" },
  whyTitle: { en: "Why this confidence", hi: "यह विश्वास स्तर क्यों", ne: "यो विश्वास स्तर किन" },

  campTitle: { en: "Relief camps and supply routes", hi: "राहत शिविर और आपूर्ति मार्ग", ne: "राहत शिविर र आपूर्ति मार्ग" },
  campNote: { en: "Supplies leave the base by road and are split by camp capacity among reachable camps. Capacity-based split is a demo rule. Replace it with real occupancy and need once collected.", hi: "आपूर्ति बेस से सड़क द्वारा निकलती है और पहुँच योग्य शिविरों में क्षमता के अनुसार बाँटी जाती है। क्षमता-आधारित बँटवारा डेमो नियम है। असली भीड़ और ज़रूरत मिलने पर इसे बदलें।", ne: "आपूर्ति बेसबाट सडकमार्गले निस्कन्छ र पुग्न सकिने शिविरबीच क्षमताअनुसार बाँडिन्छ। क्षमतामा आधारित बाँडफाँड डेमो नियम हो। वास्तविक भीड र आवश्यकता सङ्कलन भएपछि यसलाई बदल्नुहोस्।" },
  units: { en: "Units to distribute (food + medical)", hi: "बाँटने की इकाइयाँ (भोजन + चिकित्सा)", ne: "बाँड्ने इकाई (खाना + औषधि)" },
  colCamp: { en: "Camp", hi: "शिविर", ne: "शिविर" },
  colCap: { en: "Capacity", hi: "क्षमता", ne: "क्षमता" },
  colEta: { en: "Supply ETA", hi: "आपूर्ति ETA", ne: "आपूर्ति ETA" },
  colUnits: { en: "Units", hi: "इकाइयाँ", ne: "इकाई" },
  showRoute: { en: "Show route", hi: "मार्ग दिखाएँ", ne: "मार्ग देखाउनुहोस्" },
  hideRoute: { en: "Hide route", hi: "मार्ग छिपाएँ", ne: "मार्ग लुकाउनुहोस्" },
  vehicleNote: { en: "Supply vehicle uses car rules (placeholder).", hi: "आपूर्ति वाहन कार के नियम उपयोग करता है (प्लेसहोल्डर)।", ne: "आपूर्ति सवारीले कारका नियम प्रयोग गर्छ (प्लेसहोल्डर)।" },
  download: { en: "Download response plan (CSV)", hi: "प्रतिक्रिया योजना डाउनलोड करें (CSV)", ne: "प्रतिक्रिया योजना डाउनलोड गर्नुहोस् (CSV)" },

  statsTitle: { en: "Emergency statistics", hi: "आपातकालीन आँकड़े", ne: "आपतकालीन तथ्यांक" },
  sAvgEta: { en: "Average ambulance time", hi: "औसत एम्बुलेंस समय", ne: "औसत एम्बुलेन्स समय" },
  sMaxEta: { en: "Longest ambulance time", hi: "सबसे लंबा एम्बुलेंस समय", ne: "सबैभन्दा लामो एम्बुलेन्स समय" },
  sAvoid: { en: "High-risk road avoided", hi: "बचाई गई उच्च-जोखिम सड़क", ne: "जोगाइएको उच्च-जोखिम सडक" },
  sExtra: { en: "Extra minutes vs fastest (total)", hi: "सबसे तेज़ से अतिरिक्त मिनट (कुल)", ne: "सबैभन्दा छिटोभन्दा थप मिनेट (जम्मा)" },
  sNoRoute: { en: "Points with no route", hi: "बिना मार्ग वाले बिंदु", ne: "मार्ग नभएका बिन्दु" },
  sCalc: { en: "Recalculation time", hi: "पुनर्गणना समय", ne: "पुनर्गणना समय" },
  statNote: { en: "Computed in the browser from the demo network. No lives-saved or accuracy claims.", hi: "डेमो नेटवर्क से ब्राउज़र में गणना। जान बचाने या सटीकता के कोई दावे नहीं।", ne: "डेमो सञ्जालबाट ब्राउजरमा गणना। ज्यान बचाएको वा शुद्धताको कुनै दाबी छैन।" },

  roadmapTitle: { en: "Roadmap (not in this build)", hi: "रोडमैप (इस संस्करण में नहीं)", ne: "रोडम्याप (यो संस्करणमा छैन)" },
  roadmapNote: { en: "For the demo story only. Not built, not claimed as deployed.", hi: "केवल डेमो कहानी के लिए। बनाया नहीं गया, तैनात होने का दावा नहीं।", ne: "डेमो कथाका लागि मात्र। बनाइएको होइन, तैनात भएको दाबी होइन।" },
  limits: { en: "Decision support, not a safety guarantee. Demo road grid, hospitals, shelters and capacities. Risk weights are reference values to be validated for Nepal. Vehicle limits are placeholders. No accuracy claim without ground-truth data.", hi: "निर्णय-सहायता, सुरक्षा की गारंटी नहीं। डेमो सड़क ग्रिड, अस्पताल, आश्रय और क्षमताएँ। जोखिम भार संदर्भ मान हैं जिन्हें नेपाल के लिए जाँचना है। वाहन सीमाएँ प्लेसहोल्डर हैं। ज़मीनी डेटा के बिना सटीकता का कोई दावा नहीं।", ne: "निर्णय-सहायता, सुरक्षाको ग्यारेन्टी होइन। डेमो सडक ग्रिड, अस्पताल, आश्रयस्थल र क्षमता। जोखिम भार सन्दर्भ मान हुन् जसलाई नेपालका लागि जाँच्नुपर्छ। सवारी सीमा प्लेसहोल्डर हुन्। भूमिगत डेटा बिना शुद्धताको कुनै दाबी छैन।" },
  limitsEngine: { en: "Road names, risk classes and confidence reasons are shown in English.", hi: "सड़कों के नाम, जोखिम वर्ग और विश्वास के कारण अंग्रेज़ी में दिखाए जाते हैं।", ne: "सडकका नाम, जोखिम वर्ग र विश्वासका कारण अङ्ग्रेजीमा देखाइन्छन्।" },

  // ---- the five Respond pages (tabs, same names as the Home footer) ----
  tabsLabel: { en: "Respond pages", hi: "प्रतिक्रिया पृष्ठ", ne: "प्रतिक्रिया पृष्ठहरू" },
  tabPlan: { en: "Respond Plan", hi: "प्रतिक्रिया योजना", ne: "प्रतिक्रिया योजना" },
  tabClosures: { en: "Road Closures", hi: "सड़क बंदी", ne: "सडक बन्दी" },
  tabShelters: { en: "Shelters & Hospitals", hi: "आश्रय व अस्पताल", ne: "आश्रयस्थल र अस्पताल" },
  tabAmbulance: { en: "Ambulance Mode", hi: "एम्बुलेंस मोड", ne: "एम्बुलेन्स मोड" },
  tabChoke: { en: "Chokepoint Report", hi: "अवरोध रिपोर्ट", ne: "अवरोध प्रतिवेदन" },

  clEyebrow: { en: "RESPOND · ROAD CLOSURES", hi: "प्रतिक्रिया · सड़क बंदी", ne: "प्रतिक्रिया · सडक बन्दी" },
  clH1a: { en: "Close flooded roads.", hi: "डूबी सड़कें बंद करें।", ne: "डुबानमा परेका सडक बन्द गर्नुहोस्।" },
  clH1b: { en: "Routes update at once.", hi: "मार्ग तुरंत बदलते हैं।", ne: "मार्ग तुरुन्तै बदलिन्छन्।" },
  clSub: {
    en: "Click a road on the map to close or reopen it. Every ambulance and supply route is recalculated around your closures.",
    hi: "नक्शे पर सड़क पर क्लिक करके उसे बंद या दोबारा खोलें। हर एम्बुलेंस और आपूर्ति मार्ग आपकी बंदी के आसपास से दोबारा निकलता है।",
    ne: "नक्सामा सडकमा क्लिक गरेर बन्द वा फेरि खोल्नुहोस्। हरेक एम्बुलेन्स र आपूर्ति मार्ग तपाईंको बन्दीको वरिपरिबाट फेरि निकालिन्छ।",
  },
  shEyebrow: { en: "RESPOND · SHELTERS & HOSPITALS", hi: "प्रतिक्रिया · आश्रय व अस्पताल", ne: "प्रतिक्रिया · आश्रयस्थल र अस्पताल" },
  shH1a: { en: "Where to take people.", hi: "लोगों को कहाँ ले जाएँ।", ne: "मानिसलाई कहाँ लैजाने।" },
  shH1b: { en: "Which way is safe.", hi: "कौन सा रास्ता सुरक्षित है।", ne: "कुन बाटो सुरक्षित छ।" },
  shSub: {
    en: "Hospitals for rescue points, relief camps for supplies. Each camp shows its supply route time and how sure SETU is about it.",
    hi: "बचाव बिंदुओं के लिए अस्पताल, आपूर्ति के लिए राहत शिविर। हर शिविर में आपूर्ति मार्ग का समय और SETU को उसका कितना भरोसा है, दिखता है।",
    ne: "उद्धार बिन्दुका लागि अस्पताल, आपूर्तिका लागि राहत शिविर। हरेक शिविरमा आपूर्ति मार्गको समय र SETU लाई त्यसमा कति भरोसा छ भनेर देखिन्छ।",
  },
  amEyebrow: { en: "RESPOND · AMBULANCE MODE", hi: "प्रतिक्रिया · एम्बुलेंस मोड", ne: "प्रतिक्रिया · एम्बुलेन्स मोड" },
  amH1a: { en: "Every rescue point", hi: "हर बचाव बिंदु", ne: "हरेक उद्धार बिन्दु" },
  amH1b: { en: "to the nearest reachable hospital.", hi: "निकटतम पहुँच योग्य अस्पताल तक।", ne: "नजिकको पुग्न सकिने अस्पतालसम्म।" },
  amSub: {
    en: "Add rescue points on the map. Each ambulance takes the safest passable route to a hospital, and the statistics card shows the extra minutes that costs against the fastest route.",
    hi: "नक्शे पर बचाव बिंदु जोड़ें। हर एम्बुलेंस अस्पताल तक सबसे सुरक्षित पार करने योग्य मार्ग लेती है, और आँकड़ों का कार्ड दिखाता है कि सबसे तेज़ मार्ग की तुलना में इसमें कितने अतिरिक्त मिनट लगते हैं।",
    ne: "नक्सामा उद्धार बिन्दु थप्नुहोस्। हरेक एम्बुलेन्सले अस्पतालसम्म सबैभन्दा सुरक्षित पार गर्न मिल्ने मार्ग लिन्छ, र तथ्यांक कार्डले सबैभन्दा छिटो मार्गको तुलनामा कति थप मिनेट लाग्छ देखाउँछ।",
  },
  ckEyebrow: { en: "RESPOND · CHOKEPOINT REPORT", hi: "प्रतिक्रिया · अवरोध रिपोर्ट", ne: "प्रतिक्रिया · अवरोध प्रतिवेदन" },
  ckH1a: { en: "The roads everything depends on.", hi: "जिन सड़कों पर सब कुछ टिका है।", ne: "जसमा सबै कुरा निर्भर छ ती सडक।" },
  ckH1b: { en: "Watch them first.", hi: "इन पर पहले नज़र रखें।", ne: "पहिले यिनीमाथि नजर राख्नुहोस्।" },
  ckSub: {
    en: "Ranks the ten roads where a flood would hurt the network most: busy roads that are also flood-prone. The ranking is fixed for the demo network. The risk figure changes with the rainfall you set.",
    hi: "उन दस सड़कों का क्रम जहाँ बाढ़ नेटवर्क को सबसे ज़्यादा नुकसान पहुँचाएगी: व्यस्त सड़कें जो बाढ़-प्रवण भी हैं। डेमो नेटवर्क के लिए क्रम स्थिर है। जोखिम का आँकड़ा आपके तय किए गए बारिश के साथ बदलता है।",
    ne: "बाढीले सञ्जाललाई सबैभन्दा बढी असर गर्ने दश सडकको क्रम: व्यस्त र बाढी-प्रवण सडक। डेमो सञ्जालका लागि क्रम स्थिर छ। जोखिमको आँकडा तपाईंले तोकेको वर्षासँगै बदलिन्छ।",
  },

  uPeople: { en: "people", hi: "लोग", ne: "मानिस" },

  // ---- road closures page ----
  colRoad: { en: "Road", hi: "सड़क", ne: "सडक" },
  colClass: { en: "Risk class", hi: "जोखिम वर्ग", ne: "जोखिम वर्ग" },
  colRisk: { en: "Risk", hi: "जोखिम", ne: "जोखिम" },
  colLen: { en: "Length", hi: "लंबाई", ne: "लम्बाइ" },
  reopen: { en: "Reopen", hi: "खोलें", ne: "खोल्नुहोस्" },
  clNone: { en: "No roads closed. Click a road on the map to close it.", hi: "कोई सड़क बंद नहीं। बंद करने के लिए नक्शे पर सड़क पर क्लिक करें।", ne: "कुनै सडक बन्द छैन। बन्द गर्न नक्सामा सडकमा क्लिक गर्नुहोस्।" },
  closeHigh: { en: "Close all high-risk roads", hi: "सभी उच्च-जोखिम सड़कें बंद करें", ne: "सबै उच्च-जोखिम सडक बन्द गर्नुहोस्" },

  // ---- shelters & hospitals page ----
  shCampsTitle: { en: "Relief camps", hi: "राहत शिविर", ne: "राहत शिविर" },
  shCampsNote: { en: "Each card shows the supply route from the base. Distance from the river is measured to the demo river line, not surveyed.", hi: "हर कार्ड बेस से आपूर्ति मार्ग दिखाता है। नदी से दूरी डेमो नदी रेखा तक मापी गई है, सर्वे की हुई नहीं।", ne: "हरेक कार्डले बेसबाट आपूर्ति मार्ग देखाउँछ। नदीबाट दूरी डेमो नदी रेखासम्म नापिएको हो, सर्वेक्षण गरिएको होइन।" },
  shHospTitle: { en: "Hospitals", hi: "अस्पताल", ne: "अस्पताल" },
  shHospNote: { en: "Demo hospitals. Real bed counts and opening status need a data feed from the hospitals.", hi: "डेमो अस्पताल। असली बिस्तर संख्या और खुलने की स्थिति के लिए अस्पतालों से डेटा फ़ीड चाहिए।", ne: "डेमो अस्पताल। वास्तविक शय्या सङ्ख्या र खुल्ने अवस्थाका लागि अस्पतालबाट डेटा फिड चाहिन्छ।" },
  colHosp: { en: "Hospital", hi: "अस्पताल", ne: "अस्पताल" },
  colAssigned: { en: "Rescue points sent here", hi: "यहाँ भेजे गए बचाव बिंदु", ne: "यहाँ पठाइएका उद्धार बिन्दु" },
  colQuick: { en: "Quickest ambulance", hi: "सबसे तेज़ एम्बुलेंस", ne: "सबैभन्दा छिटो एम्बुलेन्स" },
  fromRiver: { en: "from river (approx.)", hi: "नदी से (लगभग)", ne: "नदीबाट (लगभग)" },
  showSafe: { en: "Show safe supply route", hi: "सुरक्षित आपूर्ति मार्ग दिखाएँ", ne: "सुरक्षित आपूर्ति मार्ग देखाउनुहोस्" },
  totalCap: { en: "Total camp capacity", hi: "कुल शिविर क्षमता", ne: "कुल शिविर क्षमता" },

  // ---- chokepoint page ----
  ckTitle: { en: "Top 10 chokepoints", hi: "शीर्ष 10 अवरोध", ne: "शीर्ष १० अवरोध" },
  ckNote: { en: "Ranked by how important the road is to the network and how flood-prone it is. Click a row to see it on the map.", hi: "सड़क नेटवर्क के लिए कितनी ज़रूरी है और कितनी बाढ़-प्रवण है, इस आधार पर क्रम। नक्शे पर देखने के लिए पंक्ति पर क्लिक करें।", ne: "सडक सञ्जालका लागि कति महत्त्वपूर्ण छ र कति बाढी-प्रवण छ भन्ने आधारमा क्रम। नक्सामा हेर्न पङ्क्तिमा क्लिक गर्नुहोस्।" },
  downloadChoke: { en: "Download chokepoints (CSV)", hi: "अवरोध डाउनलोड करें (CSV)", ne: "अवरोध डाउनलोड गर्नुहोस् (CSV)" },
  // ---- guided step-by-step flow ----
  stepWord: { en: "Step", hi: "चरण", ne: "चरण" },
  stepsLabel: { en: "Response steps", hi: "प्रतिक्रिया के चरण", ne: "प्रतिक्रियाका चरण" },
  s1Name: { en: "Situation", hi: "स्थिति", ne: "अवस्था" },
  s2Name: { en: "Roads & points", hi: "सड़क व बिंदु", ne: "सडक र बिन्दु" },
  s3Name: { en: "Ambulances", hi: "एम्बुलेंस", ne: "एम्बुलेन्स" },
  s4Name: { en: "Supplies", hi: "आपूर्ति", ne: "आपूर्ति" },
  s5Name: { en: "Review", hi: "समीक्षा", ne: "समीक्षा" },
  s1Title: { en: "Set the rain", hi: "बारिश तय करें", ne: "वर्षा तय गर्नुहोस्" },
  s1Sub: { en: "Choose how heavy the rain is. SETU colours every road by flood risk.", hi: "बारिश कितनी तेज़ है, चुनें। SETU हर सड़क को बाढ़ जोखिम के अनुसार रंग देता है।", ne: "वर्षा कति कडा छ छान्नुहोस्। SETU ले हरेक सडकलाई बाढी जोखिमअनुसार रङ दिन्छ।" },
  s2Title: { en: "Close flooded roads, mark rescue points", hi: "डूबी सड़कें बंद करें, बचाव बिंदु रखें", ne: "डुबानका सडक बन्द गर्नुहोस्, उद्धार बिन्दु राख्नुहोस्" },
  s2Sub: { en: "Tap a road on the map to close or reopen it. Add a rescue point wherever someone needs an ambulance.", hi: "सड़क को बंद या दोबारा खोलने के लिए नक्शे पर उस पर क्लिक करें। जहाँ एम्बुलेंस चाहिए वहाँ बचाव बिंदु जोड़ें।", ne: "सडक बन्द वा फेरि खोल्न नक्सामा त्यसमा क्लिक गर्नुहोस्। एम्बुलेन्स चाहिने ठाउँमा उद्धार बिन्दु थप्नुहोस्।" },
  s3Title: { en: "Send ambulances", hi: "एम्बुलेंस भेजें", ne: "एम्बुलेन्स पठाउनुहोस्" },
  s3Sub: { en: "Each rescue point gets the safest passable route to the nearest hospital.", hi: "हर बचाव बिंदु को निकटतम अस्पताल तक सबसे सुरक्षित पार करने योग्य मार्ग मिलता है।", ne: "हरेक उद्धार बिन्दुलाई नजिकको अस्पतालसम्म सबैभन्दा सुरक्षित पार गर्न मिल्ने मार्ग दिइन्छ।" },
  s4Title: { en: "Supply the relief camps", hi: "राहत शिविरों तक आपूर्ति", ne: "राहत शिविरमा आपूर्ति" },
  s4Sub: { en: "Supplies leave the base and are split among the camps SETU can reach.", hi: "आपूर्ति बेस से निकलती है और SETU जिन शिविरों तक पहुँच सकता है उनमें बाँटी जाती है।", ne: "आपूर्ति बेसबाट निस्कन्छ र SETU ले पुग्न सक्ने शिविरबीच बाँडिन्छ।" },
  s5Title: { en: "Review and download", hi: "जाँचें और डाउनलोड करें", ne: "जाँच र डाउनलोड" },
  s5Sub: { en: "Check the roads everything depends on, then download the plan.", hi: "वे सड़कें देखें जिन पर सब निर्भर है, फिर योजना डाउनलोड करें।", ne: "सबै कुरा निर्भर हुने सडक हेर्नुहोस्, त्यसपछि योजना डाउनलोड गर्नुहोस्।" },
  back: { en: "Back", hi: "पीछे", ne: "पछाडि" },
  next: { en: "Next", hi: "आगे", ne: "अगाडि" },
  sosBtn: { en: "Emergency numbers", hi: "आपातकालीन नंबर", ne: "आपतकालीन नम्बर" },
  change: { en: "change", hi: "बदलें", ne: "बदल्नुहोस्" },
  moreNums: { en: "More numbers and notes", hi: "और आँकड़े और टिप्पणियाँ", ne: "थप तथ्यांक र टिप्पणी" },
  showAll: { en: "Show all 10", hi: "सभी 10 दिखाएँ", ne: "सबै १० देखाउनुहोस्" },
  showTop: { en: "Show top 5 only", hi: "केवल शीर्ष 5 दिखाएँ", ne: "शीर्ष ५ मात्र देखाउनुहोस्" },
  addMore: { en: "Add or change rescue points", hi: "बचाव बिंदु जोड़ें या बदलें", ne: "उद्धार बिन्दु थप्नुहोस् वा बदल्नुहोस्" },
  hintClose: { en: "Tap a road on the map to close or reopen it.", hi: "नक्शे पर सड़क पर क्लिक करके उसे बंद या दोबारा खोलें।", ne: "नक्सामा सडकमा क्लिक गरेर बन्द वा फेरि खोल्नुहोस्।" },
  hintAddOn: { en: "Add rescue point is ON. Tap anywhere on the map to place one.", hi: "बचाव बिंदु जोड़ना चालू है। रखने के लिए नक्शे पर कहीं भी क्लिक करें।", ne: "उद्धार बिन्दु थप्ने चालू छ। राख्न नक्सामा जहाँसुकै क्लिक गर्नुहोस्।" },
  hintBaseOn: { en: "Set base is ON. Tap the map where supplies start from.", hi: "बेस तय करना चालू है। जहाँ से आपूर्ति निकलेगी वहाँ नक्शे पर क्लिक करें।", ne: "बेस तोक्ने चालू छ। आपूर्ति निस्कने ठाउँमा नक्सामा क्लिक गर्नुहोस्।" },
  noPoints: { en: "No rescue points yet. Go back and add one.", hi: "अभी कोई बचाव बिंदु नहीं। पीछे जाकर जोड़ें।", ne: "अहिलेसम्म उद्धार बिन्दु छैन। पछाडि गएर थप्नुहोस्।" },
  riskWord: { en: "risk", hi: "जोखिम", ne: "जोखिम" },
};

const ROADMAP = [
  { en: "Rescue team management and assignment", hi: "बचाव दल प्रबंधन और नियुक्ति", ne: "उद्धार टोली व्यवस्थापन र खटाइ" },
  { en: "Damage assessment", hi: "क्षति आकलन", ne: "क्षति मूल्याङ्कन" },
  { en: "Recovery progress tracking", hi: "पुनर्प्राप्ति प्रगति ट्रैकिंग", ne: "पुनर्लाभ प्रगति अनुगमन" },
  { en: "Real rescue-request intake and real shelter occupancy", hi: "असली बचाव-अनुरोध प्राप्ति और असली आश्रय भीड़", ne: "वास्तविक उद्धार-अनुरोध सङ्कलन र वास्तविक आश्रय भीड" },
  { en: "Login, audit log, hosted database, SMS gateway", hi: "लॉगिन, ऑडिट लॉग, होस्टेड डेटाबेस, SMS गेटवे", ne: "लगइन, अडिट लग, होस्टेड डाटाबेस, SMS गेटवे" },
];

// routing options (same defaults as the Dashboard)
const LAM = 3;
const ROBUST = true;

const fmtKm = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const fmtMin = (t) => `${t.toFixed(1)} min`;
const nb = (t) => t.replace(/ /g, "\u00a0"); // keep a number and its unit on one line

// ---------- the guided flow: five steps (the old five pages map onto them) ----------
const STEPS = [
  { n: 1, name: T.s1Name, title: T.s1Title, sub: T.s1Sub },
  { n: 2, name: T.s2Name, title: T.s2Title, sub: T.s2Sub },
  { n: 3, name: T.s3Name, title: T.s3Title, sub: T.s3Sub },
  { n: 4, name: T.s4Name, title: T.s4Title, sub: T.s4Sub },
  { n: 5, name: T.s5Name, title: T.s5Title, sub: T.s5Sub },
];
// old routes still work: each opens on the matching step
const STEP_OF = { plan: 1, closures: 2, ambulance: 3, shelters: 4, chokepoints: 5 };

// shortest distance (m) from a point to the demo river line (flat-earth approximation, fine at city scale)
const distToRiverM = ([lat0, lon0]) => {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  let best = Infinity;
  for (let i = 0; i < RIVER_LINE.length - 1; i++) {
    const ax = (RIVER_LINE[i][1] - lon0) * kx, ay = (RIVER_LINE[i][0] - lat0) * ky;
    const bx = (RIVER_LINE[i + 1][1] - lon0) * kx, by = (RIVER_LINE[i + 1][0] - lat0) * ky;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
};
const riverDist = Object.fromEntries(shelters.map((s) => [s.id, distToRiverM(s.pos)]));


// ---------- page ----------
export default function Respond({ view = "plan" }) {
  // language (same storage key as the Features page)
  const [lang, setLangState] = useState("en");
  useEffect(() => {
    try { const s = localStorage.getItem("setu-lang"); if (s && LANGUAGES.some((l) => l.code === s)) setLangState(s); } catch { /* ignore */ }
  }, []);
  const setLang = (c) => { setLangState(c); try { localStorage.setItem("setu-lang", c); } catch { /* ignore */ } };
  const tr = (o) => (typeof o === "string" ? o : o[lang] ?? o.en);

  // rain
  const [source, setSource] = useState("manual");
  const [manual, setManual] = useState({ intensity: 25, rain24: 110 });
  const [live, setLive] = useState({ status: "idle", intensity: 0, rain24: 0, at: null });
  const [frame, setFrame] = useState(26);
  const [playing, setPlaying] = useState(false);
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

  // scenario
  const [closed, setClosed] = useState(() => new Set());
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [incidents, setIncidents] = useState(START_INCIDENTS);
  const [base, setBase] = useState(START_BASE);
  const [tool, setTool] = useState("off");
  const [selectedInc, setSelectedInc] = useState(null);
  const [selectedCamp, setSelectedCamp] = useState(null);
  const [units, setUnits] = useState(1000);
  const nextId = useRef(3);

  // guided flow
  const [step, setStep] = useState(STEP_OF[view] ?? 1);
  const [sosOpen, setSosOpen] = useState(false);
  const [allChokes, setAllChokes] = useState(false);
  useEffect(() => { setStep(STEP_OF[view] ?? 1); }, [view]);
  useEffect(() => { setTool("off"); }, [step]);

  const toggleClosed = useCallback((id) => {
    setClosed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const onMapClick = useCallback((latlng, toolNow) => {
    const node = nearestNode(net, latlng);
    if (toolNow === "incident") {
      setIncidents((list) => [...list, { id: nextId.current++, node }]);
    } else if (toolNow === "base") {
      setBase(node);
      setTool("off");
    }
  }, []);

  // risk per road
  const risks = useMemo(() => net.edges.map((e) => edgeRisk(e.S, intensity, rain24)), [intensity, rain24]);
  const highCount = useMemo(
    () => net.edges.reduce((n, e, i) => n + (e.S != null && riskClass(risks[i]) >= 3 ? 1 : 0), 0),
    [risks],
  );

  // all routes
  const calc = useMemo(() => {
    const t0 = performance.now();
    const common = { closed, intensity, rain24 };
    const inc = incidents.map((p) => {
      const o = { ...common, start: p.node, targets: hospitalNodes, vehicle: "ambulance" };
      const safe = route(net, { ...o, lam: LAM, robust: ROBUST });
      const fast = route(net, { ...o, lam: 0, robust: false, ignoreRisk: true });
      return { ...p, safe, fast, conf: confidence(safe, { robust: ROBUST, live: isLive }) };
    });
    const camps = shelters.map((s) => {
      const r = route(net, { ...common, start: base, targets: [s.node], vehicle: "car", lam: LAM, robust: ROBUST });
      return { ...s, r, conf: confidence(r, { robust: ROBUST, live: isLive }) };
    });
    return { inc, camps, ms: performance.now() - t0 };
  }, [incidents, base, closed, intensity, rain24, isLive]);

  // capacity-based split among reachable camps (largest-remainder rounding)
  const alloc = useMemo(() => {
    const total = Math.max(0, Math.min(100000, Math.floor(Number(units) || 0)));
    const reach = calc.camps.filter((c) => c.r);
    const cap = reach.reduce((s, c) => s + (c.capacity || 0), 0);
    const out = {};
    let given = 0;
    const rem = [];
    reach.forEach((c) => {
      const exact = cap ? (total * c.capacity) / cap : 0;
      const fl = Math.floor(exact);
      out[c.id] = fl; given += fl; rem.push([c.id, exact - fl]);
    });
    rem.sort((a, b) => b[1] - a[1]);
    for (let i = 0; i < total - given && i < rem.length; i++) out[rem[i][0]]++;
    return out;
  }, [calc.camps, units]);

  // statistics (measured here from the engine)
  const stats = useMemo(() => {
    const ok = calc.inc.filter((p) => p.safe);
    const times = ok.map((p) => p.safe.time);
    return {
      reachable: ok.length,
      noRoute: calc.inc.length - ok.length,
      avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
      max: times.length ? Math.max(...times) : null,
      avoided: ok.reduce((s, p) => s + (p.fast ? Math.max(0, p.fast.highMeters - p.safe.highMeters) : 0), 0),
      extra: ok.reduce((s, p) => s + (p.fast ? Math.max(0, p.safe.time - p.fast.time) : 0), 0),
      campsOk: calc.camps.filter((c) => c.r).length,
    };
  }, [calc]);

  // ---------- Leaflet map ----------
  const mapEl = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const handlers = useRef({});
  handlers.current = { toggleClosed, setSelectedRoad, setSelectedInc, onMapClick, tool, step };

  useEffect(() => {
    if (map.current || !mapEl.current) return undefined;
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: true, zoomSnap: 0.25 }).setView(CENTER, 14);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(m);
    L.polyline(RIVER_LINE, { color: "#38bdf8", weight: 9, opacity: 0.22, interactive: false }).addTo(m);
    L.polyline(RIVER_LINE, { color: "#7dd3fc", weight: 2, opacity: 0.7, dashArray: "2 6", interactive: false }).addTo(m);
    layers.current = { roads: L.layerGroup().addTo(m), routes: L.layerGroup().addTo(m), marks: L.layerGroup().addTo(m) };
    m.on("click", (ev) => handlers.current.onMapClick([ev.latlng.lat, ev.latlng.lng], handlers.current.tool));
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
    net.edges.forEach((e, i) => {
      const isClosed = closed.has(e.id);
      const info = edgeClassInfo(e, risks[i]);
      const line = L.polyline(e.coords, {
        color: isClosed ? "#0b0f19" : info.color,
        weight: e.primary ? 6 : 4,
        opacity: isClosed ? 0.95 : 0.85,
        dashArray: isClosed ? "4 6" : null,
        lineCap: "round",
      });
      if (isClosed) L.polyline(e.coords, { color: "#ef4444", weight: 2, opacity: 0.9, interactive: false }).addTo(g);
      if (selectedRoad === e.id) L.polyline(e.coords, { color: "#ffffff", weight: (e.primary ? 6 : 4) + 6, opacity: 0.35, interactive: false }).addTo(g);
      line.bindTooltip(`${e.name} · ${isClosed ? "CLOSED" : info.label}`, { sticky: true, className: "rs-tip" });
      line.on("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        const h = handlers.current;
        if (h.tool !== "off") { h.onMapClick([ev.latlng.lat, ev.latlng.lng], h.tool); return; } // a tool is on: place the point here
        if (h.step !== 2) return; // roads are only closed or reopened in step 2, so a stray tap elsewhere changes nothing
        h.toggleClosed(e.id);
        h.setSelectedRoad(e.id);
      });
      line.addTo(g);
    });
  }, [risks, closed, selectedRoad]);

  // routes + markers
  useEffect(() => {
    const g = layers.current.routes, mk = layers.current.marks;
    if (!g || !mk) return;
    g.clearLayers(); mk.clearLayers();

    const showAmb = step === 3;
    const showInc = step === 2 || step === 3 || step === 5;
    const showHosp = step >= 2;
    const showShel = step >= 4;

    if (showAmb) {
      calc.inc.forEach((p) => {
        if (!p.safe) return;
        const on = selectedInc === p.id;
        L.polyline(p.safe.coords, { color: "#22d3ee", weight: on ? 16 : 12, opacity: on ? 0.3 : 0.14, interactive: false }).addTo(g);
        L.polyline(p.safe.coords, { color: on ? "#a5f3fc" : "#22d3ee", weight: on ? 6 : 4, opacity: 1, interactive: false }).addTo(g);
      });
    }
    const camp = calc.camps.find((c) => c.id === selectedCamp);
    if (step === 4 && camp?.r) {
      L.polyline(camp.r.coords, { color: "#f5c451", weight: 5, opacity: 0.95, dashArray: "8 8", interactive: false }).addTo(g);
    }

    facilities.forEach((f) => {
      if (f.type === "hospital" ? !showHosp : !showShel) return;
      L.marker(f.pos, {
        icon: L.divIcon({ className: "", html: `<div class="rs-pin rs-pin--${f.type}">${f.type === "hospital" ? "H" : "S"}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).bindTooltip(`${f.name}${f.capacity ? ` · cap ${f.capacity}` : ""}`, { className: "rs-tip" }).addTo(mk);
    });
    if (showInc) {
      calc.inc.forEach((p, i) => {
        L.marker(net.nodes[p.node].pos, {
          icon: L.divIcon({ className: "", html: `<div class="rs-pin rs-pin--incident${selectedInc === p.id ? " is-on" : ""}">${i + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
        }).on("click", () => handlers.current.setSelectedInc(p.id)).addTo(mk);
      });
    }
    if (step >= 4) {
      L.marker(net.nodes[base].pos, {
        icon: L.divIcon({ className: "", html: `<div class="rs-pin rs-pin--base">B</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
        interactive: false,
      }).addTo(mk);
    }
  }, [calc, selectedInc, selectedCamp, base, step]);

  // crosshair cursor while a tool is on
  useEffect(() => {
    if (mapEl.current) mapEl.current.classList.toggle("rs-map--tool", tool !== "off");
  }, [tool]);

  // ---------- helpers ----------
  const sel = selectedRoad ? net.edges.find((e) => e.id === selectedRoad) : null;
  const selIdx = sel ? net.edges.indexOf(sel) : -1;
  const hospitalName = (node) => hospitals.find((h) => h.node === node)?.name ?? "—";
  const selIncData = calc.inc.find((p) => p.id === selectedInc);
  const lvl = (level) => tr(T[level === "green" ? "lvlGreen" : level === "amber" ? "lvlAmber" : "lvlRed"]);

  const resetPoints = () => {
    setIncidents(START_INCIDENTS);
    nextId.current = 3;
    setBase(START_BASE);
    setSelectedInc(null);
    setSelectedCamp(null);
    setTool("off");
  };

  const downloadCsv = () => {
    const rows = [["type", "name", "destination", "distance_m", "time_min", "confidence", "units"]];
    calc.inc.forEach((p, i) => rows.push([
      "ambulance", `Rescue point ${i + 1}`, p.safe ? hospitalName(p.safe.target) : "no route",
      p.safe ? Math.round(p.safe.distance) : "", p.safe ? p.safe.time.toFixed(1) : "", p.conf.label, "",
    ]));
    calc.camps.forEach((c) => rows.push([
      "supply", "Base", c.name, c.r ? Math.round(c.r.distance) : "", c.r ? c.r.time.toFixed(1) : "",
      c.conf.label, c.r ? alloc[c.id] ?? 0 : 0,
    ]));
    const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "setu_response_plan.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sourceNote =
    source === "live" ? (live.status === "ok" ? `${tr(T.liveOk)} (${live.at?.replace("T", " ")})` : live.status === "error" ? tr(T.liveErr) : tr(T.liveLoading))
      : source === "replay" ? tr(T.replayNote) : "";

  const langClass = lang === "en" ? "" : `lang-hi lang-${lang}`;

  // ---------- extra data for the five Respond pages ----------
  const gridRef = useRef(null);
  const stepTop = useRef(null);
  const panelRef = useRef(null);

  const chokes = useMemo(() => chokepoints(net, intensity, rain24), [intensity, rain24]);
  const closedRows = useMemo(
    () => net.edges.map((e, i) => ({ e, i })).filter(({ e }) => closed.has(e.id)),
    [closed],
  );

  const hospLoad = useMemo(() => hospitals.map((h) => {
    const mine = calc.inc.filter((p) => p.safe && p.safe.target === h.node);
    return { ...h, count: mine.length, best: mine.length ? Math.min(...mine.map((p) => p.safe.time)) : null };
  }), [calc.inc]);

  const totalCap = shelters.reduce((s, c) => s + (c.capacity || 0), 0);

  // ---------- actions for the extra pages ----------
  const isNarrow = () => typeof window !== "undefined" && window.innerWidth < 1024;
  const scrollToMap = () => { if (isNarrow()) gridRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); };
  const goStep = (n) => {
    setStep(Math.max(1, Math.min(5, n)));
    if (panelRef.current) panelRef.current.scrollTop = 0;
    if (isNarrow()) stepTop.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
  const showCampRoute = (id) => {
    const off = selectedCamp === id;
    setSelectedCamp(off ? null : id);
    if (!off) scrollToMap();
  };
  const focusRoad = (e) => {
    setSelectedRoad(e.id);
    if (map.current) map.current.fitBounds(L.latLngBounds(e.coords), { maxZoom: 16, padding: [80, 80] });
    scrollToMap();
  };
  const closeHighRisk = () => setClosed((prev) => {
    const n = new Set(prev);
    net.edges.forEach((e, i) => { if (e.S != null && riskClass(risks[i]) >= 3) n.add(e.id); });
    return n;
  });
  const saveCsv = (name, rows) => {
    const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const downloadChokes = () => saveCsv("setu_chokepoints.csv", [
    ["rank", "road_id", "road", "risk_class", "risk", "length_m", "closed"],
    ...chokes.map((k, n) => [n + 1, k.e.id, k.e.name, edgeClassInfo(k.e, k.risk).label, k.risk.toFixed(2), Math.round(k.e.length), closed.has(k.e.id) ? "yes" : "no"]),
  ]);

  const cur = STEPS[step - 1];
  const nextStep = STEPS[step] || null; // the step after this one (STEPS is 0-based)
  const shownChokes = allChokes ? chokes : chokes.slice(0, 5);

  // ---------- page pieces ----------
  const unitsInput = (
    <label className="rs-units">
      <span>{tr(T.units)}</span>
      <input type="number" min="0" max="100000" step="50" value={units} onChange={(e) => setUnits(e.target.value)} />
    </label>
  );

  const toolSeg = (items) => (
    <div className={`rs-seg rs-seg--${items.length}`}>
      {items.map(([k, l]) => (
        <button key={k} className={tool === k ? "on" : ""} onClick={() => setTool(k)}>{tr(l)}</button>
      ))}
    </div>
  );

  // STEP 1: rain
  const rainCard = (
    <div className="rs-card">
      <h3>{tr(T.rainTitle)}</h3>
      <div className="rs-seg">
        {[["live", T.live], ["replay", T.replayT], ["manual", T.manual]].map(([k, l]) => (
          <button key={k} className={source === k ? "on" : ""} onClick={() => { setSource(k); setPlaying(false); }}>{tr(l)}</button>
        ))}
      </div>
      {source === "live" && (
        <button className="rs-btn rs-btn--ghost" onClick={fetchLive}>↻ {tr(T.refresh)}</button>
      )}
      {source === "replay" && (
        <div className="rs-replay">
          <button className="rs-play" onClick={() => { if (frame >= replay.length - 1) setFrame(0); setPlaying((p) => !p); }}>{playing ? "❚❚" : "▶"}</button>
          <input type="range" min="0" max={replay.length - 1} value={frame} onChange={(e) => { setPlaying(false); setFrame(+e.target.value); }} />
          <span>H{String(frame).padStart(2, "0")}</span>
        </div>
      )}
      {source === "manual" && (
        <>
          <div className="rs-presets">
            {Object.entries(PRESETS).map(([k, pr]) => (
              <button key={k} className={manual.intensity === pr.intensity && manual.rain24 === pr.rain24 ? "on" : ""} onClick={() => setManual({ intensity: pr.intensity, rain24: pr.rain24 })}>{tr(T[k])}</button>
            ))}
          </div>
          <label className="rs-slider">
            <span>{tr(T.intensity)} <b>{manual.intensity} mm/h</b></span>
            <input type="range" min="0" max="60" value={manual.intensity} onChange={(e) => setManual((m) => ({ ...m, intensity: +e.target.value }))} />
          </label>
          <label className="rs-slider">
            <span>{tr(T.rain24)} <b>{manual.rain24} mm</b></span>
            <input type="range" min="0" max="250" value={manual.rain24} onChange={(e) => setManual((m) => ({ ...m, rain24: +e.target.value }))} />
          </label>
        </>
      )}
      <p className="rs-note">
        {intensity} mm/h · {rain24} mm · {(rainfallLoading(intensity, rain24) * 100).toFixed(0)}%
        {sourceNote && <><br />{sourceNote}</>}
      </p>
    </div>
  );

  // STEP 2: close roads + rescue points
  const roadCard = (
    <div className="rs-card">
      <h3>{tr(T.roadTitle)}{sel ? ` · ${sel.id}` : ""}</h3>
      {sel && (
        <div className="rs-road">
          <div className="rs-road-head">
            <b>{sel.name}</b>
            <span className="rs-pill" style={{ background: edgeClassInfo(sel, risks[selIdx]).color }}>
              {closed.has(sel.id) ? tr(T.closed) : edgeClassInfo(sel, risks[selIdx]).label}
            </span>
          </div>
          <div className="rs-note">{tr(T.risk)} {risks[selIdx].toFixed(2)} · {fmtKm(sel.length)}</div>
          <ul>{explainEdge(sel, intensity, rain24).map((x) => <li key={x}>{x}</li>)}</ul>
          <button className="rs-btn rs-btn--ghost" onClick={() => toggleClosed(sel.id)}>{closed.has(sel.id) ? tr(T.reopenRoad) : tr(T.closeRoad)}</button>
        </div>
      )}
    </div>
  );

  const closeCard = (
    <div className="rs-card">
      <h3>{tr(T.kClosed)} · {closedRows.length}</h3>
      <p className="rs-note">{tr(T.hintClose)}</p>
      <div className="rs-row rs-row--inline">
        <button className="rs-btn rs-btn--ghost" onClick={closeHighRisk} disabled={highCount === 0}>{tr(T.closeHigh)} ({highCount})</button>
        <button className="rs-btn rs-btn--ghost" onClick={() => { setClosed(new Set()); setSelectedRoad(null); }} disabled={!closed.size}>{tr(T.reopenAll)}</button>
      </div>
      {closedRows.length === 0 ? <p className="rs-empty">{tr(T.clNone)}</p> : (
        <div className="rs-items rs-scroll">
          {closedRows.map(({ e, i }) => (
            <div key={e.id} className={`rs-item${selectedRoad === e.id ? " is-sel" : ""}`} onClick={() => focusRoad(e)}>
              <div className="rs-item-main">
                <b>{e.name}</b>
                <span><i className="rs-swatch" style={{ background: edgeClassInfo(e, risks[i]).color }} />{edgeClassInfo(e, risks[i]).label} · {nb(fmtKm(e.length))}</span>
              </div>
              <button className="rs-btn rs-btn--ghost rs-btn--sm" onClick={(ev) => { ev.stopPropagation(); toggleClosed(e.id); }}>{tr(T.reopen)}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const pointsCard = (
    <div className="rs-card">
      <h3>{tr(T.kInc)} · {incidents.length}</h3>
      {toolSeg([["incident", T.toolIncident], ["off", T.toolOff]])}
      {tool === "incident" && <p className="rs-note">{tr(T.hintAddOn)}</p>}
      <button className="rs-btn rs-btn--ghost" onClick={resetPoints}>{tr(T.resetPoints)}</button>
    </div>
  );

  // STEP 3: ambulances
  const ambCard = (
    <div className="rs-card">
      <h3>{tr(T.incTitle)}</h3>
      {calc.inc.length === 0 ? <p className="rs-empty">{tr(T.noPoints)}</p> : (
        <div className="rs-items">
          {calc.inc.map((p, i) => (
            <div key={p.id} className={`rs-item${selectedInc === p.id ? " is-sel" : ""}`} onClick={() => setSelectedInc(selectedInc === p.id ? null : p.id)}>
              <span className="rs-num">{i + 1}</span>
              <div className="rs-item-main">
                <b>{p.safe ? hospitalName(p.safe.target) : <em>{tr(T.noRoute)}</em>}</b>
                <span>{p.safe ? `${fmtMin(p.safe.time)} · ${fmtKm(p.safe.distance)}` : "—"}</span>
              </div>
              <span className={`rs-conf rs-conf--${p.conf.level}`}>{lvl(p.conf.level)}</span>
            </div>
          ))}
        </div>
      )}
      {selIncData && (
        <div className="rs-why">
          <b>{tr(T.whyTitle)}</b>
          <ul>{selIncData.conf.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <button className="rs-btn rs-btn--ghost rs-btn--sm" onClick={() => { setIncidents((l) => l.filter((x) => x.id !== selIncData.id)); setSelectedInc(null); }}>{tr(T.remove)}</button>
        </div>
      )}
      <button className="rs-btn rs-btn--ghost" onClick={() => goStep(2)}>＋ {tr(T.addMore)}</button>
    </div>
  );

  const ambStats = (
    <>
      <div className="rs-stats rs-stats--3">
        <div><b>{stats.avg != null ? fmtMin(stats.avg) : "—"}</b><span>{tr(T.sAvgEta)}</span></div>
        <div><b>{stats.max != null ? fmtMin(stats.max) : "—"}</b><span>{tr(T.sMaxEta)}</span></div>
        <div><b>{stats.noRoute}</b><span>{tr(T.sNoRoute)}</span></div>
      </div>
      <details className="rs-more">
        <summary>{tr(T.moreNums)}</summary>
        <div className="rs-stats">
          <div><b>{fmtKm(stats.avoided)}</b><span>{tr(T.sAvoid)}</span></div>
          <div><b>+{stats.extra.toFixed(1)} min</b><span>{tr(T.sExtra)}</span></div>
          <div><b>{calc.ms.toFixed(1)} ms</b><span>{tr(T.sCalc)}</span></div>
        </div>
        <p className="rs-note">{tr(T.incNote)}</p>
        <p className="rs-note">{tr(T.statNote)}</p>
      </details>
    </>
  );

  // STEP 4: relief camps
  const campCard = (
    <div className="rs-card">
      <h3>{tr(T.shCampsTitle)}</h3>
      {toolSeg([["base", T.toolBase], ["off", T.toolOff]])}
      {tool === "base" && <p className="rs-note">{tr(T.hintBaseOn)}</p>}
      {unitsInput}
      <div className="rs-cards">
        {calc.camps.map((c) => (
          <article key={c.id} className={`rs-camp${selectedCamp === c.id ? " is-sel" : ""}`}>
            <div className="rs-camp-top">
              <span className={`rs-conf rs-conf--${c.r ? c.conf.level : "red"}`}>{c.r ? lvl(c.conf.level) : tr(T.noRoute)}</span>
              <span>{fmtKm(riverDist[c.id])} {tr(T.fromRiver)}</span>
            </div>
            <h4>{c.name}</h4>
            <dl>
              <div><dt>{tr(T.colCap)}</dt><dd>{c.capacity} {tr(T.uPeople)}</dd></div>
              <div><dt>{tr(T.colEta)}</dt><dd>{c.r ? fmtMin(c.r.time) : "—"}</dd></div>
              <div><dt>{tr(T.colDist)}</dt><dd>{c.r ? fmtKm(c.r.distance) : "—"}</dd></div>
              <div><dt>{tr(T.colUnits)}</dt><dd>{c.r ? alloc[c.id] ?? 0 : 0}</dd></div>
            </dl>
            <button className="rs-btn rs-btn--ghost" disabled={!c.r} onClick={() => showCampRoute(c.id)}>
              {selectedCamp === c.id ? tr(T.hideRoute) : tr(T.showSafe)}
            </button>
          </article>
        ))}
      </div>
      <details className="rs-more">
        <summary>{tr(T.shHospTitle)}</summary>
        <div className="rs-items">
          {hospLoad.map((h) => (
            <div key={h.id} className="rs-item">
              <div className="rs-item-main">
                <b>{h.name}</b>
                <span>{tr(T.colAssigned)}: {h.count} · {tr(T.colQuick)}: {h.best != null ? fmtMin(h.best) : "—"}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="rs-note">{tr(T.shHospNote)}</p>
        <p className="rs-note"><b>{tr(T.totalCap)}:</b> {totalCap} {tr(T.uPeople)} (demo)</p>
        <p className="rs-note">{tr(T.campNote)} {tr(T.vehicleNote)}</p>
      </details>
    </div>
  );

  // STEP 5: review + export
  const reviewCard = (
    <div className="rs-card">
      <h3>{tr(T.ckTitle)}</h3>
      <p className="rs-note">{tr(T.ckNote)}</p>
      <div className="rs-items">
        {shownChokes.map((k, n) => {
          const info = edgeClassInfo(k.e, k.risk);
          return (
            <div key={k.e.id} className={`rs-item${selectedRoad === k.e.id ? " is-sel" : ""}`} onClick={() => focusRoad(k.e)}>
              <span className="rs-num rs-num--rank">{n + 1}</span>
              <div className="rs-item-main">
                <b>{k.e.name}</b>
                <span><i className="rs-swatch" style={{ background: info.color }} />{closed.has(k.e.id) ? tr(T.closed) : info.label} · {tr(T.riskWord)}{"\u00a0"}{k.risk.toFixed(2)} · {nb(fmtKm(k.e.length))}</span>
              </div>
              <button className="rs-btn rs-btn--ghost rs-btn--sm" onClick={(ev) => { ev.stopPropagation(); toggleClosed(k.e.id); }}>{closed.has(k.e.id) ? tr(T.reopen) : tr(T.closeRoad)}</button>
            </div>
          );
        })}
      </div>
      <button className="rs-linkbtn" onClick={() => setAllChokes((v) => !v)}>{allChokes ? tr(T.showTop) : tr(T.showAll)}</button>
    </div>
  );

  const exportCard = (
    <div className="rs-card">
      <div className="rs-row">
        <button className="rs-btn rs-btn--primary rs-btn--full" onClick={downloadCsv}>⬇ {tr(T.download)}</button>
        <button className="rs-btn rs-btn--ghost" onClick={downloadChokes}>⬇ {tr(T.downloadChoke)}</button>
      </div>
      <details className="rs-more">
        <summary>{tr(T.roadmapTitle)}</summary>
        <p className="rs-note">{tr(T.roadmapNote)}</p>
        <ul className="rs-roadmap">{ROADMAP.map((r) => <li key={r.en}>{tr(r)}</li>)}</ul>
      </details>
    </div>
  );

  // legend entries change with the step, so the map never shows more than it needs to
  const legendExtra = [];
  if (step === 2) legendExtra.push(<span key="c"><i className="lg-closed" />{tr(T.closed)}</span>);
  if (step === 3) legendExtra.push(<span key="a"><i className="lg-amb" />{tr(T.mapLegendRoute)}</span>);
  if (step === 4) legendExtra.push(<span key="s"><i className="lg-sup" />{tr(T.mapLegendSupply)}</span>, <span key="sh"><b className="rs-key rs-key--s">S</b>Shelter</span>, <span key="b"><b className="rs-key rs-key--b">B</b>Base</span>);
  if (step >= 2) legendExtra.push(<span key="h"><b className="rs-key rs-key--h">H</b>Hospital</span>);

  return (
    <div className={`rs-dash ${langClass}`} lang={lang}>
      {/* TOP BAR */}
      <header className="rs-top">
        <Link to="/" className="rs-brand" aria-label="Setu home">
          <span className="rs-logo" aria-hidden="true"><img src={setuLogo} alt="" /></span>
          <span>
            <span className="rs-brand-name">Setu</span>
            <span className="rs-brand-sub">{tr(T.navSub)}</span>
          </span>
        </Link>
        <div className="rs-top-right">
          <nav className="rs-sitelinks" aria-label="Site">
            <Link to="/">{tr(T.navHome)}</Link>
            <Link to="/Features">{tr(T.navFeatures)}</Link>
            <Link to="/dashboard">{tr(T.navDashboard)}</Link>
            <Link to="/About">{tr(T.navAbout)}</Link>
          </nav>
          <div className="rs-lang" role="group" aria-label="Language">
            {LANGUAGES.map((l) => (
              <button key={l.code} className={lang === l.code ? "is-on" : ""} onClick={() => setLang(l.code)} lang={l.code}>{l.label}</button>
            ))}
          </div>
          <div className="rs-sos-wrap">
            <button className="rs-sos" onClick={() => setSosOpen((v) => !v)} aria-expanded={sosOpen}>📞 {tr(T.sosBtn)}</button>
            {sosOpen && (
              <div className="rs-sos-pop" role="dialog" aria-label={tr(T.contactsTitle)}>
                <div className="rs-contacts">
                  {CONTACTS.map((c) => (
                    <a key={c.key} href={`tel:${c.number}`} className="rs-contact">
                      <span>{tr(c.label)}</span><b>{c.number}</b>
                    </a>
                  ))}
                </div>
                <p className="rs-note">{tr(T.contactsNote)}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* STEPPER */}
      <section className="rs-head" ref={stepTop}>
        <nav className="rs-steps" aria-label={tr(T.stepsLabel)}>
          {STEPS.map((st) => (
            <button
              key={st.n}
              className={`rs-stepbtn${step === st.n ? " is-on" : ""}${step > st.n ? " is-done" : ""}`}
              onClick={() => goStep(st.n)}
              aria-current={step === st.n ? "step" : undefined}
            >
              <span className="rs-stepnum">{step > st.n ? "✓" : st.n}</span>
              <span className="rs-stepname">{tr(st.name)}</span>
            </button>
          ))}
        </nav>
        <div className="rs-head-row">
          <div className="rs-head-text">
            <p className="rs-eyebrow">{tr(T.stepWord)} {step} {tr(T.of)} 5</p>
            <h1>{tr(cur.title)}</h1>
            <p className="rs-sub">{tr(cur.sub)}</p>
          </div>
          <span className="rs-chip rs-chip--warn"><i />{tr(T.demoChip)}</span>
        </div>
      </section>

      {/* STATUS: only the numbers that matter */}
      <section className="rs-status">
        <button className="rs-schip rs-schip--btn" onClick={() => goStep(1)}>
          🌧 {intensity} mm/h · {rain24} mm <u>{tr(T.change)}</u>
        </button>
        <span className="rs-schip rs-schip--orange">⚠ <b>{highCount}</b><small>/ {net.edges.length}</small> {tr(T.kHigh)}</span>
        <span className="rs-schip rs-schip--green">🚑 <b>{stats.reachable}</b><small>{tr(T.of)} {incidents.length}</small> {tr(T.kAmb)}</span>
        <span className="rs-schip rs-schip--cyan">⛺ <b>{stats.campsOk}</b><small>{tr(T.of)} {shelters.length}</small> {tr(T.kCamps)}</span>
      </section>

      {/* MAP + ONE PANEL FOR THE CURRENT STEP */}
      <main className="rs-grid" ref={gridRef}>
        <section className="rs-mapwrap">
          <div ref={mapEl} className="rs-map" />
          <div className="rs-map-title"><span className="rs-dot" />RESPOND <em>{tr(cur.name)}</em></div>
          <div className="rs-legend">
            <div className="rs-legend-row">
              {[...CLASSES, NODATA].map((c) => <span key={c.key}><i style={{ background: c.color }} />{c.label}</span>)}
            </div>
            {legendExtra.length > 0 && <div className="rs-legend-row">{legendExtra}</div>}
          </div>
        </section>

        <aside className="rs-panel" ref={panelRef}>
          <div className="rs-panel-body" key={step}>
            {step === 1 && rainCard}
            {step === 2 && (<>{closeCard}{sel && roadCard}{pointsCard}</>)}
            {step === 3 && (<>{ambCard}{ambStats}</>)}
            {step === 4 && campCard}
            {step === 5 && (<>{reviewCard}{exportCard}</>)}
          </div>
          <div className="rs-nav">
            <button className="rs-btn rs-btn--ghost" disabled={step === 1} onClick={() => goStep(step - 1)}>← {tr(T.back)}</button>
            {nextStep ? (
              <button className="rs-btn rs-btn--next" onClick={() => goStep(step + 1)}>{tr(T.next)}: {tr(nextStep.name)} →</button>
            ) : (
              <button className="rs-btn rs-btn--next" onClick={() => goStep(1)}>↺ {tr(STEPS[0].name)}</button>
            )}
          </div>
        </aside>
      </main>

      <footer className="rs-limits">{tr(T.limits)} {tr(T.limitsEngine)}</footer>
    </div>
  );
}
