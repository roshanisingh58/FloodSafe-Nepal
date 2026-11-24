// Features.js — Setu · English / Hindi / Nepali (Flood Risk & Emergency Safe-Route Mapper)
// Pilot: Kathmandu, Nepal · Team TheLadyBugz_5 · Katathon 6.0 · PS 103
// No extra packages needed: both phones, the maps and the graphs are plain React + SVG.
//
// Phone 1 shows India. A finger taps Nepal (or the visitor does), the map zooms in,
// and Phone 2 opens the Nepal map with every feature and where it stands.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./Features.css";
import setuLogo from "./Setu.jpg"; // same logo file as Home.js

/* ------------------------------------------------------------------ */
/* Shared risk model (same rules as the alignment report, Section 5)  */
/* ------------------------------------------------------------------ */
const CLASSES = [
  { name: "Very low", short: "V.low", color: "#2fa3b8" },
  { name: "Low", short: "Low", color: "#7fcfb0" },
  { name: "Moderate", short: "Mod", color: "#e2b04f" },
  { name: "High", short: "High", color: "#e07a3a" },
  { name: "Very high", short: "V.high", color: "#ef5b5b" },
];
const NO_DATA = { name: "No data", color: "#7d8a8f" };

// Thresholds 0.2 / 0.4 / 0.6 / 0.8
const classOf = (r) => (r == null ? -1 : Math.min(4, Math.floor(r / 0.2)));
const colorOf = (r) => (r == null ? NO_DATA.color : CLASSES[classOf(r)].color);
const nameOf = (r) => (r == null ? NO_DATA.name : CLASSES[classOf(r)].name);

// rainfall_loading = 0.65 x intensity/40 + 0.35 x rain_24h/150, capped at 1
const loadingOf = (intensity, rain24) => Math.min(1, 0.65 * (intensity / 40) + 0.35 * (rain24 / 150));
// risk = S x (0.12 + 0.88 x rainfall_loading)
const riskOf = (S, loading) => (S == null ? null : S * (0.12 + 0.88 * loading));

