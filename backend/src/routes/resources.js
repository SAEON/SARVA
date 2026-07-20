import { Router } from "express";
import { pool } from "../db/pool.js";
import { checkUrl, updateLinkStatus } from "../services/linkChecker.js";
import { requireAdmin } from "../utils/authSession.js";

export const resourcesRouter = Router();

const SORT_COLUMNS = {
  title: "lower(title)",
  author: "lower(author)",
  publication_year: "publication_year",
  resource_type: "lower(resource_type)",
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

function resourceGroupClause(resourceGroup) {
  if (resourceGroup === "reports_stories") {
    return "lower(coalesce(resource_type, '')) IN ('report', 'reports', 'story', 'stories', 'brief', 'case study')";
  }
  if (resourceGroup === "data_spotlight") {
    return "lower(coalesce(resource_type, '')) IN ('database', 'dataset', 'data spotlight', 'research tool', 'website')";
  }
  if (resourceGroup === "supporting_data") {
    return "lower(coalesce(resource_type, '')) IN ('supporting data', 'satellite product', 'climate data', 'environmental data')";
  }
  return null;
}

resourcesRouter.get("/resources", async (req, res) => {
  const page = boundedInteger(req.query.page, 1, 1, 100000);
  const limit = boundedInteger(req.query.limit, 20, 1, 100);
  const offset = (page - 1) * limit;
  const search = String(req.query.search || req.query.q || "").trim();
  const resourceType = String(req.query.resource_type || "").trim();
  const publicationYear = String(req.query.publication_year || "").trim();
  const keyword = String(req.query.keyword || "").trim();
  const resourceGroup = String(req.query.resource_group || "").trim();
  const author = String(req.query.author || req.query.institute || "").trim();
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
        OR lower(coalesce(author, '')) LIKE $${params.length}
        OR lower(coalesce(resource_type, '')) LIKE $${params.length}
        OR lower(array_to_string(keywords, ' ')) LIKE $${params.length}
      )`);
    }

    if (resourceType) {
      addWhere(where, params, "resource_type = ?", resourceType);
    }

    const groupClause = resourceGroupClause(resourceGroup);
    if (groupClause) where.push(groupClause);

    if (author) {
      params.push(author.toLowerCase());
      where.push(`lower(coalesce(author, '')) = $${params.length}`);
    }

    if (publicationYear) {
      addWhere(where, params, "publication_year = ?", publicationYear);
    }

    if (keyword) {
      params.push(keyword.toLowerCase());
      where.push(`EXISTS (
        SELECT 1
        FROM unnest(keywords) AS resource_keyword
        WHERE lower(resource_keyword) = $${params.length}
      )`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const count = await pool.query(`SELECT count(*)::int AS total FROM sarva.resources ${whereSql}`, params);

    const dataParams = [...params, limit, offset];
    const secondarySortSql =
      sort === "publication_year"
        ? "updated_at DESC NULLS LAST, created_at DESC NULLS LAST,"
        : "";

    const data = await pool.query(
      `
        SELECT
          id,
          title,
          url,
          author,
          publication_year,
          resource_type,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          logo_url,
          admin_notes,
          created_at,
          updated_at
        FROM sarva.resources
        ${whereSql}
        ORDER BY ${sortSql} ${order} NULLS LAST, ${secondarySortSql} id ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      dataParams
    );

    const filterWhere = ["is_active = true"];
    const filterGroupClause = resourceGroupClause(resourceGroup);
    if (filterGroupClause) filterWhere.push(filterGroupClause);

    const filters = await pool.query(`
      SELECT
        array_remove(array_agg(DISTINCT resource_type ORDER BY resource_type), NULL) AS resource_types,
        array_remove(array_agg(DISTINCT author ORDER BY author), NULL) AS authors,
        array_remove(array_agg(DISTINCT publication_year ORDER BY publication_year DESC), NULL) AS publication_years,
        array_remove(array_agg(DISTINCT keyword ORDER BY keyword), NULL) AS keywords
      FROM sarva.resources
      LEFT JOIN LATERAL unnest(keywords) AS keyword ON true
      WHERE ${filterWhere.join(" AND ")}
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
        resourceTypes: filters.rows[0]?.resource_types || [],
        authors: filters.rows[0]?.authors || [],
        publicationYears: filters.rows[0]?.publication_years || [],
        keywords: filters.rows[0]?.keywords || [],
      },
    });
  } catch (error) {
    console.error("Failed to load resources:", error);
    res.status(500).json({
      status: "error",
      message: "Unable to load resources",
    });
  }
});

resourcesRouter.get("/resources/:id", async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          url,
          author,
          publication_year,
          resource_type,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          logo_url,
          admin_notes,
          created_at,
          updated_at
        FROM sarva.resources
        WHERE id = $1 AND is_active = true
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Resource not found" });
    }

    res.json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to load resource:", error);
    res.status(500).json({
      status: "error",
      message: "Unable to load resource",
    });
  }
});

resourcesRouter.post("/resources", requireAdmin, async (req, res) => {
  const url = cleanText(req.body.url);
  const linkStatus = cleanLinkStatus(req.body.link_status, url);

  try {
    const result = await pool.query(
      `
        INSERT INTO sarva.resources (
          title,
          url,
          author,
          publication_year,
          resource_type,
          keywords,
          source_identifier,
          link_status,
          link_status_code,
          logo_url,
          admin_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING
          id,
          title,
          url,
          author,
          publication_year,
          resource_type,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          logo_url,
          admin_notes,
          created_at,
          updated_at
      `,
      [
        cleanText(req.body.title),
        url,
        cleanText(req.body.author),
        cleanText(req.body.publication_year),
        cleanText(req.body.resource_type),
        cleanKeywords(req.body.keywords),
        adminSourceIdentifier(),
        linkStatus,
        cleanStatusCode(req.body.link_status_code),
        cleanText(req.body.logo_url),
        cleanText(req.body.admin_notes),
      ]
    );

    res.status(201).json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to create resource:", error);
    res.status(500).json({ status: "error", message: "Unable to create resource" });
  }
});

resourcesRouter.patch("/resources/:id", requireAdmin, async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);
  const url = cleanText(req.body.url);
  const linkStatus = cleanLinkStatus(req.body.link_status, url);

  try {
    const result = await pool.query(
      `
        UPDATE sarva.resources
        SET
          title = $2,
          url = $3,
          author = $4,
          publication_year = $5,
          resource_type = $6,
          keywords = $7,
          link_status = $8,
          link_status_code = $9,
          logo_url = $10,
          admin_notes = $11,
          updated_at = now()
        WHERE id = $1
        RETURNING
          id,
          title,
          url,
          author,
          publication_year,
          resource_type,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          logo_url,
          admin_notes,
          created_at,
          updated_at
      `,
      [
        id,
        cleanText(req.body.title),
        url,
        cleanText(req.body.author),
        cleanText(req.body.publication_year),
        cleanText(req.body.resource_type),
        cleanKeywords(req.body.keywords),
        linkStatus,
        cleanStatusCode(req.body.link_status_code),
        cleanText(req.body.logo_url),
        cleanText(req.body.admin_notes),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Resource not found" });
    }

    res.json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to update resource:", error);
    res.status(500).json({ status: "error", message: "Unable to update resource" });
  }
});

resourcesRouter.delete("/resources/:id", requireAdmin, async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);

  try {
    const result = await pool.query(
      `
        UPDATE sarva.resources
        SET is_active = false, updated_at = now()
        WHERE id = $1 AND is_active = true
        RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Resource not found" });
    }

    res.json({ status: "ok", data: { id } });
  } catch (error) {
    console.error("Failed to delete resource:", error);
    res.status(500).json({ status: "error", message: "Unable to delete resource" });
  }
});

resourcesRouter.post("/resources/:id/check-link", requireAdmin, async (req, res) => {
  const id = boundedInteger(req.params.id, 0, 1, 2147483647);

  try {
    const current = await pool.query("SELECT url FROM sarva.resources WHERE id = $1", [id]);
    if (current.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Resource not found" });
    }

    await updateLinkStatus("resource", id, await checkUrl(current.rows[0].url));
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          url,
          author,
          publication_year,
          resource_type,
          keywords,
          source_page,
          link_status,
          link_checked_at,
          link_status_code,
          logo_url,
          admin_notes,
          created_at,
          updated_at
        FROM sarva.resources
        WHERE id = $1
      `,
      [id]
    );

    res.json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Failed to check resource link:", error);
    res.status(500).json({ status: "error", message: "Unable to check resource link" });
  }
});
