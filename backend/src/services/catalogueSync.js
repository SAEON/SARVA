import { pool } from "../db/pool.js";
import { refreshCatalogueEssentialVariables } from "./catalogueEssentialVariables.js";

const GRAPHQL_ENDPOINT = process.env.CATALOGUE_GRAPHQL_ENDPOINT || "https://catalogue.saeon.ac.za/graphql";
const PAGE_SIZE = Number(process.env.CATALOGUE_SYNC_PAGE_SIZE || 200);
const GRAPHQL_TIMEOUT_MS = Number(process.env.CATALOGUE_GRAPHQL_TIMEOUT_MS || 8000);

let activeSync = null;

async function callGraphQL(query, variables = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPHQL_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GraphQL HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  if (payload.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data;
}

export async function getLiveCatalogueSummary() {
  const query = `
    query CatalogueSummary {
      catalogue {
        search(size: 1) {
          totalCount
          pageSize
        }
      }
    }
  `;

  const data = await callGraphQL(query);
  return {
    endpoint: GRAPHQL_ENDPOINT,
    totalCount: data.catalogue.search.totalCount,
    pageSize: data.catalogue.search.pageSize,
  };
}

export async function refreshCatalogueSearchIndex(client = pool) {
  await client.query("REFRESH MATERIALIZED VIEW catalogue.record_search_index");
}

function toInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractBasicFields(esMeta) {
  const src = esMeta?._source || {};
  const immutable = src.immutableResource || {};
  const downloadBlock = immutable.resourceDownload || {};
  const download = Array.isArray(downloadBlock) ? downloadBlock[0] : downloadBlock;

  const rights = Array.isArray(src.rightsList) && src.rightsList.length > 0 ? src.rightsList[0] : {};
  const abstractObj = Array.isArray(src.descriptions)
    ? src.descriptions.find((item) => item.descriptionType === "Abstract") || src.descriptions[0]
    : null;

  return {
    saeon_id: esMeta._id,
    doi: src.doi || null,
    title: src.titles?.[0]?.title || "Untitled",
    abstract: abstractObj?.description || null,
    publisher_name: src.publisher || null,
    publication_year: toInteger(src.publicationYear),
    collection_key: src.collection_key || null,
    collection_name: src.collection_name || null,
    provider_key: src.provider_key || null,
    provider_name: src.provider_name || null,
    temporal_start: src.temporal_start || null,
    temporal_end: src.temporal_end || null,
    spatial_north: src.spatial_north ?? null,
    spatial_east: src.spatial_east ?? null,
    spatial_south: src.spatial_south ?? null,
    spatial_west: src.spatial_west ?? null,
    download_label: immutable.resourceDescription || null,
    download_filename: download?.fileName || null,
    download_url: download?.downloadURL || null,
    download_format: download?.fileFormat || null,
    licence_text: rights.rights || null,
    licence_uri: rights.rightsURI || null,
    licence_identifier: rights.rightsIdentifier || null,
  };
}

function affiliationString(person) {
  const affiliations = Array.isArray(person?.affiliation) ? person.affiliation : [];
  return affiliations.map((item) => item.affiliation).filter(Boolean).join("; ") || null;
}

function extractCreators(esMeta) {
  const creators = esMeta?._source?.creators || [];
  return creators.map((creator) => {
    const affiliation = affiliationString(creator);
    const rawName = typeof creator.name === "string" ? creator.name.trim() : creator.name;
    return {
      name: rawName || affiliation || "Unknown creator",
      name_type: creator.nameType || null,
      affiliation,
    };
  });
}

function extractContributors(esMeta) {
  const contributors = esMeta?._source?.contributors || [];
  return contributors.map((contributor) => {
    const affiliation = affiliationString(contributor);
    const rawName = typeof contributor.name === "string" ? contributor.name.trim() : contributor.name;
    return {
      name: rawName || affiliation || contributor.contributorType || "Unknown contributor",
      name_type: contributor.nameType || null,
      contributor_type: contributor.contributorType || null,
      affiliation,
    };
  });
}

function extractKeywords(esMeta) {
  return (esMeta?._source?.keywords || []).filter(Boolean);
}

function extractSubjects(esMeta) {
  return (esMeta?._source?.subjects || []).map((subject) => subject.subject).filter(Boolean);
}

function extractFormats(esMeta) {
  return (esMeta?._source?.formats || []).filter(Boolean);
}

async function upsertRecord(client, record) {
  const esMeta = record.metadata;
  const basic = extractBasicFields(esMeta);

  const result = await client.query(
    `
      INSERT INTO catalogue.catalogue_records (
        saeon_id, doi, title, abstract,
        publisher_name, publication_year,
        collection_key, collection_name,
        provider_key, provider_name,
        temporal_start, temporal_end,
        spatial_north, spatial_east, spatial_south, spatial_west,
        download_label, download_filename, download_url, download_format,
        licence_text, licence_uri, licence_identifier,
        download_count,
        raw_metadata,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8,
        $9, $10,
        $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23,
        $24,
        $25,
        now()
      )
      ON CONFLICT (saeon_id) DO UPDATE
      SET
        doi = EXCLUDED.doi,
        title = EXCLUDED.title,
        abstract = EXCLUDED.abstract,
        publisher_name = EXCLUDED.publisher_name,
        publication_year = EXCLUDED.publication_year,
        collection_key = EXCLUDED.collection_key,
        collection_name = EXCLUDED.collection_name,
        provider_key = EXCLUDED.provider_key,
        provider_name = EXCLUDED.provider_name,
        temporal_start = EXCLUDED.temporal_start,
        temporal_end = EXCLUDED.temporal_end,
        spatial_north = EXCLUDED.spatial_north,
        spatial_east = EXCLUDED.spatial_east,
        spatial_south = EXCLUDED.spatial_south,
        spatial_west = EXCLUDED.spatial_west,
        download_label = EXCLUDED.download_label,
        download_filename = EXCLUDED.download_filename,
        download_url = EXCLUDED.download_url,
        download_format = EXCLUDED.download_format,
        licence_text = EXCLUDED.licence_text,
        licence_uri = EXCLUDED.licence_uri,
        licence_identifier = EXCLUDED.licence_identifier,
        download_count = EXCLUDED.download_count,
        raw_metadata = EXCLUDED.raw_metadata,
        updated_at = now()
      RETURNING id
    `,
    [
      basic.saeon_id,
      basic.doi,
      basic.title,
      basic.abstract,
      basic.publisher_name,
      basic.publication_year,
      basic.collection_key,
      basic.collection_name,
      basic.provider_key,
      basic.provider_name,
      basic.temporal_start,
      basic.temporal_end,
      basic.spatial_north,
      basic.spatial_east,
      basic.spatial_south,
      basic.spatial_west,
      basic.download_label,
      basic.download_filename,
      basic.download_url,
      basic.download_format,
      basic.licence_text,
      basic.licence_uri,
      basic.licence_identifier,
      record.downloadCount ?? null,
      esMeta,
    ]
  );

  const recordId = result.rows[0].id;
  await client.query("DELETE FROM catalogue.record_creators WHERE record_id = $1", [recordId]);
  await client.query("DELETE FROM catalogue.record_contributors WHERE record_id = $1", [recordId]);
  await client.query("DELETE FROM catalogue.record_keywords WHERE record_id = $1", [recordId]);
  await client.query("DELETE FROM catalogue.record_subjects WHERE record_id = $1", [recordId]);
  await client.query("DELETE FROM catalogue.record_formats WHERE record_id = $1", [recordId]);

  for (const creator of extractCreators(esMeta)) {
    await client.query(
      `
        INSERT INTO catalogue.record_creators (record_id, name, name_type, affiliation)
        VALUES ($1, $2, $3, $4)
      `,
      [recordId, creator.name, creator.name_type, creator.affiliation]
    );
  }

  for (const contributor of extractContributors(esMeta)) {
    await client.query(
      `
        INSERT INTO catalogue.record_contributors (
          record_id, name, name_type, contributor_type, affiliation
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        recordId,
        contributor.name,
        contributor.name_type,
        contributor.contributor_type,
        contributor.affiliation,
      ]
    );
  }

  for (const keyword of extractKeywords(esMeta)) {
    await client.query("INSERT INTO catalogue.record_keywords (record_id, keyword) VALUES ($1, $2)", [
      recordId,
      keyword,
    ]);
  }

  for (const subject of extractSubjects(esMeta)) {
    await client.query("INSERT INTO catalogue.record_subjects (record_id, subject) VALUES ($1, $2)", [
      recordId,
      subject,
    ]);
  }

  for (const format of extractFormats(esMeta)) {
    await client.query("INSERT INTO catalogue.record_formats (record_id, format) VALUES ($1, $2)", [
      recordId,
      format,
    ]);
  }
}

export async function syncCatalogue({ maxPages = null, logger = console } = {}) {
  const client = await pool.connect();
  let syncRunId = null;
  let processed = 0;
  let totalCount = null;
  const seenSaeonIds = new Set();

  try {
    const run = await client.query(
      "INSERT INTO catalogue.sync_run (status) VALUES ('running') RETURNING id"
    );
    syncRunId = run.rows[0].id;

    let after = null;
    let page = 0;
    const query = `
      query SyncAll($after: String, $size: Int) {
        catalogue {
          search(size: $size, after: $after) {
            totalCount
            pageSize
            pageInfo {
              hasNextPage
              endCursor
            }
            records {
              id
              downloadCount
              metadata
            }
          }
        }
      }
    `;

    while (true) {
      page += 1;
      if (maxPages && page > maxPages) break;

      logger.log(`Fetching SAEON catalogue page ${page}`);
      const data = await callGraphQL(query, { after, size: PAGE_SIZE });
      const search = data.catalogue.search;
      const records = search.records || [];
      const pageInfo = search.pageInfo || {};

      if (totalCount === null) totalCount = search.totalCount;
      if (records.length === 0) break;

      await client.query("BEGIN");
      try {
        for (const record of records) {
          if (record?.id) seenSaeonIds.add(record.id);
          await upsertRecord(client, record);
          processed += 1;
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }

      await client.query(
        "UPDATE catalogue.sync_run SET total_count = $1, processed_count = $2 WHERE id = $3",
        [totalCount, processed, syncRunId]
      );

      const hasNextFlag = Boolean(pageInfo.hasNextPage);
      const likelyMoreByCount = totalCount > processed;
      const nextAfter =
        typeof pageInfo.endCursor === "string"
          ? pageInfo.endCursor
          : pageInfo.endCursor
            ? JSON.stringify(pageInfo.endCursor)
            : null;

      if (!hasNextFlag && !likelyMoreByCount) break;
      if (!nextAfter) break;
      after = nextAfter;
    }

    if (!maxPages && seenSaeonIds.size > 0) {
      await client.query(
        "DELETE FROM catalogue.catalogue_records WHERE NOT (saeon_id = ANY($1::text[]))",
        [Array.from(seenSaeonIds)]
      );
    }

    await client.query(
      `
        UPDATE catalogue.sync_run
        SET finished_at = now(), status = 'success', total_count = $1, processed_count = $2
        WHERE id = $3
      `,
      [totalCount, processed, syncRunId]
    );

    await refreshCatalogueSearchIndex(client);
    await refreshCatalogueEssentialVariables({ client, logger });

    return { status: "success", totalCount, processedCount: processed };
  } catch (error) {
    if (syncRunId) {
      await client.query(
        `
          UPDATE catalogue.sync_run
          SET finished_at = now(), status = 'failed', total_count = $1, processed_count = $2, error_message = $3
          WHERE id = $4
        `,
        [totalCount, processed, error.message, syncRunId]
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

async function catalogueSyncIsStale(staleAfterHours) {
  if (!Number.isFinite(staleAfterHours) || staleAfterHours <= 0) return false;
  const result = await pool.query(
    `
      SELECT finished_at
      FROM catalogue.sync_run
      WHERE status = 'success'
      ORDER BY finished_at DESC NULLS LAST, started_at DESC
      LIMIT 1
    `
  );
  const finishedAt = result.rows[0]?.finished_at ? new Date(result.rows[0].finished_at) : null;
  if (!finishedAt || Number.isNaN(finishedAt.getTime())) return true;
  return Date.now() - finishedAt.getTime() > staleAfterHours * 60 * 60 * 1000;
}

export function startCatalogueSyncScheduler({ runOnStart = false, staleAfterHours = 26 } = {}) {
  if (activeSync) return activeSync;

  async function runScheduledSync() {
    try {
      console.log("Starting scheduled SAEON catalogue sync");
      const result = await syncCatalogue();
      console.log("Scheduled SAEON catalogue sync complete", result);
    } catch (error) {
      console.error("Scheduled SAEON catalogue sync failed:", error);
    } finally {
      scheduleNextRun();
    }
  }

  function scheduleNextRun() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const delayMs = Math.max(1000, next.getTime() - now.getTime());
    activeSync = setTimeout(runScheduledSync, delayMs);
    activeSync.unref?.();
    console.log(`Next SAEON catalogue sync scheduled for ${next.toISOString()}`);
  }

  if (runOnStart) {
    setTimeout(runScheduledSync, 5000).unref?.();
  } else {
    catalogueSyncIsStale(staleAfterHours)
      .then((isStale) => {
        if (isStale) {
          console.log(`SAEON catalogue sync is older than ${staleAfterHours} hours; scheduling startup refresh`);
          setTimeout(runScheduledSync, 5000).unref?.();
        } else {
          scheduleNextRun();
        }
      })
      .catch((error) => {
        console.error("Could not check SAEON catalogue sync freshness:", error);
        scheduleNextRun();
      });
  }

  return activeSync;
}
