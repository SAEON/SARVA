import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {once} from 'node:events';
import express from 'express';
import {pool} from '../src/db/pool.js';
import {createReviewIssuesRouter} from '../src/routes/reviewIssues.js';
if(process.env.REVIEW_ISSUES_TEST!=='synthetic-only')throw Error('Use the isolated synthetic database');
const prefix='manage-'+crypto.randomUUID();let owner,other,admin,admin2,id;
const token=(sub)=>{const data=Buffer.from(JSON.stringify({sub:String(sub),roles:['admin','viewer'],exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return data+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(data).digest('base64url');};
const app=express();app.use(express.json());app.use('/api',createReviewIssuesRouter());
const failing={query:pool.query.bind(pool),connect:async()=>{const c=await pool.connect();return {release:()=>c.release(),query:(sql,args)=>String(sql).startsWith('INSERT INTO sarva.review_issue_event')?Promise.reject(Error('Synthetic audit failure')):c.query(sql,args)};}};
app.use('/failure',createReviewIssuesRouter(failing));
app.use('/unavailable',createReviewIssuesRouter({query:pool.query.bind(pool),connect:async()=>{throw Object.assign(Error('Synthetic unavailable pool'),{code:'TEST_UNAVAILABLE'});}}));
app.use('/broken-rollback',createReviewIssuesRouter({query:pool.query.bind(pool),connect:async()=>({query:async()=>{throw Object.assign(Error('Synthetic failed transaction'),{code:'TEST_TRANSACTION'});},release:error=>{assert.ok(error);}})}));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
async function call(user,path='',method='GET',body,root='/api'){return fetch(base+root+'/review/issues'+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+token(user)}:{})},...(body?{body:JSON.stringify(body)}:{})});}
async function detail(user=owner){const response=await call(user,'/'+id);assert.equal(response.status,200);return (await response.json()).data;}
const content=()=>({title:prefix+' edited card issue',description:'A synthetic report with clear reproduction details.',kind:'bug',priority:'normal',pagePath:'https://sarva.saeon.ac.za/overview?token=not-saved'});
before(async()=>{
 for(const name of ['owner','other','admin','admin2']){
  const uid=(await pool.query(`INSERT INTO sarva.app_user(email,display_name,password_hash,password_salt) VALUES($1,$2,'not-a-login','not-a-login') RETURNING id`,[prefix+name+'@example.invalid','Synthetic '+name])).rows[0].id;
  await pool.query('INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name=$2',[uid,name.startsWith('admin')?'admin':'viewer']);
  if(name==='owner')owner=uid;else if(name==='admin')admin=uid;else if(name==='admin2')admin2=uid;else other=uid;
 }
 const response=await call(owner,'','POST',content());assert.equal(response.status,201);id=(await response.json()).data.id;
});
after(async()=>{
 await pool.query('DELETE FROM sarva.review_issue_event WHERE issue_id=$1',[id]);await pool.query('DELETE FROM sarva.review_issue WHERE id=$1',[id]);
 await pool.query('DELETE FROM sarva.app_user WHERE id=ANY($1::bigint[])',[[owner,other,admin,admin2]]);
 await new Promise(resolve=>server.close(resolve));await pool.end();
});
test('only the owner or current admin can edit, delete or restore reports',async()=>{
 const draft={...content(),revision:1};
 assert.equal((await call(null,'/'+id+'/content','PATCH',draft)).status,401);
 assert.equal((await call(other,'/'+id+'/content','PATCH',draft)).status,404);
 assert.equal((await call(other,'/'+id,'DELETE',{revision:1,note:'An unauthorized delete attempt'})).status,404);
 assert.equal((await call(other,'/'+id+'/restore','POST',{revision:1,note:'An unauthorized restore attempt'})).status,404);
 assert.equal((await call(owner,'/'+id+'/content','PATCH',draft)).status,200);
 const data=await detail();assert.equal(data.issue.page_path,'/overview');assert.equal(data.issue.revision,2);assert.equal(data.issue.status,'open');assert.ok(data.events.some(e=>e.event_type==='edited'));
 assert.equal((await call(owner,'/'+id+'/content','PATCH',draft)).status,409);
});
test('administrator resolves with fix notes; ordinary users cannot resolve',async()=>{
 const review={status:'resolved',kind:'bug',priority:'normal',revision:2,note:'Fixed the link and checked that the target opens.'};
 assert.equal((await call(owner,'/'+id,'PATCH',review)).status,403);
 assert.equal((await call(admin,'/'+id,'PATCH',{...review,note:''})).status,400);
 assert.equal((await call(admin,'/'+id,'PATCH',review)).status,200);
 const d=await detail();assert.equal(d.issue.status,'resolved');assert.ok(d.issue.resolved_at);assert.equal(d.issue.resolution,review.note);
 assert.equal((await call(admin,'/'+id,'PATCH',review)).status,409);
});
test('delete hides the report, retains history and prevents mutations until restored',async()=>{
 assert.equal((await call(owner,'/'+id,'DELETE',{revision:3,note:'Duplicate report, retained for reference.'})).status,200);
 const active=await(await call(owner,'?search='+prefix)).json();assert.equal(active.data.total,0);
 const archived=await(await call(owner,'?search='+prefix+'&archived=true')).json();assert.equal(archived.data.total,1);assert.ok(archived.data.issues[0].deleted_at);
 const outsider=await(await call(other,'?search='+prefix+'&archived=true')).json();assert.equal(outsider.data.total,0);
 const d=await detail();assert.equal(d.issue.status,'resolved');assert.ok(d.events.some(e=>e.event_type==='deleted'));
 assert.equal((await call(owner,'/'+id+'/comments','POST',{note:'Not allowed while deleted'})).status,404);
 assert.equal((await call(owner,'/'+id+'/content','PATCH',{...content(),revision:4})).status,404);
 assert.equal((await call(admin,'/'+id,'PATCH',{status:'open',kind:'bug',priority:'normal',revision:4,note:'Not allowed while deleted'})).status,404);
 assert.equal((await call(owner,'/'+id+'/restore','POST',{revision:3,note:'An old stale restore request'})).status,409);
 assert.equal((await call(owner,'/'+id+'/restore','POST',{revision:4,note:'Restore the original report for verification.'})).status,200);
 const restored=await detail();assert.equal(restored.issue.deleted_at,null);assert.equal(restored.issue.status,'resolved');assert.equal(restored.issue.revision,5);assert.ok(restored.events.some(e=>e.event_type==='restored'));
 assert.equal((await call(admin,'/'+id+'/content','PATCH',{...content(),revision:5})).status,200);
});
test('audit failures roll back content edits and deletion',async()=>{
 const before=(await detail()).issue;
 assert.equal((await call(owner,'/'+id+'/content','PATCH',{...content(),title:'Must not be saved',revision:before.revision},'/failure')).status,500);
 assert.deepEqual((await detail()).issue,before);
 assert.equal((await call(admin,'/'+id,'DELETE',{revision:before.revision,note:'Must not delete without audit history'},'/failure')).status,500);
 assert.deepEqual((await detail()).issue,before);
});
test('revoked admin cannot manage another account report using a stale admin token',async()=>{
 await pool.query("DELETE FROM sarva.app_user_role WHERE user_id=$1 AND role_id=(SELECT id FROM sarva.auth_role WHERE name='admin')",[admin]);
 const revision=(await detail()).issue.revision;
 assert.equal((await call(admin,'/'+id+'/content','PATCH',{...content(),revision})).status,404);
 assert.equal((await call(admin,'/'+id,'DELETE',{revision,note:'A revoked admin cannot delete'})).status,404);
});

