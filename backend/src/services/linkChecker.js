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

export async function checkUrl(url, {fetchImpl=globalThis.fetch, timeoutMs=10000} = {}) {
  if (!url) return {link_status:'missing',link_status_code:null};
  let parsed;
  try { parsed=new URL(url); } catch { return {link_status:'unchecked',link_status_code:null}; }
  if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    return {link_status:'unchecked',link_status_code:null};
  async function request(method) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetchImpl(url,{method,redirect:'follow',signal:controller.signal,headers:{'User-Agent':'SARVA link checker/1.0'}});
      // Only status/headers are needed; do not download linked documents.
      await response.body?.cancel();
      return response;
    } finally {clearTimeout(timer);}
  }
  try {
    let response=await request('HEAD');
    if ([401,403,404,405,410,501].includes(response.status)) response=await request('GET');
    // Redirecting to an error does not make a link healthy.
    if(response.ok)return {link_status:response.redirected?'redirected':'active',link_status_code:response.status};
    return {link_status:[404,410].includes(response.status)?'broken':'unchecked',link_status_code:response.status};
  } catch {
    // A timeout, TLS/DNS failure or automation block cannot establish absence.
    return {link_status:'unchecked',link_status_code:null};
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
    includeAll ? [limit] : [limit, staleDays]
  );

  return result.rows;
}

export async function checkLibraryLinks(options = {}) {
  const limit = options.complete ? null : boundedInteger(options.limit, 50, 1, 250);
  const staleDays = boundedInteger(options.staleDays, 30, 1, 365);
  const includeAll = Boolean(options.complete || options.includeAll);
  const candidates = await loadCandidates({ limit, staleDays, includeAll });
  const summary = {
    requested: options.complete ? candidates.length : limit,
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
  if(options.dryRun)return {summary:{...summary,candidates:candidates.length,dryRun:true},records:[]};

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
