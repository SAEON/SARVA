import { Router } from "express";
import { pool } from "../db/pool.js";
import { checkUrl, updateLinkStatus } from "../services/linkChecker.js";
import { requireAdmin } from "../utils/authSession.js";

export const nationalPolicyRouter = Router();

const SORT_COLUMNS = {
  title: "lower(title)",
  publication_year: "publication_year",
  publisher: "lower(publisher)",
  created_at: "created_at",
};

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function addWhere(where, params, sql, value) {
  params.push(value);
  where.push(sql.replace("?", `$${params.length}`));
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function cleanLinkStatus(value, url) {
  const status = cleanText(value) || (url ? "unchecked" : "missing");
  return ["unchecked", "active", "broken", "redirected", "missing"].includes(status)
    ? status
    : "unchecked";
}

function cleanStatusCode(value) {
  if (value === "" || value == null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function adminSourceIdentifier() {
  return `admin:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

nationalPolicyRouter.get("/national-policy-legislation", async (req, res) => {
  const page = boundedInteger(req.query.page, 1, 1, 100000);
  const limit = boundedInteger(req.query.limit, 20, 1, 100);
  const offset = (page - 1) * limit;
  const search = String(req.query.search || req.query.q || "").trim();
  const publicationYear = String(req.query.publication_year || "").trim();
  const publisher = String(req.query.publisher || "").trim();
  const keyword = String(req.query.keyword || "").trim();
  const sort = String(req.query.sort || "title").trim();
  const order = String(req.query.order || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
  const sortSql = SORT_COLUMNS[sort] || SORT_COLUMNS.title;

  try {
    const params = [];
    const where = ["is_active = true"];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(
        lower(title) LIKE $${params.length}
        OR lower(coalesce(publisher, '')) LIKE $${params.length}
        OR lower(coalesce(abstract, '')) LIKE $${params.length}
        OR lower(array_to_string(keywords, ' ')) LIKE $${params.length}
      )`);
    }

    if (publicationYear) {
      addWhere(where, params, "publication_year = ?", publicationYear);
    }

    if (publisher) {
      addWhere(where, params, "publisher = ?", publisher);
    }

    if (keyword) {
      params.push(keyword.toLowerCase());
      where.push(`EXISTS (
        SELECT 1
        FROM unnest(keywords) AS policy_keyword
        WHERE lower(policy_keyword) = $${params.length}
      )`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const count = await pool.query(
      `SELECT count(*)::int AS total FROM sarva.national_policy_legislation ${whereSql}`,
      params
    );

    const data = await pool.query(
      `
        SELECT
          id,
          title,
          url,
          publication_year,
          publisher,
          abstract,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          admin_notes,
          created_at,
          updated_at
        FROM sarva.national_policy_legislation
        ${whereSql}
        ORDER BY ${sortSql} ${order} NULLS LAST, id ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );

    const filters = await pool.query(`
      SELECT
        array_remove(array_agg(DISTINCT publication_year ORDER BY publication_year DESC), NULL) AS publication_years,
        array_remove(array_agg(DISTINCT publisher ORDER BY publisher), NULL) AS publishers,
        array_remove(array_agg(DISTINCT keyword ORDER BY keyword), NULL) AS keywords
      FROM sarva.national_policy_legislation
      LEFT JOIN LATERAL unnest(keywords) AS keyword ON true
      WHERE is_active = true
    `);

    const total = count.rows[0]?.total || 0;

    res.json({
      status: "ok",
      data: data.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        publicationYears: filters.rows[0]?.publication_years || [],
        publishers: filters.rows[0]?.publishers || [],
        keywords: filters.rows[0]?.keywords || [],
      },
    });
  } catch (error) {
    console.error("Failed to load national policy and legislation:", error);
    res.status(500).json({
      status: "error",
      message: "Unable to load national policy and legislation",
    });
  }
});

nationalPolicyRouter.get("/national-policy-legislation/:id", async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          url,
          publication_year,
          publisher,
          abstract,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          admin_notes,
          created_at,
          updated_at
        FROM sarva.national_policy_legislation
        WHERE id = $1 AND is_active = true
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Policy record not found" });
    }

    res.json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to load national policy record:", error);
    res.status(500).json({
      status: "error",
      message: "Unable to load national policy record",
    });
  }
});

nationalPolicyRouter.post("/national-policy-legislation", requireAdmin, async (req, res) => {
  const url = cleanText(req.body.url);
  const linkStatus = cleanLinkStatus(req.body.link_status, url);

  try {
    const result = await pool.query(
      `
        INSERT INTO sarva.national_policy_legislation (
          title,
          url,
          publication_year,
          publisher,
          abstract,
          keywords,
          source_identifier,
          link_status,
          link_status_code,
          admin_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
          id,
          title,
          url,
          publication_year,
          publisher,
          abstract,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          admin_notes,
          created_at,
          updated_at
      `,
      [
        cleanText(req.body.title),
        url,
        cleanText(req.body.publication_year),
        cleanText(req.body.publisher),
        cleanText(req.body.abstract),
        cleanKeywords(req.body.keywords),
        adminSourceIdentifier(),
        linkStatus,
        cleanStatusCode(req.body.link_status_code),
        cleanText(req.body.admin_notes),
      ]
    );

    res.status(201).json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to create national policy record:", error);
    res.status(500).json({ status: "error", message: "Unable to create national policy record" });
  }
});

nationalPolicyRouter.patch("/national-policy-legislation/:id", requireAdmin, async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);
  const url = cleanText(req.body.url);
  const linkStatus = cleanLinkStatus(req.body.link_status, url);

  try {
    const result = await pool.query(
      `
        UPDATE sarva.national_policy_legislation
        SET
          title = $2,
          url = $3,
          publication_year = $4,
          publisher = $5,
          abstract = $6,
          keywords = $7,
          link_status = $8,
          link_status_code = $9,
          admin_notes = $10,
          updated_at = now()
        WHERE id = $1
        RETURNING
          id,
          title,
          url,
          publication_year,
          publisher,
          abstract,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          admin_notes,
          created_at,
          updated_at
      `,
      [
        id,
        cleanText(req.body.title),
        url,
        cleanText(req.body.publication_year),
        cleanText(req.body.publisher),
        cleanText(req.body.abstract),
        cleanKeywords(req.body.keywords),
        linkStatus,
        cleanStatusCode(req.body.link_status_code),
        cleanText(req.body.admin_notes),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Policy record not found" });
    }

    res.json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to update national policy record:", error);
    res.status(500).json({ status: "error", message: "Unable to update national policy record" });
  }
});

nationalPolicyRouter.delete("/national-policy-legislation/:id", requireAdmin, async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);

  try {
    const result = await pool.query(
      `
        UPDATE sarva.national_policy_legislation
        SET is_active = false, updated_at = now()
        WHERE id = $1 AND is_active = true
        RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Policy record not found" });
    }

    res.json({ status: "ok", data: { id } });
  } catch (error) {
    console.error("Failed to delete national policy record:", error);
    res.status(500).json({ status: "error", message: "Unable to delete national policy record" });
  }
});

nationalPolicyRouter.post("/national-policy-legislation/:id/check-link", requireAdmin, async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);

  try {
    const current = await pool.query("SELECT url FROM sarva.national_policy_legislation WHERE id = $1", [id]);
    if (current.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Policy record not found" });
    }

    await updateLinkStatus("policy", id, await checkUrl(current.rows[0].url));
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          url,
          publication_year,
          publisher,
          abstract,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          admin_notes,
          created_at,
          updated_at
        FROM sarva.national_policy_legislation
        WHERE id = $1
      `,
      [id]
    );

    res.json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to check national policy link:", error);
    res.status(500).json({ status: "error", message: "Unable to check national policy link" });
  }
});
