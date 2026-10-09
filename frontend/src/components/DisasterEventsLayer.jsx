import {useEffect,useState} from 'react';
import maplibregl from 'maplibre-gl';
import {apiUrl} from '../config/api';
const types={FL:'Floods',TC:'Tropical cyclones',EQ:'Earthquakes',DR:'Droughts',WF:'Wildfires',VO:'Volcanic events',TS:'Tsunamis'};
const empty={type:'FeatureCollection',features:[]};
export default function DisasterEventsLayer({map,ready,visible}){
 const [days,setDays]=useState('30'),[type,setType]=useState('all'),[data,setData]=useState(null),[message,setMessage]=useState('Loading GDACS events…');
 const features=(data?.geojson.features||[]).filter(f=>type==='all'||f.properties.eventtype===type);
 useEffect(()=>{
  if(!visible)return;
  const controller=new AbortController();
  async function refresh(){setMessage('Loading GDACS events…');try{const r=await fetch(apiUrl(`/api/disaster-events?days=${days}`),{signal:controller.signal});const b=await r.json();if(!r.ok)throw Error(b.message);setData(b);setMessage('');}catch(e){if(e.name!=='AbortError'){setData(null);setMessage(e.message||'GDACS unavailable');}}}
  refresh();const timer=setInterval(refresh,30*60000);return()=>{controller.abort();clearInterval(timer);};
 },[visible,days]);
 useEffect(()=>{
  if(!map||!ready)return;
  if(!map.getSource('gdacs-events')){
   map.addSource('gdacs-events',{type:'geojson',data:empty});
   map.addLayer({id:'gdacs-events',type:'circle',source:'gdacs-events',paint:{'circle-radius':8,'circle-color':['match',['get','alertlevel'],'Red','#dc2626','Orange','#ea8a15','Green','#39875a','#64748b'],'circle-stroke-color':'#fff','circle-stroke-width':2}});
  }
  map.getSource('gdacs-events').setData(visible?{type:'FeatureCollection',features}:empty);
  map.setLayoutProperty('gdacs-events','visibility',visible?'visible':'none');
 },[map,ready,visible,data,type]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  if(!map||!ready||!visible)return;
  let popup;
  const click=e=>{
   const p=e.features?.[0]?.properties;if(!p)return;
   const box=document.createElement('div');
   for(const line of [p.name,`${types[p.eventtype]||p.eventtype} · ${p.country}`,`GDACS alert level: ${p.alertlevel}`,`Event period: ${p.fromdate?.slice(0,10)} – ${p.todate?.slice(0,10)}`,p.severity]){const row=document.createElement('p');row.textContent=line;box.append(row);}
   if(p.reportUrl){const a=document.createElement('a');a.href=p.reportUrl;a.textContent='Read GDACS event report ↗';a.target='_blank';a.rel='noreferrer';box.append(a);}
   popup?.remove();popup=new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(box).addTo(map);
  };
  const enter=()=>{map.getCanvas().style.cursor='pointer';},leave=()=>{map.getCanvas().style.cursor='';};
  map.on('click','gdacs-events',click);map.on('mouseenter','gdacs-events',enter);map.on('mouseleave','gdacs-events',leave);
  return()=>{popup?.remove();map.off('click','gdacs-events',click);map.off('mouseenter','gdacs-events',enter);map.off('mouseleave','gdacs-events',leave);leave();};
 },[map,ready,visible]);
 if(!visible)return null;
 return <div className="sarva-map__legend sarva-fireLegend sarva-disasterLegend" aria-label="GDACS regional events legend">
  <div className="sarva-fireLegend__brand"><div><strong>Regional disaster events</strong><small>GDACS · southern Africa and nearby islands</small></div></div>
  <label>Event window<select aria-label="Disaster event window" value={days} onChange={e=>setDays(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
  <label>Event type<select aria-label="Disaster event type" value={type} onChange={e=>setType(e.target.value)}><option value="all">All event types</option>{Object.entries(types).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  {message?<p role="status">{message}</p>:<p role="status">{features.length?`${features.length} reported event episodes`:'No reported events match these filters.'}<br/>Refreshed {new Date(data.updatedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})} SAST</p>}
  <button type="button" onClick={()=>map?.fitBounds([[10,-40],[55,-10]],{padding:50,duration:800})}>View southern Africa ↗</button>
  <div className="sarva-fireLegend__scale"><strong>GDACS alert level</strong>{[['#39875a','Green'],['#ea8a15','Orange'],['#dc2626','Red'],['#64748b','Unknown']].map(([colour,label])=><div key={label}><i style={{background:colour}}/><span>{label}</span></div>)}</div>
  <small>Click a marker for dates and its event report. Markers show event locations, not affected-area boundaries. Coverage is selective.</small>
  <p>GDACS global disaster alerts are separate from South African official weather warnings. <a href="https://www.weathersa.co.za/warnings" target="_blank" rel="noreferrer">SAWS warnings ↗</a></p>
  <a href="https://www.gdacs.org/" target="_blank" rel="noreferrer">Source: GDACS ↗</a>
 </div>;
}
