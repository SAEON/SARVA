import {Router} from 'express';
export const fireDetectionsRouter=Router();
let cache=null;
let pending=null;
const sourceUrl='https://firms.modaps.eosdis.nasa.gov/active_fire/';
export function parseDetections(csv,now=Date.now()) {
 const [header,...lines]=csv.trim().split(/\r?\n/); const keys=header.split(',');
 return lines.flatMap(line=>{
  const row=Object.fromEntries(line.split(',').map((v,i)=>[keys[i],v]));
  const lon=Number(row.longitude),lat=Number(row.latitude);
  const time=String(row.acq_time || '').padStart(4,'0');
  const detectedAt=`${row.acq_date}T${time.slice(0,2)}:${time.slice(2)}:00Z`;
  const ageHours=(now-Date.parse(detectedAt))/3600000;
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||!Number.isFinite(ageHours)||ageHours<0||ageHours>168||lon<16||lon>33.5||lat< -35.5||lat> -21.5)return [];
  return [{type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{detectedAt,ageHours,satellite:row.satellite || 'S-NPP',confidence:row.confidence || 'Unknown',frp:Number(row.frp)||0}}];
 });
}
async function refresh(key){
 const now=new Date(); const start=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
 const second=new Date(Date.parse(start)+5*86400000).toISOString().slice(0,10);
 const urls=[[start,5],[second,3]].map(([date,days])=>`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_SNPP_NRT/16,-35.5,33.5,-21.5/${days}/${date}`);
 const texts=await Promise.all(urls.map(async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('NASA download unavailable');const text=await r.text();if(!text.startsWith('latitude,'))throw Error('NASA returned an invalid response; check FIRMS configuration');return text;}));
 const seen=new Set();const features=texts.flatMap(text=>parseDetections(text)).filter(f=>{const id=`${f.geometry.coordinates}:${f.properties.detectedAt}`;if(seen.has(id))return false;seen.add(id);return true;});
 cache={features,updatedAt:new Date().toISOString()}; return cache;
}
fireDetectionsRouter.get('/fire-detections',async(req,res)=>{
 const key=process.env.FIRMS_MAP_KEY;
 if(!key)return res.status(503).json({status:'unconfigured',message:'Satellite fire detections need a NASA FIRMS map key configured on the server.',sourceUrl});
 try{
  if(!cache||Date.now()-Date.parse(cache.updatedAt)>30*60000){if(!pending)pending=refresh(key).finally(()=>{pending=null;});await pending;}
  const hours=req.query.hours==='24'?24:168;
  res.json({status:'ok',updatedAt:cache.updatedAt,sourceUrl,attribution:'NASA FIRMS · VIIRS S-NPP near-real-time thermal detections',geojson:{type:'FeatureCollection',features:cache.features.filter(f=>(Date.now()-Date.parse(f.properties.detectedAt))/3600000<=hours)}});
 }catch {res.status(502).json({status:'unavailable',message:'NASA fire detections could not be refreshed. Try again later.',sourceUrl});}
});