// Manual slider presets (demo values, not measurements)
const RAIN = [
  { key: "dry", label: "Dry", intensity: 0, rain24: 0 },
  { key: "moderate", label: "Moderate", intensity: 10, rain24: 40 },
  { key: "heavy", label: "Heavy", intensity: 25, rain24: 100 },
  { key: "extreme", label: "Extreme", intensity: 40, rain24: 150 },
];

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* ------------------------------------------------------------------ */
/* South Asia outlines for Phone 1 (pre-simplified, no download)      */
/* India: DataMeet india-composite (official boundary).               */
/* Neighbours: johan/world.geo.json. viewBox 0 0 300 340.             */
/* ------------------------------------------------------------------ */
const SA = {
  india: "M103.2,37.3L106.7,37.6L106.9,36.6L108.9,36.7L109.6,35.0L114.6,33.6L115.1,32.6L116.7,33.2L119.5,32.5L120.8,33.8L121.5,33.4L122.7,35.9L125.4,36.2L125.9,37.9L127.2,36.5L129.1,37.4L126.0,44.9L123.5,45.6L123.5,47.0L121.0,47.3L121.9,49.4L120.0,51.7L115.4,51.9L117.2,55.2L115.6,55.3L115.9,57.7L117.4,59.4L120.1,59.5L119.4,61.3L121.3,64.5L120.1,66.0L118.9,65.6L116.1,67.8L114.4,66.4L114.1,64.3L111.0,65.9L111.8,68.3L114.4,71.1L113.8,72.9L115.0,74.8L113.9,75.7L114.4,77.6L115.5,77.9L117.3,76.3L120.2,80.4L124.2,80.9L127.5,83.0L127.3,84.7L134.6,87.9L128.6,92.8L129.0,94.2L127.5,95.7L128.0,98.0L126.7,99.0L126.0,101.7L130.0,104.3L130.5,103.0L136.2,106.1L137.2,108.3L138.3,108.1L142.3,111.0L143.9,110.4L147.3,112.7L149.6,112.3L149.9,114.4L153.9,114.9L155.1,116.1L155.7,114.7L160.0,116.0L159.8,115.0L162.5,114.3L163.8,115.6L166.7,116.0L167.0,118.8L169.8,119.7L170.4,120.7L171.9,120.5L172.0,121.6L175.8,120.5L177.8,123.5L179.3,122.5L182.1,123.0L185.6,124.9L188.7,123.3L188.9,124.6L191.1,125.6L196.0,124.2L197.1,125.5L198.7,121.8L198.2,119.4L196.9,118.1L198.8,111.7L198.1,110.4L202.7,108.5L204.5,109.5L205.0,111.0L203.9,113.8L205.2,116.5L203.7,117.9L204.8,118.2L204.9,119.8L205.3,119.3L207.2,121.2L209.4,120.6L213.7,122.2L218.1,120.3L221.3,121.5L230.1,121.2L231.9,120.1L233.3,120.8L233.9,119.7L233.2,116.8L233.9,116.5L233.0,114.7L229.7,114.6L228.9,113.2L229.6,111.9L232.2,112.4L235.0,110.7L236.9,111.6L239.4,109.8L238.9,108.2L241.1,107.7L244.0,104.4L250.9,102.0L254.0,99.7L253.4,98.5L256.9,96.9L258.0,98.4L262.1,99.3L268.3,96.3L271.0,97.6L270.3,99.6L271.6,98.9L274.4,103.0L272.3,104.7L273.1,105.5L273.1,104.4L275.0,103.7L276.9,106.2L278.7,106.1L280.8,107.7L281.0,110.7L279.8,110.6L276.6,113.5L279.1,118.1L276.5,117.5L275.0,115.7L270.7,116.6L263.6,122.2L261.0,123.0L260.3,124.6L261.4,128.2L258.8,133.1L256.4,134.8L255.9,136.5L257.4,137.4L257.1,139.2L254.3,143.6L252.1,149.7L248.5,148.2L246.3,148.8L244.7,147.5L245.7,151.3L245.2,156.6L244.4,157.9L242.9,157.5L242.7,162.5L243.6,165.0L242.1,165.7L241.8,167.8L241.4,167.3L240.9,168.2L239.1,166.1L238.2,167.8L235.3,151.0L233.3,151.7L232.5,150.8L232.6,153.3L230.7,155.0L231.4,157.0L229.4,158.5L227.9,155.4L227.6,157.3L227.0,156.9L225.3,152.0L227.2,147.2L229.1,147.6L229.8,146.0L230.7,146.9L230.6,145.9L232.0,146.9L232.1,145.0L234.3,144.2L235.5,141.2L234.9,139.6L237.3,139.8L236.6,138.3L233.4,136.8L218.9,137.2L213.5,135.8L213.9,129.5L212.1,126.6L211.1,129.2L209.2,128.9L207.4,127.6L206.8,125.1L205.1,125.0L206.4,126.6L203.0,126.4L203.7,125.6L200.6,122.9L200.0,124.3L201.4,124.5L201.7,125.5L198.6,127.5L198.0,130.7L199.4,130.8L201.8,133.7L204.3,133.6L204.5,135.1L206.0,136.1L205.3,137.0L201.0,136.6L200.6,139.1L200.0,139.9L198.2,139.2L198.6,140.0L197.1,141.8L200.0,144.6L203.6,145.6L203.9,148.4L202.2,149.6L202.0,151.7L204.2,153.1L203.5,155.5L205.9,155.9L204.6,157.8L205.7,159.4L205.4,162.2L206.8,166.1L205.8,168.6L206.9,171.1L205.3,171.2L204.7,169.7L204.6,171.3L203.5,170.7L204.0,167.4L202.7,166.8L202.0,169.4L201.7,168.1L201.1,168.6L201.1,171.3L200.8,170.3L200.6,171.5L200.6,170.3L199.5,170.2L199.2,171.8L198.9,166.1L197.2,165.4L198.7,166.6L195.3,170.5L188.9,172.1L187.3,174.0L186.5,175.9L187.8,179.0L186.9,179.4L188.7,179.9L185.7,181.7L186.2,183.3L185.1,184.1L186.3,183.6L183.8,185.1L181.9,187.0L182.4,187.4L175.0,189.8L170.5,192.8L162.4,203.2L157.2,206.0L154.2,210.2L146.0,215.5L146.0,220.1L140.7,222.6L139.3,221.9L136.7,222.7L133.8,228.3L132.8,228.4L132.6,227.1L131.4,226.6L127.7,228.7L125.8,234.5L127.1,239.3L126.5,244.2L128.5,251.8L126.8,259.7L123.2,267.3L124.3,280.6L120.6,280.1L118.9,281.1L118.8,283.1L115.5,288.4L116.1,289.9L118.1,290.4L109.8,293.0L108.1,299.2L103.4,302.1L98.6,299.4L94.4,294.1L95.5,293.2L94.4,293.8L92.8,289.6L92.0,283.2L88.8,275.9L88.4,272.6L85.5,267.0L82.4,264.1L79.0,256.1L78.1,248.3L75.5,242.2L76.3,242.5L74.2,238.0L72.7,237.4L73.1,236.6L70.9,234.4L70.7,232.0L69.7,231.3L70.6,231.1L67.2,226.0L66.0,221.9L66.9,221.5L66.0,221.7L65.5,220.6L66.7,220.7L65.5,219.8L66.3,219.6L65.4,218.5L65.0,215.4L65.6,215.5L64.4,213.0L65.4,213.1L64.2,212.0L63.9,210.5L64.6,210.2L62.1,204.1L62.4,203.5L63.6,204.8L63.5,203.1L63.0,203.7L62.0,202.9L61.9,201.0L62.7,201.7L61.4,199.5L62.1,198.2L62.8,199.3L61.9,197.6L63.3,196.4L62.7,196.5L62.6,194.7L61.0,197.6L60.8,193.6L61.9,193.8L60.4,192.1L61.7,191.5L60.3,191.4L59.6,188.5L61.8,181.8L61.3,179.7L62.1,179.6L61.1,179.2L61.3,177.5L60.3,177.3L61.3,176.9L60.1,176.4L60.8,175.5L59.5,176.5L59.4,175.2L60.4,175.3L59.1,174.4L60.6,172.9L59.5,172.9L59.8,172.4L62.0,170.7L58.6,170.9L59.3,168.5L60.4,167.8L58.3,168.2L59.0,165.6L61.9,165.0L58.5,164.6L57.6,165.6L56.7,164.6L56.4,166.6L55.4,167.4L55.9,168.3L55.2,168.0L56.5,171.2L54.5,174.2L54.7,175.3L48.7,178.5L43.2,180.2L37.2,176.7L26.3,164.6L27.5,163.0L27.2,163.8L28.6,163.5L28.9,165.1L31.2,164.4L31.4,163.5L32.8,164.5L33.4,163.0L34.1,163.7L35.7,162.3L37.4,162.4L39.8,158.2L38.4,158.5L37.8,157.4L37.8,158.4L34.8,158.8L33.2,160.5L30.9,160.1L30.1,159.1L28.6,159.5L23.6,156.3L24.4,156.6L23.1,155.7L24.0,155.0L21.7,153.0L25.2,149.4L22.5,150.7L21.7,150.0L21.0,152.3L19.5,151.9L21.0,150.9L19.6,150.9L21.1,148.5L24.7,148.5L25.1,145.2L25.7,146.2L26.4,145.3L26.9,146.1L32.2,145.4L33.4,146.6L36.0,146.6L36.8,145.4L40.8,144.2L40.9,145.8L42.2,146.2L45.8,144.4L44.8,144.0L44.7,142.5L45.6,141.6L41.8,134.8L41.7,131.8L38.2,131.7L36.7,129.5L37.4,123.6L31.4,121.8L32.1,117.5L39.2,109.5L41.1,109.5L42.4,112.1L43.6,112.5L52.8,110.0L57.2,102.2L62.2,99.7L66.2,90.8L71.4,88.4L70.6,86.8L71.1,85.6L72.3,85.3L75.4,81.2L77.9,79.9L76.2,79.4L77.5,76.5L76.0,73.8L77.1,72.1L79.5,70.5L82.7,70.1L83.9,68.8L81.5,66.4L77.7,66.2L78.0,62.9L77.4,63.7L75.0,63.6L68.4,60.4L68.0,52.7L66.3,48.0L66.7,46.2L68.6,46.2L69.2,44.3L72.0,43.1L72.8,40.9L69.4,39.9L68.9,38.7L69.7,37.0L66.3,36.9L65.7,35.6L63.8,35.1L64.3,33.7L58.8,33.8L58.6,30.1L62.4,27.8L63.2,25.6L70.3,25.4L68.7,23.5L72.0,24.3L75.4,22.6L76.7,23.0L77.8,21.8L79.2,22.1L79.7,23.3L81.9,22.4L84.3,23.1L84.7,25.3L87.2,25.1L89.8,28.1L96.0,30.8L97.1,33.7L101.6,35.1ZM249.4,310.1L250.4,312.4L250.0,314.3L249.2,314.4L247.7,311.2ZM248.4,308.4L248.5,309.3L247.6,309.6ZM245.2,302.6L246.0,303.9L245.0,304.0ZM239.8,290.8L240.3,291.8L239.6,292.0ZM237.8,275.0L238.4,277.0L237.6,278.6L236.3,278.4L236.3,275.9ZM238.8,269.1L238.9,270.5L238.1,270.3ZM239.2,262.0L239.2,263.7L240.0,263.7L239.3,264.9L240.0,265.2L238.9,267.6L239.6,267.7L238.8,269.0L237.5,265.7L238.0,264.7L238.3,265.6ZM240.2,261.2L240.9,261.7L240.0,263.3L239.5,261.8ZM241.0,255.4L241.7,259.0L241.1,260.3L240.1,259.8L240.8,261.1L239.2,261.0L239.0,258.3L239.9,258.0L239.4,256.2ZM242.2,249.2L242.7,251.3L241.5,251.2L242.4,252.0L242.2,254.0L241.5,254.4L240.9,253.7L241.0,254.9L240.0,255.4L240.3,251.4L241.1,249.4ZM198.5,169.7L198.3,171.1L197.4,170.7L198.2,168.8Z",
  NPL: "M198.1,110.8L197.4,115.0L198.6,121.1L197.6,124.9L190.1,125.1L172.4,121.9L167.2,117.0L155.0,115.8L143.3,110.4L134.8,105.6L126.2,102.0L129.6,92.9L139.0,86.2L146.2,89.2L155.3,95.5L160.3,96.9L163.3,101.5L170.3,103.4L177.5,107.7L187.7,109.9Z",
  CHN: "M397.1,199.7L389.3,204.3L382.0,201.3L381.7,193.0L386.1,188.6L395.9,185.9L401.1,186.2L403.1,189.8L399.1,194.1ZM552.2,-100.5L567.7,-97.5L578.3,-90.6L582.0,-81.5L595.6,-81.5L603.3,-85.3L618.1,-88.2L613.4,-79.5L610.0,-75.9L606.9,-65.3L600.9,-56.0L590.0,-57.7L582.3,-54.3L584.7,-46.0L583.4,-34.6L578.8,-34.3L578.9,-29.4L573.1,-35.1L569.5,-29.7L555.7,-25.5L557.1,-20.4L549.3,-20.8L545.1,-23.8L538.9,-17.0L529.1,-11.8L521.8,-5.6L509.3,-2.8L502.7,1.7L493.0,4.4L497.8,-0.1L495.9,-3.9L503.0,-10.3L498.3,-15.4L490.5,-12.0L480.4,-5.3L474.8,1.0L466.1,1.4L461.5,5.9L466.2,12.5L473.5,14.0L473.8,18.4L480.9,21.2L491.0,14.3L498.9,18.1L504.7,18.3L506.1,23.4L493.5,26.1L489.3,31.3L480.6,36.1L476.0,42.9L485.6,48.2L489.1,57.7L494.6,66.6L500.7,74.0L500.5,81.1L494.9,83.8L497.0,88.9L502.3,91.9L500.9,99.8L498.7,107.5L493.7,108.3L479.9,131.5L471.6,143.0L446.8,160.0L436.7,161.1L431.2,165.4L428.1,162.3L423.1,167.1L410.5,171.9L401.1,173.4L398.0,183.6L393.0,184.2L390.7,177.2L392.8,173.4L380.8,170.3L376.6,171.9L367.6,169.4L363.3,165.5L364.7,159.9L356.5,158.2L352.2,154.5L344.6,159.7L335.9,160.8L328.7,160.7L323.9,163.1L319.3,164.5L320.6,175.6L315.9,175.3L315.0,173.0L314.8,169.0L308.2,171.8L297.7,166.4L300.3,158.4L294.6,156.5L292.5,147.7L283.0,149.3L284.1,137.8L292.6,129.7L292.7,114.4L288.8,112.1L285.8,106.4L280.5,107.1L270.9,105.7L273.9,101.6L269.7,95.6L263.3,99.7L255.8,97.3L245.5,103.4L237.3,110.6L230.1,111.8L226.2,109.2L221.5,109.0L215.1,106.8L210.2,109.2L204.3,116.4L203.6,108.8L198.1,110.8L187.7,109.9L177.5,107.7L170.3,103.4L163.3,101.5L160.3,96.9L155.3,95.5L146.2,89.2L139.0,86.2L135.3,88.5L122.9,81.8L114.1,75.7L111.6,65.0L118.0,66.3L118.3,61.4L114.7,56.5L115.6,48.6L106.0,37.3L91.3,33.3L88.6,25.9L82.0,21.4L80.4,18.7L79.1,13.1L79.4,9.4L73.9,7.2L71.0,8.2L68.7,-0.8L71.3,-3.0L70.0,-5.2L78.6,-9.8L84.8,-11.7L94.3,-10.4L97.7,-16.6L109.1,-17.7L112.3,-21.6L126.4,-26.8L127.7,-29.0L127.0,-34.5L133.1,-37.0L125.1,-53.8L142.8,-57.6L147.4,-59.8L153.9,-77.1L171.6,-73.9L176.6,-78.3L177.0,-87.9L184.5,-88.8L191.3,-95.3L194.8,-96.1L197.1,-89.3L204.7,-84.2L217.4,-80.6L223.6,-72.8L220.2,-61.5L223.4,-57.3L246.1,-54.3L256.9,-48.3L262.4,-47.2L266.5,-38.3L271.8,-32.6L281.7,-32.8L300.1,-30.7L312.1,-32.0L320.9,-30.6L334.1,-24.7L345.0,-24.7L348.9,-21.7L359.4,-26.9L373.8,-30.2L387.3,-30.6L397.7,-34.0L404.1,-39.2L410.4,-42.4L409.0,-45.6L406.1,-49.3L410.8,-55.5L425.0,-52.7L434.0,-57.8L447.6,-61.6L454.2,-68.0L460.5,-70.7L473.5,-72.0L480.6,-70.9L481.5,-74.3L473.4,-81.1L466.2,-84.2L459.4,-80.6L450.5,-82.1L445.5,-80.9L443.2,-84.8L453.8,-101.8L464.6,-98.1L477.2,-104.2L477.1,-108.5L485.2,-118.7L490.2,-121.8L490.1,-127.2L485.2,-129.5L492.6,-134.3L503.7,-136.0L515.6,-136.3L529.0,-133.4L536.8,-129.8L542.4,-120.1L545.7,-115.9L548.8,-110.0Z",
  PAK: "M82.0,21.4L88.6,25.9L91.3,33.3L106.0,37.3L97.4,45.4L87.4,46.8L73.8,44.4L69.4,48.6L75.7,63.6L82.9,68.4L75.3,74.0L75.4,80.9L66.7,90.5L61.1,100.3L51.7,110.5L41.3,109.7L31.5,119.9L37.3,124.2L38.4,131.6L43.4,136.5L45.2,144.8L25.5,144.8L19.5,151.2L12.9,148.8L10.3,141.9L3.3,134.5L-13.2,136.3L-27.7,136.5L-40.3,137.9L-36.9,126.6L-24.0,121.6L-24.8,117.2L-29.1,115.6L-29.3,107.1L-37.9,102.9L-41.5,97.0L-45.9,92.0L-30.9,96.9L-21.9,95.5L-16.6,96.7L-14.8,94.6L-8.5,95.4L3.1,91.4L3.4,83.2L8.4,77.7L15.1,77.7L16.1,75.0L22.9,73.8L26.2,74.7L29.7,72.0L29.2,66.2L33.0,60.3L38.7,57.9L35.2,51.5L43.7,51.8L46.2,48.3L45.8,44.6L50.3,40.5L49.2,35.7L47.1,31.6L52.4,27.4L62.0,25.4L72.2,24.3L76.8,22.5Z",
  AFG: "M-42.9,35.7L-33.8,39.4L-27.0,38.1L-25.1,33.7L-18.1,32.3L-13.0,29.4L-11.2,21.6L-3.7,19.8L-2.3,16.3L1.9,18.9L9.6,19.3L19.1,22.5L25.6,19.4L28.6,21.2L31.5,16.8L36.9,17.0L38.2,15.6L39.2,11.7L43.0,8.4L47.9,10.5L46.9,13.5L49.6,14.0L48.8,22.1L52.3,25.2L55.5,23.2L59.4,22.2L65.0,17.9L71.2,18.6L80.4,18.7L82.0,21.4L76.8,22.5L72.2,24.3L62.0,25.4L52.4,27.4L47.1,31.6L49.2,35.7L50.3,40.5L45.8,44.6L46.2,48.3L43.7,51.8L35.2,51.5L38.7,57.9L33.0,60.3L29.2,66.2L29.7,72.0L26.2,74.7L22.9,73.8L16.1,75.0L15.1,77.7L8.4,77.7L3.4,83.2L3.1,91.4L-8.5,95.4L-14.8,94.6L-16.6,96.7L-21.9,95.5L-30.9,96.9L-45.9,92.0L-37.8,83.2L-38.5,77.0L-45.3,75.4L-46.0,69.2L-48.9,61.5L-45.1,56.2L-49.0,54.8Z",
  BGD: "M238.9,167.2L238.7,174.1L235.6,172.7L236.1,180.4L233.6,175.4L233.1,170.5L231.4,165.8L227.6,160.2L219.4,159.8L220.2,163.8L217.4,169.2L213.6,167.2L212.3,169.0L206.3,167.0L204.9,159.1L201.8,151.8L203.3,146.0L197.8,143.4L199.8,139.9L205.4,136.3L198.9,131.2L202.1,124.6L209.2,128.8L213.4,129.3L214.2,136.0L222.7,137.3L231.0,137.2L236.2,138.8L232.1,147.0L228.1,147.6L225.3,153.1L230.2,158.1L231.7,151.9L234.1,151.9Z",
  BTN: "M230.1,111.8L233.8,114.9L233.1,120.9L225.8,121.1L218.3,120.5L212.6,122.0L204.5,118.3L204.3,116.4L210.2,109.2L215.1,106.8L221.5,109.0L226.2,109.2Z",
  MMR: "M300.4,185.1L295.2,189.3L288.8,189.7L284.8,200.2L281.0,201.9L285.3,210.4L291.0,217.4L294.7,223.8L291.4,232.2L288.3,234.0L290.4,238.8L296.4,246.5L297.4,251.9L297.3,256.4L300.8,265.2L295.9,274.2L291.5,284.1L290.7,277.0L293.4,269.6L290.4,263.9L291.1,253.3L287.5,248.3L284.6,236.8L283.0,224.6L279.1,216.6L273.2,221.4L263.0,228.3L258.0,227.4L252.4,225.2L255.5,213.2L253.7,204.2L246.6,193.0L247.7,189.5L242.5,188.3L236.1,180.4L235.6,172.7L238.7,174.1L238.9,167.2L243.3,164.9L242.3,160.8L244.4,157.5L244.7,147.5L251.7,149.7L255.7,141.7L256.1,137.0L261.1,128.9L260.8,123.4L272.4,116.7L278.8,118.5L278.1,112.5L281.2,110.8L280.5,107.1L285.8,106.4L288.8,112.1L292.7,114.4L292.6,129.7L284.1,137.8L283.0,149.3L292.5,147.7L294.6,156.5L300.3,158.4L297.7,166.4L308.2,171.8L314.8,169.0L315.0,173.0L307.4,179.3L305.5,182.9Z",
  LKA: "M141.4,307.4L140.0,317.5L136.3,320.2L128.5,322.4L124.2,314.7L122.6,300.9L126.7,285.2L132.9,290.6L137.1,297.4Z",
  nepalCenter: [166.2, 107.6],
  mumbai: [61.6, 195.8],
  delhi: [100.4, 103.7],
  kolkata: [200.3, 162.1],
};
const SA_W = 300, SA_H = 340;
const NEIGHBOURS = ["CHN", "PAK", "AFG", "BGD", "BTN", "MMR", "LKA"];
const NEPAL_BOX = "120 80 86 52"; // Nepal outline crop, same coordinates as SA.NPL

