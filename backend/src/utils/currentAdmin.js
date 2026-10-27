import {pool} from '../db/pool.js';
import {verifyToken} from './authSession.js';

export function currentAdmin(db=pool) {
 return async (req,res,next) => {
  try {
   const header=String(req.headers.authorization || '');
   const payload=verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
   if (!payload?.sub || !/^[1-9][0-9]*$/.test(String(payload.sub))) return res.status(403).json({message:'Administrator access required'});
   const result=await db.query(`SELECT u.id FROM sarva.app_user u JOIN sarva.app_user_role ur ON ur.user_id=u.id
    JOIN sarva.auth_role r ON r.id=ur.role_id WHERE u.id=$1 AND u.is_active AND r.name='admin'`,[payload.sub]);
   if (!result.rowCount) return res.status(403).json({message:'Administrator access required'});
   req.authUser={...payload,sub:String(result.rows[0].id)};
   next();
  } catch (error) {
   if (error instanceof SyntaxError) return res.status(403).json({message:'Administrator access required'});
   console.error('Administrator verification failed');
   return res.status(503).json({message:'Unable to verify administrator access'});
  }
 };
}
export const requireCurrentAdmin=currentAdmin();
