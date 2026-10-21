import {useEffect,useRef,useState} from 'react';
import maplibregl from '../config/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {apiUrl,martinUrl} from '../config/api';
import {useCurrentUser} from '../hooks/useCurrentUser';
import '../styles/accessibility-workspace.css';
const empty={type:'FeatureCollection',features:[]};
export default function AccessibilityWorkspace(){
 const node=useRef(null), mapRef=useRef(null), modeRef=useRef('explore'), pointsRef=useRef([]);
 const [mode,updateMode]=useState('explore'),[points,setPoints]=useState([]),[selected,setSelected]=useState(null),[name,setName]=useState(''),[category,setCategory]=useState('clinic'),[message,setMessage]=useState(''),[status,setStatus]=useState([]),[edits,setEdits]=useState([]),[revision,setRevision]=useState(0);
 const camera=useRef(null);
 const [facilityFilter,setFacilityFilter]=useState('all');
 const [visible,setVisible]=useState({roads:true,facilities:true,zones:true});
 const {token,isAdmin}=useCurrentUser();
 function setMode(value){updateMode(value);modeRef.current=value;pointsRef.current=[];setPoints([]);mapRef.current?.getSource('drawing')?.setData(empty);}
 useEffect(()=>{Promise.all([fetch(apiUrl('/api/accessibility/status')).then(r=>r.json()),fetch(apiUrl('/api/accessibility/edits')).then(r=>r.json())]).then(([s,e])=>{if(s.status!=='ok')throw Error('Data unavailable');setStatus(s.data);setEdits(e.data || []);}).catch(()=>setMessage('Accessibility services unavailable.'));},[revision]);
 useEffect(()=>{
 const sources={base:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'},drawing:{type:'geojson',data:empty}};
 for(const kind of ['roads','facilities','zones'])sources[kind]={type:'vector',tiles:[martinUrl(`/access_${kind}/{z}/{x}/{y}?v=${revision}`)]};
 const map=new maplibregl.Map({container:node.current,center:camera.current?.center || [18.86,-33.93],zoom:camera.current?.zoom || 11,cooperativeGestures:true,dragRotate:false,pitchWithRotate:false,style:{version:8,sources,layers:[{id:'base',type:'raster',source:'base'}, {id:'roads',type:'line',source:'roads','source-layer':'access_roads',paint:{'line-color':'#b56832','line-width':3}}, {id:'zones',type:'fill',source:'zones','source-layer':'access_zones',paint:{'fill-color':'#7357a3','fill-opacity':0.3}}, {id:'facilities',type:'circle',source:'facilities','source-layer':'access_facilities',paint:{'circle-color':['match',['get','category'],'clinic','#b84f48','hospital','#b84f48','school','#357a8a','#385a48'],'circle-radius':7,'circle-stroke-color':'white','circle-stroke-width':2}}, {id:'drawing-fill',type:'fill',source:'drawing',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#7357a3','fill-opacity':0.35}}, {id:'drawing-points',type:'circle',source:'drawing',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':6,'circle-color':'#7357a3'}}]}});
 mapRef.current=map;map.addControl(new maplibregl.NavigationControl({showCompass:false}));map.on('load',()=>map.touchZoomRotate.disableRotation());
 map.on('click',e=>{
 if(modeRef.current!=='explore'){
 const next=modeRef.current==='facility'?[[e.lngLat.lng,e.lngLat.lat]]:[...pointsRef.current,[e.lngLat.lng,e.lngLat.lat]];pointsRef.current=next;setPoints(next);
 const features=next.map(p=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}}));if(next.length>=3)features.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...next,next[0]]]}});map.getSource('drawing').setData({type:'FeatureCollection',features});return;
 }
 const feature=map.queryRenderedFeatures(e.point,{layers:['facilities','zones','roads']})[0];
 if(feature){setSelected({...feature.properties,geometry:feature.geometry});setName(feature.properties.name || 'Unnamed feature');setCategory(feature.properties.category || 'other');}
 });
 return()=>{camera.current={center:map.getCenter().toArray(),zoom:map.getZoom()};map.remove();mapRef.current=null;};
 // A source refresh rebuilds the map after an edit; drawing is not persisted until Save.
 },[revision]);
 useEffect(()=>{const map=mapRef.current;if(!map)return;const apply=()=>{for(const [k,v]of Object.entries(visible))if(map.getLayer(k))map.setLayoutProperty(k,'visibility',v?'visible':'none');};if(map.isStyleLoaded())apply();else map.once('load',apply);return()=>map.off('load',apply);},[visible,revision]);
 useEffect(()=>{const map=mapRef.current;if(!map)return;const apply=()=>map.setFilter('facilities',facilityFilter==='all'?null:['==',['get','category'],facilityFilter]);if(map.isStyleLoaded())apply();else map.once('load',apply);return()=>map.off('load',apply);},[facilityFilter,revision]);
 async function save(hidden=false,restore=null){
 if(!isAdmin){setMessage('Log in with an administrator account to save map edits.');return;}
 const item=restore || selected;
 let kind=mode==='zone'?'zone':mode==='facility'?'facility':item?.kind;
 let geometry=mode==='facility'&&points.length?{type:'Point',coordinates:points[0]}:mode==='zone'&&points.length>=3?{type:'Polygon',coordinates:[[...points,points[0]]]}:null;
 if(mode!=='explore'&&!geometry){setMessage('Place a facility or draw at least three zone vertices first.');return;}
 const payload={id:item?.edit_id?Number(item.edit_id):restore?Number(restore.id):undefined,sourceId:item?.source_id?Number(item.source_id):undefined,kind,name:restore?restore.name:name,category:restore?restore.category:category,hidden,geometry};
 try{const r=await fetch(apiUrl('/api/accessibility/edits'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});const b=await r.json();if(!r.ok)throw Error(b.message);setMessage(hidden?'Feature hidden. Restore it below.':'Saved to PostGIS.');setMode('explore');pointsRef.current=[];setPoints([]);setSelected(null);setRevision(v=>v+1);}catch(e){setMessage(e.message);}
 }
 const counts=kind=>status.filter(s=>s.kind===kind).reduce((n,s)=>n+s.count,0);
 return <section className="access-workspace"><header><small>MUNICIPAL ACCESSIBILITY · PILOT</small><h1>Roads, services and planning zones</h1><p>Explore imported roads and facilities, or add local facilities and zones. Routing and travel-time analysis are not yet available.</p></header>
 <div className="access-toolbar"><button onClick={()=>mapRef.current?.flyTo({center:[18.86,-33.93],zoom:11})}>Stellenbosch pilot</button><button onClick={()=>mapRef.current?.fitBounds([[16.45,-34.84],[32.95,-22.13]])}>South Africa</button>{['roads','facilities','zones'].map(k=><label key={k}><input type="checkbox" checked={visible[k]} onChange={e=>setVisible({...visible,[k]:e.target.checked})}/>{k} ({counts(k==='roads'?'road':k==='facilities'?'facility':'zone')})</label>)}</div>
 <label>Facility category <select value={facilityFilter} onChange={e=>setFacilityFilter(e.target.value)}><option value="all">All facility categories</option>{[...new Set(status.filter(s=>s.kind==='facility').map(s=>s.category))].map(c=><option key={c}>{c}</option>)}</select></label>
 <div className="access-layout"><div ref={node} className="access-map"/><aside><h2>{mode==='explore'?'Inspect a feature':mode==='zone'?'Draw a planning zone':'Add a facility'}</h2><p>{mode==='explore'?'Click a road, facility or zone to inspect it.':mode==='zone'?'Click three or more vertices around the zone, then save.':'Click the map to place the facility, then save.'}</p><button onClick={()=>{setMode('explore');setSelected(null);}}>Explore / cancel drawing</button><button disabled={!isAdmin} onClick={()=>{setSelected(null);setName('');setCategory('clinic');setMode('facility');}}>Add facility</button><button disabled={!isAdmin} onClick={()=>{setSelected(null);setName('');setCategory('investigation');setMode('zone');}}>Draw zone</button>{!isAdmin&&<p>Administrator login is required for persistent edits.</p>}
 {selected&&<div><strong>{selected.name || 'Unnamed'}</strong><p>{selected.kind} · {selected.category}<br/>{selected.provenance}</p><p>OSM listings are not verified service availability. Road tags do not establish passability.</p></div>}
 {(selected||mode!=='explore')&&<><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{[...new Set([category,...(mode==='zone'||selected?.kind==='zone'?['investigation','service_area','proposed_development']:selected?.kind==='road'?['motorway','primary','secondary','tertiary','residential','service','track','path']:['clinic','hospital','doctors','school','college','university','police','fire_station','other'])])].map(c=><option key={c}>{c}</option>)}</select></label><p>{points.length?`${points.length} map points captured`:''}</p><button disabled={!isAdmin||!name.trim()} onClick={()=>save(false)}>Save feature</button>{selected&&<button disabled={!isAdmin} onClick={()=>save(true)}>Hide feature</button>}</>}
 {message&&<p role="status">{message}</p>}<details><summary>Hidden features — restore</summary>{edits.filter(e=>e.hidden).map(e=><p key={e.id}>{e.name}<button disabled={!isAdmin} onClick={()=>save(false,e)}>Restore</button></p>)}</details><details><summary>Available facilities and source dates</summary>{status.map(s=><p key={`${s.kind}-${s.category}`}>{s.category}: {s.count} · {s.imported_at?new Date(s.imported_at).toLocaleDateString('en-ZA'):'Local feature'}</p>)}</details><p>OSM source refreshes preserve local overrides. Zones describe planning intent; they do not calculate accessibility.</p></aside></div></section>;
}
