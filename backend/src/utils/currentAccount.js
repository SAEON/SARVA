import {pool} from '../db/pool.js';
import {verifyToken} from './authSession.js';

export function currentAccount(db=pool) {
 return async (req,res,next)=>{
  res.set('Cache-Control','no-store');
  try{
   const header=String(req.headers.authorization || '');
   let payload;
   try{payload=verifyToken(header.startsWith('Bearer ')?header.slice(7):'');}catch{return res.status(401).json({message:'Sign in to SARVA to continue'});}
   if(!payload?.sub || !/^[1-9][0-9]*$/.test(String(payload.sub)))return res.status(401).json({message:'Sign in to SARVA to continue'});
   const result=await db.query(`SELECT u.id,EXISTS(SELECT 1 FROM sarva.app_user_role ur JOIN sarva.auth_role r ON r.id=ur.role_id
    WHERE ur.user_id=u.id AND r.name='admin') AS is_admin FROM sarva.app_user u WHERE u.id=$1 AND u.is_active`,[payload.sub]);
   if(!result.rowCount)return res.status(401).json({message:'Sign in with an active SARVA account'});
   req.reviewUser={id:String(result.rows[0].id),isAdmin:result.rows[0].is_admin};next();
  }catch{res.status(503).json({message:'Unable to verify account access'});}
 };
}
