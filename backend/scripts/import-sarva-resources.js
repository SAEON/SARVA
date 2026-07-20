import "dotenv/config";
import crypto from "crypto";
import https from "https";
import { URL } from "url";
import { pool } from "../src/db/pool.js";

const SOURCE_PAGE = "https://sarva.saeon.ac.za/resources/";
const USER_AGENT = "Mozilla/5.0 SARVA resources importer";
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 20000;

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function normaliseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
    ndash: "-",
    mdash: "-",
  };

  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return named[lower] || match;
  });
}

function stripTags(value) {
  return normaliseWhitespace(decodeHtml(String(value || "").replace(/<[^>]*>/g, " ")));
}

function extractAttribute(value, attr) {
  const match = String(value || "").match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? decodeHtml(match[1]).trim() : null;
}

function absoluteUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl, SOURCE_PAGE).toString();
  } catch {
    return null;
  }
}

function splitKeywords(value) {
  return normaliseWhitespace(value)
    .replace(/,+$/g, "")
    .split(",")
    .map((keyword) => normaliseWhitespace(keyword).replace(/,+$/g, ""))
    .filter(Boolean);
}

function stableIdentifier(record) {
  const identityParts = record.url
    ? ["url", normaliseWhitespace(record.url).toLowerCase()]
    : [
        "record",
        normaliseWhitespace(record.title).toLowerCase(),
        normaliseWhitespace(record.author).toLowerCase(),
      ];

  return crypto
    .createHash("sha256")
    .update(identityParts.join("|"))
    .digest("hex");
}

