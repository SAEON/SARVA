import {mapFeatures} from '../config/analyticsMap';
import { useEffect, useRef, useState } from 'react';
import maplibregl from '../config/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiUrl } from '../config/api';
import { reportCsv, downloadCsv } from '../config/analyticsCsv';

const actionNames={map_layer:'Map layer selected',municipality:'Municipality explored',catalogue_search:'Catalogue search',catalogue_record:'Catalogue record opened',resource_open:'Resource opened',content_create:'Content created',content_edit:'Content edited',content_review:'Content reviewed'};
const countryName=code=>{try{return code?new Intl.DisplayNames(['en'],{type:'region'}).of(code):'Unknown / local';}catch{return code;}};
const initialFilters={device:'',audience:'',country:'',section:'',userId:''};
function Rows({title,rows,columns}) {
 return <section className="analytics-panel"><h3>{title}</h3>{!rows?.length?<p>No matching activity recorded.</p>:<div className="analytics-scroll"><table><thead><tr>{columns.map(([label])=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{columns.map(([label,key,format])=><td key={label}>{format?format(row[key],row):(row[key]??'Unknown')}</td>)}</tr>)}</tbody></table></div>}</section>;
}
function VisitorMap({rows,mode}) {
 const container=useRef(null),map=useRef(null),popup=useRef(null);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  let instance;
  try {
   instance=new maplibregl.Map({container:container.current,center:[18,5],zoom:1.1,style:{version:8,sources:{basemap:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'basemap',type:'raster',source:'basemap',paint:{'raster-opacity':0.65}}]}});
   map.current=instance;
   instance.addControl(new maplibregl.NavigationControl(),'top-right');
   instance.on('load',()=>{
    instance.addSource('visitors',{type:'geojson',data:mapFeatures([])});
    instance.addLayer({id:'visitor-heat',type:'heatmap',source:'visitors',paint:{'heatmap-weight':['get','views'],'heatmap-radius':38,'heatmap-opacity':0.65}});
    instance.addLayer({id:'visitor-circles',type:'circle',source:'visitors',paint:{'circle-radius':['interpolate',['linear'],['get','views'],1,7,20,14,200,26],'circle-color':'#137c78','circle-opacity':0.78,'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
    instance.on('click','visitor-circles',event=>{
     const feature=event.features?.[0];if(!feature)return;
     const p=feature.properties; const node=document.createElement('div');
     const title=document.createElement('strong');title.textContent=p.city+', '+p.country;node.appendChild(title);
     for(const text of [p.views+' views • '+p.clicks+' clicks • '+p.interactions+' interactions','Desktop '+p.desktop+' • Mobile '+p.mobile+' • Tablet '+p.tablet+' • Automated '+p.automated,'Approximate IP area; rounded to a one-degree grid.']) {const line=document.createElement('p');line.textContent=text;node.appendChild(line);}
     popup.current?.remove();popup.current=new maplibregl.Popup().setLngLat(event.lngLat).setDOMContent(node).addTo(instance);
    });
    setMessage('ready');
   });
   instance.on('error',()=>setMessage('Basemap or map data could not load. The tables remain available.'));
  }catch{container.current.textContent='Map rendering unavailable in this browser. Use the location table below.';}
  return()=>{popup.current?.remove();instance?.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  const instance=map.current;if(!instance?.getSource('visitors'))return;
  popup.current?.remove();instance.getSource('visitors').setData(mapFeatures(rows));
  instance.setPaintProperty('visitor-heat','heatmap-weight',['/', ['get','views'], Math.max(1,...mapFeatures(rows).features.map(f=>f.properties.views))]);
  instance.setLayoutProperty('visitor-heat','visibility',mode==='heatmap'?'visible':'none');
  instance.setLayoutProperty('visitor-circles','visibility',mode==='heatmap'?'none':'visible');
 },[rows,mode,message]);
 return <><div ref={container} className="analytics-visitor-map" role="region" aria-label="Approximate visitor locations map"/>{message&&message!=='ready'&&<p role="status">{message}</p>}</>;
}
export default function AnalyticsAudience({token,from,to,revision}) {
 const [filters,setFilters]=useState(initialFilters),[mode,setMode]=useState('circles');
 const [snapshot,setSnapshot]=useState({key:null,report:null,error:''});
 const requestKey=JSON.stringify({from,to,filters,revision});
 const report=snapshot.key===requestKey?snapshot.report:null;
 const error=snapshot.key===requestKey?snapshot.error:'';
 const loading=snapshot.key!==requestKey;
 useEffect(()=>{
  const controller=new AbortController();

  const params=new URLSearchParams({from,to,...filters});
  fetch(apiUrl('/api/analytics/insights?'+params),{headers:{Authorization:'Bearer '+token},signal:controller.signal})
   .then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.message||'Audience insights unavailable');return body;})
   .then(body=>{if(!controller.signal.aborted)setSnapshot({key:requestKey,report:body,error:''});})
   .catch(err=>{if(err.name!=='AbortError')setSnapshot({key:requestKey,report:null,error:err.message});});
  return()=>controller.abort();
 },[token,from,to,filters,requestKey]);
 const data=report?.data,totals=data?.totals?.[0];
 const change=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const countryOptions=[...new Set((data?.countries||[]).map(row=>row.country).filter(Boolean))];
 if(filters.country&&filters.country!=='unknown'&&!countryOptions.includes(filters.country))countryOptions.push(filters.country);
 return <section className="analytics-audience"><div className="analytics-heading"><div><span className="analytics-eyebrow">AUDIENCE EXPLORER</span><h2>Where people connect. What they explore.</h2><p>Approximate locations, devices and signed-in activity. Filters below apply to this explorer only; the original reports follow unchanged.</p></div></div>
 {import.meta.env.VITE_ANALYTICS_DEMO === 'true' && <p className="analytics-notice"><strong>Local review · synthetic example data.</strong> These are fabricated visitors and accounts, not production analytics.</p>}
 <div className="analytics-audience-filters">
 <label>Device<select value={filters.device} onChange={e=>change('device',e.target.value)}><option value="">All devices</option>{['Desktop','Mobile','Tablet','Automated','Unknown'].map(value=><option key={value}>{value}</option>)}</select></label>
 <label>Audience<select value={filters.audience} onChange={e=>change('audience',e.target.value)}><option value="">All audiences</option><option value="anonymous">Anonymous visitors</option><option value="signed-in">Signed-in users</option><option value="administrator">Administrators</option><option value="legacy">Earlier tracking (unclassified)</option></select></label>
 <label>Country<select value={filters.country} onChange={e=>change('country',e.target.value)}><option value="">All countries / unknown</option><option value="unknown">Unknown / private network</option>{countryOptions.sort().map(value=><option key={value} value={value}>{countryName(value)}</option>)}</select></label>
 <label>Section<select value={filters.section} onChange={e=>change('section',e.target.value)}><option value="">All sections</option>{data?.sections?.map(row=><option key={row.section}>{row.section}</option>)}</select></label>
 <button onClick={()=>setFilters(initialFilters)}>Reset filters</button>
 </div>
 {loading&&<p role="status">Loading audience insights…</p>}{error&&<p className="analytics-notice" role="alert">{error}</p>}
 {data&&<><div className="analytics-cards">{[['Filtered page views',totals?.views],['Unique IP addresses',totals?.unique_ips],['Browser-tab sessions',totals?.sessions],['Recorded interactions',totals?.interactions],['Unmapped page views',totals?.unmapped]].map(([label,value])=><section key={label}><span>{label}</span><strong>{Number(value||0).toLocaleString()}</strong></section>)}</div>
 <p className="analytics-meta">Unique IP addresses apply to the selected dates and filters and count network addresses, not people. Older visits have no saved IP identifier; {Number(totals?.ip_unavailable_views||0).toLocaleString()} page views in this selection cannot be counted.</p>
 <section className="analytics-panel"><div className="analytics-map-heading"><div><h3>Visitor locations</h3><p>Circles show page-view totals. Select a circle for its device mix. Heatmap shows relative intensity, not unique people.</p></div><label>Map view<select value={mode} onChange={e=>setMode(e.target.value)}><option value="circles">Sized circles</option><option value="heatmap">Heatmap</option></select></label></div>
 <VisitorMap rows={data.locations} mode={mode}/>
 {!mapFeatures(data.locations).features.length&&<p className="analytics-notice">No mapped page views match these filters. Private-network visits and older events without coordinates remain in the tables.</p>}
 <p className="analytics-meta">Locations are rounded to a one-degree grid (roughly 100 km), not GPS positions. VPNs may locate the network provider. Map displays up to 1,000 aggregate groups. Public basemap tiles are requested from OpenStreetMap; account identities and analytics events are not sent to the tile provider.</p>
 </section>
 <Rows title="Location × device × audience · top 1,000 groups" rows={data.locations} columns={[["Country","country",countryName],["City (approx.)","city"],["Device","device"],["Audience","audience_type"],["Views","views"],["Sessions","sessions"],["Clicks","clicks"],["Interactions","interactions"]]}/>
 <div className="analytics-grid"><Rows title="Interactions" rows={data.actions} columns={[["Action","action",value=>actionNames[value]||value],["Count","count"],["Sessions","sessions"]]}/>
 <Rows title="Signed-in users · most recent 100" rows={data.users} columns={[["User","name",(value,row)=><button onClick={()=>change('userId',String(row.user_id))}>{value||'Removed account'} · #{row.user_id}</button>],["Audience","audience_type"],["Views","views"],["Clicks","clicks"],["Interactions","interactions"]]}/></div>
 {filters.userId&&<p className="analytics-notice">Viewing account #{filters.userId}. <button onClick={()=>change('userId','')}>Show all users</button></p>}
 <Rows title="Signed-in activity · latest 100 events" rows={data.activity} columns={[["Time (SAST)","created_at",value=>new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})],["User","name",(value,row)=>(value||'Removed account')+' · #'+row.user_id],["Event","action",(value,row)=>actionNames[value]||row.kind],["Page","path"],["Selection","subject"],["Device","device"],["Country","country",countryName]]}/>
 <p className="analytics-meta">Account activity is visible only to administrators. Identity is verified by the server against active SARVA accounts; shared preview login is not an individual identity. Older events are not attributed retrospectively. This is usage analytics, not a complete security audit. Browser privacy preferences are respected.</p>
 <button onClick={()=>downloadCsv(reportCsv({...report,days:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1,generatedAt:new Date().toISOString()}),'sarva-audience-'+from+'-'+to+'.csv')}>Export filtered audience CSV</button>
 </>}
 </section>;
}
