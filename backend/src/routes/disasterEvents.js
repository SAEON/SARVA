import { Router } from 'express';
export const disasterEventsRouter = Router();
const sourceUrl = 'https://www.gdacs.org/';
let cache, pending;
export function normalizeEvents(input) {
 if(input?.type !== 'FeatureCollection' || !Array.isArray(input.features)) throw Error('Invalid GDACS response');
 const seen = new Set();
 return {type:'FeatureCollection',features:input.features.flatMap(f=>{
  const c=f.geometry?.coordinates,p=f.properties || {};
  if(f.geometry?.type!=='Point'||!Array.isArray(c)||c.length<2||!c.slice(0,2).every(Number.isFinite)||c[0]<10||c[0]>55||c[1]<-40||c[1]>-10||!Number.isFinite(Date.parse(p.todate)))return [];
  const id=`${p.eventtype}:${p.eventid}:${p.episodeid}`;if(seen.has(id))return [];seen.add(id);
  let reportUrl='';try{const u=new URL(p.url?.report);if(u.protocol==='https:'&&['gdacs.org','www.gdacs.org'].includes(u.hostname))reportUrl=u.href;}catch{}
  return [{type:'Feature',id,geometry:{type:'Point',coordinates:c.slice(0,2)},properties:{name:String(p.name||p.description||'Regional event'),eventtype:String(p.eventtype||'Other'),country:String(p.country||''),alertlevel:['Green','Orange','Red'].includes(p.alertlevel)?p.alertlevel:'Unknown',fromdate:p.fromdate||'',todate:p.todate,updatedAt:p.datemodified||'',severity:String(p.severitydata?.severitytext||''),reportUrl}}];
 })};
}
async function refresh(){
 const params=new URLSearchParams({geometryArea:'POLYGON((10 -40,55 -40,55 -10,10 -10,10 -40))',days:'30'});
 const r=await fetch(`https://www.gdacs.org/gdacsapi/api/Events/geteventlist/eventsbyarea?${params}`,{signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error('GDACS unavailable');
 cache={geojson:normalizeEvents(await r.json()),updatedAt:new Date().toISOString()};
}
disasterEventsRouter.get('/disaster-events',async(req,res)=>{
 try{
  if(!cache||Date.now()-Date.parse(cache.updatedAt)>30*60000){if(!pending)pending=refresh().finally(()=>{pending=null;});await pending;}
  const days=req.query.days==='7'?7:30,cutoff=Date.now()-days*86400000;
  res.json({status:'ok',sourceUrl,updatedAt:cache.updatedAt,days,geojson:{type:'FeatureCollection',features:cache.geojson.features.filter(f=>Date.parse(f.properties.todate)>=cutoff)}});
 }catch{res.status(502).json({status:'unavailable',message:'GDACS events could not be refreshed. Try again later.',sourceUrl});}
});
