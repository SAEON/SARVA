import { Router } from "express";
import { pool } from "../db/pool.js";

export const siteRouter = Router();

siteRouter.get("/hero", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        slug,
        title,
        subtitle,
        description,
        cta_label,
        cta_href,
        image_path,
        image_alt,
        overlay_strength
      FROM sarva.site_hero
      WHERE is_active = true
      ORDER BY sort_order ASC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No active hero configured"
      });
    }

    res.json({
      status: "ok",
      data: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});