test('admins assign active admins, filter their work, and protect names from reporters',async()=>{
 await pool.query("INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name='admin'",[admin]);
 assert.equal((await call(owner,'/assignment-options')).status,403);
 const options=await(await call(admin,'/assignment-options')).json();assert.ok(options.data.admins.some(u=>String(u.id)===String(admin2)));
 let revision=(await detail()).issue.revision;
 assert.equal((await call(owner,'/'+id+'/assignment','PATCH',{revision,assignedTo:admin2})).status,403);
 assert.equal((await call(admin,'/'+id+'/assignment','PATCH',{revision,assignedTo:owner})).status,400);
 assert.equal((await call(admin,'/'+id+'/assignment','PATCH',{revision,assignedTo:admin2})).status,200);
 assert.equal((await call(admin,'/'+id+'/assignment','PATCH',{revision,assignedTo:null})).status,409);
 const owned=await detail();assert.equal(owned.issue.assignment_status,'Assigned to admin');assert.ok(!Object.hasOwn(owned.issue,'assigned_to'));assert.ok(!Object.hasOwn(owned.issue,'assignee_name'));
 const event=owned.events.find(e=>e.event_type==='assigned');assert.equal(event.actor_name,'Admin');assert.deepEqual(event.changes,{});assert.ok(!JSON.stringify(owned).includes('Synthetic admin2'));
 const adminView=await detail(admin);assert.equal(String(adminView.issue.assigned_to),String(admin2));assert.equal(adminView.issue.assignee_name,'Synthetic admin2');
 const mine=await(await call(admin2,'?assigned=mine&search='+prefix)).json();assert.equal(mine.data.total,1);
 assert.equal((await call(owner,'?assigned=mine')).status,403);
 revision=adminView.issue.revision;
 assert.equal((await call(admin,'/'+id+'/assignment','PATCH',{revision,assignedTo:null})).status,200);
 assert.equal((await detail()).issue.assignment_status,'Unassigned');
 const unassigned=await(await call(admin,'?assigned=unassigned&search='+prefix)).json();assert.equal(unassigned.data.total,1);
});
test('assignment rejects inactive admins and rolls back on history failure',async()=>{
 const revision=(await detail()).issue.revision;
 await pool.query('UPDATE sarva.app_user SET is_active=false WHERE id=$1',[admin2]);
 assert.equal((await call(admin,'/'+id+'/assignment','PATCH',{revision,assignedTo:admin2})).status,400);
 await pool.query('UPDATE sarva.app_user SET is_active=true WHERE id=$1',[admin2]);
 const before=(await detail(admin)).issue;
 assert.equal((await call(admin,'/'+id+'/assignment','PATCH',{revision,assignedTo:admin2},'/failure')).status,500);
 assert.deepEqual((await detail(admin)).issue,before);
});

