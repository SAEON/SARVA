import { Router } from "express";
import { pool } from "../db/pool.js";

export const siteRouter = Router();

const SNAPSHOT_KEY = "home-hero-highlights";

function localDateKey(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function freshnessLabel(value) {
  if (!value) return "cached";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "cached";
  const updatedDate = localDateKey(date);
  const today = localDateKey();
  const yesterday = localDateKey(Date.now() - 24 * 60 * 60 * 1000);
  if (updatedDate === today) return "updated today";
  if (updatedDate === yesterday) return "updated yesterday";
  return "cached";
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(number);
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function placeLabel(row) {
  return [row.municipality, row.province].filter(Boolean).join(", ") || "South Africa";
}

function scoreBand(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "No signal";
  if (score >= 80) return "Very high";
  if (score >= 60) return "High";
  if (score >= 40) return "Moderate";
  if (score >= 20) return "Low";
  return "Very low";
}

function severityKey(value) {
  const band = scoreBand(value).toLowerCase().replace(/\s+/g, "-");
  return band === "no-signal" ? "unknown" : band;
}

function hazardHighlight({ label, value, detail, row, mapMode, tag, severityScore, explainer }) {
  return {
    label,
    value,
    detail: `${detail} | ${placeLabel(row)} | ${formatDate(row.forecastDate) || "forecast window"}`,
    tag,
    severity: scoreBand(severityScore),
    severityKey: severityKey(severityScore),
    explainer,
    freshness: freshnessLabel(row.updatedAt),
    updatedAt: row.updatedAt || null,
    updatedAtLabel: formatDateTime(row.updatedAt),
    location: placeLabel(row),
    forecastDate: formatDate(row.forecastDate),
    latitude: Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
    longitude: Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
    mapMode,
    source: "ECMWF Open Data IFS 0.25 degree forecast, cached by SARVA",
  };
}

async function buildHomeHighlights() {
  const [
    forecast,
    glanceFacts,
    summaryCounts,
  ] = await Promise.all([
    pool.query(`
      WITH latest_run AS (
        SELECT id, source, finished_at, point_count
        FROM sarva.forecast_risk_sync_run
        WHERE status = 'success'
        ORDER BY (source = 'ecmwf-open-data') DESC, finished_at DESC NULLS LAST, started_at DESC
        LIMIT 1
      ),
      base AS (
        SELECT
          p.forecast_date AS "forecastDate",
          p.rainfall_mm::double precision AS "rainfallMm",
          p.temperature_max_c::double precision AS "temperatureMaxC",
          p.wind_max_kmh::double precision AS "windMaxKmh",
          p.rain_risk_score::double precision AS "rainRiskScore",
          p.heat_risk_score::double precision AS "heatRiskScore",
          p.wind_risk_score::double precision AS "windRiskScore",
          p.fire_risk_score::double precision AS "fireRiskScore",
          p.overall_risk_score::double precision AS "overallRiskScore",
          p.dominant_hazard AS "dominantHazard",
          p.latitude,
          p.longitude,
          lr.finished_at AS "updatedAt",
          lr.source
        FROM latest_run lr
        JOIN sarva.forecast_risk_points p ON p.sync_run_id = lr.id
      ),
      selected AS (
        SELECT 'overall' AS kind, b.*
        FROM (SELECT * FROM base ORDER BY "overallRiskScore" DESC NULLS LAST, "rainfallMm" DESC NULLS LAST LIMIT 1) b
        UNION ALL
        SELECT 'rainfall' AS kind, b.*
        FROM (SELECT * FROM base ORDER BY "rainfallMm" DESC NULLS LAST LIMIT 1) b
        UNION ALL
        SELECT 'heat' AS kind, b.*
        FROM (SELECT * FROM base ORDER BY "temperatureMaxC" DESC NULLS LAST LIMIT 1) b
        UNION ALL
        SELECT 'wind' AS kind, b.*
        FROM (SELECT * FROM base ORDER BY "windMaxKmh" DESC NULLS LAST LIMIT 1) b
        UNION ALL
        SELECT 'fire' AS kind, b.*
        FROM (SELECT * FROM base ORDER BY "fireRiskScore" DESC NULLS LAST, "windMaxKmh" DESC NULLS LAST LIMIT 1) b
      ),
      enriched AS (
        SELECT
          s.*,
          COALESCE(m.municname, m.map_title) AS municipality,
          m.province
        FROM selected s
        LEFT JOIN LATERAL (
          SELECT municname, map_title, province
          FROM sarva.municipal_boundaries mb
          WHERE ST_Contains(ST_Transform(mb.geom, 4326), ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326))
          LIMIT 1
        ) m ON true
      )
      SELECT
        (SELECT row_to_json(e) FROM enriched e WHERE kind = 'overall' LIMIT 1) AS overall,
        (SELECT row_to_json(e) FROM enriched e WHERE kind = 'rainfall' LIMIT 1) AS rainfall,
        (SELECT row_to_json(e) FROM enriched e WHERE kind = 'heat' LIMIT 1) AS heat,
        (SELECT row_to_json(e) FROM enriched e WHERE kind = 'wind' LIMIT 1) AS wind,
        (SELECT row_to_json(e) FROM enriched e WHERE kind = 'fire' LIMIT 1) AS fire,
        (SELECT min("forecastDate") FROM base) AS "startDate",
        (SELECT max("forecastDate") FROM base) AS "endDate"
    `),
    pool.query(`
      SELECT section, fact, value, unit, place, source, source_type AS "sourceType", updated, note
      FROM sarva.south_africa_at_a_glance_fact
      WHERE status = 'available'
      ORDER BY sort_order, section, fact
    `),
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM catalogue.catalogue_records) AS "catalogueRecords",
        (SELECT count(*)::int FROM sarva.resources WHERE COALESCE(is_active, true) = true) AS "resourceRecords",
        (SELECT count(*)::int FROM sarva.glossary_term WHERE is_active = true) AS "glossaryTerms",
        (SELECT count(*)::int FROM sarva.national_policy_legislation WHERE COALESCE(is_active, true) = true) AS "policyRecords",
        (
          SELECT count(*)::int
          FROM sarva.loggernet_site_mappings
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
        ) AS "observationSites"
    `),
  ]);

  const forecastRow = forecast.rows[0] || {};
  const forecastStartDate = formatDate(forecastRow.startDate);
  const forecastEndDate = formatDate(forecastRow.endDate);
  const forecastRange = forecastStartDate && forecastEndDate
    ? `${forecastStartDate} to ${forecastEndDate}`
    : "next 5 days";
  const overall = forecastRow.overall || {};
  const rainfall = forecastRow.rainfall || {};
  const heat = forecastRow.heat || {};
  const wind = forecastRow.wind || {};
  const fire = forecastRow.fire || {};

  return {
    generatedAt: new Date().toISOString(),
    title: "Risk and hazard highlights",
    summary: `Public-facing screening highlights from the cached ${forecastRange} forecast window.`,
    highlights: [
      hazardHighlight({
        label: "Overall forecast outlook",
        value: overall.overallRiskScore === null || overall.overallRiskScore === undefined
          ? "--"
          : scoreBand(overall.overallRiskScore),
        detail: `${overall.dominantHazard || "Environmental"} signal, ${formatNumber(overall.overallRiskScore)}/100`,
        row: overall,
        mapMode: "environmental-risk",
        tag: "5-day outlook",
        severityScore: overall.overallRiskScore,
        explainer: "Highest SARVA screening signal across rain, heat, wind and fire-weather layers.",
      }),
      hazardHighlight({
        label: "Rainfall watch",
        value: rainfall.rainfallMm === null || rainfall.rainfallMm === undefined
          ? "--"
          : `${formatNumber(rainfall.rainfallMm)} mm/day`,
        detail: `${scoreBand(rainfall.rainRiskScore)} rain/flood screening signal`,
        row: rainfall,
        mapMode: "forecast-risk",
        tag: "Rainfall",
        severityScore: rainfall.rainRiskScore,
        explainer: "Highest forecast daily rainfall total in the current ECMWF cache.",
      }),
      hazardHighlight({
        label: "Hottest forecast area",
        value: heat.temperatureMaxC === null || heat.temperatureMaxC === undefined
          ? "--"
          : `${formatNumber(heat.temperatureMaxC)} °C`,
        detail: `${scoreBand(heat.heatRiskScore)} heat screening signal`,
        row: heat,
        mapMode: "heat-risk",
        tag: "Heat",
        severityScore: heat.heatRiskScore,
        explainer: "Highest forecast maximum temperature over the cached forecast window.",
      }),
      hazardHighlight({
        label: "Strongest forecast wind",
        value: wind.windMaxKmh === null || wind.windMaxKmh === undefined
          ? "--"
          : `${formatNumber(wind.windMaxKmh)} km/h`,
        detail: `${scoreBand(wind.windRiskScore)} wind screening signal`,
        row: wind,
        mapMode: "wind-risk",
        tag: "Wind",
        severityScore: wind.windRiskScore,
        explainer: "Strongest forecast 10 m wind speed in the current ECMWF cache.",
      }),
      hazardHighlight({
        label: "Fire-weather watch",
        value: fire.fireRiskScore === null || fire.fireRiskScore === undefined
          ? "--"
          : scoreBand(fire.fireRiskScore),
        detail: `Heat, wind and forecast dryness, ${formatNumber(fire.fireRiskScore)}/100`,
        row: fire,
        mapMode: "fire-risk",
        tag: "Fire weather",
        severityScore: fire.fireRiskScore,
        explainer: "Screening proxy combining heat, wind and dry forecast conditions.",
      }),
    ],
    atAGlance: glanceFacts.rows,
    portalStats: summaryCounts.rows[0] || {},
    sourceSummary: {
      forecast: forecastRow,
      atAGlanceCount: glanceFacts.rows.length,
      portalStats: summaryCounts.rows[0] || {},
    },
  };
}

async function getPortalStats() {
  const result = await pool.query(`
    WITH institution_facets AS (
      SELECT
        min(btrim(provider_name)) AS label,
        min(provider_key) FILTER (WHERE provider_key IS NOT NULL AND btrim(provider_key) <> '') AS key,
        min(saeon_id) AS "sampleRecordId",
        count(*)::int AS count
      FROM catalogue.catalogue_records
      WHERE provider_name IS NOT NULL
        AND btrim(provider_name) <> ''
      GROUP BY lower(btrim(provider_name))
    ),
    provider_facets AS (
      SELECT
        min(btrim(publisher_name)) AS label,
        min(saeon_id) AS "sampleRecordId",
        count(*)::int AS count
      FROM catalogue.catalogue_records
      WHERE publisher_name IS NOT NULL
        AND btrim(publisher_name) <> ''
      GROUP BY lower(btrim(publisher_name))
    ),
    collection_facets AS (
      SELECT
        min(btrim(collection_name)) AS label,
        min(collection_key) FILTER (WHERE collection_key IS NOT NULL AND btrim(collection_key) <> '') AS key,
        min(saeon_id) AS "sampleRecordId",
        count(*)::int AS count
      FROM catalogue.catalogue_records
      WHERE collection_name IS NOT NULL
        AND btrim(collection_name) <> ''
      GROUP BY lower(btrim(collection_name))
    ),
    observation_site_facets AS (
      SELECT
        COALESCE(display_name, station_name) AS label,
        station_name,
        website_url AS "websiteUrl",
        doi
      FROM sarva.loggernet_site_mappings
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
    )
    SELECT
      (SELECT count(*)::int FROM catalogue.catalogue_records) AS "catalogueRecords",
      (SELECT count(*)::int FROM institution_facets) AS "catalogueInstitutions",
      (SELECT count(*)::int FROM provider_facets) AS "catalogueProviders",
      (SELECT count(*)::int FROM collection_facets) AS "catalogueCollections",
      (
        SELECT count(*)::int
        FROM sarva.loggernet_site_mappings
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
      ) AS "observationSites",
      (
        SELECT finished_at
        FROM catalogue.sync_run
        WHERE status = 'success'
        ORDER BY finished_at DESC NULLS LAST, started_at DESC
        LIMIT 1
      ) AS "catalogueSyncedAt",
      (SELECT max(updated_at) FROM sarva.resources WHERE COALESCE(is_active, true) = true) AS "resourcesSyncedAt",
      (SELECT max(updated_at) FROM sarva.glossary_term WHERE is_active = true) AS "glossarySyncedAt",
      (SELECT max(updated_at) FROM sarva.national_policy_legislation WHERE COALESCE(is_active, true) = true) AS "policySyncedAt",
      (SELECT max(updated_at) FROM sarva.loggernet_site_mappings) AS "observationSitesSyncedAt",
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'key', key, 'sampleRecordId', "sampleRecordId", 'count', count) ORDER BY count DESC, label), '[]'::jsonb)
        FROM institution_facets
      ) AS "institutions",
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'sampleRecordId', "sampleRecordId", 'count', count) ORDER BY count DESC, label), '[]'::jsonb)
        FROM provider_facets
      ) AS "providers",
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'key', key, 'sampleRecordId', "sampleRecordId", 'count', count) ORDER BY count DESC, label), '[]'::jsonb)
        FROM collection_facets
      ) AS "collections",
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'stationName', station_name, 'websiteUrl', "websiteUrl", 'doi', doi) ORDER BY label), '[]'::jsonb)
        FROM observation_site_facets
      ) AS "observationSiteList"
  `);

  return result.rows[0] || {};
}

async function getHomeHighlights() {
  const cached = await pool.query(
    `
      SELECT generated_at AS "generatedAt", expires_at AS "expiresAt", payload, source_summary AS "sourceSummary"
      FROM sarva.site_intelligence_snapshot
      WHERE snapshot_key = $1
        AND expires_at > now()
        AND NOT EXISTS (
          SELECT 1
          FROM sarva.forecast_risk_sync_run run
          WHERE run.status = 'success'
            AND COALESCE(run.finished_at, run.started_at) > generated_at
        )
        AND jsonb_typeof(payload #> '{highlights,0,latitude}') = 'number'
        AND jsonb_typeof(payload #> '{highlights,0,longitude}') = 'number'
      ORDER BY generated_at DESC
      LIMIT 1
    `,
    [SNAPSHOT_KEY]
  );

  if (cached.rows[0]) {
    return {
      ...cached.rows[0].payload,
      generatedAt: cached.rows[0].generatedAt,
      expiresAt: cached.rows[0].expiresAt,
      cached: true,
    };
  }

  const snapshot = await buildHomeHighlights();
  const saved = await pool.query(
    `
      INSERT INTO sarva.site_intelligence_snapshot
        (snapshot_key, generated_at, expires_at, payload, source_summary)
      VALUES ($1, now(), now() + interval '1 day', $2::jsonb, $3::jsonb)
      ON CONFLICT (snapshot_key)
      DO UPDATE SET
        generated_at = EXCLUDED.generated_at,
        expires_at = EXCLUDED.expires_at,
        payload = EXCLUDED.payload,
        source_summary = EXCLUDED.source_summary
      RETURNING generated_at AS "generatedAt", expires_at AS "expiresAt", payload
    `,
    [SNAPSHOT_KEY, JSON.stringify(snapshot), JSON.stringify(snapshot.sourceSummary)]
  );

  return {
    ...saved.rows[0].payload,
    generatedAt: saved.rows[0].generatedAt,
    expiresAt: saved.rows[0].expiresAt,
    cached: false,
  };
}

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

siteRouter.get("/stats", async (_req, res) => {
  try {
    const [data, portalStats] = await Promise.all([
      getHomeHighlights(),
      getPortalStats(),
    ]);

    res.json({
      status: "ok",
      data: {
        ...data,
        portalStats,
        sourceSummary: {
          ...(data.sourceSummary || {}),
          portalStats,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching site stats", error);
    res.status(500).json({
      status: "error",
      message: "Site highlights could not be loaded",
    });
  }
});
