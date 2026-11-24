import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, Popup, Tooltip, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './app.css'

const CC = ['#8bd17c', '#3ba55d', '#f2c94c', '#f2994a', '#d4001f'], CN = ['Very low', 'Low', 'Moderate', 'High', 'Very high']
const PRE = { Dry: [0, 0], Moderate: [8, 40], Heavy: [20, 110], Extreme: [40, 220] }  // mm/h, mm in 24 h
const api = (p, o) => fetch('/api' + p, o).then(r => { if (!r.ok) throw new Error(r.status + ' ' + p); return r.json() })
const post = (p, b) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })
const chip = k => <span className="chip" style={{ background: k < 0 ? '#8a8a98' : CC[k], color: k == 4 || k < 0 ? '#fff' : '#22222e' }}>{k < 0 ? 'No data' : CN[k]}</span>
const Clicks = ({ on }) => { useMapEvents({ click: e => on(e.latlng) }); return null }
// shelter status → colour; tent marker for shelters, cross for hospitals
const SC = { safe: '#3ba55d', watch: '#f2c94c', unsafe: '#d4001f', outside: '#8a8a98' }
const SN = { safe: 'Open', watch: 'Check first', unsafe: 'Flooding: avoid', outside: 'Outside mapped area' }
const tent = (st, big) => L.divIcon({ className: '', iconSize: big ? [30, 30] : [22, 22], iconAnchor: big ? [15, 26] : [11, 19],
  html: `<svg viewBox="0 0 24 24" width="${big ? 30 : 22}" height="${big ? 30 : 22}" style="opacity:${st === 'outside' ? .55 : 1}"><path d="M12 2 L23 21 H1 Z" fill="${SC[st] || SC.safe}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M12 11 L16 21 H8 Z" fill="#14111c"/></svg>` })
const cross = L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  html: '<svg viewBox="0 0 20 20" width="20" height="20"><rect x="1" y="1" width="18" height="18" rx="4" fill="#fff"/><path d="M8 4h4v4h4v4h-4v4H8v-4H4V8h4z" fill="#d4001f"/></svg>' })
const fmtCap = c => c ? `${c.toLocaleString('en-IN')} people` : 'capacity unknown'
const SAMPLE = 'name,lat,lon,capacity,flood_prone\nWard 1 relief camp,27.7165,85.3230,250,no\n'

