import { Router } from "express";
import { pool } from "../db/pool.js";

export const navRouter = Router();

function normalizeInternalPath(value) {
  if (!value) return null;
  const path = String(value).trim();
  if (!path) return null;
  return path.startsWith("/") ? path : `/${path.toLowerCase()}`;
}

function topLevelPath(label) {
  const value = String(label || "").trim().toLowerCase();
  if (value === "home") return "/";
  if (value === "explore") return "/explore";
  return null;
}

navRouter.get("/", async (req, res) => {
  try {
    const nav = await pool.query(`
      SELECT id, label, sort_order
      FROM sarva.site_nav
      WHERE is_active = true
      ORDER BY sort_order ASC
    `);

    const items = await pool.query(`
      SELECT nav_id, label, to_path, href, is_external, sort_order
      FROM sarva.site_nav_item
      WHERE is_active = true
      ORDER BY sort_order ASC
    `);

    const byNav = new Map();
    for (const row of items.rows) {
      const list = byNav.get(row.nav_id) || [];
      list.push({
        label: row.label,
        to: normalizeInternalPath(row.to_path),
        href: row.href ? row.href.trim() : null,
        external: row.is_external
      });
      byNav.set(row.nav_id, list);
    }

    const data = nav.rows.map((n) => ({
      label: n.label,
      ...(topLevelPath(n.label) ? { to: topLevelPath(n.label) } : {}),
      items: byNav.get(n.id) || []
    }));

    res.json({ status: "ok", data });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});
