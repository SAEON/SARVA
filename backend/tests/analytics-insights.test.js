import {once} from 'node:events';
import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {pool} from '../src/db/pool.js';
import {analyticsRouter} from '../src/routes/analytics.js';
import {insightsFilter} from '../src/routes/analyticsInsights.js';
import {locationFor} from '../src/utils/analyticsAudience.js';
import {interactionFields} from '../src/utils/analyticsIdentity.js';
if(process.env.SARVA_ANALYTICS_TEST!=='synthetic-only') throw Error('Run only against the isolated synthetic analytics database');
const app=express();app.set('trust proxy',true);app.use(express.json());app.use('/api',analyticsRouter);
const server=app.listen(0,'127.0.0.1');
await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port+'/api';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const query='?from='+today+'&to='+today;
let admin,user;
function token(id,roles=['viewer'],exp=Math.floor(Date.now()/1000)+3600){
 const data=Buffer.from(JSON.stringify({sub:String(id),roles,exp})).toString('base64url');
 return data+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(data).digest('base64url');
}
async function event(body={},authorization){
 const id=crypto.randomUUID();
 return fetch(base+'/analytics/events',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'8.8.8.8',...(authorization?{Authorization:'Bearer '+authorization}:{})},body:JSON.stringify({path:'/',sessionId:id,viewId:id,...body})});
}
async function insights(auth,extra=''){return fetch(base+'/analytics/insights'+query+extra,{headers:auth?{Authorization:'Bearer '+auth}:{}});}
before(async()=>{
 for(const [email,name,role] of [['synthetic-admin@example.invalid','Synthetic administrator','admin'],['synthetic-user@example.invalid','Synthetic researcher','viewer']]){
  const result=await pool.query(`INSERT INTO sarva.app_user(email,display_name,password_hash,password_salt) VALUES($1,$2,'not-a-login','not-a-login') ON CONFLICT(email) DO UPDATE SET is_active=true RETURNING id`,[email,name]);
  const id=result.rows[0].id;
  await pool.query('INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name=$2 ON CONFLICT DO NOTHING',[id,role]);
  if(role==='admin')admin=id;else user=id;
 }
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await pool.end();});
test('location refuses private IPs and rounds public coordinates',()=>{
 assert.equal(locationFor('10.1.2.3').locationSource,'local/private network');
 assert.equal(locationFor('::ffff:192.168.1.2').latitude,undefined);
 const point=locationFor('8.8.8.8');assert.equal(point.country,'US');assert.ok(Number.isInteger(point.latitude));assert.ok(Number.isInteger(point.longitude));
});
test('filters reject invalid dates and SQL-shaped input',()=>{
 for(const bad of [{from:'2026-02-30',to:today},{from:today,to:today,device:"Desktop' OR true--"},{from:today,to:today,audience:'admin'},{from:today,to:today,country:'USA'},{from:today,to:today,userId:'1 OR true'}]) assert.throws(()=>insightsFilter(bad));
 const safe=insightsFilter({from:today,to:today,device:'Desktop',section:"x' OR true--"});assert.ok(!safe.where.includes("x'"));assert.ok(safe.args.includes("x' OR true--"));
 assert.equal(interactionFields({action:'password',subject:'secret'}),null);
 assert.equal(interactionFields({action:'map_layer',subject:'<script>'}),null);
});
test('anonymous and ordinary users cannot read account reports',async()=>{
 assert.equal((await insights()).status,403);assert.equal((await insights(token(user))).status,403);
 assert.equal((await insights('bad.token')).status,403);
});
test('server ignores browser-supplied identity and role',async()=>{
 const id=crypto.randomUUID();assert.equal((await event({viewId:id,userId:admin,audience_type:'administrator'},token(user,['admin']))).status,202);
 const row=(await pool.query('SELECT * FROM sarva.analytics_event WHERE view_id=$1',[id])).rows[0];
 assert.equal(String(row.user_id),String(user));assert.equal(row.audience_type,'signed-in');assert.equal(row.country,'US');
});
test('expired and malformed tokens cannot identify an account',async()=>{
 for(const auth of [token(user,['viewer'],1),'bad.token']){
  const id=crypto.randomUUID();assert.equal((await event({viewId:id},auth)).status,202);
  const row=(await pool.query('SELECT user_id,audience_type FROM sarva.analytics_event WHERE view_id=$1',[id])).rows[0];assert.equal(row.user_id,null);assert.equal(row.audience_type,'anonymous');
 }
});
test('records typed interactions, filters devices and returns admin-only user activity',async()=>{
 assert.equal((await event({kind:'interaction',action:'map_layer',subject:'heat-risk'},token(user))).status,202);
 assert.equal((await event({kind:'interaction',action:'email',subject:'private'},token(user))).status,400);
 assert.equal((await event({},token(admin,['admin']))).status,202);
 const response=await insights(token(admin,['admin']),'&audience=signed-in');assert.equal(response.status,200);
 const report=await response.json();assert.ok(report.data.actions.some(row=>row.action==='map_layer'));
 assert.ok(report.data.activity.every(row=>String(row.user_id)===String(user)));
 assert.ok(report.data.locations.every(row=>row.audience_type==='signed-in'));
 assert.ok(!JSON.stringify(report).includes('password_hash'));assert.ok(!JSON.stringify(report).includes('8.8.8.8'));
 const zero=await(await insights(token(admin,['admin']),'&device=Tablet&section=no-matching-section')).json();assert.equal(zero.data.totals[0].views,0);
});
test('inactive and revoked administrator accounts lose report access immediately',async()=>{
 const auth=token(admin,['admin']);await pool.query('UPDATE sarva.app_user SET is_active=false WHERE id=$1',[admin]);assert.equal((await insights(auth)).status,403);
 await pool.query('UPDATE sarva.app_user SET is_active=true WHERE id=$1',[admin]);
 await pool.query("DELETE FROM sarva.app_user_role WHERE user_id=$1 AND role_id=(SELECT id FROM sarva.auth_role WHERE name='admin')",[admin]);assert.equal((await insights(auth)).status,403);
 await pool.query("INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name='admin'",[admin]);
});
test('anonymous requests cannot alter signed-in engagement',async()=>{
 const id=crypto.randomUUID();await event({viewId:id,sessionId:id},token(user));
 await event({kind:'engagement',viewId:id,sessionId:id,activeMs:9999,scrollDepth:99});
 assert.equal((await pool.query('SELECT duration_ms FROM sarva.analytics_event WHERE view_id=$1',[id])).rows[0].duration_ms,0);
 await event({kind:'engagement',viewId:id,sessionId:id,activeMs:1000,scrollDepth:10},token(user));
 assert.equal((await pool.query('SELECT duration_ms FROM sarva.analytics_event WHERE view_id=$1',[id])).rows[0].duration_ms,1000);
});