export default function App() {
  const [mode, setMode] = useState('PLAN'), [tool, setTool] = useState('inspect'), [city, setCity] = useState(null)
  const [risk, setRisk] = useState(null), [fac, setFac] = useState([]), [rain, setRain] = useState({ I: 0, A: 0, src: 'manual', ts: '' })
  const [start, setStart] = useState(null), [dest, setDest] = useState('hospital'), [veh, setVeh] = useState('ambulance')
  const [lam, setLam] = useState(1), [rob, setRob] = useState(false), [route, setRoute] = useState(null)
  const [choke, setChoke] = useState([]), [alerts, setAlerts] = useState(null), [ver, setVer] = useState(0), [err, setErr] = useState('')
  const [fr, setFr] = useState([]), [fi, setFi] = useState(0), [play, setPlay] = useState(false)
  const [shel, setShel] = useState(null), [showOut, setShowOut] = useState(true), [showOsm, setShowOsm] = useState(false), [imp, setImp] = useState(''), [impMsg, setImpMsg] = useState('')
  const bump = () => setVer(v => v + 1), run = f => f.catch(e => setErr(String(e.message)))

  useEffect(() => { run(Promise.all([api('/city'), api('/facilities')]).then(([c, f]) => { setCity(c); setFac(f); setRain(c.rain); setStart({ lat: c.center[0], lng: c.center[1] }) })) }, [])
  useEffect(() => { if (city) run(Promise.all([api('/risk'), api('/chokepoints'), api('/alerts'), api('/facilities'), api('/shelters')]).then(([r, c, a, f, s]) => { setRisk(r); setChoke(c); setAlerts(a); setFac(f); setShel(s) })) }, [city, ver])
  useEffect(() => {  // automatic recalculation after any change (feature 12)
    if (!city || !start) return
    run(api(`/route?lat=${start.lat}&lon=${start.lng}&to=${dest}&vehicle=${veh}&lam=${lam}&robust=${rob}`).then(setRoute))
  }, [city, start, dest, veh, lam, rob, ver])
  useEffect(() => { if (!play || !fr.length) return; const t = setInterval(() => setFi(i => { const n = (i + 1) % fr.length; frame(n); return n }), 800); return () => clearInterval(t) }, [play, fr])

  const setRainTo = (I, A, src = 'manual', ts = '') => post('/rain', { I, A, src, ts }).then(r => { setRain(r); bump() })
  const frame = i => { const a = fr.slice(Math.max(0, i - 23), i + 1).reduce((s, x) => s + x.p, 0); run(setRainTo(fr[i].p, a, 'replay', fr[i].t)) }
  const live = () => run(api('/rain/live').then(r => { setRain(r); bump() }))
  const replay = () => run(api('/rain/replay').then(f => { setFr(f); setFi(0); let a = f.slice(0, 1).reduce((s, x) => s + x.p, 0); post('/rain', { I: f[0].p, A: a, src: 'replay', ts: f[0].t }).then(r => { setRain(r); bump() }) }))
  const onFeature = (f, layer) => {
    const p = f.properties
    layer.on('click', () => { if (tool === 'block') post('/block/' + p.id).then(bump) })
    if (tool === 'inspect') layer.bindPopup(`<b>${p.name}</b> ${p.label} (${p.risk ?? 'n/a'})<br>${p.tunnel ? 'Underpass or tunnel<br>' : ''}` + (p.why.map(w => `${w.label} ${w.pct}% ${w.value}`).join('<br>') || 'No terrain data: grey, treated as moderate'))
  }
  const goTo = id => { setDest(String(id)); setMode('RESPOND') }
  const doImport = text => run(post('/shelters/import', { csv: text }).then(r => { setImpMsg(`Added ${r.added} shelter${r.added === 1 ? '' : 's'}` + (r.outside_area ? `, ${r.outside_area} outside the mapped area` : '') + (r.skipped ? `, ${r.skipped} duplicate or invalid` : '') + '.'); setImp(''); bump() }).catch(e => { setImpMsg('Import failed: ' + e.message); throw e }))
  const readFile = e => { const f = e.target.files[0]; if (f) f.text().then(doImport); e.target.value = '' }
  const ShelterSummary = () => shel && <><h2>Shelters under current rain</h2>
    <div className="row">{['safe', 'watch', 'unsafe'].map(k => <span key={k} className="chip" style={{ background: SC[k], color: k === 'unsafe' ? '#fff' : '#22222e' }}>{SN[k]}: {shel.counts[k]}</span>)}<span className="m">+{shel.counts.outside} outside map</span></div>
    <p className="m">Open capacity in mapped area: <b style={{ color: '#ece8f4' }}>{shel.capacity_open.toLocaleString('en-IN')}</b> people (est. 45 m² per person, Sphere standard).</p></>
  const m = route?.found ? route.metrics : null
  if (!city) return <div className="ms">Loading city… {err}</div>
  return (
    <div className="app">
      <div className="map">
        <MapContainer center={city.center} zoom={15} style={{ height: '100%' }}>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={16} maxZoom={19} attribution="Tiles © Esri, HERE, Garmin, © OpenStreetMap contributors" />
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={16} maxZoom={19} />
          <Clicks on={ll => tool === 'start' && setStart(ll)} />
          {risk && <GeoJSON key={`${ver}-${tool}`} data={risk} onEachFeature={onFeature}
            style={f => f.properties.closed ? { color: '#fff', dashArray: '2 8', weight: 5 } : { color: f.properties.cls < 0 ? '#8a8a98' : CC[f.properties.cls], weight: f.properties.cls >= 3 ? 6 : 4, opacity: .9 }} />}
          {fac.filter(f => f.t === 'hospital' && f.in_area).map(f => <Marker key={'h' + f.id} position={[f.lat, f.lon]} icon={cross}><Tooltip>Hospital: {f.n}</Tooltip></Marker>)}
          {fac.filter(f => f.t === 'shelter' && (showOut || f.status !== 'outside') && (showOsm || f.src !== 'osm')).map(f => <Marker key={'s' + f.id + f.status} position={[f.lat, f.lon]} icon={tent(f.status, route?.destination?.id === f.id)} zIndexOffset={f.status === 'outside' ? -500 : 500}>
            <Tooltip>{f.n}</Tooltip>
            <Popup><div className="pop"><b>{f.n}</b><br /><span className="chip" style={{ background: SC[f.status], color: f.status === 'safe' || f.status === 'watch' ? '#22222e' : '#fff' }}>{SN[f.status]}</span> {f.why}<br />
              {fmtCap(f.cap)}{f.area ? ` · ${f.area.toLocaleString('en-IN')} m²` : ''}{f.flood_prone ? ' · riverbank' : ''}<br /><small>{f.municipality ? f.municipality + ' · ' : ''}Source: {f.src}</small>
              {(f.status === 'safe' || f.status === 'watch') && <div><button className="b on" style={{ marginTop: 6 }} onClick={() => goTo(f.id)}>Route here</button></div>}</div></Popup></Marker>)}
          {route?.found && <><Polyline positions={route.geometry.map(([x, y]) => [y, x])} pathOptions={{ color: '#fff', weight: 11 }} /><Polyline positions={route.geometry.map(([x, y]) => [y, x])} pathOptions={{ color: '#e0407f', weight: 6 }} />
            {route.signal_priority_junctions.map((j, i) => <CircleMarker key={i} center={j} radius={6} pathOptions={{ color: '#22222e', fillColor: '#f2c94c', fillOpacity: 1 }}><Tooltip>Signal priority</Tooltip></CircleMarker>)}</>}
          {start && <CircleMarker center={start} radius={8} pathOptions={{ color: '#fff', fillColor: '#22222e', fillOpacity: 1 }}><Tooltip>Start</Tooltip></CircleMarker>}
        </MapContainer>
        <div className="legend">
          <b>Road flood risk</b>{CN.map((n, i) => <div key={n}><i style={{ background: CC[i] }} />{n}</div>)}<div><i style={{ background: '#8a8a98' }} />No data</div>
          <b>Shelters</b>{['safe', 'watch', 'unsafe', 'outside'].map(k => <div key={k}><span dangerouslySetInnerHTML={{ __html: tent(k).options.html }} />{SN[k]}</div>)}
          <div><span dangerouslySetInnerHTML={{ __html: cross.options.html }} />Hospital</div>
          <label className="lg"><input type="checkbox" checked={showOut} onChange={e => setShowOut(e.target.checked)} /> Show valley-wide sites</label>
          <label className="lg"><input type="checkbox" checked={showOsm} onChange={e => setShowOsm(e.target.checked)} /> Show other possible sites (OSM schools)</label>
        </div>
      </div>
      <aside className="side">
        <h1>Flood<b>Safe</b> {city.city}</h1><p className="m">Katathon 6.0, PS 103. Decision support only, not a safety guarantee.</p>
        {(city.warn || err) && <div className={'ms' + (err || city.warn.startsWith('Showing DEMO') || city.warn.includes('unavailable') ? ' bad' : '')}>{city.warn} {err}</div>}
        <div className="row">{['PLAN', 'ALERT', 'RESPOND'].map(x => <button key={x} className={'b' + (mode === x ? ' on' : '')} onClick={() => setMode(x)}>{x}</button>)}</div>
        <div className="kp"><div><b>{rain.I.toFixed(1)}</b>mm/h</div><div><b>{rain.A.toFixed(0)}</b>mm 24 h</div><div><b>{rain.src.toUpperCase()}</b>{rain.ts || 'no data yet'}</div></div>

        {mode === 'PLAN' && <><h2>Design storm</h2><div className="row">{Object.entries(PRE).map(([k, [I, A]]) => <button key={k} className="b" onClick={() => run(setRainTo(I, A))}>{k}</button>)}</div>
          <h2>Municipal chokepoint report</h2><p className="m">Heavy design storm; risk × road importance × nearby hospitals and shelters.</p>
          <table><tbody><tr><th>#</th><th>Street</th><th>Risk</th></tr>{choke.map((c, i) => <tr key={c.edge}><td>{i + 1}</td><td>{c.street}</td><td>{chip(CN.indexOf(c.risk_class))}</td></tr>)}</tbody></table>
          <div className="row"><a className="b" href={'data:text/csv;charset=utf-8,' + encodeURIComponent('rank,street,risk_class,risk,road_class,facility_proximity\n' + choke.map((c, i) => [i + 1, `"${c.street}"`, c.risk_class, c.risk, c.road_class, c.facility_proximity].join(',')).join('\n'))} download="chokepoint_report.csv">Download CSV</a></div>
          <ShelterSummary /></>}

        {mode === 'ALERT' && <><h2>Rainfall</h2>
          <label>Intensity {rain.I} mm/h<input type="range" min="0" max="80" value={rain.I} onChange={e => run(setRainTo(+e.target.value, rain.A))} /></label>
          <label>Last 24 h {rain.A} mm<input type="range" min="0" max="300" value={rain.A} onChange={e => run(setRainTo(rain.I, +e.target.value))} /></label>
          <div className="row"><button className="b" onClick={live}>Use live feed</button><button className="b" onClick={replay}>Replay Kathmandu flood (Sep 2024)</button>{fr.length > 0 && <button className="b" onClick={() => setPlay(!play)}>{play ? 'Pause' : 'Play'}</button>}</div>
          {fr.length > 0 && <input type="range" min="0" max={fr.length - 1} value={fi} onChange={e => { setFi(+e.target.value); frame(+e.target.value) }} />}
          <h2>Likely to flood within 30 min</h2><p><b>{alerts?.likely_soon ?? 0}</b> roads</p><div className="bub">{alerts?.message}</div></>}

        {mode === 'RESPOND' && <><h2>Map tool</h2><div className="row">{[['inspect', 'Inspect road'], ['start', 'Set start'], ['block', 'Close / reopen road']].map(([k, n]) => <button key={k} className={'b' + (tool === k ? ' on' : '')} onClick={() => setTool(k)}>{n}</button>)}<button className="b" onClick={() => post('/reset').then(bump)}>Reopen all</button></div>
          <label>Destination<select value={dest} onChange={e => setDest(e.target.value)}><option value="hospital">Nearest hospital</option><option value="shelter">Nearest safe shelter</option>{fac.filter(f => f.in_area && (showOsm || f.src !== 'osm')).map(f => <option key={f.id} value={f.id}>{f.t === 'hospital' ? '🏥 ' : '⛺ '}{f.n}</option>)}</select></label>
          <div className="row">{[['ambulance', 'Ambulance'], ['car', 'Car'], ['bike', 'Two-wheeler'], ['walk', 'Walking']].map(([k, n]) => <button key={k} className={'b' + (veh === k ? ' on' : '')} onClick={() => setVeh(k)}>{n}</button>)}</div>
          <label>Risk avoidance (0 = fastest): {lam}<input type="range" min="0" max="3" step=".5" value={lam} onChange={e => setLam(+e.target.value)} /></label>
          <label><input type="checkbox" checked={rob} onChange={e => setRob(e.target.checked)} /> Robust routing (rain −20% / +30%)</label>
          {dest === 'shelter' && <ShelterSummary />}
          {route && !route.found && <div className="ms bad">{route.message}</div>}
          {route?.found && route.destination.t === 'shelter' && <div className="dest"><span dangerouslySetInnerHTML={{ __html: tent(route.destination.status).options.html }} />
            <div><b>{route.destination.n}</b><br /><span className="m">{fmtCap(route.destination.cap)} · {route.destination.why}</span></div></div>}
          {route?.skipped_shelters?.length > 0 && <div className="ms skip"><b>Skipped closer shelters</b>{route.skipped_shelters.map(s => <div key={s.n}>✕ {s.n} ({s.distance_m} m away): {s.why}</div>)}</div>}
          {m && <><div className="row"><span className="chip" style={{ background: { High: '#3ba55d', Medium: '#f2994a', Low: '#d4001f' }[m.confidence], color: '#fff' }}>Confidence: {m.confidence}</span><span className="m">to {route.destination.n}</span></div>
            <div className="kp"><div><b>{(m.distance_m / 1000).toFixed(2)} km</b>distance</div><div><b>{m.time_min} min</b>estimated time</div><div><b>{m.avg_risk}</b>avg risk score</div></div>
            <p>{route.same_as_fastest ? 'Same as the fastest route.' : `Versus fastest: +${route.vs_fastest.extra_min} min, ${route.vs_fastest.high_risk_m_avoided} m of high-risk road avoided.`}</p>
            <b>Why this confidence</b><ul>{m.reasons.map(r => <li key={r}>{r}</li>)}</ul>
            {veh === 'ambulance' && <p><b>Ambulance mode:</b> {route.signal_priority_junctions.length} junctions need signal priority (yellow dots).</p>}
            {route.alternatives?.length > 0 && <><b>Backup shelters</b><table><tbody>{route.alternatives.map(a => <tr key={a.id} className="click" onClick={() => goTo(a.id)}>
              <td><i className="dot" style={{ background: SC[a.status] }} />{a.n}</td><td>{a.time_min} min</td><td className="m">{a.cap ? a.cap.toLocaleString('en-IN') : '–'}</td></tr>)}</tbody></table></>}</>}
          <h2>Import shelters</h2><p className="m">CSV with <code>name,lat,lon</code> (optional <code>capacity, flood_prone, type, source</code>). Imported camps show on the map and join routing at once.</p>
          <div className="row"><label className="b file">Upload CSV<input type="file" accept=".csv,text/csv" onChange={readFile} /></label><button className="b" onClick={() => setImp(imp ? '' : SAMPLE)}>{imp ? 'Cancel' : 'Paste rows'}</button></div>
          {imp && <><textarea rows="4" value={imp} onChange={e => setImp(e.target.value)} /><div className="row"><button className="b on" onClick={() => doImport(imp)}>Add to map</button></div></>}
          {impMsg && <div className="ms">{impMsg}</div>}</>}
        <p className="m">Roads and facilities: OpenStreetMap. Terrain and rainfall: Open-Meteo. Shelters: UN/IOM 2011 Kathmandu Valley open-space survey + OSM + imports.</p>
      </aside>
    </div>
  )
}