test('assignment connection failures return JSON and leave the report unchanged',async()=>{
 const before=(await detail(admin)).issue;
 const response=await call(admin,'/'+id+'/assignment','PATCH',{revision:before.revision,assignedTo:admin2},'/unavailable');
 assert.equal(response.status,503);assert.match(response.headers.get('content-type'),/application\/json/);
 assert.match((await response.json()).message,/Refresh the issue/);
 assert.deepEqual((await detail(admin)).issue,before);
});


test('second administrator assigns, reloads, reassigns and unassigns another user report',async()=>{
 const options=await(await call(admin2,'/assignment-options')).json();
 assert.ok(options.data.admins.some(u=>String(u.id)===String(admin)));
 let issue=(await detail(admin2)).issue;
 let response=await call(admin2,'/'+id+'/assignment','PATCH',{revision:issue.revision,assignedTo:String(admin)});
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);
 assert.ok(await response.json());
 issue=(await detail(admin2)).issue;
 assert.equal(String(issue.assigned_to),String(admin));
 assert.equal(String((await detail(admin)).issue.assigned_to),String(admin));
 response=await call(admin2,'/'+id+'/assignment','PATCH',{revision:issue.revision,assignedTo:String(admin2)});
 assert.equal(response.status,200);await response.json();
 issue=(await detail(admin2)).issue;assert.equal(String(issue.assigned_to),String(admin2));
 response=await call(admin2,'/'+id+'/assignment','PATCH',{revision:issue.revision,assignedTo:null});
 assert.equal(response.status,200);await response.json();
 assert.equal((await detail(admin2)).issue.assignment_status,'Unassigned');
});


test('assignment rollback failures still return JSON and discard the broken connection',async()=>{
 const before=(await detail(admin)).issue;
 const response=await call(admin,'/'+id+'/assignment','PATCH',{revision:before.revision,assignedTo:admin2},'/broken-rollback');
 assert.equal(response.status,500);assert.match(response.headers.get('content-type'),/application\/json/);
 assert.match((await response.json()).message,/Refresh the issue/);
 assert.deepEqual((await detail(admin)).issue,before);
});


