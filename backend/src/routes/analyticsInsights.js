import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../utils/authSession.js';
export const analyticsInsights = Router();
export function insightsFilter(query) {
 const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
   && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
 const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if (!validDate(query.from) || !validDate(query.to) || query.from > query.to || query.to > today
   || (Date.parse(query.to)-Date.parse(query.from))/86400000 > 365) throw Error('Choose valid dates, up to 366 days ending today.');
 const args = [query.from+'T00:00:00+02:00',new Date(Date.parse(query.to+'T00:00:00+02:00')+86400000).toISOString()];
 let where = "e.created_at >= $1::timestamptz AND e.created_at < $2::timestamptz AND e.kind IN ('page','click','interaction')";
 const fields = { device: ['Desktop','Mobile','Tablet','Automated','Unknown'], audience: ['anonymous','signed-in','administrator','legacy'] };
 for (const [key, allowed] of Object.entries(fields)) if (query[key]) {
   if (!allowed.includes(query[key])) throw Error('Invalid '+key+' filter');
   args.push(query[key]); where += ` AND e.${key === 'audience' ? 'audience_type' : key}=$${args.length}`;
 }
 if (query.country === 'unknown') where += ' AND e.country IS NULL';
 else if (query.country) { if (!/^[A-Z]{2}$/.test(query.country)) throw Error('Invalid country'); args.push(query.country); where += ` AND e.country=$${args.length}`; }
 if (query.section) { if (typeof query.section !== 'string' || query.section.length>80) throw Error('Invalid section'); args.push(query.section); where += ` AND e.section=$${args.length}`; }
 if (query.userId) { if (!/^[0-9]{1,18}$/.test(query.userId)) throw Error('Invalid user'); args.push(query.userId); where += ` AND e.user_id=$${args.length}::bigint`; }
 return { where, args };
}
analyticsInsights.get('/analytics/insights', (req,res,next) => {
 try { requireAdmin(req,res,next); } catch { res.sendStatus(403); }
}, async (req,res) => {
 res.set('Cache-Control','no-store');
 let filter;
 try { filter=insightsFilter(req.query); } catch (error) { return res.status(400).json({message:error.message}); }
 try {
   const access=await pool.query(`SELECT 1 FROM sarva.app_user u JOIN sarva.app_user_role ur ON ur.user_id=u.id
   JOIN sarva.auth_role r ON r.id=ur.role_id WHERE u.id=$1 AND u.is_active AND r.name='admin'`,[req.authUser.sub]);
   if (!access.rowCount) return res.sendStatus(403);
   const {where,args}=filter;
   const queries={
    totals:`SELECT count(*) FILTER(WHERE e.kind='page')::int AS views, count(DISTINCT e.session_id)::int AS sessions,
      count(*) FILTER(WHERE e.kind='interaction')::int AS interactions,
      count(*) FILTER(WHERE e.kind='page' AND (e.latitude IS NULL OR e.longitude IS NULL))::int AS unmapped
      FROM sarva.analytics_event e WHERE ${where}`,
    locations:`SELECT e.country,e.region,e.city,e.latitude,e.longitude,e.device,e.audience_type,
      count(*) FILTER(WHERE e.kind='page')::int AS views,count(DISTINCT e.session_id)::int AS sessions,
      count(*) FILTER(WHERE e.kind='click')::int AS clicks,count(*) FILTER(WHERE e.kind='interaction')::int AS interactions
      FROM sarva.analytics_event e WHERE ${where} GROUP BY e.country,e.region,e.city,e.latitude,e.longitude,e.device,e.audience_type
      ORDER BY views DESC,sessions DESC,e.country,e.city LIMIT 1000`,
    actions:`SELECT e.action,count(*)::int AS count,count(DISTINCT e.session_id)::int AS sessions
      FROM sarva.analytics_event e WHERE ${where} AND e.kind='interaction' GROUP BY e.action ORDER BY count DESC LIMIT 50`,
    users:`SELECT e.user_id,u.display_name AS name,e.audience_type,count(*) FILTER(WHERE e.kind='page')::int AS views,
      count(*) FILTER(WHERE e.kind='click')::int AS clicks,count(*) FILTER(WHERE e.kind='interaction')::int AS interactions,
      max(e.created_at) AS last_seen FROM sarva.analytics_event e LEFT JOIN sarva.app_user u ON u.id=e.user_id
      WHERE ${where} AND e.user_id IS NOT NULL GROUP BY e.user_id,u.display_name,e.audience_type ORDER BY last_seen DESC LIMIT 100`,
    activity:`SELECT e.created_at,e.user_id,u.display_name AS name,e.audience_type,e.kind,e.path,e.action,e.subject,e.device,e.country
      FROM sarva.analytics_event e LEFT JOIN sarva.app_user u ON u.id=e.user_id WHERE ${where} AND e.user_id IS NOT NULL
      ORDER BY e.created_at DESC,e.id DESC LIMIT 100`,
    countries:`SELECT DISTINCT e.country FROM sarva.analytics_event e WHERE e.created_at >= $1::timestamptz AND e.created_at < $2::timestamptz AND e.country IS NOT NULL ORDER BY e.country`,
    sections:`SELECT DISTINCT e.section FROM sarva.analytics_event e WHERE e.created_at >= $1::timestamptz AND e.created_at < $2::timestamptz
      AND e.section IS NOT NULL ORDER BY e.section`
   };
   const data={};
   await Promise.all(Object.entries(queries).map(async([key,sql])=> { data[key]=(await pool.query(sql,['sections','countries'].includes(key)?args.slice(0,2):args)).rows; }));
   res.json({data,from:req.query.from,to:req.query.to,limits:{locations:1000,users:100,activity:100}});
 } catch { res.status(503).json({message:'Audience insights unavailable. Check migration 057 and database connectivity.'}); }
});
