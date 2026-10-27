import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {once} from 'node:events';
import express from 'express';
import {pool} from '../src/db/pool.js';
import {createReviewIssuesRouter} from '../src/routes/reviewIssues.js';
if(process.env.REVIEW_ISSUES_TEST!=='synthetic-only')throw Error('Use only the isolated synthetic review database');
const prefix='review-test-'+crypto.randomUUID();let admin,reporter,other,issue;
function token(id,roles=['viewer'],exp=Math.floor(Date.now()/1000)+3600){const data=Buffer.from(JSON.stringify({sub:String(id),roles,exp})).toString('base64url');return data+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(data).digest('base64url');}
const app=express();app.use(express.json());app.use('/api',createReviewIssuesRouter());
const failingDb={query:pool.query.bind(pool),connect:async()=>{const client=await pool.connect();return {release:()=>client.release(),query:(sql,args)=>String(sql).startsWith('INSERT INTO sarva.review_issue_event')?Promise.reject(Error('Synthetic audit failure')):client.query(sql,args)};}};
app.use('/failure',createReviewIssuesRouter(failingDb));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
async function call(path,auth,body,method){return fetch(base+path,{method:method || (body?'POST':'GET'),headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{})});}
const report=()=>({title:prefix+' map issue',kind:'bug',priority:'normal',pagePath:'/explore',description:'Synthetic test: the expected map layer did not appear.'});
async function detail(id=issue,auth=token(admin)){const response=await call('/api/review/issues/'+id,auth);assert.equal(response.status,200);return (await response.json()).data;}
async function review(status='in-review',extra={}){const d=await detail();return {kind:'bug',priority:'high',status,revision:d.issue.revision,note:'Synthetic review and verification notes',...extra};}
before(async()=>{
 for(const name of ['admin','reporter','other']){
  const id=(await pool.query(`INSERT INTO sarva.app_user(email,display_name,password_hash,password_salt) VALUES($1,$2,'not-a-login','not-a-login') RETURNING id`,[prefix+'-'+name+'@example.invalid','Synthetic review '+name])).rows[0].id;
  await pool.query('INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name=$2',[id,name==='admin'?'admin':'viewer']);
  if(name==='admin')admin=id;else if(name==='reporter')reporter=id;else other=id;
 }
});
after(async()=>{
 await pool.query('DELETE FROM sarva.review_issue_event WHERE issue_id IN (SELECT id FROM sarva.review_issue WHERE created_by=ANY($1::bigint[]))',[[admin,reporter,other]]);
 await pool.query('DELETE FROM sarva.review_issue WHERE created_by=ANY($1::bigint[])',[[admin,reporter,other]]);
 await pool.query('DELETE FROM sarva.app_user WHERE id=ANY($1::bigint[])',[[admin,reporter,other]]);
 await new Promise(resolve=>server.close(resolve));await pool.end();
});
test('anonymous, expired, malformed and inactive accounts cannot access the tracker',async()=>{
 for(const auth of [null,'bad.token',token(reporter,['viewer'],1)])assert.equal((await call('/api/review/issues',auth)).status,401);
 await pool.query('UPDATE sarva.app_user SET is_active=false WHERE id=$1',[other]);assert.equal((await call('/api/review/issues',token(other))).status,401);
 await pool.query('UPDATE sarva.app_user SET is_active=true WHERE id=$1',[other]);
});
test('signed-in user can report an issue and creator comes from verified account',async()=>{
 const bad=await call('/api/review/issues',token(reporter),{...report(),createdBy:admin});assert.equal(bad.status,400);
 const response=await call('/api/review/issues',token(reporter),report());assert.equal(response.status,201);issue=(await response.json()).data.id;
 const row=(await pool.query('SELECT created_by,status FROM sarva.review_issue WHERE id=$1',[issue])).rows[0];assert.equal(String(row.created_by),String(reporter));assert.equal(row.status,'open');
 assert.equal((await detail()).events[0].event_type,'created');
});
test('ordinary users can list only their own issues; admins can see all without exposing credentials',async()=>{
 const owner=await call('/api/review/issues?search='+prefix,token(reporter));assert.equal(owner.headers.get('cache-control'),'no-store');assert.equal((await owner.json()).data.total,1);
 const outsider=await(await call('/api/review/issues?search='+prefix,token(other,['admin']))).json();assert.equal(outsider.data.total,0);assert.equal(outsider.data.isAdmin,false);
 const adminResult=await(await call('/api/review/issues?search='+prefix,token(admin))).json();assert.equal(adminResult.data.total,1);assert.equal(adminResult.data.isAdmin,true);
 const text=JSON.stringify(adminResult);for(const secret of ['password_hash','password_salt','@example.invalid'])assert.ok(!text.includes(secret));
});
test('another user cannot read or comment on a guessed issue ID',async()=>{
 assert.equal((await call('/api/review/issues/'+issue,token(other))).status,404);
 assert.equal((await call('/api/review/issues/'+issue+'/comments',token(other),{note:'Guessing another account report'})).status,404);
});
test('reporter and administrator comments are retained as plain text',async()=>{
 assert.equal((await call('/api/review/issues/'+issue+'/comments',token(reporter),{note:'Tested again: <script>example text</script>'})).status,201);
 assert.equal((await call('/api/review/issues/'+issue+'/comments',token(admin),{note:'Reviewing the reproduction steps.'})).status,201);
 const data=await detail();assert.equal(data.events.length,3);assert.equal(data.events.filter(e=>e.event_type==='reply').length,1);assert.ok(data.events.some(e=>e.note.includes('<script>example text</script>')));
});
test('non-admin reporters receive generic admin replies without administrator names',async()=>{
 const owner=await detail(issue,token(reporter));
 const adminReply=owner.events.find(e=>e.event_type==='reply');assert.equal(adminReply.actor_name,'Admin');
 assert.ok(!JSON.stringify(owner).includes('Synthetic review admin'));
 const adminView=await detail();assert.equal(adminView.events.find(e=>e.event_type==='reply').actor_name,'Synthetic review admin');
});
test('a demoted administrator loses other threads and sees generic names on their own earlier reply',async()=>{
 const ownResponse=await call('/api/review/issues',token(admin),report());assert.equal(ownResponse.status,201);const ownId=(await ownResponse.json()).data.id;
 assert.equal((await call('/api/review/issues/'+ownId+'/comments',token(admin),{note:'An earlier administrator reply on this synthetic report.'})).status,201);
 await pool.query("DELETE FROM sarva.app_user_role WHERE user_id=$1 AND role_id=(SELECT id FROM sarva.auth_role WHERE name='admin')",[admin]);
 const ownAdminReply=await call('/api/review/issues/'+issue,token(admin,['admin']));assert.equal(ownAdminReply.status,404);
 const ownData=await detail(ownId,token(admin,['admin']));assert.equal(ownData.events.find(e=>e.event_type==='reply').actor_name,'Admin');
 await pool.query("INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name='admin'",[admin]);
});
test('only current administrators can review, even when a user token claims admin',async()=>{
 const draft=await review();
 assert.equal((await call('/api/review/issues/'+issue,token(reporter,['admin']),draft,'PATCH')).status,403);
 await pool.query("DELETE FROM sarva.app_user_role WHERE user_id=$1 AND role_id=(SELECT id FROM sarva.auth_role WHERE name='admin')",[admin]);
 assert.equal((await call('/api/review/issues/'+issue,token(admin,['admin']),draft,'PATCH')).status,403);
 await pool.query("INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name='admin'",[admin]);
});
test('review, resolution and reopening preserve earlier fixes and comments',async()=>{
 assert.equal((await call('/api/review/issues/'+issue,token(admin),await review(),'PATCH')).status,200);
 let data=await detail();assert.equal(data.issue.status,'in-review');
 assert.equal((await call('/api/review/issues/'+issue,token(admin),await review('resolved',{note:'Fixed the layer path and verified map loading.'}),'PATCH')).status,200);
 data=await detail();assert.equal(data.issue.status,'resolved');assert.ok(data.issue.resolved_at);assert.equal(data.issue.resolution,'Fixed the layer path and verified map loading.');
 assert.equal((await call('/api/review/issues/'+issue,token(admin),await review('open',{kind:'update',note:'Reopened after a follow-up test found another affected page.'}),'PATCH')).status,200);
 data=await detail();assert.equal(data.issue.status,'open');assert.equal(data.issue.resolution,'');assert.equal(data.issue.resolved_at,null);
 assert.ok(data.events.some(e=>e.note==='Fixed the layer path and verified map loading.'));assert.equal(data.events.filter(e=>['comment','reply'].includes(e.event_type)).length,2);
});
test('invalid input and private query-string page paths are rejected',async()=>{
 for(const change of [{title:'x'},{description:'short'},{kind:'admin'},{priority:'urgent'},{pagePath:'https://example.invalid/'},{pagePath:'/search?password=secret'},{pagePath:'//example.invalid'}])assert.equal((await call('/api/review/issues',token(reporter),{...report(),...change})).status,400);
 assert.equal((await call('/api/review/issues?page=-1',token(admin))).status,400);
 assert.equal((await call('/api/review/issues?status=deleted',token(admin))).status,400);
 assert.equal((await call('/api/review/issues/'+issue,token(admin),await review('resolved',{note:''}),'PATCH')).status,400);
});
test('stale reviewer draft cannot overwrite a newer decision',async()=>{
 const draft=await review();assert.equal((await call('/api/review/issues/'+issue,token(admin),draft,'PATCH')).status,200);
 assert.equal((await call('/api/review/issues/'+issue,token(admin),draft,'PATCH')).status,409);
});
test('an audit failure rolls back both issue creation and a review change',async()=>{
 const old=(await pool.query('SELECT count(*) FROM sarva.review_issue WHERE created_by=$1',[reporter])).rows[0].count;
 assert.equal((await call('/failure/review/issues',token(reporter),report())).status,500);
 assert.equal((await pool.query('SELECT count(*) FROM sarva.review_issue WHERE created_by=$1',[reporter])).rows[0].count,old);
 const before=(await detail()).issue;assert.equal((await call('/failure/review/issues/'+issue,token(admin),await review('resolved'),'PATCH')).status,500);assert.deepEqual((await detail()).issue,before);
});
