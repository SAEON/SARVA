import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../utils/authSession.js';
import { createHealthCache } from '../services/dataHealth.js';

export function createDataHealthRouter({ database = pool, getHealth = createHealthCache() } = {}) {
  const router = Router();
  router.get('/data-health', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try { requireAdmin(req, res, next); } catch { res.status(403).json({ message: 'Admin access required' }); }
  }, async (req, res) => {
    try {
      const access = await database.query({ text: `SELECT 1 FROM sarva.app_user u
        JOIN sarva.app_user_role ur ON ur.user_id=u.id JOIN sarva.auth_role r ON r.id=ur.role_id
        WHERE u.id=$1 AND u.is_active AND r.name='admin'`, values: [req.authUser.sub], query_timeout: 6000 });
      if (!access.rowCount) return res.status(403).json({ message: 'Admin access required' });
      res.json({ status: 'ok', data: await getHealth() });
    } catch { res.status(503).json({ message: 'Data health checks are unavailable. Check the API and database connection.' }); }
  });
  return router;
}
export const dataHealthRouter = createDataHealthRouter();
