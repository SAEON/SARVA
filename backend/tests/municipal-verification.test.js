import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { eligibleMunicipalValueSql, numberOrNull, scoreLabel } from '../src/routes/municipalProfiles.js';
if (process.env.MUNICIPAL_READ_ONLY_TEST !== 'local-only') throw Error('Run against the local candidate only');
const base='http://localhost:5050/api/municipalities';
async function get(path=''){const r=await fetch(base+path);assert.equal(r.status,200);const body=await r.json();assert.equal(body.status,'ok');return body.data;}
after(()=>pool.end());
test('missing scores stay null while genuine zero remains valid',()=>{
 assert.equal(numberOrNull(null),null);assert.equal(numberOrNull(undefined),null);assert.equal(numberOrNull(0),0);
 assert.equal(scoreLabel(null),'Insufficient verified data');assert.equal(scoreLabel(0),'Very low');
});
test('eligibility excludes synthetic rows even when individual flags are wrong',async()=>{
 const q=await pool.query(`WITH fixtures(id,is_proxy,confidence,scenario,notes,source_label) AS (VALUES
 ('verified',false,'imported','baseline','Source observation','Official source'),
 ('admin',false,'admin','baseline','','Reviewed entry'),
 ('definition',true,'imported','baseline','','Official source'),
 ('confidence',false,'proxy','baseline','','Official source'),
 ('scenario',false,'imported','baseline_proxy','','Official source'),
 ('note',false,'imported','baseline','Deterministic seed value for interface design','Official source'),
 ('source',false,'imported','baseline','','SARVA generated baseline proxy'),
 ('unknown',false,NULL,'baseline','','Official source'))
 SELECT v.id FROM fixtures v JOIN fixtures d ON d.id=v.id WHERE ${eligibleMunicipalValueSql()} ORDER BY v.id`);
 assert.deepEqual(q.rows.map(r=>r.id),['admin','verified']);
});
test('all local public profiles exclude proxies and retain verified main scores',async()=>{
 const municipalities=await get('?limit=260');assert.equal(municipalities.count,213);
 for(const municipality of municipalities.records){
  const d=await get(`/${municipality.gid}/profile`);
  const records=d.indicators.records;assert.ok(records.length);
  assert.ok(records.every(r=>!r.isProxy&&r.confidence!=='proxy'&&!/proxy/i.test(r.scenario||'')));
  for(const index of d.indicators.indices){
   assert.ok(index.components.every(c=>c.confidence!=='proxy'&&!/proxy/i.test(c.scenario||'')));
   if(index.isProxy||!index.components.length){assert.equal(index.score,null);assert.equal(index.riskLabel,'Insufficient verified data');assert.equal(index.indicatorCount,0);}
  }
  const institutional=d.indicators.indices.find(i=>i.key==='governance_institutional_capacity_imported');
  assert.equal(institutional.score,null);assert.equal(institutional.indicatorCount,0);
  assert.equal(institutional.expectedIndicatorCount,2);assert.equal(institutional.coveragePercent,0);
  const old=await fetch(`http://backend:5050/api/municipalities/${municipality.gid}/profile`).then(r=>r.json());
  const main=d.indicators.indices.find(i=>i.key==='imported_composite_risk');
  assert.equal(main.score,old.data.indicators.indices.find(i=>i.key==='imported_composite_risk').score);
 }
});
test('map, trend and metadata cannot reveal synthetic indicator values',async()=>{
 const map=await get('/metric?metric=index:governance_institutional_capacity_imported');
 assert.equal(map.records.length,213);assert.ok(map.records.every(r=>r.mapValue===null&&r.normalizedValue===null&&r.displayValue===null&&r.availability==='insufficient_verified_data'));
 const indicator=await get('/metric?metric=indicator:poverty_pressure');assert.deepEqual(indicator.records,[]);
 const trend=await get('/205/indicators/poverty_pressure/trend');assert.equal(trend.records.length,0);
 const meta=await get('/metadata');assert.ok(meta.indicators.every(i=>!i.isProxy));
});
