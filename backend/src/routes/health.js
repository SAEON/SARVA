import { Router } from "express";
import { pool } from "../db/pool.js";

export const healthRouter = Router();

healthRouter.get("/health", async (req, res) => {
  try {
    const r = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});