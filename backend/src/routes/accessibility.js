import {Router} from 'express';
import {pool} from '../db/pool.js';
import {requireCurrentAdmin as requireAdmin} from '../utils/currentAdmin.js';
export const accessibilityRouter=Router();
accessibilityRouter.get('/accessibility/status',async(req,res)=>{
 try {const r=await pool.query('SELECT kind,category,count(*)::int AS count,max(imported_at) AS imported_at FROM sarva.access_features GROUP BY kind,category ORDER BY kind,category');res.json({status:'ok',data:r.rows});}catch{res.status(503).json({message:'Accessibility data unavailable.'});}
});
accessibilityRouter.get('/accessibility/edits',async(req,res)=>{
 try {const r=await pool.query(`SELECT id,source_id,kind,name,category,hidden,updated_at,ST_AsGeoJSON(ST_Transform(geom,4326))::json AS geometry FROM sarva.access_edit ORDER BY updated_at DESC LIMIT 500`);res.json({status:'ok',data:r.rows});}catch{res.status(503).json({message:'Edits unavailable.'});}
});
accessibilityRouter.post('/accessibility/edits',requireAdmin,async(req,res)=>{
 const b=req.body || {}; const kind=b.kind;
 if(!['road','facility','zone'].includes(kind) || typeof b.name!=='string' || !b.name.trim() || b.name.length>200 || typeof b.category!=='string' || b.category.length>80 || typeof b.hidden!=='boolean' || (b.id!=null && (!Number.isSafeInteger(b.id)||b.id<=0)) || (b.sourceId!=null && (!Number.isSafeInteger(b.sourceId)||b.sourceId<=0))) return res.status(400).json({message:'Invalid feature attributes.'});
 const g=b.geometry;
 const expected={road:'LineString',facility:'Point',zone:'Polygon'}[kind];
 if(g && (g.type!==expected || JSON.stringify(g).length>100000)) return res.status(400).json({message:'Invalid geometry type or size.'});
 if(!g && !b.sourceId && !b.id) return res.status(400).json({message:'Geometry required.'});
 const c=await pool.connect();
 try {await c.query('BEGIN');
 if(g){const check=await c.query(`SELECT ST_IsValid(g) AND NOT ST_IsEmpty(g) AND ST_CoveredBy(g,ST_MakeEnvelope(15,-36,34,-21,4326)) AS valid FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) g) x`,[JSON.stringify(g)]);if(!check.rows[0].valid)throw new Error('invalid');}
 if(b.sourceId){const source=await c.query('SELECT kind FROM sarva.access_source WHERE id=$1',[b.sourceId]);if(source.rows[0]?.kind!==kind)throw new Error('invalid');}
 const prior=await c.query('SELECT * FROM sarva.access_edit WHERE id=$1 OR source_id=$2 FOR UPDATE',[b.id || null,b.sourceId || null]);
 if(b.id && !prior.rowCount)throw new Error('invalid');
 const old=prior.rows[0];if(prior.rowCount>1 || (old && old.kind!==kind) || (old && b.sourceId && old.source_id!==String(b.sourceId)))throw new Error('invalid');const actor=String(req.authUser.sub || req.authUser.email || 'admin');
 let result;
 if(old) result=await c.query(`UPDATE sarva.access_edit SET name=$2,category=$3,hidden=$4,geom=COALESCE(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($5),4326),3857),geom),updated_by=$6,updated_at=now() WHERE id=$1 RETURNING *`,[old.id,b.name.trim(),b.category,b.hidden,g?JSON.stringify(g):null,actor]);
 else result=await c.query(`INSERT INTO sarva.access_edit(source_id,kind,name,category,hidden,geom,updated_by) VALUES($1,$2,$3,$4,$5,ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($6),4326),3857),$7) RETURNING *`,[b.sourceId || null,kind,b.name.trim(),b.category,b.hidden,g?JSON.stringify(g):null,actor]);
 await c.query('INSERT INTO sarva.access_history(edit_id,before_record,after_record,actor) VALUES($1,$2,$3,$4)',[result.rows[0].id,old?JSON.stringify(old):null,JSON.stringify(result.rows[0]),actor]);await c.query('COMMIT');res.json({status:'ok',data:{id:result.rows[0].id}});
 }catch{await c.query('ROLLBACK');res.status(400).json({message:'Could not save. Check feature geometry, source and attributes.'});}finally{c.release();}
});
