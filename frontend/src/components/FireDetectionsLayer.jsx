import {useEffect,useState} from 'react';
import maplibregl from 'maplibre-gl';
import {apiUrl} from '../config/api';
export default function FireDetectionsLayer({map,ready,visible}){
 const [hours,setHours]=useState('24'),[data,setData]=useState(null),[message,setMessage]=useState('Loading satellite detections…');
 useEffect(()=>{
  if(!visible)return;
  const controller=new AbortController();
  async function refresh(){setMessage('Loading satellite detections…');try{const r=await fetch(apiUrl(`/api/fire-detections?hours=${hours}`),{signal:controller.signal});const b=await r.json();if(!r.ok)throw Error(b.message);setData(b);setMessage('');}catch(e){if(e.name!=='AbortError'){setData(null);setMessage(e.message);}}}
  refresh();const timer=setInterval(refresh,30*60000);return()=>{controller.abort();clearInterval(timer);};
 },[hours,visible]);
 useEffect(()=>{
  if(!map||!ready)return;
  if(!map.getSource('satellite-fires')){
   map.addSource('satellite-fires',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
   map.addLayer({id:'satellite-fires',type:'circle',source:'satellite-fires',paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,4,10,8],'circle-color':['step',['get','ageHours'],'#dc2626',24,'#f97316',72,'#eab308'],'circle-stroke-color':'#fff','circle-stroke-width':1.2}});
  }
  map.getSource('satellite-fires').setData(visible&&data?data.geojson:{type:'FeatureCollection',features:[]});
  map.setLayoutProperty('satellite-fires','visibility',visible?'visible':'none');
 },[map,ready,visible,data]);
 useEffect(()=>{
  if(!map||!ready||!visible)return;
  let popup;
  const click=e=>{const p=e.features?.[0]?.properties;if(!p)return;const box=document.createElement('div');for(const line of ['Satellite thermal detection',`Detected: ${p.detectedAt} (UTC)`,`Satellite: ${p.satellite}`,`Confidence: ${p.confidence}`,`Fire radiative power: ${p.frp} MW`]){const row=document.createElement('div');row.textContent=line;box.append(row);}popup?.remove();popup=new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(box).addTo(map);};
  const enter=()=>{map.getCanvas().style.cursor='pointer';},leave=()=>{map.getCanvas().style.cursor='';};
  map.on('click','satellite-fires',click);map.on('mouseenter','satellite-fires',enter);map.on('mouseleave','satellite-fires',leave);
  return()=>{popup?.remove();map.off('click','satellite-fires',click);map.off('mouseenter','satellite-fires',enter);map.off('mouseleave','satellite-fires',leave);};
 },[map,ready,visible]);
 if(!visible)return null;
 return <div className="sarva-map__legend sarva-fireLegend"><div className="sarva-fireLegend__brand"><img src="https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg" alt="NASA" width="52" height="44"/><div><strong>Satellite fire detections</strong><small>NASA FIRMS · VIIRS S-NPP</small></div></div><label>Time window<select aria-label="Fire detection time window" value={hours} onChange={e=>setHours(e.target.value)}><option value="24">Last 24 hours</option><option value="168">Last 7 days</option></select></label>{message?<p role="status">{message}</p>:<p>{data?.geojson.features.length} detections · refreshed {new Date(data.updatedAt).toLocaleString('en-ZA')}</p>}<div className="sarva-fireLegend__scale" aria-label="Detection age legend"><strong>Time since detection</strong>{[["#dc2626","Less than 24 hours"],["#f97316","1–3 days"],["#eab308","3–7 days"]].filter((_,i)=>hours==='168'||i===0).map(([colour,label])=><div key={label}><i style={{background:colour}} aria-hidden="true"/><span>{label}</span></div>)}</div><small>Click a dot for detection details.</small><p>Satellite thermal activity; not confirmed wildfire boundaries or official warnings. Coverage may be affected by clouds and satellite passes.</p><a href="https://firms.modaps.eosdis.nasa.gov/active_fire/" target="_blank" rel="noreferrer">NASA FIRMS · VIIRS S-NPP ↗</a></div>;
}
