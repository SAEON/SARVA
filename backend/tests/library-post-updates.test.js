import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {once} from 'node:events';
import {pool} from '../src/db/pool.js';
import {resourcesRouter} from '../src/routes/resources.js';
import {nationalPolicyRouter} from '../src/routes/nationalPolicy.js';
import {glossaryRouter} from '../src/routes/glossary.js';
if(process.env.USER_ADMIN_TEST!=='synthetic-only')throw Error('Isolated synthetic database required');
const prefix='post-library-'+crypto.randomUUID();let admin;
const app=express();app.use(express.json());for(const router of [resourcesRouter,nationalPolicyRouter,glossaryRouter])app.use('/api',router);
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
function token(){const data=Buffer.from(JSON.stringify({sub:String(admin),roles:['admin'],exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return data+'.'+crypto.createHmac('sha256',process.env.AUTH_SECRET).update(data).digest('base64url');}
async function call(path,body,auth=true){return fetch('http://127.0.0.1:'+server.address().port+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token()}:{})},body:JSON.stringify(body)});}
before(async()=>{admin=(await pool.query("INSERT INTO sarva.app_user(email,display_name,password_hash,password_salt) VALUES($1,'Synthetic library administrator','not-a-login','not-a-login') RETURNING id",[prefix+'@example.invalid'])).rows[0].id;await pool.query("INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name='admin'",[admin]);});
after(async()=>{await pool.query('DELETE FROM sarva.app_user WHERE id=$1',[admin]);await new Promise(resolve=>server.close(resolve));await pool.end();});
test('resource, policy and glossary edits persist through POST and reject anonymous edits',async()=>{
 for(const [route,table,field,body] of [
  ['resources','resources','title',{title:prefix,resource_type:'Report',publication_year:'2026'}],
  ['national-policy-legislation','national_policy_legislation','title',{title:prefix,publication_year:'2026',publisher:'Synthetic'}],
  ['glossary','glossary_term','term',{term:prefix,definition:'Synthetic definition'}]]){
  const created=await call(route,body);assert.equal(created.status,201);const id=(await created.json()).data.id;
  try{const changed={...body,[field]:prefix+' updated'};assert.equal((await call(route+'/'+id,changed,false)).status,403);const response=await call(route+'/'+id,changed);assert.equal(response.status,200);assert.equal((await response.json()).data[field],changed[field]);
   const saved=(await pool.query('SELECT '+field+' FROM sarva.'+table+' WHERE id=$1',[id])).rows[0];assert.equal(saved[field],changed[field]);
  }finally{await pool.query('DELETE FROM sarva.'+table+' WHERE id=$1',[id]);}
 }
});
