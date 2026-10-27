import {Router} from 'express';
import {pool} from '../db/pool.js';
import {currentAccount} from '../utils/currentAccount.js';

const kinds=['bug','update','comment'],statuses=['open','in-review','resolved'],priorities=['low','normal','high'];
const issueFields=`i.id,i.title,i.kind,i.description,i.page_path,i.priority,i.status,i.resolution,i.revision,i.created_at,i.updated_at,i.resolved_at,u.display_name AS reporter_name`;
const fail=(status,message)=>Object.assign(new Error(message),{status});
const isId=value=>/^[1-9][0-9]*$/.test(String(value));
const validText=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
export function createReviewIssuesRouter(db=pool){
 const router=Router(),rates=new Map();
 router.use('/review/issues',currentAccount(db));
 function limit(req,res,next){
  const now=Date.now();for(const [key,value] of rates)if(value.until<now)rates.delete(key);
  const id=req.reviewUser.id,entry=rates.get(id)||{count:0,until:now+60000};rates.set(id,entry);
  if(++entry.count>30){res.set('Retry-After','60');return res.status(429).json({message:'Too many updates. Please wait a minute.'});}next();
 }
 async function freshActor(client,id){
  const result=await client.query(`SELECT u.id,EXISTS(SELECT 1 FROM sarva.app_user_role ur JOIN sarva.auth_role r ON r.id=ur.role_id
   WHERE ur.user_id=u.id AND r.name='admin') AS is_admin FROM sarva.app_user u WHERE u.id=$1 AND u.is_active FOR SHARE`,[id]);
  if(!result.rowCount)throw fail(401,'Your account is no longer active');
  return {id:String(result.rows[0].id),isAdmin:result.rows[0].is_admin};
 }
 function visible(issue,actor){if(!issue || (!actor.isAdmin && String(issue.created_by)!==actor.id))throw fail(404,'Issue not found');}
 router.get('/review/issues',async(req,res)=>{
  try{
   const search=String(req.query.search || '').trim(),status=String(req.query.status || ''),kind=String(req.query.kind || ''),page=Number(req.query.page || 1);
   if(search.length>150 || (status&&!statuses.includes(status)) || (kind&&!kinds.includes(kind)) || !Number.isSafeInteger(page)||page<1||page>100000)throw fail(400,'Invalid issue filters');
   const args=[req.reviewUser.isAdmin,req.reviewUser.id,search,status,kind];
   const where=`WHERE ($1 OR i.created_by=$2) AND ($3='' OR position(lower($3) in lower(i.title))>0 OR position(lower($3) in lower(i.description))>0)
    AND ($4='' OR i.status=$4) AND ($5='' OR i.kind=$5)`;
   const count=await db.query(`SELECT count(*)::integer AS total FROM sarva.review_issue i ${where}`,args);
   const result=await db.query(`SELECT ${issueFields} FROM sarva.review_issue i JOIN sarva.app_user u ON u.id=i.created_by ${where} ORDER BY i.updated_at DESC,i.id DESC LIMIT 25 OFFSET $6`,[...args,(page-1)*25]);
   const counts=await db.query(`SELECT status,count(*)::integer AS count FROM sarva.review_issue WHERE $1 OR created_by=$2 GROUP BY status`,[req.reviewUser.isAdmin,req.reviewUser.id]);
   res.json({data:{issues:result.rows,total:count.rows[0].total,page,pageSize:25,counts:counts.rows,isAdmin:req.reviewUser.isAdmin}});
  }catch(error){res.status(error.status||500).json({message:error.status?error.message:'Unable to load testing issues'});}
 });
 router.get('/review/issues/:id',async(req,res)=>{
  if(!isId(req.params.id))return res.status(400).json({message:'Invalid issue'});
  try{
   const issue=(await db.query(`SELECT ${issueFields},i.created_by FROM sarva.review_issue i JOIN sarva.app_user u ON u.id=i.created_by WHERE i.id=$1`,[req.params.id])).rows[0];visible(issue,req.reviewUser);
   const page=Number(req.query.page || 1);if(!Number.isSafeInteger(page)||page<1||page>100000)throw fail(400,'Invalid history page');
   const events=await db.query(`SELECT e.id,e.event_type,e.note,e.changes,e.created_at,CASE WHEN $3 THEN u.display_name WHEN e.event_type IN ('reply','review') THEN 'Admin' WHEN e.actor_user_id=$4 THEN u.display_name ELSE 'Admin' END AS actor_name FROM sarva.review_issue_event e
    JOIN sarva.app_user u ON u.id=e.actor_user_id WHERE e.issue_id=$1 ORDER BY e.id DESC LIMIT 50 OFFSET $2`,[issue.id,(page-1)*50,req.reviewUser.isAdmin,req.reviewUser.id]);
   const total=(await db.query('SELECT count(*)::integer AS total FROM sarva.review_issue_event WHERE issue_id=$1',[issue.id])).rows[0].total;
   delete issue.created_by;
   res.json({data:{issue,events:events.rows.reverse(),historyTotal:total,historyPage:page,isAdmin:req.reviewUser.isAdmin}});
  }catch(error){res.status(error.status||500).json({message:error.status?error.message:'Unable to load issue'});}
 });
 router.post('/review/issues',limit,async(req,res)=>{
  const b=req.body||{};
  if(!validText(b.title,3,180)||!validText(b.description,10,10000)||!kinds.includes(b.kind)||!priorities.includes(b.priority)||
   typeof b.pagePath!=='string'||(b.pagePath!==''&&!/^\/(?!\/)[^?#\s]{0,200}$/.test(b.pagePath))||
   Object.keys(b).some(k=>!['title','description','kind','priority','pagePath'].includes(k)))return res.status(400).json({message:'Enter a title, description, type and priority. Page paths must start with / and omit query strings.'});
  const client=await db.connect();
  try{
   await client.query('BEGIN');const actor=await freshActor(client,req.reviewUser.id);
   const issue=(await client.query(`INSERT INTO sarva.review_issue(title,description,kind,priority,page_path,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[b.title.trim(),b.description.trim(),b.kind,b.priority,b.pagePath,actor.id])).rows[0];
   await client.query(`INSERT INTO sarva.review_issue_event(issue_id,actor_user_id,event_type,note) VALUES($1,$2,'created','Issue reported')`,[issue.id,actor.id]);
   await client.query('COMMIT');res.status(201).json({data:issue,message:'Issue reported'});
  }catch(error){await client.query('ROLLBACK');res.status(error.status||500).json({message:error.status?error.message:'Unable to report issue'});}finally{client.release();}
 });
 router.post('/review/issues/:id/comments',limit,async(req,res)=>{
  if(!isId(req.params.id)||!validText(req.body?.note,1,10000)||Object.keys(req.body).some(k=>k!=='note'))return res.status(400).json({message:'Enter a comment (up to 10,000 characters)'});
  const client=await db.connect();
  try{
   await client.query('BEGIN');const actor=await freshActor(client,req.reviewUser.id);
   const issue=(await client.query('SELECT id,created_by FROM sarva.review_issue WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];visible(issue,actor);
   await client.query(`INSERT INTO sarva.review_issue_event(issue_id,actor_user_id,event_type,note) VALUES($1,$2,$3,$4)`,[issue.id,actor.id,actor.isAdmin?'reply':'comment',req.body.note.trim()]);
   await client.query('UPDATE sarva.review_issue SET updated_at=now() WHERE id=$1',[issue.id]);
   await client.query('COMMIT');res.status(201).json({message:'Comment added'});
  }catch(error){await client.query('ROLLBACK');res.status(error.status||500).json({message:error.status?error.message:'Unable to add comment'});}finally{client.release();}
 });
 router.patch('/review/issues/:id',limit,async(req,res)=>{
  if(!req.reviewUser.isAdmin)return res.status(403).json({message:'Only administrators can change review status'});
  const b=req.body||{};
  if(!isId(req.params.id)||!statuses.includes(b.status)||!kinds.includes(b.kind)||!priorities.includes(b.priority)||!Number.isSafeInteger(b.revision)||b.revision<1||!validText(b.note,5,5000)||
   Object.keys(b).some(k=>!['status','kind','priority','revision','note'].includes(k)))return res.status(400).json({message:'Choose a valid status, type and priority, and add review or fix notes (5–5,000 characters)'});
  const client=await db.connect();
  try{
   await client.query('BEGIN');const actor=await freshActor(client,req.reviewUser.id);if(!actor.isAdmin)throw fail(403,'Administrator access required');
   const issue=(await client.query('SELECT * FROM sarva.review_issue WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!issue)throw fail(404,'Issue not found');
   if(issue.revision!==b.revision)throw fail(409,'Another reviewer updated this issue. Refresh before saving.');
   const before={status:issue.status,kind:issue.kind,priority:issue.priority};
   const after={status:b.status,kind:b.kind,priority:b.priority};
   await client.query(`UPDATE sarva.review_issue SET status=$2,kind=$3,priority=$4,revision=revision+1,updated_at=now(),
    resolution=CASE WHEN $2='resolved' THEN $5 ELSE '' END,resolved_at=CASE WHEN $2='resolved' THEN now() ELSE NULL END WHERE id=$1`,[issue.id,b.status,b.kind,b.priority,b.note.trim()]);
   await client.query(`INSERT INTO sarva.review_issue_event(issue_id,actor_user_id,event_type,note,changes) VALUES($1,$2,'review',$3,$4)`,[issue.id,actor.id,b.note.trim(),JSON.stringify({before,after})]);
   await client.query('COMMIT');res.json({message:'Review saved'});
  }catch(error){await client.query('ROLLBACK');res.status(error.status||500).json({message:error.status?error.message:'Unable to save review'});}finally{client.release();}
 });
 return router;
}
export const reviewIssuesRouter=createReviewIssuesRouter();