test('POST assignment uses the same permissions, revisions and audit trail as PATCH',async()=>{
 let issue=(await detail(admin2)).issue;
 const body={revision:issue.revision,assignedTo:String(admin)};
 assert.equal((await call(null,'/'+id+'/assignment','POST',body)).status,401);
 assert.equal((await call(owner,'/'+id+'/assignment','POST',body)).status,403);
 assert.equal((await call(admin2,'/'+id+'/assignment','POST',{...body,assignedTo:owner})).status,400);
 assert.equal((await call(admin2,'/'+id+'/assignment','POST',body)).status,200);
 const saved=await detail(admin2);assert.equal(String(saved.issue.assigned_to),String(admin));
 const event=(await pool.query("SELECT actor_user_id,changes FROM sarva.review_issue_event WHERE issue_id=$1 AND event_type='assigned' ORDER BY id DESC LIMIT 1",[id])).rows[0];
 assert.equal(String(event.actor_user_id),String(admin2));assert.equal(String(event.changes.after.assigned_to),String(admin));
 assert.equal((await call(admin2,'/'+id+'/assignment','POST',body)).status,409);
 const before=(await detail(admin2)).issue;
 assert.equal((await call(admin2,'/'+id+'/assignment','POST',{revision:before.revision,assignedTo:null},'/failure')).status,500);
 assert.deepEqual((await detail(admin2)).issue,before);
 assert.equal((await call(admin2,'/'+id+'/assignment','PATCH',{revision:before.revision,assignedTo:null})).status,200);
 assert.equal((await detail(admin2)).issue.assignment_status,'Unassigned');
 issue=(await detail(admin2)).issue;
 const unavailable=await call(admin2,'/'+id+'/assignment','POST',{revision:issue.revision,assignedTo:admin},'/unavailable');
 assert.equal(unavailable.status,503);assert.match(unavailable.headers.get('content-type'),/application\/json/);
});


test('admin creates and assigns atomically; viewers and invalid targets are rejected',async()=>{
 const draft={...content(),title:prefix+' initial assignment',assignedTo:String(admin2)};
 assert.equal((await call(owner,'','POST',draft)).status,403);
 assert.equal((await call(admin,'','POST',{...draft,assignedTo:owner})).status,400);
 await pool.query('UPDATE sarva.app_user SET is_active=false WHERE id=$1',[admin2]);
 assert.equal((await call(admin,'','POST',draft)).status,400);
 await pool.query('UPDATE sarva.app_user SET is_active=true WHERE id=$1',[admin2]);
 const before=(await pool.query('SELECT count(*) FROM sarva.review_issue WHERE title=$1',[draft.title])).rows[0].count;
 assert.equal((await call(admin,'','POST',draft,'/failure')).status,500);
 assert.equal((await pool.query('SELECT count(*) FROM sarva.review_issue WHERE title=$1',[draft.title])).rows[0].count,before);
 for(const assignedTo of [String(admin2),null]){
  const response=await call(admin,'','POST',{...draft,assignedTo});assert.equal(response.status,201);
  const created=(await response.json()).data.id;
  try{
   const row=(await pool.query('SELECT assigned_to,revision FROM sarva.review_issue WHERE id=$1',[created])).rows[0];
   assert.equal(row.assigned_to==null?null:String(row.assigned_to),assignedTo);assert.equal(row.revision,1);
   const events=(await pool.query('SELECT event_type,changes FROM sarva.review_issue_event WHERE issue_id=$1 ORDER BY id',[created])).rows;
   assert.deepEqual(events.map(e=>e.event_type),assignedTo?['created','assigned']:['created']);
   if(assignedTo)assert.equal(String(events[1].changes.after.assigned_to),assignedTo);
  }finally{await pool.query('DELETE FROM sarva.review_issue_event WHERE issue_id=$1',[created]);await pool.query('DELETE FROM sarva.review_issue WHERE id=$1',[created]);}
 }
});
