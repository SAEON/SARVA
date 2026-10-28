import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {once} from 'node:events';
import express from 'express';
import {pool} from '../src/db/pool.js';
import {createUserAdminRouter} from '../src/routes/userAdmin.js';
import {authRouter} from '../src/routes/auth.js';
import {resourcesRouter} from '../src/routes/resources.js';
import {requireCurrentAdmin} from '../src/utils/currentAdmin.js';
if(process.env.USER_ADMIN_TEST!=='synthetic-only')throw Error('Use the isolated synthetic database only');
const prefix='access-test-'+crypto.randomUUID(),password=crypto.randomBytes(24).toString('hex');
const salt=crypto.randomBytes(16).toString('hex');
const hash=crypto.pbkdf2Sync(password,salt,120000,64,'sha512').toString('hex');
let admin,second,viewer;
function token(id,roles=['viewer']){const value=Buffer.from(JSON.stringify({sub:String(id),roles,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return value+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(value).digest('base64url');}
const app=express();app.use(express.json());app.use('/api',createUserAdminRouter());app.use('/api',authRouter);app.use('/api',resourcesRouter);
const failingDb={query:pool.query.bind(pool),connect:async()=>{const client=await pool.connect();return {release:()=>client.release(),query:(sql,args)=>String(sql).startsWith('INSERT INTO sarva.user_access_audit')?Promise.reject(new Error('Synthetic audit failure')):client.query(sql,args)};}};app.use('/failure',createUserAdminRouter(failingDb));app.post('/content-edit',requireCurrentAdmin,(_req,res)=>res.json({ok:true}));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
async function call(path,auth,body,method){return fetch(base+path,{method:method || (body?'POST':'GET'),headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{})});}
async function access(id){return (await pool.query(`SELECT u.is_active,u.access_revision,ARRAY(SELECT r.name FROM sarva.app_user_role ur JOIN sarva.auth_role r ON r.id=ur.role_id WHERE ur.user_id=u.id ORDER BY r.name) AS roles FROM sarva.app_user u WHERE id=$1`,[id])).rows[0];}
async function change(id,roles,isActive=true,extra={}){const current=await access(id);return {roles,isActive,revision:current.access_revision,reason:'Synthetic access review',currentPassword:password,...extra};}
before(async()=>{
 for(const role of ['admin','admin','viewer']){
  const result=await pool.query('INSERT INTO sarva.app_user(email,display_name,password_hash,password_salt) VALUES($1,$2,$3,$4) RETURNING id',[prefix+'-'+(admin?(second?'viewer':'second'):'admin')+'@example.invalid','Synthetic '+role,hash,salt]);
  const id=result.rows[0].id;
  await pool.query('INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name=$2',[id,role]);
  if(!admin)admin=id;else if(!second)second=id;else viewer=id;
 }
});
after(async()=>{
 await pool.query('DELETE FROM sarva.user_access_audit WHERE actor_user_id=ANY($1::bigint[]) OR target_user_id=ANY($1::bigint[])',[[admin,second,viewer]]);
 await pool.query('DELETE FROM sarva.app_user WHERE id=ANY($1::bigint[])',[[admin,second,viewer]]);
 await new Promise(resolve=>server.close(resolve));await pool.end();
});
test('anonymous, malformed, ordinary and forged-role users cannot list or change accounts',async()=>{
 for(const auth of [null,'bad.token',token(viewer),token(viewer,['admin'])]){
  assert.equal((await call('/api/admin/users',auth)).status,403);
  assert.equal((await call('/api/admin/users/'+viewer,auth,await change(viewer,['admin']))).status,403);
  assert.equal((await call('/api/admin/users/'+admin+'/history',auth)).status,403);
 }
});
test('lists only safe account fields, searches literally and validates pagination',async()=>{
 const response=await call('/api/admin/users?search='+encodeURIComponent(prefix),token(admin));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const text=await response.text(),body=JSON.parse(text);assert.equal(body.data.total,3);assert.equal(body.data.users.length,3);
 for(const secret of ['password_hash','password_salt',hash,salt])assert.ok(!text.includes(secret));
 assert.equal((await call('/api/admin/users?page=-1',token(admin))).status,400);
 const literal=await(await call('/api/admin/users?search='+encodeURIComponent("' OR true--"),token(admin))).json();assert.equal(literal.data.total,0);
});
test('changes roles with password confirmation and records actor, reason and before/after',async()=>{
 const response=await call('/api/admin/users/'+viewer,token(admin),await change(viewer,['viewer','contributor']));assert.equal(response.status,200);
 const result=await access(viewer);assert.deepEqual(result.roles,['contributor','viewer']);
 const history=await(await call('/api/admin/users/'+viewer+'/history',token(admin))).json();assert.equal(history.data.length,1);
 assert.deepEqual(history.data[0].before_access.roles,['viewer']);assert.deepEqual(history.data[0].after_access.roles,['contributor','viewer']);
 assert.equal(history.data[0].reason,'Synthetic access review');assert.ok(!JSON.stringify(history).includes(password));
});
test('wrong password, unknown role, empty roles, extra fields and no-op do not change access',async()=>{
 const old=await access(viewer);
 for(const [patch,status] of [[{currentPassword:'wrong'},403],[{roles:['owner']},400],[{roles:[]},400],[{userId:admin},400],[{reason:'x'},400],[{roles:['contributor','viewer']},400]]){
  assert.equal((await call('/api/admin/users/'+viewer,token(admin),await change(viewer,['viewer'],true,patch))).status,status);
 }
 assert.deepEqual(await access(viewer),old);
});
test('stale concurrent edits are rejected without a second audit record',async()=>{
 const draft=await change(viewer,['viewer']);assert.equal((await call('/api/admin/users/'+viewer,token(second),draft)).status,200);
 assert.equal((await call('/api/admin/users/'+viewer,token(second),draft)).status,409);
 const history=await(await call('/api/admin/users/'+viewer+'/history',token(second))).json();assert.equal(history.data.length,2);
});
test('self-demotion and self-deactivation are blocked',async()=>{
 assert.equal((await call('/api/admin/users/'+second,token(second),await change(second,['viewer']))).status,409);
 assert.equal((await call('/api/admin/users/'+second,token(second),await change(second,['admin'],false))).status,409);
});
test('role grants use current DB roles; demoted and inactive admins lose existing token access',async()=>{
 const oldToken=token(viewer,['viewer']);
 assert.equal((await call('/api/admin/users/'+viewer,token(second),await change(viewer,['admin','viewer']))).status,200);
 assert.equal((await call('/api/admin/users',oldToken)).status,200);
 const adminToken=token(viewer,['admin']);
 assert.equal((await call('/api/admin/users/'+viewer,token(second),await change(viewer,['viewer']))).status,200);
 assert.equal((await call('/api/admin/users',adminToken)).status,403);
 assert.equal((await call('/content-edit',adminToken,{},'POST')).status,403);
 assert.equal((await call('/api/resources',adminToken,{},'POST')).status,403);
 await pool.query('UPDATE sarva.app_user SET is_active=false WHERE id=$1',[admin]);
 assert.equal((await call('/api/admin/users',token(admin,['admin']))).status,403);
 assert.equal((await call('/content-edit',token(admin,['admin']),{},'POST')).status,403);
 await pool.query('UPDATE sarva.app_user SET is_active=true WHERE id=$1',[admin]);
});
test('deactivate and reactivate an account without losing its roles',async()=>{
 assert.equal((await call('/api/admin/users/'+viewer,token(second),await change(viewer,['viewer'],false))).status,200);assert.equal((await access(viewer)).is_active,false);
 const email=(await pool.query('SELECT email FROM sarva.app_user WHERE id=$1',[viewer])).rows[0].email;
 assert.equal((await call('/api/auth/login',null,{email,password},'POST')).status,401);
 assert.equal((await call('/api/admin/users/'+viewer,token(second),await change(viewer,['viewer'],true))).status,200);assert.equal((await access(viewer)).is_active,true);
});
test('audit insertion failure rolls back role and status changes',async()=>{
 const before=await access(viewer);
 const response=await call('/failure/admin/users/'+viewer,token(second),await change(viewer,['contributor','viewer']));
 assert.equal(response.status,500);assert.deepEqual(await access(viewer),before);
});
test('serialized competing demotions cannot remove both administrators',async()=>{
 const results=await Promise.all([
  call('/api/admin/users/'+second,token(admin),await change(second,['viewer'])),
  call('/api/admin/users/'+admin,token(second),await change(admin,['viewer']))
 ]);
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===403).length,1);
 assert.equal([await access(admin),await access(second)].filter(a=>a.is_active&&a.roles.includes('admin')).length,1);
});
