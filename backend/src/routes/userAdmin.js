import crypto from 'node:crypto';
import {Router} from 'express';
import {pool} from '../db/pool.js';
import {currentAdmin} from '../utils/currentAdmin.js';

const fields=`u.id,u.display_name,u.email,u.is_active,u.access_revision,u.created_at,u.last_login_at,
 COALESCE((SELECT json_agg(r.name ORDER BY r.name) FROM sarva.app_user_role ur JOIN sarva.auth_role r ON r.id=ur.role_id WHERE ur.user_id=u.id),'[]') AS roles`;
function fail(status,message){return Object.assign(new Error(message),{status});}
function passwordMatches(password,user){
 const actual=crypto.pbkdf2Sync(password,user.password_salt,120000,64,'sha512');
 const expected=Buffer.from(user.password_hash,'hex');
 return actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
}
export function createUserAdminRouter(db=pool){
 const router=Router();
 router.use('/admin/users',currentAdmin(db),(req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/admin/users',async(req,res)=>{
  try{
   const search=String(req.query.search || '').trim();
   const page=Number(req.query.page || 1);
   if(search.length>150 || !Number.isSafeInteger(page) || page<1 || page>100000) throw fail(400,'Invalid search or page');
   const args=[search];
   const where=`WHERE $1='' OR position(lower($1) in lower(u.display_name))>0 OR position(lower($1) in lower(u.email))>0`;
   const count=await db.query(`SELECT count(*)::integer AS total FROM sarva.app_user u ${where}`,args);
   const users=await db.query(`SELECT ${fields} FROM sarva.app_user u ${where} ORDER BY lower(u.email),u.id LIMIT 25 OFFSET $2`,[search,(page-1)*25]);
   const roles=await db.query('SELECT name,label,description FROM sarva.auth_role ORDER BY name');
   res.json({data:{users:users.rows,roles:roles.rows,total:count.rows[0].total,page,pageSize:25}});
  }catch(error){res.status(error.status || 500).json({message:error.status?error.message:'Unable to load accounts'});}
 });
 router.get('/admin/users/:id/history',async(req,res)=>{
  if(!/^[1-9][0-9]*$/.test(req.params.id)) return res.status(400).json({message:'Invalid account'});
  try{
   const result=await db.query(`SELECT a.id,a.created_at,a.reason,a.before_access,a.after_access,
    u.display_name AS actor_name FROM sarva.user_access_audit a JOIN sarva.app_user u ON u.id=a.actor_user_id
    WHERE a.target_user_id=$1 ORDER BY a.id DESC LIMIT 50`,[req.params.id]);
   res.json({data:result.rows});
  }catch{res.status(500).json({message:'Unable to load access history'});}
 });
 const attempts=new Map();
 router.post('/admin/users/:id',async(req,res)=>{
  const body=req.body || {};
  const roles=body.roles;
  if(!/^[1-9][0-9]*$/.test(req.params.id) || !Array.isArray(roles) || roles.length<1 || roles.length>20 ||
   roles.some(r=>typeof r!=='string' || r.length>60) || new Set(roles).size!==roles.length ||
   typeof body.isActive!=='boolean' || !Number.isSafeInteger(body.revision) || body.revision<1 ||
   typeof body.reason!=='string' || body.reason.trim().length<5 || body.reason.length>500 ||
   typeof body.currentPassword!=='string' || body.currentPassword.length>1024 ||
   Object.keys(body).some(k=>!['roles','isActive','revision','reason','currentPassword'].includes(k)))
   return res.status(400).json({message:'Select at least one valid role, an account status and a reason (5–500 characters).'});
  const now=Date.now(),actorId=req.authUser.sub;
  for(const [key,value] of attempts) if(value.until<now) attempts.delete(key);
  const attempt=attempts.get(actorId) || {count:0,until:now+60000};
  if(++attempt.count>10){res.set('Retry-After','60');return res.status(429).json({message:'Too many changes. Try again in a minute.'});}
  attempts.set(actorId,attempt);
  const client=await db.connect();
  try{
   await client.query('BEGIN');
   // Serialize access changes so two administrators cannot remove the last admin concurrently.
   await client.query('SELECT pg_advisory_xact_lock(72491059)');
   const actor=(await client.query(`SELECT u.password_hash,u.password_salt FROM sarva.app_user u
    WHERE u.id=$1 AND u.is_active AND EXISTS(SELECT 1 FROM sarva.app_user_role ur JOIN sarva.auth_role r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='admin') FOR UPDATE`,[actorId])).rows[0];
   if(!actor) throw fail(403,'Administrator access required');
   if(!passwordMatches(body.currentPassword,actor)) throw fail(403,'Your current SARVA password is incorrect');
   const target=(await client.query(`SELECT ${fields} FROM sarva.app_user u WHERE u.id=$1 FOR UPDATE`,[req.params.id])).rows[0];
   if(!target) throw fail(404,'Account not found');
   if(target.access_revision!==body.revision) throw fail(409,'This account changed. Refresh and review it again.');
   const valid=await client.query('SELECT id,name FROM sarva.auth_role WHERE name=ANY($1::text[])',[roles]);
   if(valid.rowCount!==roles.length) throw fail(400,'Unknown role selected');
   if(String(target.id)===actorId && (!body.isActive || !roles.includes('admin'))) throw fail(409,'You cannot deactivate yourself or remove your own administrator role. Ask another administrator.');
   if(target.is_active && target.roles.includes('admin') && (!body.isActive || !roles.includes('admin'))){
    const others=await client.query(`SELECT u.id FROM sarva.app_user u WHERE u.is_active AND u.id<>$1
     AND EXISTS(SELECT 1 FROM sarva.app_user_role ur JOIN sarva.auth_role r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='admin')`,[target.id]);
    if(!others.rowCount) throw fail(409,'At least one active administrator must remain.');
   }
   const before={roles:target.roles,isActive:target.is_active};
   const after={roles:[...roles].sort(),isActive:body.isActive};
   if(JSON.stringify(before)===JSON.stringify(after)) throw fail(400,'No access changes to save');
   await client.query('DELETE FROM sarva.app_user_role WHERE user_id=$1',[target.id]);
   await client.query('INSERT INTO sarva.app_user_role(user_id,role_id) SELECT $1,id FROM sarva.auth_role WHERE name=ANY($2::text[])',[target.id,roles]);
   await client.query('UPDATE sarva.app_user SET is_active=$2,access_revision=access_revision+1,updated_at=now() WHERE id=$1',[target.id,body.isActive]);
   await client.query('INSERT INTO sarva.user_access_audit(actor_user_id,target_user_id,before_access,after_access,reason) VALUES($1,$2,$3,$4,$5)',[actorId,target.id,JSON.stringify(before),JSON.stringify(after),body.reason.trim()]);
   await client.query('COMMIT');
   res.json({message:'Account access updated',data:{id:target.id,revision:target.access_revision+1}});
  }catch(error){
   await client.query('ROLLBACK');
   res.status(error.status || 500).json({message:error.status?error.message:'Unable to save account access'});
  }finally{client.release();}
 });
 return router;
}
export const userAdminRouter=createUserAdminRouter();
