import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAdmin } from "../utils/authSession.js";

export const glossaryRouter = Router();

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

// GET /api/glossary?search=...&category=...
glossaryRouter.get("/glossary", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const category = (req.query.category || "").trim();

    const params = [];
    const where = ["is_active = true"];

    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(lower(term) LIKE $${params.length} OR lower(definition) LIKE $${params.length})`);
    }

    const sql = `
  SELECT id, term, definition, category, source, created_at, updated_at
  FROM sarva.glossary_term
  WHERE ${where.join(" AND ")}
  ORDER BY lower(term) ASC;
`;

    const r = await pool.query(sql, params);
    res.json({ status: "ok", data: r.rows });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

glossaryRouter.post("/glossary", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO sarva.glossary_term (term, definition, category, source)
        VALUES ($1, $2, $3, $4)
        RETURNING id, term, definition, category, source, created_at, updated_at
      `,
      [
        cleanText(req.body.term),
        cleanText(req.body.definition),
        cleanText(req.body.category),
        cleanText(req.body.source),
      ]
    );

    res.status(201).json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to create glossary term:", error);
    res.status(500).json({ status: "error", message: "Unable to create glossary term" });
  }
});

glossaryRouter.patch("/glossary/:id", requireAdmin, async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);

  try {
    const result = await pool.query(
      `
        UPDATE sarva.glossary_term
        SET
          term = $2,
          definition = $3,
          category = $4,
          source = $5,
          updated_at = now()
        WHERE id = $1 AND is_active = true
        RETURNING id, term, definition, category, source, created_at, updated_at
      `,
      [
        id,
        cleanText(req.body.term),
        cleanText(req.body.definition),
        cleanText(req.body.category),
        cleanText(req.body.source),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Glossary term not found" });
    }

    res.json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to update glossary term:", error);
    res.status(500).json({ status: "error", message: "Unable to update glossary term" });
  }
});

glossaryRouter.delete("/glossary/:id", requireAdmin, async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);

  try {
    const result = await pool.query(
      `
        UPDATE sarva.glossary_term
        SET is_active = false, updated_at = now()
        WHERE id = $1 AND is_active = true
        RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Glossary term not found" });
    }

    res.json({ status: "ok", data: { id } });
  } catch (error) {
    console.error("Failed to delete glossary term:", error);
    res.status(500).json({ status: "error", message: "Unable to delete glossary term" });
  }
});
