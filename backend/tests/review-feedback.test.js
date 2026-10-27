import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {once} from 'node:events';
import express from 'express';
import {pool} from '../src/db/pool.js';
import {createReviewIssuesRouter} from '../src/routes/reviewIssues.js';
if(process.env.REVIEW_ISSUES_TEST!=='synthetic-only')throw Error('Use only the isolated synthetic database');
const prefix='feedback-'+crypto.randomUUID();let owner,other,admin,id;
function token(sub){const data=Buffer.from(JSON.stringify({sub:String(sub),roles:['admin','viewer'],exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return data+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(data).digest('base64url');}
const app=express();app.use(express.json());app.use('/api',createReviewIssuesRouter());const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port+'/api/review/issues';
async function call(user,path='',body,method){return fetch(base+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+token(user)}:{})},...(body?{body:JSON.stringify(body)}:{})});}
const draft=()=>({title:prefix+' question about a map',kind:'question',priority:'normal',description:'How can I compare the layers shown in this map?',contactName:'Synthetic tester',contactEmail:'tester@example.invalid'});
before(async()=>{for(const name of ['owner','other','admin']){const uid=(await pool.query(`INSERT INTO sarva.app_user(email,display_name,password_hash,password_salt) VALUES($1,$2,'not-a-login','not-a-login') RETURNING id`,[prefix+name+'@example.invalid','Synthetic '+name])).rows[0].id;await pool.query('INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name=$2',[uid,name==='admin'?'admin':'viewer']);if(name==='owner')owner=uid;else if(name==='admin')admin=uid;else other=uid;}});
after(async()=>{await pool.query('DELETE FROM sarva.review_issue_event WHERE issue_id IN (SELECT id FROM sarva.review_issue WHERE created_by=$1)',[owner]);await pool.query('DELETE FROM sarva.review_issue WHERE created_by=$1',[owner]);await pool.query('DELETE FROM sarva.app_user WHERE id=ANY($1::bigint[])',[[owner,other,admin]]);await new Promise(resolve=>server.close(resolve));await pool.end();});
test('a registered viewer can ask a question with optional private contact details',async()=>{
 assert.equal((await call(null,'',draft())).status,401);
 const response=await call(owner,'',draft());assert.equal(response.status,201);id=(await response.json()).data.id;
 for(const actor of [owner,admin]){const d=(await(await call(actor,'/'+id)).json()).data;assert.equal(d.issue.kind,'question');assert.equal(d.issue.contact_email,'tester@example.invalid');assert.equal(d.issue.contact_name,'Synthetic tester');}
 assert.equal((await call(other,'/'+id)).status,404);
 const stranger=await(await call(other,'?search='+prefix)).json();assert.equal(stranger.data.total,0);assert.ok(!JSON.stringify(stranger).includes('tester@example.invalid'));
});
test('administrator replies to a question without exposing admin identity to the reporter',async()=>{
 assert.equal((await call(admin,'/'+id+'/comments',{note:'Open the layer selector and choose the comparison layer.'})).status,201);
 const d=(await(await call(owner,'/'+id)).json()).data;assert.equal(d.events.find(e=>e.event_type==='reply').actor_name,'Admin');
 assert.ok(d.events.some(e=>e.note.includes('comparison layer')));
});
test('feedback needs no contact details and invalid emails are rejected',async()=>{
 assert.equal((await call(owner,'',{...draft(),contactEmail:'not-an-email'})).status,400);
 assert.equal((await call(owner,'',{...draft(),contactName:'x'.repeat(101)})).status,400);
 const response=await call(owner,'',{...draft(),kind:'feedback',contactName:'',contactEmail:''});assert.equal(response.status,201);
 const fid=(await response.json()).data.id;const d=(await(await call(owner,'/'+fid)).json()).data;assert.equal(d.issue.kind,'feedback');assert.equal(d.issue.contact_email,'');
 const edited=await call(owner,'/'+id+'/content',{...draft(),contactName:'Updated tester',contactEmail:'followup@example.invalid',revision:1},'PATCH');assert.equal(edited.status,200);
 const changed=(await(await call(owner,'/'+id)).json()).data;assert.equal(changed.issue.contact_email,'followup@example.invalid');assert.ok(changed.events.some(e=>e.event_type==='edited'));
});