function parseRows(html) {
  const tableMatch = html.match(/<table\b[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    throw new Error("No resource table found in source HTML");
  }

  const tableHtml = tableMatch[0];
  const paginationMode = {
    tableClass: extractAttribute(tableHtml, "class") || "",
    itemsPerPage: extractAttribute(tableHtml, "data-items-per-page"),
    rowsInHtml: 0,
  };

  const rowMatches = [...tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const dataRows = rowMatches.filter((row) => /<td\b/i.test(row));
  paginationMode.rowsInHtml = dataRows.length;

  const records = [];
  const malformed = [];

  dataRows.forEach((rowHtml, index) => {
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);

    if (cells.length < 5) {
      malformed.push({ row: index + 1, reason: `Expected 5 cells, found ${cells.length}` });
      return;
    }

    const linkMatch = cells[0].match(/<a\b[\s\S]*?<\/a>/i);
    const linkHtml = linkMatch ? linkMatch[0] : cells[0];
    const title = stripTags(linkHtml);
    const url = absoluteUrl(linkMatch ? extractAttribute(linkHtml, "href") : null);
    const author = stripTags(cells[1]) || null;
    const publicationYear = stripTags(cells[2]) || null;
    const resourceType = stripTags(cells[3]) || null;
    const keywords = splitKeywords(stripTags(cells[4]));

    if (!title) {
      malformed.push({ row: index + 1, reason: "Missing title" });
      return;
    }

    const record = {
      title,
      url,
      author,
      publication_year: publicationYear,
      resource_type: resourceType,
      keywords,
      source_page: SOURCE_PAGE,
    };

    record.source_identifier = stableIdentifier(record);
    records.push(record);
  });

  const seen = new Set();
  const deduped = [];
  let duplicatesSkipped = 0;

  for (const record of records) {
    const key = record.url ? `url:${record.url.toLowerCase()}` : `source:${record.source_identifier}`;
    if (seen.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }
    seen.add(key);
    deduped.push(record);
  }

  return {
    records: deduped,
    malformed,
    duplicatesSkipped,
    paginationMode,
  };
}

function requestOnce(url, { rejectUnauthorized }) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        timeout: TIMEOUT_MS,
        rejectUnauthorized,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
      },
      (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          requestOnce(new URL(response.headers.location, url).toString(), { rejectUnauthorized })
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Unexpected status ${response.statusCode}`));
          return;
        }

        let html = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          html += chunk;
        });
        response.on("end", () => resolve(html));
      }
    );

    request.on("timeout", () => request.destroy(new Error("Request timed out")));
    request.on("error", reject);
  });
}

async function fetchSourceHtml() {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    for (const rejectUnauthorized of [true, false]) {
      try {
        if (!rejectUnauthorized) {
          console.warn("Retrying source request without TLS certificate verification.");
        }
        return await requestOnce(SOURCE_PAGE, { rejectUnauthorized });
      } catch (error) {
        lastError = error;
      }
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw lastError;
}

async function upsertRecords(records) {
  const client = await pool.connect();
  const stats = { inserted: 0, updated: 0 };

  try {
    await client.query("BEGIN");

    for (const record of records) {
      const result = await client.query(
        `
          INSERT INTO sarva.resources (
            title,
            url,
            author,
            publication_year,
            resource_type,
            keywords,
            source_page,
            source_identifier
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (source_identifier)
          DO UPDATE SET
            title = EXCLUDED.title,
            url = EXCLUDED.url,
            author = EXCLUDED.author,
            publication_year = EXCLUDED.publication_year,
            resource_type = EXCLUDED.resource_type,
            keywords = EXCLUDED.keywords,
            source_page = EXCLUDED.source_page,
            updated_at = now()
          RETURNING (xmax = 0) AS inserted
        `,
        [
          record.title,
          record.url,
          record.author,
          record.publication_year,
          record.resource_type,
          record.keywords,
          record.source_page,
          record.source_identifier,
        ]
      );

      if (result.rows[0]?.inserted) stats.inserted += 1;
      else stats.updated += 1;
    }

    await client.query("COMMIT");
    return stats;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function qualityReview(records) {
  const urls = new Map();
  const titleAuthors = new Map();

  for (const record of records) {
    if (record.url) urls.set(record.url.toLowerCase(), (urls.get(record.url.toLowerCase()) || 0) + 1);
    const titleAuthor = `${record.title.toLowerCase()}|${(record.author || "").toLowerCase()}`;
    titleAuthors.set(titleAuthor, (titleAuthors.get(titleAuthor) || 0) + 1);
  }

  return {
    missingTitles: records.filter((record) => !record.title).length,
    missingUrls: records.filter((record) => !record.url).length,
    duplicateUrls: [...urls.values()].filter((count) => count > 1).length,
    duplicateTitleAuthor: [...titleAuthors.values()].filter((count) => count > 1).length,
    invalidPublicationYears: records.filter(
      (record) => record.publication_year && !/^\d{4}$/.test(record.publication_year)
    ).length,
    blankAuthors: records.filter((record) => !record.author).length,
    blankResourceTypes: records.filter((record) => !record.resource_type).length,
    malformedKeywords: records.filter((record) => record.keywords.some((keyword) => /,$/.test(keyword))).length,
  };
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const html = await fetchSourceHtml();
  const { records, malformed, duplicatesSkipped, paginationMode } = parseRows(html);

  console.log(`Source records found: ${paginationMode.rowsInHtml}`);
  console.log(`Client-side table items per page: ${paginationMode.itemsPerPage || "not declared"}`);
  console.log(`Records after de-duplication: ${records.length}`);
  console.log(`Duplicates skipped: ${duplicatesSkipped}`);
  console.log(`Malformed records: ${malformed.length}`);

  for (const item of malformed) {
    console.warn(`Malformed row ${item.row}: ${item.reason}`);
  }

  console.log("Quality review:", JSON.stringify(qualityReview(records), null, 2));

  if (dryRun) {
    console.log("Dry run complete; no database changes made.");
    return;
  }

  const stats = await upsertRecords(records);
  console.log(`Records inserted: ${stats.inserted}`);
  console.log(`Records updated: ${stats.updated}`);
}

main()
  .catch((error) => {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

export { parseRows, qualityReview, stableIdentifier };
