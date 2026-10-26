import { verifyToken } from './authSession.js';
export const actions = Object.freeze({
 map_layer: 'Map layer selected', municipality: 'Municipality explored',
 catalogue_search: 'Catalogue search', catalogue_record: 'Catalogue record opened',
 resource_open: 'Resource opened', content_create: 'Content created',
 content_edit: 'Content edited', content_review: 'Content reviewed'
});
export async function analyticsIdentity(req, db) {
 const header = String(req.headers.authorization || '');
 if (!header.startsWith('Bearer ')) return { userId: null, audienceType: 'anonymous' };
 let payload;
 try { payload = verifyToken(header.slice(7)); } catch { payload = null; }
 if (!payload || !/^[0-9]+$/.test(String(payload.sub))) return { userId: null, audienceType: 'anonymous' };
 const result = await db.query(`SELECT u.id, EXISTS (SELECT 1 FROM sarva.app_user_role ur
 JOIN sarva.auth_role r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='admin') AS admin
 FROM sarva.app_user u WHERE u.id=$1 AND u.is_active`, [payload.sub]);
 const user = result.rows[0];
 return user ? { userId: user.id, audienceType: user.admin ? 'administrator' : 'signed-in' }
 : { userId: null, audienceType: 'anonymous' };
}
export function interactionFields(body) {
 if (!Object.hasOwn(actions, body.action)) return null;
 const subject = body.subject == null ? null : String(body.subject);
 if (subject !== null && !/^[a-zA-Z0-9:_-]{1,80}$/.test(subject)) return null;
 return { action: body.action, subject };
}
