import "dotenv/config";
import https from "https";
import { URL } from "url";
import { pool } from "../src/db/pool.js";

const SOURCE_PAGE = "https://sarva.saeon.ac.za/glossary/";
const USER_AGENT = "Mozilla/5.0 SARVA glossary importer";
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
    ldquo: "\"",
    lsquo: "'",
    lt: "<",
    mdash: "-",
    nbsp: " ",
    ndash: "-",
    quot: "\"",
    rdquo: "\"",
    rsquo: "'",
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

function parseRows(html) {
  const tableMatch = html.match(/<table\b[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    throw new Error("No glossary table found in source HTML");
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

    if (cells.length < 2) {
      malformed.push({ row: index + 1, reason: `Expected 2 cells, found ${cells.length}` });
      return;
    }

    const term = stripTags(cells[0]);
    const definition = stripTags(cells[1]);

    if (!term || !definition) {
      malformed.push({ row: index + 1, reason: "Missing term or definition" });
      return;
    }

    records.push({
      term,
      definition,
      category: null,
      source: SOURCE_PAGE,
    });
  });

  const seen = new Set();
  const deduped = [];
  let duplicatesSkipped = 0;

  for (const record of records) {
    const key = record.term.toLowerCase();
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
      const existing = await client.query(
        `
          SELECT id
          FROM sarva.glossary_term
          WHERE lower(term) = lower($1)
          LIMIT 1
        `,
        [record.term]
      );

      if (existing.rowCount > 0) {
        await client.query(
          `
            UPDATE sarva.glossary_term
            SET
              term = $1,
              definition = $2,
              category = $3,
              source = $4,
              is_active = true,
              updated_at = now()
            WHERE id = $5
          `,
          [
            record.term,
            record.definition,
            record.category,
            record.source,
            existing.rows[0].id,
          ]
        );
        stats.updated += 1;
      } else {
        await client.query(
          `
            INSERT INTO sarva.glossary_term (
              term,
              definition,
              category,
              source,
              is_active
            )
            VALUES ($1, $2, $3, $4, true)
          `,
          [record.term, record.definition, record.category, record.source]
        );
        stats.inserted += 1;
      }
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

async function main() {
  const dryRun = hasFlag("--dry-run");
  const html = await fetchSourceHtml();
  const parsed = parseRows(html);

  console.log(
    JSON.stringify(
      {
        source: SOURCE_PAGE,
        rowsInHtml: parsed.paginationMode.rowsInHtml,
        itemsPerPage: parsed.paginationMode.itemsPerPage,
        parsedRecords: parsed.records.length,
        duplicatesSkipped: parsed.duplicatesSkipped,
        malformedRows: parsed.malformed,
        dryRun,
      },
      null,
      2
    )
  );

  if (dryRun) return;

  const stats = await upsertRecords(parsed.records);
  console.log(JSON.stringify({ imported: parsed.records.length, ...stats }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
