import express,{Router} from 'express';
import {pool} from '../db/pool.js';
import {currentAccount} from '../utils/currentAccount.js';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
export const centres=['spu','ufs','ufh','ul','wsu'];
const kinds=['paper','dataset','report','tool','case-study','collection'],access=['not-stated','open','on-request','restricted'],MAX=8*1024*1024;
const types={pdf:'application/pdf',csv:'text/csv',txt:'text/plain',json:'application/json',geojson:'application/geo+json',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
const fail=(status,message)=>Object.assign(new Error(message),{status});
const isId=v=>/^[1-9][0-9]{0,17}$/.test(String(v));
export function validateWork(b){
 const text=(key,min,max)=>{const v=b?.[key]??'';if(typeof v!=='string'||v.trim().length<min||v.length>max)throw fail(400,'Check '+key);return v.trim();};
 if(!Array.isArray(b?.centres)||!b.centres.length||b.centres.length>5||b.centres.some(c=>!centres.includes(c)))throw fail(400,'Choose at least one centre');
 if(!kinds.includes(b.kind)||!access.includes(b.dataAccess||'not-stated'))throw fail(400,'Choose a valid type and data access option');
 let year=null;if(b.year!==''&&b.year!==null&&b.year!==undefined){year=Number(b.year);if(!Number.isInteger(year)||year<1900||year>2100)throw fail(400,'Check publication year');}
 let sourceUrl=text('sourceUrl',0,2000);if(sourceUrl){let u;try{u=new URL(sourceUrl);}catch{throw fail(400,'Enter an HTTP or HTTPS source link');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw fail(400,'Enter an HTTP or HTTPS source link');sourceUrl=u.href;}
 return {title:text('title',3,220),description:text('description',10,6000),centres:[...new Set(b.centres)],kind:b.kind,year,authors:text('authors',0,1000),citation:text('citation',0,2000),licence:text('licence',0,300),sourceUrl,dataAccess:b.dataAccess||'not-stated'};
}
export function validateFile(bytes,name){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX)throw fail(400,'Choose a non-empty file up to 8 MB');
 if(typeof name!=='string'||name.length>150||[...name].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127||c==='/'||c.charCodeAt(0)===92))throw fail(400,'Invalid filename');
 const ext=name.split('.').pop().toLowerCase(),type=types[ext];if(!type)throw fail(400,'Allowed: PDF, CSV, TXT, JSON, GeoJSON, PNG and JPEG');
 if(ext==='pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw fail(400,'Invalid PDF');
 if(ext==='png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw fail(400,'Invalid PNG');
 if(['jpg','jpeg'].includes(ext)&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw fail(400,'Invalid JPEG');
 if(['csv','txt','json','geojson'].includes(ext)){let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw fail(400,'Text/data files must use UTF-8');}if(text.includes(String.fromCharCode(0))||['<!doctype','<html','<svg','<script'].some(s=>text.trimStart().toLowerCase().startsWith(s)))throw fail(400,'HTML, SVG and scripts are not accepted');if(['json','geojson'].includes(ext)){let parsed;try{parsed=JSON.parse(text);}catch{throw fail(400,'Invalid JSON');}if(ext==='geojson'&&!['Feature','FeatureCollection','Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon','GeometryCollection'].includes(parsed?.type))throw fail(400,'Invalid GeoJSON');}}
 return type;
}
function clean(row,actor){const r={...row,has_file:Boolean(row.file_key)};delete r.file_key;if(!actor?.canManage&&String(row.created_by)!==actor?.id){delete r.created_by;delete r.review_note;}return r;}
export function createCgcWorkRouter(db=pool,storage=process.env.CGC_UPLOAD_DIR||'/app/uploads/cgc'){
 const router=Router(),account=currentAccount(db),rates=new Map();
 const auth=(req,res,next)=>account(req,res,async()=>{try{
  const roles=(await db.query("SELECT r.name FROM sarva.app_user_role ur JOIN sarva.auth_role r ON r.id=ur.role_id WHERE ur.user_id=$1",[req.reviewUser.id])).rows.map(r=>r.name);
  req.reviewUser.canManage=req.reviewUser.isAdmin||roles.includes('cgc-admin');
  req.reviewUser.canSubmit=req.reviewUser.canManage||roles.includes('cgc-user');
  if(req.method==='POST'&&!req.reviewUser.canSubmit)return res.status(403).json({message:'A CGC user or CGC admin role is required. Ask a SARVA administrator to update your account.'});
  next();
 }catch{res.status(503).json({message:'Unable to verify CGC access'});}});
 router.use('/cgc/work',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
 const attempt=fn=>async(req,res,next)=>{try{await fn(req,res,next);}catch(e){next(e);}};
 const limit=(req,res,next)=>{const now=Date.now();for(const[k,v]of rates)if(v.until<now)rates.delete(k);const k=req.reviewUser.id,v=rates.get(k)||{count:0,until:now+60000};rates.set(k,v);if(++v.count>20)return res.status(429).json({message:'Please wait a minute before submitting more changes'});next();};
 async function locked(c,id,actor,revision){const row=(await c.query('SELECT * FROM sarva.cgc_work WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row||(!actor.canManage&&String(row.created_by)!==actor.id))throw fail(404,'Work not found');if(!Number.isInteger(revision)||revision!==row.revision)throw fail(409,'Work changed. Refresh before saving');return row;}
 async function event(c,r,a,action,note=''){await c.query('INSERT INTO sarva.cgc_work_event(work_id,actor_id,action,note,revision) VALUES($1,$2,$3,$4,$5)',[r.id,a.id,action,note,r.revision]);}
 async function transaction(fn){const c=await db.connect();try{await c.query('BEGIN');const v=await fn(c);await c.query('COMMIT');return v;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const list=scope=>attempt(async(req,res)=>{
  const actor=req.reviewUser;if(scope==='review'&&!actor?.canManage)throw fail(403,'Administrator access required');const centre=String(req.query.centre||''),kind=String(req.query.kind||''),search=String(req.query.search||'').trim(),page=Number(req.query.page||1);
  if((centre&&!centres.includes(centre))||(kind&&!kinds.includes(kind))||search.length>150||!Number.isSafeInteger(page)||page<1||page>10000)throw fail(400,'Invalid filters');
  const values=[centre,kind,search],where=["($1='' OR $1=ANY(centres))","($2='' OR kind=$2)","($3='' OR position(lower($3) in lower(title||' '||description||' '||authors))>0)"];
  if(scope==='public')where.push("status='published'");if(scope==='mine'){values.push(actor.id);where.push('created_by=$4');}
  if(scope==='review'){const s=String(req.query.status||'pending');if(!['pending','published','changes-requested','archived','all'].includes(s))throw fail(400,'Invalid status');if(s!=='all'){values.push(s);where.push('status=$4');}}
  const w=where.join(' AND '),total=(await db.query('SELECT count(*)::integer AS total FROM sarva.cgc_work WHERE '+w,values)).rows[0].total;
  const rows=(await db.query('SELECT * FROM sarva.cgc_work WHERE '+w+' ORDER BY publication_year DESC NULLS LAST,id DESC LIMIT 20 OFFSET $'+(values.length+1),[...values,(page-1)*20])).rows;res.json({data:{items:rows.map(r=>clean(r,actor)),total,page,pageSize:20}});
 });
 router.get('/cgc/work',list('public'));router.get('/cgc/work/mine',auth,list('mine'));router.get('/cgc/work/review',auth,list('review'));
 router.post('/cgc/work',auth,limit,attempt(async(req,res)=>{const w=validateWork(req.body);const row=await transaction(async c=>{const n=(await c.query("SELECT count(*)::integer AS n FROM sarva.cgc_work WHERE created_by=$1 AND status IN ('pending','changes-requested')",[req.reviewUser.id])).rows[0].n;if(n>=100)throw fail(429,'Review existing submissions first');const r=(await c.query('INSERT INTO sarva.cgc_work(title,description,centres,kind,publication_year,authors,citation,licence,source_url,data_access,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',[w.title,w.description,w.centres,w.kind,w.year,w.authors,w.citation,w.licence,w.sourceUrl,w.dataAccess,req.reviewUser.id])).rows[0];await event(c,r,req.reviewUser,'submitted');return r;});res.status(201).json({data:clean(row,req.reviewUser)});}));
 router.post('/cgc/work/:id/content',auth,limit,attempt(async(req,res)=>{if(!isId(req.params.id))throw fail(400,'Invalid work');const w=validateWork(req.body);const row=await transaction(async c=>{const old=await locked(c,req.params.id,req.reviewUser,req.body.revision);if(old.status==='archived')throw fail(400,'Archived work cannot be edited');const r=(await c.query("UPDATE sarva.cgc_work SET title=$2,description=$3,centres=$4,kind=$5,publication_year=$6,authors=$7,citation=$8,licence=$9,source_url=$10,data_access=$11,status='pending',review_note='',revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *",[old.id,w.title,w.description,w.centres,w.kind,w.year,w.authors,w.citation,w.licence,w.sourceUrl,w.dataAccess])).rows[0];await event(c,r,req.reviewUser,'resubmitted');return r;});res.json({data:clean(row,req.reviewUser)});}));
 router.post('/cgc/work/:id/file',auth,limit,attempt(async(req,res,next)=>{if(!isId(req.params.id))throw fail(400,'Invalid work');const row=(await db.query('SELECT created_by FROM sarva.cgc_work WHERE id=$1',[req.params.id])).rows[0];if(!row||(!req.reviewUser.canManage&&String(row.created_by)!==req.reviewUser.id))throw fail(404,'Work not found');if(!req.is('application/octet-stream'))throw fail(415,'Upload as application/octet-stream');next();}),express.raw({type:'application/octet-stream',limit:MAX}),attempt(async(req,res)=>{
  let name;try{name=decodeURIComponent(String(req.headers['x-file-name']||''));}catch{throw fail(400,'Invalid filename');}const type=validateFile(req.body,name),key=randomUUID();await fs.mkdir(storage,{recursive:true,mode:0o700});const file=path.join(storage,key);await fs.writeFile(file,req.body,{flag:'wx',mode:0o600});let oldKey;
  try{const row=await transaction(async c=>{const old=await locked(c,req.params.id,req.reviewUser,Number(req.headers['x-work-revision']));if(old.status==='archived')throw fail(400,'Archived work cannot be changed');oldKey=old.file_key;const r=(await c.query("UPDATE sarva.cgc_work SET file_key=$2,file_name=$3,file_type=$4,file_size=$5,file_sha256=$6,status='pending',review_note='',revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *",[old.id,key,name,type,req.body.length,createHash('sha256').update(req.body).digest('hex')])).rows[0];await event(c,r,req.reviewUser,'file-uploaded');return r;});if(oldKey)await fs.unlink(path.join(storage,oldKey)).catch(()=>{});res.json({data:clean(row,req.reviewUser)});}catch(e){await fs.unlink(file).catch(()=>{});throw e;}
 }));
 router.get('/cgc/work/:id/file',(req,res,next)=>req.headers.authorization?auth(req,res,next):next(),attempt(async(req,res)=>{if(!isId(req.params.id))throw fail(404,'File not found');const r=(await db.query('SELECT * FROM sarva.cgc_work WHERE id=$1',[req.params.id])).rows[0];if(!r||!r.file_key||(r.status!=='published'&&!req.reviewUser?.canManage&&String(r.created_by)!==req.reviewUser?.id))throw fail(404,'File not found');res.set({'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Type':r.file_type});res.download(path.join(storage,r.file_key),r.file_name,e=>{if(e&&!res.headersSent)res.status(404).json({message:'File unavailable'});});}));
 router.post('/cgc/work/:id/review',auth,limit,attempt(async(req,res)=>{if(!req.reviewUser.canManage)throw fail(403,'Administrator access required');const {status,note='',revision}=req.body;if(!isId(req.params.id)||!['published','changes-requested','archived'].includes(status)||typeof note!=='string'||note.length>2000||!note.trim())throw fail(400,'Choose an outcome and add a review note');const row=await transaction(async c=>{const old=await locked(c,req.params.id,req.reviewUser,revision);if(status==='published'&&!old.source_url&&!old.file_key)throw fail(400,'Add a file or source link before publishing');if(status==='published'&&!old.licence&&old.file_key)throw fail(400,'Add a reuse licence for the uploaded file');const r=(await c.query('UPDATE sarva.cgc_work SET status=$2,review_note=$3,revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *',[old.id,status,note.trim()])).rows[0];await event(c,r,req.reviewUser,status,note.trim());return r;});res.json({data:clean(row,req.reviewUser)});}));
 router.get('/cgc/work/:id/history',auth,attempt(async(req,res)=>{if(!isId(req.params.id))throw fail(404,'Work not found');const row=(await db.query('SELECT created_by FROM sarva.cgc_work WHERE id=$1',[req.params.id])).rows[0];if(!row||(!req.reviewUser.canManage&&String(row.created_by)!==req.reviewUser.id))throw fail(404,'Work not found');const rows=(await db.query('SELECT action,note,revision,created_at FROM sarva.cgc_work_event WHERE work_id=$1 ORDER BY id DESC LIMIT 50',[req.params.id])).rows;res.json({data:rows});}));
 router.use((e,req,res,next)=>{if(!req.path.startsWith('/cgc/work')||res.headersSent)return next(e);res.status(e.status||500).json({message:e.status===413?'File exceeds the 8 MB limit':e.status?e.message:'Showcase temporarily unavailable'});});return router;
}
export const cgcWorkRouter=createCgcWorkRouter();
