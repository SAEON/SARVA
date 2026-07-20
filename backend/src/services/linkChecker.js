import { pool } from "../db/pool.js";

const TARGETS = {
  resource: {
    table: "sarva.resources",
  },
  policy: {
    table: "sarva.national_policy_legislation",
  },
};

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export async function checkUrl(url) {
  if (!url) {
    return { link_status: "missing", link_status_code: null };
  }

  async function request(method) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      return await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "SARVA link checker/1.0",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    let response = await request("HEAD");
    if ([403, 405].includes(response.status)) {
      response = await request("GET");
    }

    if (response.redirected) {
      return { link_status: "redirected", link_status_code: response.status };
    }

    return {
      link_status: response.ok ? "active" : "broken",
      link_status_code: response.status,
    };
  } catch (error) {
    return { link_status: "broken", link_status_code: null };
  }
}

export async function updateLinkStatus(kind, id, link) {
  const target = TARGETS[kind];
  if (!target) throw new Error(`Unsupported link checker target: ${kind}`);

  const result = await pool.query(
    `
      UPDATE ${target.table}
      SET
        link_status = $2,
        link_status_code = $3,
        link_checked_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING id, link_status, link_checked_at, link_status_code
    `,
    [id, link.link_status, link.link_status_code]
  );

  return result.rows[0] || null;
}

async function loadCandidates({ limit, staleDays, includeAll }) {
  const staleClause = includeAll
    ? "true"
    : `(
        link_checked_at IS NULL
        OR link_status = 'unchecked'
        OR link_checked_at < now() - make_interval(days => $2::int)
      )`;

  const result = await pool.query(
    `
      WITH candidates AS (
        SELECT
          'resource' AS kind,
          id,
          title,
          url,
          link_status,
          link_checked_at
        FROM sarva.resources
        WHERE is_active = true AND ${staleClause}

        UNION ALL

        SELECT
          'policy' AS kind,
          id,
          title,
          url,
          link_status,
          link_checked_at
        FROM sarva.national_policy_legislation
        WHERE is_active = true AND ${staleClause}
      )
      SELECT *
      FROM candidates
      ORDER BY link_checked_at ASC NULLS FIRST, kind, title
      LIMIT $1
    `,
    [limit, staleDays]
  );

  return result.rows;
}

export async function checkLibraryLinks(options = {}) {
  const limit = boundedInteger(options.limit, 50, 1, 250);
  const staleDays = boundedInteger(options.staleDays, 30, 1, 365);
  const includeAll = Boolean(options.includeAll);
  const candidates = await loadCandidates({ limit, staleDays, includeAll });
  const summary = {
    requested: limit,
    checked: 0,
    updated: 0,
    resources: 0,
    policies: 0,
    active: 0,
    redirected: 0,
    broken: 0,
    missing: 0,
    unchecked: 0,
    errors: 0,
  };
  const records = [];

  for (const candidate of candidates) {
    try {
      const link = await checkUrl(candidate.url);
      const updated = await updateLinkStatus(candidate.kind, candidate.id, link);

      summary.checked += 1;
      summary.updated += updated ? 1 : 0;
      summary[candidate.kind === "resource" ? "resources" : "policies"] += 1;
      summary[link.link_status] = (summary[link.link_status] || 0) + 1;
      records.push({
        kind: candidate.kind,
        id: candidate.id,
        title: candidate.title,
        ...updated,
      });
    } catch (error) {
      summary.errors += 1;
      records.push({
        kind: candidate.kind,
        id: candidate.id,
        title: candidate.title,
        error: error.message,
      });
    }
  }

  return {
    summary,
    records,
  };
}