// Illustrative daily monsoon rain bars (not measurements); the spike marks 26–28 Sep 2024.
const MONSOON = Array.from({ length: 26 }, (_, i) =>
  Math.round(Math.min(1, 0.22 + hash(i + 40) * 0.42 + (i >= 22 && i <= 24 ? 0.5 : 0)) * 100) / 100
);

/* ------------------------------------------------------------------ */
/* Nepal map (open data: mesaugat/geoJSON-Nepal districts)            */
/* ------------------------------------------------------------------ */
const NEPAL_URL = "https://cdn.jsdelivr.net/gh/mesaugat/geoJSON-Nepal@master/nepal-districts.geojson";
const NW = 900, NH = 470;
const NEPAL_COLORS = ["#0f3644", "#14516a", "#1d7792", "#2fa3b8", "#7fcfb0", "#e2b04f", "#e07a3a"];
const VALLEY = ["KATHMANDU", "LALITPUR", "BHAKTAPUR"];

const CITIES = [
  {
    key: "kathmandu", name: "Kathmandu", tag: "PILOT · CODE DEFAULT", coords: [85.324, 27.7172],
    points: [
      "Documented flood: 26–28 Sep 2024, Bagmati above danger level",
      "River runs through the city — strong test for routing",
      "Valley terrain, so elevation and basin factors work",
      "Replay event and demo ward are set here",
    ],
  },
  {
    key: "pokhara", name: "Pokhara", tag: "CANDIDATE", coords: [83.9856, 28.2096],
    points: [
      "Supported in code with CITY=pokhara",
      "Team to check OSM coverage of roads and hospitals",
      "Team to collect documented flood history with sources",
    ],
  },
  {
    key: "biratnagar", name: "Biratnagar", tag: "CANDIDATE · TERAI", coords: [87.2718, 26.4525],
    points: [
      "Flat Terai city",
      "Small elevation differences, so elevation-based factors will be weak",
      "Set with CENTER=\"lat,lon\"",
    ],
  },
];

function makeProjection(features) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const each = (g, fn) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).forEach((p) => p.forEach((ring) => ring.forEach(fn)));
  features.forEach((f) => each(f.geometry, ([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }));
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const pad = 24;
  const s = Math.min((NW - pad * 2) / ((maxX - minX) * k), (NH - pad * 2) / (maxY - minY));
  const ox = (NW - (maxX - minX) * k * s) / 2, oy = (NH - (maxY - minY) * s) / 2;
  return ([x, y]) => [ox + (x - minX) * k * s, oy + (maxY - y) * s];
}

function toPath(geom, proj) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polys.map((poly) => poly.map((ring) => {
    const step = ring.length > 400 ? 3 : ring.length > 150 ? 2 : 1;
    const pts = ring.filter((_, i) => i % step === 0);
    return "M" + pts.map((p) => proj(p).map((v) => v.toFixed(1)).join(",")).join("L") + "Z";
  }).join("")).join("");
}

// Illustrative shading: lower (Terai / valley) districts shaded higher. Not measured data.
function districtShade(f, i) {
  const ring = (f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates[0])[0];
  const [lon, lat] = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
  const south = 28.7 - ((lon - 80.1) / 8) * 2.3, north = 30.4 - ((lon - 80.5) / 7.6) * 2.5;
  const t = Math.max(0, Math.min(1, (lat - south) / (north - south)));
  let r = Math.pow(1 - t, 1.4) * 0.85 + (hash(i) - 0.5) * 0.22;
  if (VALLEY.includes(String(f.properties.DISTRICT).toUpperCase())) r = 0.93;
  r = Math.max(0, Math.min(0.999, r));
  return { color: NEPAL_COLORS[Math.floor(r * NEPAL_COLORS.length)], level: r };
}

const terrainOf = (level) => (level > 0.7 ? "Lower, flood-prone terrain" : level > 0.4 ? "Mid hills" : "High hills & mountains");

const BAGMATI = [[85.43, 27.8], [85.33, 27.69], [85.28, 27.56], [85.37, 27.32], [85.52, 27.08], [85.6, 26.86]];

// One shared download for every Nepal map on the page (phone + big map).
let nepalCache = null;
let nepalPromise = null;
function useNepalGeo() {
  const [geo, setGeo] = useState(nepalCache);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (nepalCache) return;
    let alive = true;
    if (!nepalPromise) {
      nepalPromise = fetch(NEPAL_URL)
        .then((r) => r.json())
        .then((data) => {
          const proj = makeProjection(data.features);
          const districts = data.features.map((f, i) => ({
            name: String(f.properties.DISTRICT || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
            d: toPath(f.geometry, proj),
            ...districtShade(f, i),
          }));
          nepalCache = { proj, districts };
          return nepalCache;
        });
    }
    nepalPromise
      .then((g) => alive && setGeo(g))
      .catch(() => { nepalPromise = null; if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  return { geo, failed };
}

/* ------------------------------------------------------------------ */
/* Features and their status (alignment report, Section 4)            */
/* ------------------------------------------------------------------ */
const FEATURES = [
  { icon: "🛣️", title: "Road-level risk scoring", desc: "Every OpenStreetMap road segment gets a 0–1 flood-risk score.", status: "done" },
  { icon: "🗺️", title: "Interactive risk map", desc: "Roads coloured by class. Click any road to see why it scored that way.", status: "done" },
  { icon: "🎨", title: "Five risk classes", desc: "Very low to very high. Grey means no data — counted as moderate, never safe.", status: "done" },
  { icon: "🚧", title: "Close & reopen roads", desc: "Click a road to close it, click again to reopen it.", status: "done" },
  { icon: "🔁", title: "Automatic reroute", desc: "Routes recalculate the moment a road is closed or rain changes.", status: "done" },
  { icon: "🧭", title: "Risk-aware route planner", desc: "Pick start and destination. Cost = travel time + λ × risk.", status: "done" },
  { icon: "📏", title: "Route metrics", desc: "Distance, time and average risk for every suggested route.", status: "done" },
  { icon: "🟢", title: "Confidence & reasons", desc: "Green, amber or red confidence with a plain-language “why”.", status: "done" },
  { icon: "🔀", title: "Plan · Alert · Respond", desc: "Three modes for before, during and after the rain.", status: "done" },
  { icon: "🌧️", title: "Rainfall slider", desc: "Dry, moderate, heavy and extreme presets for any scenario.", status: "done" },
  { icon: "📍", title: "Chokepoint report", desc: "Ranked risky roads for the municipality, with CSV download.", status: "done" },
  { icon: "📡", title: "Live rainfall feed", desc: "Open-Meteo rainfall, refreshed on demand.", status: "starter" },
  { icon: "🌍", title: "Real road network", desc: "Kathmandu roads loaded with OSMnx.", status: "starter" },
  { icon: "⏪", title: "Storm replay", desc: "Replay of the Kathmandu flood, Sep 2024 (ERA5 reanalysis, not live).", status: "starter" },
  { icon: "🏠", title: "Shelter database", desc: "shelters.csv plus OSM, routing to the nearest shelter. Nepal data being collected.", status: "starter" },
  { icon: "🚑", title: "Ambulance mode", desc: "Hospital and shelter routing with signal-priority junctions.", status: "starter" },
  { icon: "⛰️", title: "Elevation & drainage model", desc: "Elevation, basin depth and creek distance done. Flow accumulation and HAND next.", status: "partial" },
  { icon: "🎯", title: "Back-test on real hotspots", desc: "Check scores against 10–15 sourced Kathmandu flood points.", status: "todo" },
  { icon: "🏛️", title: "Real deployment", desc: "Pilot with a ward office: login, audit log, hosted database, SMS. Not deployed yet.", status: "roadmap" },
];

const STATUS = { done: "Done", starter: "Starter", partial: "Partial", todo: "To do", roadmap: "Roadmap" };
const STATUS_ORDER = ["done", "partial", "starter", "todo", "roadmap"];
const STATUS_COLOR = { done: "#7fcfb0", partial: "#e2b04f", starter: "#9fded6", todo: "#f2a14a", roadmap: "#7d8a8f" };
// How far along each status is, on a 4-step track: planned → started → partial → done
const STAGE = { roadmap: 1, todo: 1, starter: 2, partial: 3, done: 4 };
const STAGE_NAMES = ["Planned", "Started", "Partial", "Done"];
const COUNTS = FEATURES.reduce((a, f) => ({ ...a, [f.status]: (a[f.status] || 0) + 1 }), {});

const ENGINE = [
  {
    tag: "RISK ENGINE", title: "Susceptibility × rain",
    code: "risk = S × (0.12 + 0.88·L)\nL = 0.65·rain/40\n  + 0.35·rain24h/150\nL capped at 1",
    desc: "S mixes low elevation, basin depth, creek distance and built-up density. The scaling is a prototype assumption to validate.",
  },
  {
    tag: "ROUTING", title: "Dijkstra with closures",
    code: "cost = time + λ·risk\nclosed road → removed\nrobust = worst of\nrain −20% · 0 · +30%",
    desc: "NetworkX Dijkstra on the real road graph. Vehicle limits use risk classes (placeholders), never invented flood depths.",
  },
  {
    tag: "ALERT RULE", title: "Likely to flood soon",
    code: "now      < High\n+30 min  ≥ High\n(same rain rate)\n→ flag the road",
    desc: "Gives drivers and ambulance teams a 30-minute early-warning window.",
  },
  {
    tag: "CONFIDENCE", title: "Green · Amber · Red",
    code: "max road risk\n+ average risk\n+ no-data share\n+ robust? live rain?",
    desc: "Every route says how sure it is and why — decision support, not a safety guarantee.",
  },
];

const SOURCES = [
  { need: "Roads, hospitals, schools, shelters", src: "OpenStreetMap via OSMnx", note: "Check ward coverage first" },
  { need: "Terrain", src: "Open-Meteo elevation (Copernicus, ~90 m) or SRTM", note: "Coarse — we say so" },
  { need: "Rainfall, live & past", src: "Open-Meteo forecast & archive (ERA5)", note: "ERA5 smooths extremes" },
  { need: "Shelters", src: "shelters.csv · municipal, NDRRMA / BIPAD, OSM", note: "Source and date recorded" },
  { need: "Flood hotspots", src: "News, municipal & NDRRMA reports, Sentinel-1", note: "For the back-test" },
];

/* ------------------------------------------------------------------ */
/* Small hooks                                                         */
/* ------------------------------------------------------------------ */
function useClock() {
  const [clock, setClock] = useState(null);
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, []);
  return clock;
}

// true once the element has scrolled into view (used to start graph animations)
function useInView(threshold = 0.3) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen];
}

