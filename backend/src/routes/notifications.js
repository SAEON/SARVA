import {Router} from 'express';
import {pool} from '../db/pool.js';
import {currentAccount} from '../utils/currentAccount.js';
export function createNotificationsRouter(db=pool){
 const router=Router();router.use('/notifications',currentAccount(db));
 const visible=`n.recipient_id=$1 AND (n.kind='reply' OR $2::boolean) AND (n.issue_id IS NULL OR (i.deleted_at IS NULL AND ($2::boolean OR i.created_by=$1)))`;
 router.get('/notifications',async(req,res)=>{try{
  const args=[req.reviewUser.id,req.reviewUser.isAdmin];
  const counts=(await db.query(`SELECT n.kind,count(*)::int AS count FROM sarva.account_notification n LEFT JOIN sarva.review_issue i ON i.id=n.issue_id WHERE ${visible} AND n.read_at IS NULL GROUP BY n.kind`,args)).rows;
  const items=(await db.query(`SELECT n.id,n.kind,n.created_at,n.issue_id,n.user_id,n.event_id,i.title,e.note AS reply,u.display_name AS registered_name
   FROM sarva.account_notification n LEFT JOIN sarva.review_issue i ON i.id=n.issue_id LEFT JOIN sarva.review_issue_event e ON e.id=n.event_id
   LEFT JOIN sarva.app_user u ON u.id=n.user_id WHERE ${visible} AND n.read_at IS NULL ORDER BY n.id DESC LIMIT 50`,args)).rows;
  const openIssues=req.reviewUser.isAdmin?(await db.query("SELECT count(*)::int AS count FROM sarva.review_issue WHERE deleted_at IS NULL AND status='open'")).rows[0].count:null;
  res.json({data:{counts,openIssues,items:items.map(n=>({...n,href:n.kind==='registration'?'/admin/users?user='+n.user_id:'/testing?issue='+n.issue_id+(n.event_id?'&reply='+n.event_id:'' )}))}});
 }catch{res.status(503).json({message:'Notifications unavailable'});}});
 router.post('/notifications/:id/read',async(req,res)=>{try{
  if(!/^[1-9][0-9]{0,18}$/.test(req.params.id))return res.sendStatus(400);
  const result=await db.query(`UPDATE sarva.account_notification n SET read_at=coalesce(n.read_at,now()) WHERE n.id=$3 AND n.recipient_id=$1
   AND (n.kind='reply' OR $2::boolean) AND (n.issue_id IS NULL OR EXISTS(SELECT 1 FROM sarva.review_issue i WHERE i.id=n.issue_id AND i.deleted_at IS NULL AND ($2::boolean OR i.created_by=$1))) RETURNING n.id`,[req.reviewUser.id,req.reviewUser.isAdmin,req.params.id]);
  if(!result.rowCount)return res.sendStatus(404);res.json({data:{id:result.rows[0].id}});
 }catch{res.status(503).json({message:'Unable to mark notification read'});}});
 return router;
}
export const notificationsRouter=createNotificationsRouter();