test('unique IP totals deduplicate visits and exclude historical missing identifiers',async()=>{
 const section='unique-ip-test-'+crypto.randomUUID();
 const hash1='1'.repeat(64),hash2='2'.repeat(64);
 for(const [ip,kind] of [[hash1,'page'],[hash1,'page'],[hash2,'page'],[null,'page'],['3'.repeat(64),'interaction']]) {
  await pool.query(`INSERT INTO sarva.analytics_event(kind,path,section,session_id,visitor_ip_hash) VALUES($1,'/',$2,$3,$4)`,[kind,section,crypto.randomUUID(),ip]);
 }
 const response=await insights(token(admin,['admin']),'&section='+section);
 assert.equal(response.status,200);const report=await response.json();
 assert.equal(report.data.totals[0].unique_ips,2);assert.equal(report.data.totals[0].ip_unavailable_views,1);
 assert.ok(!JSON.stringify(report).includes(hash1));
 await pool.query('DELETE FROM sarva.analytics_event WHERE section=$1',[section]);
});

test('browser GPC and DNT headers skip analytics storage even for signed-in events',async()=>{
 for(const privacyHeader of ['Sec-GPC','DNT']){
  const id=crypto.randomUUID();
  const r=await fetch(base+'/analytics/events',{method:'POST',headers:{'Content-Type':'application/json',[privacyHeader]:'1',Authorization:'Bearer '+token(user)},body:JSON.stringify({path:'/',sessionId:id,viewId:id,kind:'page'})});
  assert.equal(r.status,204);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM sarva.analytics_event WHERE view_id=$1',[id])).rows[0].count,0);
 }
});