function useCountUp(target, run, ms = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf, t0;
    const step = (t) => {
      if (t0 == null) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

/* ------------------------------------------------------------------ */
/* Phone frame shared by both screens                                  */
/* ------------------------------------------------------------------ */
function PhoneShell({ children, className = "" }) {
  const clock = useClock();
  return (
    <div className={`fx-phone ${className}`}>
      <div className="fx-island" />
      <div className="fx-screen">
        <div className="fx-status"><span>{clock ?? "--:--"}</span><span>▮▮▮ ᯤ ▭</span></div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone 1 — India map, tap Nepal                                      */
/* ------------------------------------------------------------------ */
function PhoneIndia({ stage, run, onTap, onReplay }) {
  const [nx, ny] = SA.nepalCenter;
  const zoomed = stage !== "idle";
  const zoomStyle = zoomed
    ? { transformOrigin: `${nx}px ${ny}px`, transform: `translate(${150 - nx}px, ${150 - ny}px) scale(3.1)` }
    : { transformOrigin: `${nx}px ${ny}px` };

  return (
    <PhoneShell className="fx-phone-1">
      <div className="fx-appbar">
        <span className="fx-applogo">≈</span>
        <div className="fx-search">⌕ <span key={zoomed ? "n" : "i"} className="fx-swap">{zoomed ? "Nepal" : "India · South Asia"}</span></div>
        <span className="fx-screen-no">1/2</span>
      </div>

      <div className="fx-i-head">
        <span>Monsoon flood watch</span>
        <span className="fx-muted">{stage === "idle" ? "Tap a country" : stage === "zoom" ? "Zooming in…" : "Nepal selected"}</span>
      </div>

      <div className="fx-i-map">
        <svg viewBox={`0 0 ${SA_W} ${SA_H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="fxIndiaFill" cx="45%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#1d7792" />
              <stop offset="100%" stopColor="#123e4c" />
            </radialGradient>
            <linearGradient id="fxNepalFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ef5b5b" />
              <stop offset="100%" stopColor="#e07a3a" />
            </linearGradient>
          </defs>

          <g className={`fx-i-world ${zoomed ? "zoom" : ""}`} style={zoomStyle}>
            {NEIGHBOURS.map((k) => <path key={k} d={SA[k]} className="fx-i-nb" />)}
            <path d={SA.india} className="fx-i-india" />
            <text x="112" y="200" className="fx-i-label">INDIA</text>
            {[["Delhi", SA.delhi, 1], ["Mumbai", SA.mumbai, -1], ["Kolkata", SA.kolkata, 1]].map(([name, [x, y], side]) => (
              <g key={name} className="fx-i-city">
                <circle cx={x} cy={y} r="2.2" />
                <text x={x + side * 5} y={y + 3} className={side < 0 ? "left" : ""}>{name}</text>
              </g>
            ))}
            <g className="fx-i-nepal" onClick={onTap} role="button" aria-label="Open Nepal">
              <path d={SA.NPL} className="fx-i-nepal-glow" />
              <path d={SA.NPL} className="fx-i-nepal-shape" />
              <circle cx={nx} cy={ny} r="5" className="fx-i-nepal-ping" />
              <rect x="120" y="80" width="86" height="52" className="fx-i-hit" />
            </g>
            <text x={nx} y={ny - 14} className="fx-i-nepal-label">NEPAL</text>
          </g>

          {/* monsoon rain streaks */}
          <g className="fx-streaks">
            {Array.from({ length: 22 }, (_, i) => {
              const x = 20 + hash(i + 3) * 260, y = hash(i + 9) * 200;
              return <line key={i} x1={x} y1={y} x2={x - 4} y2={y + 12} style={{ animationDelay: `${(hash(i + 17) * 1.6).toFixed(2)}s` }} />;
            })}
          </g>

          {/* "Tap Nepal" hint + animated finger */}
          {stage === "idle" && (
            <g key={run}>
              <g className="fx-hint" transform={`translate(${nx + 36}, ${ny - 46})`}>
                <rect x="-34" y="-11" width="68" height="20" rx="10" />
                <text y="3">Tap Nepal</text>
              </g>
              <g className="fx-finger" style={{ "--tx": `${nx}px`, "--ty": `${ny}px` }}>
                <circle r="9" className="fx-finger-ripple" />
                <circle r="9" className="fx-finger-ripple r2" />
                <circle r="5" className="fx-finger-touch" />
                <text x="-7" y="24" className="fx-finger-hand">👆</text>
              </g>
            </g>
          )}
        </svg>

        {stage === "zoom" && (
          <div className="fx-i-opening">
            <span>Opening Nepal</span>
            <div className="fx-i-progress"><i /></div>
          </div>
        )}
        {stage === "open" && (
          <div className="fx-i-done">✓ Nepal opened on screen 2 <b>→</b></div>
        )}
      </div>

      <div className="fx-i-card">
        <div className="fx-i-card-head">
          <strong>Nepal · monsoon rain</strong>
          <span className="fx-muted">illustrative</span>
        </div>
        <div className="fx-mbars" key={run}>
          {MONSOON.map((v, i) => (
            <i key={i} className={i >= 22 && i <= 24 ? "spike" : ""} style={{ height: `${v * 100}%`, animationDelay: `${i * 35}ms` }} />
          ))}
          <span className="fx-mbars-tag">26–28 Sep 2024</span>
        </div>
        <div className="fx-i-stats">
          <div><b>77</b><span>districts</span></div>
          <div><b>{CITIES.length}</b><span>cities</span></div>
          <div><b>{FEATURES.length}</b><span>features</span></div>
        </div>
        {stage === "open" ? (
          <button className="fx-i-btn ghost" onClick={onReplay}>↻ Replay the tap</button>
        ) : (
          <button className="fx-i-btn" onClick={onTap} disabled={stage !== "idle"}>
            {stage === "idle" ? "👆 Tap Nepal to open" : "Opening…"}
          </button>
        )}
      </div>
    </PhoneShell>
  );
}

/* ------------------------------------------------------------------ */
/* Phone 2 — Nepal map, all features and where they stand             */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: "status", label: "Status" },
  { key: "features", label: "Features" },
  { key: "risk", label: "Risk graph" },
];

function PhoneNepal({ stage, onBack }) {
  const open = stage === "open";
  const { geo, failed } = useNepalGeo();
  const [preset, setPreset] = useState("heavy");
  const [tab, setTab] = useState("status");
  const [auto, setAuto] = useState(true);
  const [pick, setPick] = useState(null); // { type: "city" | "district", ... }

  const rain = RAIN.find((r) => r.key === preset);
  const loading = loadingOf(rain.intensity, rain.rain24);
  const districts = useMemo(
    () => (geo ? geo.districts.map((d) => ({ ...d, risk: riskOf(d.level, loading) })) : []),
    [geo, loading]
  );
  const atRisk = districts.filter((d) => classOf(d.risk) >= 3).length;

  // Reset every time the screen re-opens
  useEffect(() => {
    if (!open) { setTab("status"); setAuto(true); setPick(null); setPreset("heavy"); }
  }, [open]);

  // Auto-play: rotate sheet tabs and rain until the visitor touches the phone
  useEffect(() => {
    if (!open || !auto) return;
    const t1 = setInterval(() => setTab((x) => TABS[(TABS.findIndex((t) => t.key === x) + 1) % TABS.length].key), 4800);
    const t2 = setInterval(() => setPreset((x) => RAIN[(RAIN.findIndex((r) => r.key === x) + 1) % RAIN.length].key), 2400);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [open, auto]);

  const stop = () => auto && setAuto(false);

  return (
    <PhoneShell className={`fx-phone-2 ${open ? "is-open" : ""}`}>
      <div className="fx-appbar">
        <button className="fx-backbtn" onClick={onBack} disabled={!open} aria-label="Back to India">‹</button>
        <div className="fx-search">⌕ <span>{open ? "Nepal · Kathmandu pilot" : "Waiting…"}</span></div>
        <span className="fx-screen-no">2/2</span>
      </div>

      {!open ? (
        <div className={`fx-wait ${stage === "zoom" ? "incoming" : ""}`}>
          <svg viewBox={NEPAL_BOX} className="fx-wait-nepal"><path d={SA.NPL} /></svg>
          <strong>{stage === "zoom" ? "Opening Nepal…" : "Tap Nepal on screen 1"}</strong>
          <p>The Nepal map, every feature and its status open here.</p>
          <div className="fx-skel"><i /><i /><i /></div>
        </div>
      ) : (
        <div className="fx-n2" onPointerDown={stop}>
          {/* Map */}
          <div className="fx-n2-map">
            <div className="fx-n2-head">
              <span>{geo ? <><b>{atRisk}</b> of {districts.length} mapped districts high risk</> : failed ? "Map needs internet" : "Loading Nepal…"}</span>
              <span className="fx-muted">{rain.intensity} mm/h</span>
            </div>
            <div className="fx-n2-legend">{CLASSES.map((c) => <span key={c.name} style={{ background: c.color }} />)}</div>

            <svg viewBox={`0 0 ${NW} ${NH}`} className="fx-n2-svg">
              {geo ? (
                <g className="fx-reveal">
                  <g className="fx-districts">
                    {districts.map((d, i) => (
                      <path key={d.name} d={d.d} fill={colorOf(d.risk)} style={{ animationDelay: `${(i % 40) * 18}ms` }}
                        className={`fx-pdistrict ${pick?.type === "district" && pick.name === d.name ? "on" : ""}`}
                        onClick={() => setPick({ type: "district", ...d })} />
                    ))}
                  </g>
                  <path className="fx-pbagmati" d={"M" + BAGMATI.map((p) => geo.proj(p).join(",")).join(" L")} />
                  {CITIES.map((c) => {
                    const [px, py] = geo.proj(c.coords);
                    const on = pick?.type === "city" ? pick.key === c.key : c.key === "kathmandu";
                    const left = c.key === "biratnagar";
                    return (
                      <g key={c.key} className={`fx-ppin ${on ? "on" : ""}`} onClick={() => setPick({ type: "city", ...c })}>
                        {on && <circle cx={px} cy={py} r="30" className="fx-pin-pulse" />}
                        <circle cx={px} cy={py} r="40" className="fx-ppin-hit" />
                        <circle cx={px} cy={py} r="14" className="fx-ppin-dot" />
                        <text x={left ? px - 26 : px + 26} y={py - 20} className={`fx-ppin-label ${left ? "left" : ""}`}>{c.name}</text>
                      </g>
                    );
                  })}
                </g>
              ) : (
                <text x={NW / 2} y={NH / 2} className="fx-pnepal-loading">{failed ? "Map needs internet to load" : "Loading Nepal map…"}</text>
              )}
            </svg>

            {pick && (
              <div className="fx-n2-pop" onClick={() => setPick(null)}>
                {pick.type === "city" ? (
                  <>
                    <div className="fx-n2-pop-row"><strong>{pick.name}</strong><span>{pick.tag}</span></div>
                    <p>{pick.points[0]}</p>
                  </>
                ) : (
                  <>
                    <div className="fx-n2-pop-row"><strong>{pick.name}</strong><b style={{ color: colorOf(pick.risk) }}>{nameOf(pick.risk)}</b></div>
                    <p>{terrainOf(pick.level)} · rain loading {Math.round(loading * 100)}%</p>
                  </>
                )}
              </div>
            )}

            <div className="fx-n2-rain">
              {RAIN.map((p) => (
                <button key={p.key} className={preset === p.key ? "active" : ""} onClick={() => { setAuto(false); setPreset(p.key); }}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Bottom sheet */}
          <div className="fx-sheet">
            <div className="fx-grab" />
            <div className="fx-tabs">
              {TABS.map((t) => (
                <button key={t.key} className={`fx-tab ${tab === t.key ? "active" : ""}`} onClick={() => { setAuto(false); setTab(t.key); }}>
                  {t.label}
                  {auto && tab === t.key && <i className="fx-tab-timer" />}
                </button>
              ))}
            </div>
            <div className="fx-sheet-body" key={tab}>
              {tab === "status" && <StatusPanel />}
              {tab === "features" && <FeatureList />}
              {tab === "risk" && <RiskGraph districts={districts} preset={preset} loaded={!!geo} />}
            </div>
          </div>
        </div>
      )}
    </PhoneShell>
  );
}

/* Donut of feature status + bars */
function StatusDonut({ size = 108, stroke = 13, run = true }) {
  const R = (size - stroke) / 2, C = 2 * Math.PI * R, c = size / 2;
  const total = FEATURES.length;
  const done = useCountUp(COUNTS.done || 0, run);
  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={`fx-donut ${run ? "run" : ""}`} width={size} height={size}>
      <circle cx={c} cy={c} r={R} className="fx-donut-track" strokeWidth={stroke} />
      {STATUS_ORDER.map((k, i) => {
        const len = ((COUNTS[k] || 0) / total) * C;
        const off = acc; acc += len;
        if (!len) return null;
        return (
          <circle key={k} cx={c} cy={c} r={R} fill="none" stroke={STATUS_COLOR[k]} strokeWidth={stroke}
            strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off}
            transform={`rotate(-90 ${c} ${c})`} className="fx-donut-seg"
            style={{ "--c": C, animationDelay: `${i * 0.18}s` }} />
        );
      })}
      <text x={c} y={c + 2} className="fx-donut-num">{done}/{total}</text>
      <text x={c} y={c + 17} className="fx-donut-sub">done</text>
    </svg>
  );
}

function StatusPanel() {
  const total = FEATURES.length;
  return (
    <div className="fx-status-panel">
      <StatusDonut />
      <div className="fx-sbars">
        {STATUS_ORDER.map((k, i) => (
          <div key={k} className="fx-sbar">
            <span>{STATUS[k]}</span>
            <div><i style={{ width: `${((COUNTS[k] || 0) / total) * 100}%`, background: STATUS_COLOR[k], animationDelay: `${i * 0.12}s` }} /></div>
            <b>{COUNTS[k] || 0}</b>
          </div>
        ))}
      </div>
      <p className="fx-status-note">Kathmandu pilot · 3 cities mapped · decision support, not a safety guarantee</p>
    </div>
  );
}

function StageTrack({ status, delay = 0 }) {
  const n = STAGE[status];
  return (
    <span className="fx-track" title={`Stage: ${STAGE_NAMES[n - 1]}`}>
      {STAGE_NAMES.map((s, i) => (
        <i key={s} className={i < n ? "on" : ""} style={i < n ? { background: STATUS_COLOR[status], animationDelay: `${delay + i * 90}ms` } : undefined} />
      ))}
    </span>
  );
}

function FeatureList() {
  return (
    <div className="fx-flist">
      {FEATURES.map((f, i) => (
        <div className="fx-frow" key={f.title} style={{ animationDelay: `${i * 45}ms` }}>
          <span className="fx-frow-icon">{f.icon}</span>
          <div className="fx-frow-main">
            <b>{f.title}</b>
            <StageTrack status={f.status} delay={i * 45} />
          </div>
          <span className={`fx-badge fx-badge-xs fx-badge-${f.status}`}>{STATUS[f.status]}</span>
        </div>
      ))}
    </div>
  );
}

function RiskGraph({ districts, preset, loaded }) {
  if (!loaded) return <p className="fx-muted fx-graph-empty">Loading districts…</p>;
  const counts = CLASSES.map((_, i) => districts.filter((d) => classOf(d.risk) === i).length);
  const max = Math.max(1, ...counts);
  const series = RAIN.map((p) => {
    const L = loadingOf(p.intensity, p.rain24);
    return districts.filter((d) => classOf(riskOf(d.level, L)) >= 3).length;
  });
  const smax = Math.max(1, ...series);
  const W = 260, H = 54;
  const pts = series.map((v, i) => [14 + (i * (W - 28)) / (series.length - 1), H - 8 - (v / smax) * (H - 18)]);
  const cur = RAIN.findIndex((r) => r.key === preset);
  return (
    <div className="fx-riskgraph">
      <span className="fx-graph-title">Districts per risk class</span>
      <div className="fx-cbars">
        {counts.map((v, i) => (
          <div key={i} className="fx-cbar">
            <b>{v}</b>
            <div><i style={{ height: `${(v / max) * 100}%`, background: CLASSES[i].color }} /></div>
            <span>{CLASSES[i].short}</span>
          </div>
        ))}
      </div>
      <span className="fx-graph-title">High-risk districts as rain grows</span>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="fx-spark">
        <polyline points={pts.map((p) => p.join(",")).join(" ")} className="fx-spark-line" />
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={i === cur ? 5 : 3} className={`fx-spark-dot ${i === cur ? "on" : ""}`} />
            <text x={x} y={y - 8} className="fx-spark-val">{series[i]}</text>
            <text x={x} y={H + 12} className="fx-spark-lbl">{RAIN[i].label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* Link between the phones */
function Connector({ stage }) {
  const d = "M6 30 C 40 4, 80 56, 114 30";
  return (
    <div className={`fx-link fx-link-${stage}`} aria-hidden="true">
      <svg viewBox="0 0 120 60">
        <path d={d} className="fx-link-path" />
        <path d="M106 22 L116 30 L106 38" className="fx-link-head" />
        {stage !== "idle" && (
          <circle r="5" className="fx-link-dot">
            <animateMotion dur="1.1s" repeatCount="indefinite" path={d} />
          </circle>
        )}
      </svg>
      <span>{stage === "idle" ? "tap Nepal" : stage === "zoom" ? "opening…" : "Nepal open"}</span>
    </div>
  );
}

/* Both phones + the demo timeline */
function PhoneDemo() {
  const [stage, setStage] = useState("idle"); // idle → zoom → open
  const [run, setRun] = useState(0);
  const timer = useRef(null);

  const tap = useCallback(() => {
    setStage((s) => {
      if (s !== "idle") return s;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setStage("open"), 1150);
      return "zoom";
    });
  }, []);

  // The finger reaches Nepal after ~3 s and taps by itself
  useEffect(() => {
    if (stage !== "idle") return;
    const t = setTimeout(tap, 3300);
    return () => clearTimeout(t);
  }, [stage, run, tap]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const replay = () => { clearTimeout(timer.current); setStage("idle"); setRun((r) => r + 1); };

  return (
    <section className="fx-stage" aria-label="Interactive phone demo">
      <div className="fx-stage-col">
        <span className="fx-step"><b>01</b> India map · tap Nepal</span>
        <div className="fx-phone-wrap">
          <div className="fx-phone-glow" />
          <span className="fx-float fx-float-a"><span className="fx-dot fx-dot-live" />Monsoon watch</span>
          <PhoneIndia stage={stage} run={run} onTap={tap} onReplay={replay} />
        </div>
      </div>

      <Connector stage={stage} />

      <div className="fx-stage-col">
        <span className="fx-step"><b>02</b> Nepal · all features & status</span>
        <div className="fx-phone-wrap">
          <div className={`fx-phone-glow ${stage === "open" ? "hot" : ""}`} />
          <span className="fx-float fx-float-b">{stage === "open" ? `${COUNTS.done} of ${FEATURES.length} features done` : "Waiting for a tap"}</span>
          <PhoneNepal stage={stage} onBack={replay} />
        </div>
      </div>
      <p className="fx-phone-note">Interactive demo · tap Nepal, change the rain, open the tabs · illustrative shading, not live data</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Big Nepal map section                                               */
/* ------------------------------------------------------------------ */
function NepalMap({ active, onPick }) {
  const { geo, failed } = useNepalGeo();
  const [hover, setHover] = useState(null);

  return (
    <div className="fx-nepal-map">
      <div className="fx-map-label">Nepal · {geo ? geo.districts.length : 77} districts<br /><small>○ Illustrative shading</small></div>
      {hover && <div className="fx-hover"><strong>{hover.name}</strong><span>{terrainOf(hover.level)}</span></div>}
      <svg viewBox={`0 0 ${NW} ${NH}`} className="fx-nepal-svg">
        {geo && (
          <>
            <g className="fx-districts">
              {geo.districts.map((d) => (
                <path key={d.name} d={d.d} fill={d.color} className="fx-district"
                  onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)}>
                  <title>{d.name}</title>
                </path>
              ))}
            </g>
            <path className="fx-bagmati" d={"M" + BAGMATI.map((p) => geo.proj(p).join(",")).join(" L")} />
            {CITIES.map((c) => {
              const [x, y] = geo.proj(c.coords);
              const isOn = active === c.key;
              const flip = c.key === "biratnagar";
              return (
                <g key={c.key} className={`fx-pin ${isOn ? "on" : ""}`} onClick={() => onPick(c.key)}>
                  {isOn && <circle cx={x} cy={y} r="16" className="fx-pin-pulse" />}
                  <line x1={x} y1={y} x2={flip ? x - 46 : x + 46} y2={y - 30} className="fx-pin-line" />
                  <circle cx={x} cy={y} r="7" className="fx-pin-dot" />
                  <foreignObject x={flip ? x - 196 : x + 46} y={y - 56} width="150" height="50">
                    <div className={`fx-tip ${flip ? "flip" : ""}`}><strong>{c.name}</strong><span>{c.tag}</span></div>
                  </foreignObject>
                </g>
              );
            })}
          </>
        )}
        {!geo && <text x={NW / 2} y={NH / 2} className="fx-map-loading">{failed ? "Map needs internet to load" : "Loading Nepal map…"}</text>}
      </svg>
      <div className="fx-nepal-legend">
        <span className="fx-legend-title">FLOOD SUSCEPTIBILITY</span>
        <div className="fx-nepal-bar" />
        <div className="fx-legend-scale"><span>Low</span><span>High</span></div>
      </div>
    </div>
  );
}

/* Animated "where they stand" graph above the feature grid */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* LANGUAGE — English / Hindi / Nepali (same pattern as Home.js)      */
/* ------------------------------------------------------------------ */
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
// tr({ en, hi, ne }) -> text in the active language (falls back to English)
function useLang() {
  const { lang, setLang } = useContext(LangContext);
  const tr = (o) => (o == null ? "" : typeof o === "string" ? o : o[lang] ?? o.en);
  return { lang, setLang, tr };
}

// Feature names + descriptions in Hindi / Nepali (English comes from FEATURES)
const FEATURE_TR = {
  "Road-level risk scoring": { hi: ["सड़क-स्तर जोखिम स्कोर", "हर OpenStreetMap सड़क खंड को 0–1 बाढ़-जोखिम स्कोर मिलता है।"], ne: ["सडक-स्तर जोखिम स्कोर", "हरेक OpenStreetMap सडक खण्डलाई 0–1 बाढी-जोखिम स्कोर दिइन्छ।"] },
  "Interactive risk map": { hi: ["इंटरैक्टिव जोखिम मानचित्र", "सड़कें वर्ग के अनुसार रंगी हुई। किसी भी सड़क पर क्लिक करें और कारण देखें।"], ne: ["अन्तरक्रियात्मक जोखिम नक्सा", "सडकहरू वर्ग अनुसार रङ्गिएका। कुनै सडकमा क्लिक गरी कारण हेर्नुहोस्।"] },
  "Five risk classes": { hi: ["पाँच जोखिम वर्ग", "बहुत कम से बहुत अधिक। ग्रे का अर्थ डेटा नहीं — मध्यम माना जाता है, सुरक्षित नहीं।"], ne: ["पाँच जोखिम वर्ग", "धेरै कमदेखि धेरै उच्च। खैरो भनेको डेटा छैन — मध्यम मानिन्छ, सुरक्षित होइन।"] },
  "Close & reopen roads": { hi: ["सड़क बंद करें और खोलें", "बंद करने के लिए सड़क पर क्लिक करें, फिर से खोलने के लिए दोबारा क्लिक करें।"], ne: ["सडक बन्द र खोल्नुहोस्", "बन्द गर्न सडकमा क्लिक गर्नुहोस्, फेरि खोल्न पुनः क्लिक गर्नुहोस्।"] },
  "Automatic reroute": { hi: ["स्वचालित नया रास्ता", "सड़क बंद होते या बारिश बदलते ही रास्ते फिर से गणना होते हैं।"], ne: ["स्वचालित नयाँ मार्ग", "सडक बन्द हुने वा वर्षा बदलिने बित्तिकै मार्ग पुनः गणना हुन्छ।"] },
  "Risk-aware route planner": { hi: ["जोखिम-जागरूक रूट प्लानर", "शुरुआत और गंतव्य चुनें। लागत = यात्रा समय + λ × जोखिम।"], ne: ["जोखिम-सचेत मार्ग योजनाकार", "सुरु र गन्तव्य छान्नुहोस्। लागत = यात्रा समय + λ × जोखिम।"] },
  "Route metrics": { hi: ["रूट मापदंड", "हर सुझाए गए रास्ते की दूरी, समय और औसत जोखिम।"], ne: ["मार्ग मापदण्ड", "हरेक सुझाइएको मार्गको दूरी, समय र औसत जोखिम।"] },
  "Confidence & reasons": { hi: ["भरोसा और कारण", "हरा, पीला या लाल भरोसा, साथ में आसान भाषा में “क्यों”।"], ne: ["विश्वास र कारण", "हरियो, पहेँलो वा रातो विश्वास, सरल भाषामा “किन” सहित।"] },
  "Plan · Alert · Respond": { hi: ["योजना · अलर्ट · प्रतिक्रिया", "बारिश से पहले, दौरान और बाद के लिए तीन मोड।"], ne: ["योजना · सतर्कता · प्रतिक्रिया", "वर्षा अघि, बेला र पछिका लागि तीन मोड।"] },
  "Rainfall slider": { hi: ["वर्षा स्लाइडर", "किसी भी स्थिति के लिए सूखा, मध्यम, भारी और अत्यधिक प्रीसेट।"], ne: ["वर्षा स्लाइडर", "जुनसुकै अवस्थाका लागि सुख्खा, मध्यम, भारी र अत्यधिक प्रिसेट।"] },
  "Chokepoint report": { hi: ["चोकपॉइंट रिपोर्ट", "नगरपालिका के लिए जोखिम भरी सड़कों की सूची, CSV डाउनलोड के साथ।"], ne: ["चोकपोइन्ट रिपोर्ट", "नगरपालिकाका लागि जोखिमपूर्ण सडकहरूको सूची, CSV डाउनलोड सहित।"] },
  "Live rainfall feed": { hi: ["लाइव वर्षा फ़ीड", "Open-Meteo वर्षा, मांग पर अपडेट।"], ne: ["लाइभ वर्षा फिड", "Open-Meteo वर्षा, आवश्यकता अनुसार अद्यावधिक।"] },
  "Real road network": { hi: ["असली सड़क नेटवर्क", "काठमांडू की सड़कें OSMnx से लोड।"], ne: ["वास्तविक सडक सञ्जाल", "काठमाडौंका सडकहरू OSMnx बाट लोड।"] },
  "Storm replay": { hi: ["तूफ़ान रीप्ले", "काठमांडू बाढ़, सितंबर 2024 का रीप्ले (ERA5 डेटा, लाइव नहीं)।"], ne: ["आँधी रिप्ले", "काठमाडौं बाढी, सेप्टेम्बर 2024 को रिप्ले (ERA5 डेटा, लाइभ होइन)।"] },
  "Shelter database": { hi: ["आश्रय डेटाबेस", "shelters.csv और OSM, निकटतम आश्रय तक रास्ता। नेपाल डेटा जुटाया जा रहा है।"], ne: ["आश्रयस्थल डाटाबेस", "shelters.csv र OSM, नजिकको आश्रयस्थलसम्म मार्ग। नेपाल डेटा सङ्कलन हुँदैछ।"] },
  "Ambulance mode": { hi: ["एम्बुलेंस मोड", "अस्पताल और आश्रय तक रास्ता, सिग्नल-प्राथमिकता चौराहों के साथ।"], ne: ["एम्बुलेन्स मोड", "अस्पताल र आश्रयस्थलसम्म मार्ग, सिग्नल-प्राथमिकता चोकहरू सहित।"] },
  "Elevation & drainage model": { hi: ["ऊँचाई और जल-निकासी मॉडल", "ऊँचाई, बेसिन गहराई और नाले की दूरी पूरी। आगे फ्लो एक्युमुलेशन और HAND।"], ne: ["उचाइ र ढल निकास मोडेल", "उचाइ, बेसिन गहिराइ र खोलाको दूरी सम्पन्न। अब फ्लो एक्युमुलेसन र HAND।"] },
  "Back-test on real hotspots": { hi: ["असली हॉटस्पॉट पर जाँच", "10–15 स्रोत-सहित काठमांडू बाढ़ बिंदुओं पर स्कोर की जाँच।"], ne: ["वास्तविक हटस्पटमा परीक्षण", "10–15 स्रोतसहितका काठमाडौं बाढी बिन्दुमा स्कोर जाँच।"] },
  "Real deployment": { hi: ["वास्तविक तैनाती", "वार्ड कार्यालय के साथ पायलट: लॉगिन, ऑडिट लॉग, होस्टेड डेटाबेस, SMS। अभी तैनात नहीं।"], ne: ["वास्तविक प्रयोग", "वडा कार्यालयसँग पाइलट: लगइन, अडिट लग, होस्टेड डाटाबेस, SMS। अझै लागू भएको छैन।"] },
};
const fTitle = (f, lang) => (FEATURE_TR[f.title]?.[lang]?.[0] ?? f.title);
const fDesc = (f, lang) => (FEATURE_TR[f.title]?.[lang]?.[1] ?? f.desc);

const STATUS_TR = {
  done: { en: "Done", hi: "पूर्ण", ne: "सम्पन्न" },
  starter: { en: "Starter", hi: "शुरुआती", ne: "सुरुवाती" },
  partial: { en: "Partial", hi: "आंशिक", ne: "आंशिक" },
  todo: { en: "To do", hi: "बाकी", ne: "बाँकी" },
  roadmap: { en: "Roadmap", hi: "रोडमैप", ne: "रोडम्याप" },
};

const ENGINE_TR = {
  "RISK ENGINE": { tag: { hi: "जोखिम इंजन", ne: "जोखिम इन्जिन" }, title: { hi: "संवेदनशीलता × बारिश", ne: "संवेदनशीलता × वर्षा" }, desc: { hi: "S में कम ऊँचाई, बेसिन गहराई, नाले की दूरी और निर्मित घनत्व शामिल हैं। यह स्केलिंग एक प्रोटोटाइप अनुमान है जिसकी जाँच बाकी है।", ne: "S मा कम उचाइ, बेसिन गहिराइ, खोलाको दूरी र निर्मित घनत्व समावेश छन्। यो स्केलिङ जाँच गर्न बाँकी प्रोटोटाइप अनुमान हो।" } },
  "ROUTING": { tag: { hi: "रूटिंग", ne: "मार्ग निर्धारण" }, title: { hi: "बंद सड़कों के साथ Dijkstra", ne: "बन्द सडकसहित Dijkstra" }, desc: { hi: "असली सड़क ग्राफ़ पर NetworkX Dijkstra। वाहन सीमाएँ जोखिम वर्गों पर आधारित, कभी काल्पनिक बाढ़-गहराई नहीं।", ne: "वास्तविक सडक ग्राफमा NetworkX Dijkstra। सवारी सीमा जोखिम वर्गमा आधारित, कहिल्यै काल्पनिक बाढी-गहिराइ होइन।" } },
  "ALERT RULE": { tag: { hi: "अलर्ट नियम", ne: "सतर्कता नियम" }, title: { hi: "जल्द बाढ़ की संभावना", ne: "छिट्टै बाढी आउने सम्भावना" }, desc: { hi: "ड्राइवरों और एम्बुलेंस टीमों को 30 मिनट की पूर्व चेतावनी देता है।", ne: "चालक र एम्बुलेन्स टोलीलाई ३० मिनेटको पूर्वचेतावनी दिन्छ।" } },
  "CONFIDENCE": { tag: { hi: "भरोसा", ne: "विश्वास" }, title: { hi: "हरा · पीला · लाल", ne: "हरियो · पहेँलो · रातो" }, desc: { hi: "हर रास्ता बताता है कि वह कितना पक्का है और क्यों — निर्णय सहायता, सुरक्षा की गारंटी नहीं।", ne: "हरेक मार्गले कति निश्चित छ र किन भनेर बताउँछ — निर्णय सहयोग, सुरक्षाको ग्यारेन्टी होइन।" } },
};

/* ------------------------------------------------------------------ */
/* Setu logo + brand (same look as Home.js)                           */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Feature categories → clickable pie chart + explainer panel         */
/* ------------------------------------------------------------------ */
const CATEGORIES = [
  {
    key: "risk", icon: "🗺️", color: "#f07567",
    name: { en: "Risk mapping", hi: "जोखिम मानचित्रण", ne: "जोखिम नक्साङ्कन" },
    about: { en: "Scores every road for flood risk and shows it on the map.", hi: "हर सड़क का बाढ़-जोखिम आँकता है और उसे मानचित्र पर दिखाता है।", ne: "हरेक सडकको बाढी-जोखिम मापन गरी नक्सामा देखाउँछ।" },
    titles: ["Road-level risk scoring", "Interactive risk map", "Five risk classes", "Elevation & drainage model"],
  },
  {
    key: "route", icon: "🧭", color: "#f5b95a",
    name: { en: "Safe routing", hi: "सुरक्षित रूटिंग", ne: "सुरक्षित मार्ग" },
    about: { en: "Finds the safest way through and explains how sure it is.", hi: "सबसे सुरक्षित रास्ता ढूँढता है और बताता है कि वह कितना पक्का है।", ne: "सबैभन्दा सुरक्षित बाटो खोज्छ र कति निश्चित छ भनेर बताउँछ।" },
    titles: ["Close & reopen roads", "Automatic reroute", "Risk-aware route planner", "Route metrics", "Confidence & reasons"],
  },
  {
    key: "rain", icon: "🌧️", color: "#6cb4ee",
    name: { en: "Rain & live data", hi: "बारिश और लाइव डेटा", ne: "वर्षा र लाइभ डेटा" },
    about: { en: "The rainfall and road data that feed the risk model.", hi: "वह बारिश और सड़क डेटा जो जोखिम मॉडल को चलाता है।", ne: "जोखिम मोडेललाई चलाउने वर्षा र सडक डेटा।" },
    titles: ["Rainfall slider", "Live rainfall feed", "Real road network", "Storm replay"],
  },
  {
    key: "emergency", icon: "🚑", color: "#f294b8",
    name: { en: "Emergency response", hi: "आपातकालीन प्रतिक्रिया", ne: "आपतकालीन प्रतिक्रिया" },
    about: { en: "Helps people reach shelters and hospitals, and guides ambulances.", hi: "लोगों को आश्रय और अस्पताल तक पहुँचाता है और एम्बुलेंस को रास्ता दिखाता है।", ne: "मानिसलाई आश्रयस्थल र अस्पतालसम्म पुर्‍याउँछ र एम्बुलेन्सलाई मार्ग देखाउँछ।" },
    titles: ["Plan · Alert · Respond", "Shelter database", "Ambulance mode", "Chokepoint report"],
  },
  {
    key: "rollout", icon: "🚀", color: "#86dcc4",
    name: { en: "Testing & rollout", hi: "जाँच और लॉन्च", ne: "परीक्षण र सुरुवात" },
    about: { en: "Checking accuracy against real floods and taking Setu to a ward office.", hi: "असली बाढ़ों पर सटीकता की जाँच और Setu को वार्ड कार्यालय तक ले जाना।", ne: "वास्तविक बाढीमा शुद्धता जाँच र Setu लाई वडा कार्यालयसम्म पुर्‍याउने।" },
    titles: ["Back-test on real hotspots", "Real deployment"],
  },
].map((c) => ({ ...c, items: FEATURES.filter((f) => c.titles.includes(f.title)) }));

const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

function FeaturePie() {
  const { lang, tr } = useLang();
  const [ref, seen] = useInView(0.25);
  const [active, setActive] = useState("route");
  const [hover, setHover] = useState(null);
  const total = FEATURES.length;
  const W = 620, H = 440, cx = W / 2, cy = H / 2, R = 150;

  let start = -Math.PI / 2;
  const slices = CATEGORIES.map((c) => {
    const sweep = (c.items.length / total) * Math.PI * 2;
    const a0 = start, a1 = start + sweep, mid = start + sweep / 2;
    start = a1;
    return { ...c, a0, a1, mid, pct: ((c.items.length / total) * 100).toFixed(1) };
  });
  const cat = slices.find((c) => c.key === active) || slices[0];
  const doneIn = cat.items.filter((f) => f.status === "done").length;
  const nF = (n) => `${n} ${tr(n === 1 ? { en: "feature", hi: "सुविधा", ne: "सुविधा" } : { en: "features", hi: "सुविधाएँ", ne: "सुविधाहरू" })}`;

  return (
    <div ref={ref} className={`fx-pie-wrap ${seen ? "run" : ""}`}>
      <div className="fx-pie-left">
        <p className="fx-pie-title">{tr({ en: "FEATURES BY CATEGORY", hi: "श्रेणी अनुसार सुविधाएँ", ne: "श्रेणी अनुसार सुविधाहरू" })}</p>
        <svg className="fx-pie" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Features by category">
          {slices.map((s, i) => {
            const on = active === s.key, hov = hover === s.key;
            const [dx, dy] = polar(0, 0, on ? 18 : hov ? 8 : 0, s.mid);
            const [x0, y0] = polar(cx, cy, R, s.a0);
            const [x1, y1] = polar(cx, cy, R, s.a1);
            const large = s.a1 - s.a0 > Math.PI ? 1 : 0;
            const [nx, ny] = polar(cx, cy, R * 0.6, s.mid);
            const [ex, ey] = polar(cx, cy, R + 4, s.mid);
            const [kx, ky] = polar(cx, cy, R + 34, s.mid);
            const right = Math.cos(s.mid) >= 0;
            const lx = kx + (right ? 22 : -22);
            const toggle = () => setActive(s.key);
            return (
              <g
                key={s.key}
                className={`fx-slice ${on ? "on" : ""}`}
                style={{ transform: `translate(${dx}px, ${dy}px)`, animationDelay: `${i * 0.12}s`, color: s.color }}
                onClick={toggle}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`${tr(s.name)}: ${nF(s.items.length)}`}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle()}
              >
                <path d={`M${cx},${cy} L${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} Z`} fill={s.color} className="fx-slice-path" />
                <text x={nx} y={ny - 14} className="fx-slice-icon" textAnchor="middle" dominantBaseline="central">{s.icon}</text>
                <text x={nx} y={ny + 10} className="fx-slice-num" textAnchor="middle" dominantBaseline="central">{s.pct}%</text>
                <polyline className="fx-slice-arrow" points={`${ex},${ey} ${kx},${ky} ${lx},${ky}`} />
                <text x={lx + (right ? 6 : -6)} y={ky - 7} className="fx-slice-name" textAnchor={right ? "start" : "end"}>{tr(s.name)}</text>
                <text x={lx + (right ? 6 : -6)} y={ky + 10} className="fx-slice-count" textAnchor={right ? "start" : "end"}>{nF(s.items.length)}</text>
              </g>
            );
          })}
        </svg>
        <div className="fx-pie-chips">
          {slices.map((c) => (
            <button key={c.key} className={active === c.key ? "on" : ""} onClick={() => setActive(c.key)} style={{ "--c": c.color }}>
              <i /> {tr(c.name)}
            </button>
          ))}
        </div>
      </div>

      <aside className="fx-pie-info">
        <p className="fx-pie-hint">{tr({ en: "Each slice is one group of features. Click a slice to see the features inside it.", hi: "हर हिस्सा सुविधाओं का एक समूह है। अंदर की सुविधाएँ देखने के लिए किसी हिस्से पर क्लिक करें।", ne: "हरेक भाग सुविधाहरूको एउटा समूह हो। भित्रका सुविधा हेर्न कुनै भागमा क्लिक गर्नुहोस्।" })}</p>
        <div key={cat.key + lang} className="fx-pie-detail" style={{ "--c": cat.color }}>
          <div className="fx-pie-head">
            <span className="fx-pie-badge">{cat.icon}</span>
            <div>
              <h3>{tr(cat.name)}</h3>
              <span className="fx-pie-meta">
                {nF(cat.items.length)} · {cat.pct}% {tr({ en: "of all features", hi: "कुल सुविधाओं का", ne: "कुल सुविधाको" })} · {doneIn} / {cat.items.length} {tr(STATUS_TR.done)}
              </span>
            </div>
          </div>
          <p className="fx-pie-about">{tr(cat.about)}</p>
          <ul>
            {cat.items.map((f, i) => (
              <li key={f.title} style={{ animationDelay: `${i * 60}ms` }}>
                <span className="fx-pie-icon">{f.icon}</span>
                <div>
                  <b>{fTitle(f, lang)}</b>
                  <p>{fDesc(f, lang)}</p>
                </div>
                <span className={`fx-badge fx-badge-xs fx-badge-${f.status}`}>{tr(STATUS_TR[f.status])}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function FeaturesPage() {
  const { lang, setLang, tr } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [city, setCity] = useState("kathmandu");
  const activeCity = CITIES.find((c) => c.key === city);
  const closeMenu = () => setMenuOpen(false);
  // Hindi and Nepali both use Devanagari — same "lang-hi" class as Home.js
  const langClass = lang === "en" ? "" : `lang-hi lang-${lang}`;

  return (
    <div className={`features ${langClass}`} lang={lang}>
      {/* NAVBAR — same as Home page */}
      <header className="nav">
        <SetuBrand />
        <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
          <Link to="/" onClick={closeMenu}>{tr({ en: "Home", hi: "होम", ne: "होम" })}</Link>
          <Link to="/Features" className="active" onClick={closeMenu}>{tr({ en: "Features", hi: "सुविधाएँ", ne: "सुविधाहरू" })}</Link>
          <a href="#all" onClick={closeMenu}>{tr({ en: "All Features", hi: "सभी सुविधाएँ", ne: "सबै सुविधा" })}</a>
          <Link to="/About" onClick={closeMenu}>{tr({ en: "About", hi: "परिचय", ne: "बारेमा" })}</Link>
        </nav>
        <div className="nav-actions">
          <div className="lang-toggle" role="group" aria-label="Language">
            {LANGUAGES.map((l) => (
              <button key={l.code} className={lang === l.code ? "on" : ""} onClick={() => setLang(l.code)} lang={l.code}>{l.label}</button>
            ))}
          </div>
          <Link to="/dashboard" className="btn btn-primary btn-sm hide-mobile">
            {tr({ en: "Open Dashboard", hi: "डैशबोर्ड खोलें", ne: "ड्यासबोर्ड खोल्नुहोस्" })}
          </Link>
          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? "✕" : "☰"}</button>
        </div>
      </header>

      {/* HERO */}
      <section className="fx-hero" id="live">
        <div className="fx-hero-text">
          <p className="fx-eyebrow">{tr({ en: "FEATURES · KATHMANDU PILOT", hi: "सुविधाएँ · काठमांडू पायलट", ne: "सुविधाहरू · काठमाडौं पाइलट" })}</p>
          <h1>
            {tr({ en: "From India to Nepal.", hi: "भारत से नेपाल तक।", ne: "भारतदेखि नेपालसम्म।" })}<br />
            <span className="fx-accent">{tr({ en: "Every feature, mapped.", hi: "हर सुविधा, मानचित्र पर।", ne: "हरेक सुविधा, नक्सामा।" })}</span>
          </h1>
          <p className="fx-sub">
            {tr({
              en: "Setu turns rainfall and terrain into a flood-risk map, then finds the safest way through — for commuters, ambulances and people heading to a shelter. Tap Nepal on the first phone and the second one opens the Nepal map with every feature and where it stands.",
              hi: "Setu बारिश और भू-भाग को बाढ़-जोखिम मानचित्र में बदलता है, फिर सबसे सुरक्षित रास्ता ढूँढता है — यात्रियों, एम्बुलेंस और आश्रय जा रहे लोगों के लिए। पहले फ़ोन पर नेपाल टैप करें, दूसरा फ़ोन हर सुविधा के साथ नेपाल का मानचित्र खोलेगा।",
              ne: "Setu ले वर्षा र भू-भागलाई बाढी-जोखिम नक्सामा बदल्छ, अनि सबैभन्दा सुरक्षित बाटो खोज्छ — यात्रु, एम्बुलेन्स र आश्रयस्थल जाने मानिसका लागि। पहिलो फोनमा नेपाल ट्याप गर्नुहोस्, दोस्रो फोनले हरेक सुविधासहित नेपालको नक्सा खोल्छ।",
            })}
          </p>
        </div>
        <div className="fx-hero-side">
          <div className="fx-mode-list">
            <div className="fx-mode fx-mode-plan"><span>{tr({ en: "PLAN", hi: "योजना", ne: "योजना" })}</span><p>{tr({ en: "Before the monsoon — risk map and chokepoint report.", hi: "मानसून से पहले — जोखिम मानचित्र और चोकपॉइंट रिपोर्ट।", ne: "मनसुनअघि — जोखिम नक्सा र चोकपोइन्ट रिपोर्ट।" })}</p></div>
            <div className="fx-mode fx-mode-alert"><span>{tr({ en: "ALERT", hi: "अलर्ट", ne: "सतर्कता" })}</span><p>{tr({ en: "During rain — roads likely to flood within 30 min.", hi: "बारिश के दौरान — 30 मिनट में डूब सकने वाली सड़कें।", ne: "वर्षाको बेला — ३० मिनेटभित्र डुब्न सक्ने सडकहरू।" })}</p></div>
            <div className="fx-mode fx-mode-respond"><span>{tr({ en: "RESPOND", hi: "प्रतिक्रिया", ne: "प्रतिक्रिया" })}</span><p>{tr({ en: "Roads blocked — instant reroute with confidence.", hi: "सड़कें बंद — भरोसे के साथ तुरंत नया रास्ता।", ne: "सडक बन्द — विश्वाससहित तुरुन्त नयाँ मार्ग।" })}</p></div>
          </div>
          <div className="fx-cta-row">
            <Link to="/route-planner" className="fx-btn fx-btn-primary">{tr({ en: "Plan a Safe Route →", hi: "सुरक्षित रास्ता बनाएँ →", ne: "सुरक्षित मार्ग बनाउनुहोस् →" })}</Link>
            <a href="#all" className="fx-btn fx-btn-ghost">{tr({ en: "See all features", hi: "सभी सुविधाएँ देखें", ne: "सबै सुविधा हेर्नुहोस्" })}</a>
          </div>
        </div>
      </section>

      {/* TWO PHONES */}
      <PhoneDemo />

      {/* NEPAL */}
      <section className="fx-section" id="nepal">
        <p className="fx-eyebrow">{tr({ en: "PILOT REGION", hi: "पायलट क्षेत्र", ne: "पाइलट क्षेत्र" })}</p>
        <h2>{tr({ en: "Built for Nepal. Starting in Kathmandu.", hi: "नेपाल के लिए बना। शुरुआत काठमांडू से।", ne: "नेपालका लागि बनेको। सुरुवात काठमाडौंबाट।" })}</h2>
        <div className="fx-nepal">
          <NepalMap active={city} onPick={setCity} />
          <aside className="fx-city-panel">
            <div className="fx-city-tabs">
              {CITIES.map((c) => (
                <button key={c.key} className={city === c.key ? "active" : ""} onClick={() => setCity(c.key)}>{c.name}</button>
              ))}
            </div>
            <span className="fx-city-tag">{activeCity.tag}</span>
            <h3>{activeCity.name}</h3>
            <ul key={city}>{activeCity.points.map((p) => <li key={p}>{p}</li>)}</ul>
            <div className="fx-criteria">
              <span>{tr({ en: "How we choose the city", hi: "हम शहर कैसे चुनते हैं", ne: "हामी सहर कसरी छान्छौं" })}</span>
              <ol>
                <li>{tr({ en: "OpenStreetMap coverage of roads & hospitals", hi: "सड़कों और अस्पतालों का OpenStreetMap कवरेज", ne: "सडक र अस्पतालको OpenStreetMap कभरेज" })}</li>
                <li>{tr({ en: "Documented flood history", hi: "दर्ज बाढ़ इतिहास", ne: "अभिलेखित बाढी इतिहास" })}</li>
                <li>{tr({ en: "Terrain variation", hi: "भू-भाग में विविधता", ne: "भू-भागको विविधता" })}</li>
                <li>{tr({ en: "Team familiarity", hi: "टीम की जानकारी", ne: "टोलीको परिचितता" })}</li>
              </ol>
            </div>
            <p className="fx-agencies">{tr({ en: "Agencies", hi: "संस्थाएँ", ne: "निकायहरू" })}: <b>NDRRMA</b> · <b>DHM</b></p>
          </aside>
        </div>
      </section>

      {/* ALL FEATURES — pie chart + explainer */}
      <section className="fx-section" id="all">
        <p className="fx-eyebrow">{tr({ en: "WHAT IT DOES", hi: "यह क्या करता है", ne: "यसले के गर्छ" })}</p>
        <h2>{tr({ en: "All features, and where they stand.", hi: "सभी सुविधाएँ, और वे कहाँ तक पहुँचीं।", ne: "सबै सुविधा, र तिनीहरू कहाँ पुगे।" })}</h2>
        <FeaturePie />
      </section>

      {/* ENGINE */}
      <section className="fx-section" id="engine">
        <p className="fx-eyebrow">{tr({ en: "UNDER THE HOOD", hi: "अंदर की बात", ne: "भित्री कुरा" })}</p>
        <h2>{tr({ en: "Transparent maths, not a black box.", hi: "पारदर्शी गणित, कोई ब्लैक बॉक्स नहीं।", ne: "पारदर्शी गणित, ब्ल्याक बक्स होइन।" })}</h2>
        <div className="fx-engine">
          {ENGINE.map((e) => {
            const t = ENGINE_TR[e.tag] || {};
            return (
              <div className="fx-engine-card" key={e.tag}>
                <span className="fx-engine-tag">{tr({ en: e.tag, ...t.tag })}</span>
                <h3>{tr({ en: e.title, ...t.title })}</h3>
                <pre>{e.code}</pre>
                <p>{tr({ en: e.desc, ...t.desc })}</p>
              </div>
            );
          })}
        </div>
        <div className="fx-rain-sources">
          <div><span className="fx-dot fx-dot-live" /><b>{tr({ en: "Live", hi: "लाइव", ne: "लाइभ" })}</b><p>{tr({ en: "Open-Meteo feed. A dry day correctly shows 0 high-risk roads.", hi: "Open-Meteo फ़ीड। सूखे दिन सही ढंग से 0 उच्च-जोखिम सड़कें दिखती हैं।", ne: "Open-Meteo फिड। सुख्खा दिनमा सही रूपमा ० उच्च-जोखिम सडक देखिन्छ।" })}</p></div>
          <div><span className="fx-dot fx-dot-replay" /><b>{tr({ en: "Replay", hi: "रीप्ले", ne: "रिप्ले" })}</b><p>{tr({ en: "Real Kathmandu storm, Sep 2024 — reanalysis data, clearly labelled.", hi: "असली काठमांडू तूफ़ान, सितंबर 2024 — रीएनालिसिस डेटा, साफ़ लेबल के साथ।", ne: "वास्तविक काठमाडौं आँधी, सेप्टेम्बर 2024 — पुनर्विश्लेषण डेटा, स्पष्ट लेबलसहित।" })}</p></div>
          <div><span className="fx-dot fx-dot-manual" /><b>{tr({ en: "Manual", hi: "मैनुअल", ne: "म्यानुअल" })}</b><p>{tr({ en: "Slider for dry, moderate, heavy and extreme what-ifs.", hi: "सूखा, मध्यम, भारी और अत्यधिक स्थितियों के लिए स्लाइडर।", ne: "सुख्खा, मध्यम, भारी र अत्यधिक अवस्थाका लागि स्लाइडर।" })}</p></div>
        </div>
      </section>

      {/* DATA */}
      <section className="fx-section" id="data">
        <p className="fx-eyebrow">{tr({ en: "OPEN DATA ONLY", hi: "केवल खुला डेटा", ne: "खुला डेटा मात्र" })}</p>
        <h2>{tr({ en: "Free, reproducible sources.", hi: "मुफ़्त, दोहराने योग्य स्रोत।", ne: "निःशुल्क, दोहोर्‍याउन मिल्ने स्रोत।" })}</h2>
        <div className="fx-table">
          <div className="fx-tr fx-th"><span>{tr({ en: "Need", hi: "ज़रूरत", ne: "आवश्यकता" })}</span><span>{tr({ en: "Source", hi: "स्रोत", ne: "स्रोत" })}</span><span>{tr({ en: "Note", hi: "टिप्पणी", ne: "टिप्पणी" })}</span></div>
          {SOURCES.map((s) => (
            <div className="fx-tr" key={s.need}><span>{s.need}</span><span>{s.src}</span><span>{s.note}</span></div>
          ))}
        </div>
        <div className="fx-limits">
          <strong>{tr({ en: "Honest limits", hi: "ईमानदार सीमाएँ", ne: "इमानदार सीमाहरू" })}</strong>
          <p>{tr({
            en: "Decision support, not a safety guarantee. Factor weights come from a Mumbai study and are reference values until validated for Nepal. Terrain is about 90 m resolution. We make no accuracy claims until the back-test against real Kathmandu hotspots is done.",
            hi: "निर्णय सहायता, सुरक्षा की गारंटी नहीं। कारकों के भार एक मुंबई अध्ययन से हैं और नेपाल के लिए जाँच होने तक संदर्भ मान हैं। भू-भाग लगभग 90 मीटर रिज़ॉल्यूशन का है। असली काठमांडू हॉटस्पॉट पर जाँच पूरी होने तक हम सटीकता का कोई दावा नहीं करते।",
            ne: "निर्णय सहयोग, सुरक्षाको ग्यारेन्टी होइन। कारकका भार मुम्बई अध्ययनबाट लिइएका हुन् र नेपालका लागि प्रमाणित नभएसम्म सन्दर्भ मान हुन्। भू-भाग करिब ९० मिटर रिजोल्युसनको छ। वास्तविक काठमाडौं हटस्पटमा परीक्षण नसकिएसम्म हामी शुद्धताको दाबी गर्दैनौं।",
          })}</p>
        </div>
      </section>

      {/* CTA */}
      <section className="fx-cta">
        <h2>{tr({ en: "See your route before the water does.", hi: "पानी से पहले अपना रास्ता देखें।", ne: "पानीभन्दा पहिले आफ्नो बाटो हेर्नुहोस्।" })}</h2>
        <p>{tr({ en: "Open the dashboard, set the rain and close a road — Setu reroutes instantly.", hi: "डैशबोर्ड खोलें, बारिश सेट करें और एक सड़क बंद करें — Setu तुरंत नया रास्ता देता है।", ne: "ड्यासबोर्ड खोल्नुहोस्, वर्षा सेट गर्नुहोस् र एउटा सडक बन्द गर्नुहोस् — Setu ले तुरुन्त नयाँ मार्ग दिन्छ।" })}</p>
        <div className="fx-cta-row fx-center">
          <Link to="/dashboard" className="fx-btn fx-btn-primary">{tr({ en: "Open Dashboard →", hi: "डैशबोर्ड खोलें →", ne: "ड्यासबोर्ड खोल्नुहोस् →" })}</Link>
          <Link to="/" className="fx-btn fx-btn-ghost">{tr({ en: "Back to Home", hi: "होम पर वापस", ne: "होममा फर्कनुहोस्" })}</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="fx-footer">
        <svg className="fx-wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">
          <path className="fx-wave-a" d="M0 35 Q180 5 360 35 T720 35 T1080 35 T1440 35 T1800 35 T2160 35 T2520 35 T2880 35 V70 H0 Z" />
          <path className="fx-wave-b" d="M0 45 Q180 20 360 45 T720 45 T1080 45 T1440 45 T1800 45 T2160 45 T2520 45 T2880 45 V70 H0 Z" />
        </svg>
        <div className="fx-footer-inner">
          <div className="fx-footer-brand">
            <Link to="/" className="fx-nav-brand"><SetuLogo /><span className="fx-nav-name">SETU</span></Link>
            <p>{tr({ en: "Flood risk & emergency safe-route mapper. Pilot: Kathmandu, Nepal.", hi: "बाढ़ जोखिम और आपातकालीन सुरक्षित-रास्ता मैपर। पायलट: काठमांडू, नेपाल।", ne: "बाढी जोखिम र आपतकालीन सुरक्षित-मार्ग नक्साङ्कन। पाइलट: काठमाडौं, नेपाल।" })}</p>
            <span className="fx-footer-chip"><span className="fx-dot fx-dot-replay" />{tr({ en: "Prototype · not deployed yet", hi: "प्रोटोटाइप · अभी तैनात नहीं", ne: "प्रोटोटाइप · अझै लागू छैन" })}</span>
          </div>
          <div className="fx-footer-col">
            <h4>{tr({ en: "Explore", hi: "देखें", ne: "हेर्नुहोस्" })}</h4>
            <a href="#live">{tr({ en: "Phone demo", hi: "फ़ोन डेमो", ne: "फोन डेमो" })}</a>
            <a href="#nepal">{tr({ en: "Nepal pilot", hi: "नेपाल पायलट", ne: "नेपाल पाइलट" })}</a>
            <a href="#all">{tr({ en: "All features", hi: "सभी सुविधाएँ", ne: "सबै सुविधा" })}</a>
            <a href="#engine">{tr({ en: "How it works", hi: "यह कैसे काम करता है", ne: "यसले कसरी काम गर्छ" })}</a>
            <a href="#data">{tr({ en: "Data sources", hi: "डेटा स्रोत", ne: "डेटा स्रोत" })}</a>
          </div>
          <div className="fx-footer-col">
            <h4>{tr({ en: "App", hi: "ऐप", ne: "एप" })}</h4>
            <Link to="/">{tr({ en: "Home", hi: "होम", ne: "होम" })}</Link>
            <Link to="/dashboard">{tr({ en: "Dashboard", hi: "डैशबोर्ड", ne: "ड्यासबोर्ड" })}</Link>
            <Link to="/route-planner">{tr({ en: "Route planner", hi: "रूट प्लानर", ne: "मार्ग योजनाकार" })}</Link>
          </div>
          <div className="fx-footer-col">
            <h4>{tr({ en: "Open data", hi: "खुला डेटा", ne: "खुला डेटा" })}</h4>
            <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
            <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
            <a href="https://bipadportal.gov.np" target="_blank" rel="noopener noreferrer">NDRRMA · BIPAD</a>
            <a href="https://github.com/mesaugat/geoJSON-Nepal" target="_blank" rel="noopener noreferrer">geoJSON-Nepal</a>
            <a href="https://github.com/datameet/maps" target="_blank" rel="noopener noreferrer">DataMeet India maps</a>
          </div>
        </div>
        <div className="fx-footer-bottom">
          <span>© 2026 Setu · Team TheLadyBugz_5 · Katathon 6.0 · PS 103</span>
          <span className="fx-muted">{tr({ en: "Decision support, not a safety guarantee.", hi: "निर्णय सहायता, सुरक्षा की गारंटी नहीं।", ne: "निर्णय सहयोग, सुरक्षाको ग्यारेन्टी होइन।" })}</span>
          <a href="#live" className="fx-top">↑ {tr({ en: "Back to top", hi: "ऊपर जाएँ", ne: "माथि जानुहोस्" })}</a>
        </div>
      </footer>
    </div>
  );
}

export default function Features() {
  return (
    <LangProvider>
      <FeaturesPage />
    </LangProvider>
  );
}