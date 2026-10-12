import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs/promises';
const bbox = (process.argv[2] || '').split(',').map(Number);
if(bbox.length!==4 || bbox.some(v=>!Number.isFinite(v)) || bbox[0]>=bbox[2] || bbox[1]>=bbox[3] || (bbox[2]-bbox[0])*(bbox[3]-bbox[1])>2) throw new Error('Supply west,south,east,north bbox, up to 2 square degrees.');
const [w,s,e,n]=bbox;
const query=`[out:json][timeout:180];(way[highway](${s},${w},${n},${e});nwr[amenity~"^(clinic|hospital|doctors|school|college|university|police|fire_station)$"](${s},${w},${n},${e}););out geom center;`;
let body;
if(process.argv[3]) body=JSON.parse(await fs.readFile(process.argv[3],'utf8'));
else {
 const response=await fetch(process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',{method:'POST',headers:{'User-Agent':'SARVA accessibility pilot (SAEON)','Accept':'application/json'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(240000)});
 if(!response.ok) throw new Error(`OSM download failed: ${response.status}`);
 body=await response.json();
}
if(body.remark || !Array.isArray(body.elements)) throw new Error(body.remark || 'Invalid OSM extract.');
const pool=new pg.Pool({host:process.env.DB_HOST || '127.0.0.1',port:Number(process.env.DB_PORT || 5440),database:process.env.DB_NAME || process.env.POSTGRES_DB || 'sarva',user:process.env.DB_USER || process.env.POSTGRES_USER || 'sarva',password:process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD});
const client=await pool.connect(); let roads=0,facilities=0;
try { await client.query('BEGIN');
for(const item of body.elements || []) {
 const road=item.type==='way' && item.tags?.highway;
 let geometry;
 if(road && item.geometry?.length>=2) geometry={type:'LineString',coordinates:item.geometry.map(p=>[p.lon,p.lat])};
 else if(item.tags?.amenity) {const p=item.type==='node'?item:item.center;if(!p)continue;geometry={type:'Point',coordinates:[p.lon,p.lat]};}
 if(!geometry)continue;
 await client.query(`INSERT INTO sarva.access_source(osm_key,kind,name,category,tags,nodes,geom) VALUES($1,$2,$3,$4,$5,$6,ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($7),4326),3857)) ON CONFLICT(osm_key) DO UPDATE SET name=excluded.name,category=excluded.category,tags=excluded.tags,nodes=excluded.nodes,geom=excluded.geom,imported_at=now()`,[`${item.type}/${item.id}`,road?'road':'facility',item.tags.name || '',road?item.tags.highway:item.tags.amenity,JSON.stringify(item.tags),JSON.stringify(item.nodes || null),JSON.stringify(geometry)]);
 road?roads++:facilities++;
}
await client.query('COMMIT'); console.log(JSON.stringify({roads,facilities,bbox,source:'OpenStreetMap / Overpass',note:'Existing local overrides preserved. Source deletions are not reconciled automatically.'}));
} catch(e){await client.query('ROLLBACK');throw e;} finally {client.release();await pool.end();}
