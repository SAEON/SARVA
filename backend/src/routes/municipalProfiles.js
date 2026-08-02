import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAdmin } from "../utils/authSession.js";

export const municipalProfilesRouter = Router();

const PROFILE_DESCRIPTION =
  "Municipal risk profiles combine MDB municipal boundaries with SARVA cached forecast risk layers and observation-site metadata. They are screening profiles for exploration and planning support, not official warnings.";

const CALCULATION_NOTES = [
  {
    title: "Raw values",
    body: "Raw values are source measurements, such as population counts, crime cases, percentages or service-access values. They are retained separately from comparison scores.",
  },
  {
    title: "Comparison scores",
    body: "The map uses normalized 0-100 values so municipalities can be compared spatially. Imported sa_risk rows use source value_0_100 where present; otherwise values are min-max normalized within the same indicator, period and scenario.",
  },
  {
    title: "Risk direction",
    body: "Indicators marked higher_risk contribute directly to risk pressure. Indicators marked higher_resilience are inverted as 100 - score before they contribute to risk pressure. Context indicators are shown but excluded from composite pressure calculations.",
  },
  {
    title: "Composite indices",
    body: "Composite indices are weighted averages of component indicator comparison scores. Imported category indices use equal weights within the category; the imported overall composite is balanced by domain so larger indicator families, such as crime, do not dominate only because they contain more rows.",
  },
  {
    title: "Trends",
    body: "Trend analysis uses all available period/scenario rows for the selected municipality and indicator. It displays raw values when available and retains normalized scores for cross-municipality comparison.",
  },
];

const INDEX_PRESENTATION = {
  imported_composite_risk: {
    label: "Municipal risk overview",
    description:
      "Balanced screening overview combining available people, services, safety and governance indicators. Use it as a starting point, then inspect the category indices and drivers.",
  },
  imported_governance_risk: {
    label: "Governance and finance pressure",
    description:
      "Composite of available audit, municipal finance, infrastructure investment and institutional-capacity indicators.",
  },
  crime_safety_imported: {
    label: "Combined safety pressure",
    description:
      "Roll-up of available SAPS safety indicators. Use the specific violent contact, property, sexual violence and public-order layers for interpretation.",
  },
  stats_sa_vulnerability_imported: {
    label: "People and vulnerability context",
  },
  service_access_imported: {
    label: "Basic service access pressure",
  },
};

function presentIndex(row) {
  const presentation = INDEX_PRESENTATION[row.key] || {};
  return {
    ...row,
    label: presentation.label || row.label,
    description: presentation.description || row.description,
  };
}

function scoreLabel(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "Unknown";
  if (value >= 80) return "Very high";
  if (value >= 60) return "High";
  if (value >= 40) return "Moderate";
  if (value >= 20) return "Low";
  return "Very low";
}

function numberOrNull(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function bboxFromRow(row) {
  const values = [row.minx, row.miny, row.maxx, row.maxy].map(Number);
  return values.every(Number.isFinite) ? values : null;
}

function normaliseIndicator(row) {
  const value = numberOrNull(row.value, 1);
  const rawValue = numberOrNull(row.raw_value, 3);
  const adjustedValue = numberOrNull(row.adjusted_value, 1);
  return {
    key: row.key,
    label: row.label,
    theme: row.theme,
    description: row.description,
    unit: row.unit,
    direction: row.direction,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    isProxy: Boolean(row.is_proxy),
    value,
    normalizedValue: value,
    rawValue,
    displayValue: rawValue ?? value,
    displayUnit: row.raw_unit || row.unit,
    adjustedValue,
    riskLabel: scoreLabel(adjustedValue ?? value),
    confidence: row.confidence,
    period: row.period,
    scenario: row.scenario,
    notes: row.notes,
  };
}

function latestIndicatorValuesSql(whereSql = "") {
  return `
    WITH latest_values AS (
      SELECT DISTINCT ON (v.municipality_gid, v.indicator_key)
        v.*
      FROM sarva.municipal_indicator_value v
      ${whereSql}
      ORDER BY
        v.municipality_gid,
        v.indicator_key,
        (v.confidence <> 'proxy') DESC,
        v.period DESC,
        v.updated_at DESC
    )
  `;
}

function publicIndicatorRow(row) {
  const rawValue = numberOrNull(row.raw_value, 3);
  const normalizedValue = numberOrNull(row.value, 1);
  return {
    key: row.key,
    label: row.label,
    theme: row.theme,
    unit: row.unit,
    direction: row.direction,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    isProxy: Boolean(row.is_proxy),
    period: row.period,
    scenario: row.scenario,
    confidence: row.confidence,
    rawValue,
    displayValue: rawValue ?? normalizedValue,
    displayUnit: row.raw_unit || row.unit,
    normalizedValue,
    adjustedValue: numberOrNull(row.adjusted_value, 1),
  };
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanDirection(value) {
  return ["higher_risk", "higher_resilience", "context"].includes(value) ? value : "higher_risk";
}

async function resolveMunicipalityGid(client, value) {
  const text = cleanText(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);

  const result = await client.query(
    `
      SELECT gid
      FROM sarva.municipal_boundaries
      WHERE lower(namecode) = lower($1)
         OR lower(municname) = lower($1)
         OR lower(map_title) = lower($1)
         OR lower(substring(namecode from '\\(([A-Z]{2,3}[0-9]{0,3}|[A-Z]{3})\\)$')) = lower($1)
      ORDER BY gid
      LIMIT 1
    `,
    [text]
  );
  return result.rows[0]?.gid || null;
}

municipalProfilesRouter.get("/municipalities", async (req, res) => {
  const search = String(req.query.search || req.query.q || "").trim();
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "260", 10) || 260, 1), 260);

  try {
    const values = [];
    let where = "";
    if (search) {
      values.push(`%${search}%`);
      where = `
        WHERE municname ILIKE $1
           OR map_title ILIKE $1
           OR namecode ILIKE $1
           OR district_n ILIKE $1
           OR province ILIKE $1
      `;
    }
    values.push(limit);

    const result = await pool.query(
      `
        WITH base AS (
          SELECT
            gid,
            COALESCE(NULLIF(municname, ''), NULLIF(map_title, ''), 'Municipality') AS municipality,
            province,
            district_n,
            namecode,
            ST_Transform(geom, 4326) AS geom4326
          FROM sarva.municipal_boundaries
          ${where}
        ),
        extents AS (
          SELECT
            gid,
            municipality,
            province,
            district_n AS "district",
            namecode AS code,
            ST_XMin(ST_Extent(geom4326)) AS minx,
            ST_YMin(ST_Extent(geom4326)) AS miny,
            ST_XMax(ST_Extent(geom4326)) AS maxx,
            ST_YMax(ST_Extent(geom4326)) AS maxy,
            ST_X(ST_PointOnSurface(ST_Collect(geom4326))) AS longitude,
            ST_Y(ST_PointOnSurface(ST_Collect(geom4326))) AS latitude
          FROM base
          GROUP BY gid, municipality, province, district_n, namecode
        )
        SELECT *
        FROM extents
        ORDER BY municipality
        LIMIT $${values.length}
      `,
      values
    );

    res.json({
      status: "ok",
      data: {
        count: result.rows.length,
        records: result.rows.map((row) => ({
          gid: row.gid,
          municipality: row.municipality,
          province: row.province,
          district: row.district,
          code: row.code,
          longitude: numberOrNull(row.longitude, 6),
          latitude: numberOrNull(row.latitude, 6),
          bbox: bboxFromRow(row),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching municipalities", error);
    res.status(500).json({ status: "error", message: "Municipalities could not be loaded." });
  }
});

municipalProfilesRouter.get("/municipalities/metric", async (req, res) => {
  const metric = String(req.query.metric || "index:imported_composite_risk").trim();
  const [kind, key] = metric.includes(":") ? metric.split(":", 2) : ["index", metric];
  const safeKind = kind === "indicator" ? "indicator" : "index";

  try {
    if (safeKind === "indicator") {
      const result = await pool.query(
        `
          ${latestIndicatorValuesSql("WHERE v.indicator_key = $1")}
          SELECT
            mb.gid,
            COALESCE(NULLIF(mb.municname, ''), NULLIF(mb.map_title, ''), 'Municipality') AS municipality,
            d.key,
            d.label,
            d.theme,
            d.unit,
            d.direction,
            d.source_name,
            d.source_url,
            d.is_proxy,
            v.period,
            v.scenario,
            v.value::double precision AS normalized_value,
            v.raw_value::double precision AS raw_value,
            COALESCE(v.raw_unit, d.unit) AS display_unit,
            CASE WHEN d.direction = 'higher_resilience' THEN 100 - v.value ELSE v.value END::double precision AS map_value,
            v.confidence
          FROM sarva.municipal_boundaries mb
          JOIN latest_values v ON v.municipality_gid = mb.gid
          JOIN sarva.municipal_indicator_definition d ON d.key = v.indicator_key
          ORDER BY municipality
        `,
        [key]
      );

      const definition = result.rows[0] || null;
      res.json({
        status: "ok",
        data: {
          metric: {
            kind: "indicator",
            key,
            label: definition?.label || key,
            unit: definition?.display_unit || definition?.unit || "value",
            sourceName: definition?.source_name || null,
            period: definition?.period || null,
            scenario: definition?.scenario || null,
          },
          records: result.rows.map((row) => ({
            gid: row.gid,
            municipality: row.municipality,
            mapValue: numberOrNull(row.map_value, 1),
            normalizedValue: numberOrNull(row.normalized_value, 1),
            rawValue: numberOrNull(row.raw_value, 3),
            displayValue: numberOrNull(row.raw_value, 3) ?? numberOrNull(row.normalized_value, 1),
            displayUnit: row.display_unit,
            confidence: row.confidence,
          })),
        },
      });
      return;
    }

    const result = await pool.query(
      `
        ${latestIndicatorValuesSql()}
        , indicators AS (
          SELECT
            v.municipality_gid,
            d.key,
            CASE
              WHEN d.direction = 'higher_resilience' THEN 100 - v.value
              ELSE v.value
            END::double precision AS adjusted_value
          FROM latest_values v
          JOIN sarva.municipal_indicator_definition d ON d.key = v.indicator_key
        ),
        scores AS (
          SELECT
            mb.gid,
            COALESCE(NULLIF(mb.municname, ''), NULLIF(mb.map_title, ''), 'Municipality') AS municipality,
            idx.key,
            idx.label,
            idx.theme,
            CASE
              WHEN sum(ii.weight) FILTER (WHERE i.adjusted_value IS NOT NULL) > 0 THEN
                sum(i.adjusted_value * ii.weight) FILTER (WHERE i.adjusted_value IS NOT NULL)
                / sum(ii.weight) FILTER (WHERE i.adjusted_value IS NOT NULL)
              ELSE NULL
            END::double precision AS score
          FROM sarva.municipal_boundaries mb
          CROSS JOIN sarva.municipal_index_definition idx
          JOIN sarva.municipal_index_indicator ii ON ii.index_key = idx.key
          LEFT JOIN indicators i ON i.municipality_gid = mb.gid AND i.key = ii.indicator_key
          WHERE idx.key = $1
          GROUP BY mb.gid, municipality, idx.key, idx.label, idx.theme
        )
        SELECT *
        FROM scores
        WHERE score IS NOT NULL
        ORDER BY municipality
      `,
      [key]
    );

    const definition = result.rows[0] ? presentIndex(result.rows[0]) : null;
    res.json({
      status: "ok",
      data: {
        metric: { kind: "index", key, label: definition?.label || key, unit: "0-100 score" },
        records: result.rows.map((row) => ({
          gid: row.gid,
          municipality: row.municipality,
          mapValue: numberOrNull(row.score, 1),
          normalizedValue: numberOrNull(row.score, 1),
          displayValue: numberOrNull(row.score, 1),
          displayUnit: "0-100 score",
          confidence: "calculated",
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching municipal metric", error);
    res.status(500).json({ status: "error", message: "Municipal metric could not be loaded." });
  }
});

municipalProfilesRouter.get("/municipalities/metadata", async (req, res) => {
  try {
    const indicators = await pool.query(`
      SELECT
        d.key,
        d.label,
        d.theme,
        d.description,
        d.unit,
        d.direction,
        d.source_name AS "sourceName",
        d.source_url AS "sourceUrl",
        d.is_proxy AS "isProxy",
        d.sort_order AS "sortOrder",
        array_remove(array_agg(DISTINCT v.period ORDER BY v.period), NULL) AS periods,
        array_remove(array_agg(DISTINCT v.scenario ORDER BY v.scenario), NULL) AS scenarios,
        max(v.updated_at) AS "updatedAt"
      FROM sarva.municipal_indicator_definition d
      LEFT JOIN sarva.municipal_indicator_value v ON v.indicator_key = d.key
      GROUP BY d.key
      ORDER BY d.sort_order, d.label
    `);

    const indices = await pool.query(`
      SELECT
        idx.key,
        idx.label,
        idx.theme,
        idx.description,
        idx.source_name AS "sourceName",
        idx.source_url AS "sourceUrl",
        idx.is_proxy AS "isProxy",
        idx.sort_order AS "sortOrder",
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'indicatorKey', ii.indicator_key,
              'indicatorLabel', d.label,
              'weight', ii.weight,
              'direction', d.direction,
              'sourceName', d.source_name
            )
            ORDER BY ii.sort_order, d.label
          ) FILTER (WHERE ii.indicator_key IS NOT NULL),
          '[]'::jsonb
        ) AS components
      FROM sarva.municipal_index_definition idx
      LEFT JOIN sarva.municipal_index_indicator ii ON ii.index_key = idx.key
      LEFT JOIN sarva.municipal_indicator_definition d ON d.key = ii.indicator_key
      GROUP BY idx.key
      ORDER BY idx.sort_order, idx.label
    `);

    res.json({
      status: "ok",
      data: {
        calculationNotes: CALCULATION_NOTES,
        indicators: indicators.rows,
        indices: indices.rows.map(presentIndex),
        importSchema: {
          requiredColumns: ["municipality_code", "indicator_key", "period", "scenario", "raw_value"],
          recommendedColumns: ["value_0_100", "unit", "source_name", "source_url", "notes"],
          municipalityCodeRule: "Use MDB municipal code, for example WC032, CPT or EC108. SARVA also maps codes embedded in namecode values such as Overstrand (WC032).",
          financeImportCommand: "cd backend && npm run import:municipal-finance-indicators",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching municipal metadata", error);
    res.status(500).json({ status: "error", message: "Municipal metadata could not be loaded." });
  }
});

municipalProfilesRouter.get("/municipalities/:gid/indicators/:indicatorKey/trend", async (req, res) => {
  const gid = Number.parseInt(req.params.gid, 10);
  const indicatorKey = String(req.params.indicatorKey || "").trim();
  if (!Number.isFinite(gid) || !indicatorKey) {
    res.status(400).json({ status: "error", message: "Municipality gid and indicator key are required." });
    return;
  }

  try {
    const result = await pool.query(
      `
        SELECT
          d.key,
          d.label,
          d.theme,
          d.description,
          d.unit,
          d.direction,
          d.source_name,
          d.source_url,
          d.is_proxy,
          v.period,
          v.scenario,
          v.raw_value::double precision AS raw_value,
          v.raw_unit,
          v.value::double precision AS value,
          CASE
            WHEN d.direction = 'higher_resilience' THEN 100 - v.value
            ELSE v.value
          END::double precision AS adjusted_value,
          v.confidence,
          v.updated_at
        FROM sarva.municipal_indicator_value v
        JOIN sarva.municipal_indicator_definition d ON d.key = v.indicator_key
        WHERE v.municipality_gid = $1
          AND v.indicator_key = $2
        ORDER BY
          CASE WHEN v.period ~ '^\\d+$' THEN v.period::int ELSE NULL END NULLS LAST,
          v.period,
          v.scenario
      `,
      [gid, indicatorKey]
    );

    res.json({
      status: "ok",
      data: {
        indicator: result.rows[0]
          ? {
              key: result.rows[0].key,
              label: result.rows[0].label,
              theme: result.rows[0].theme,
              description: result.rows[0].description,
              unit: result.rows[0].unit,
              direction: result.rows[0].direction,
              sourceName: result.rows[0].source_name,
              sourceUrl: result.rows[0].source_url,
              isProxy: Boolean(result.rows[0].is_proxy),
            }
          : null,
        records: result.rows.map(publicIndicatorRow),
      },
    });
  } catch (error) {
    console.error("Error fetching municipal trend", error);
    res.status(500).json({ status: "error", message: "Municipal indicator trend could not be loaded." });
  }
});

municipalProfilesRouter.get("/municipalities/admin/import-status", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        count(*) FILTER (WHERE confidence = 'imported')::int AS "importedValues",
        count(*) FILTER (WHERE confidence = 'proxy')::int AS "proxyValues",
        count(DISTINCT indicator_key)::int AS "indicatorKeys",
        count(DISTINCT municipality_gid)::int AS "municipalities",
        max(updated_at) AS "lastUpdatedAt"
      FROM sarva.municipal_indicator_value
    `);

    res.json({
      status: "ok",
      data: {
        ...result.rows[0],
        importCommand: "cd backend && npm run import:sa-risk-indicators",
        financeImportCommand: "cd backend && npm run import:municipal-finance-indicators",
        note: "For new datasets, load validated rows into sarva.municipal_indicator_definition and sarva.municipal_indicator_value using the documented required columns.",
      },
    });
  } catch (error) {
    console.error("Error fetching municipal import status", error);
    res.status(500).json({ status: "error", message: "Municipal import status could not be loaded." });
  }
});

municipalProfilesRouter.post("/municipalities/admin/indicator-values", requireAdmin, async (req, res) => {
  const municipalityCode = cleanText(req.body.municipalityCode || req.body.municipality_code || req.body.gid);
  const indicatorKey = cleanText(req.body.indicatorKey || req.body.indicator_key);
  const label = cleanText(req.body.label);
  const theme = cleanText(req.body.theme) || "Admin imported";
  const description = cleanText(req.body.description) || label || indicatorKey;
  const unit = cleanText(req.body.unit) || "value";
  const direction = cleanDirection(req.body.direction);
  const period = cleanText(req.body.period);
  const scenario = cleanText(req.body.scenario) || "admin import";
  const rawValue = Number(req.body.rawValue ?? req.body.raw_value);
  const normalizedValue =
    req.body.value_0_100 == null || req.body.value_0_100 === ""
      ? null
      : Number(req.body.value_0_100);
  const sourceName = cleanText(req.body.sourceName || req.body.source_name) || "Admin imported municipal indicator";
  const sourceUrl = cleanText(req.body.sourceUrl || req.body.source_url);
  const notes = cleanText(req.body.notes);

  if (!municipalityCode || !indicatorKey || !period || !Number.isFinite(rawValue)) {
    res.status(400).json({
      status: "error",
      message: "municipalityCode, indicatorKey, period and rawValue are required.",
    });
    return;
  }

  if (normalizedValue != null && (!Number.isFinite(normalizedValue) || normalizedValue < 0 || normalizedValue > 100)) {
    res.status(400).json({ status: "error", message: "value_0_100 must be between 0 and 100." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const municipalityGid = await resolveMunicipalityGid(client, municipalityCode);
    if (!municipalityGid) {
      await client.query("ROLLBACK");
      res.status(404).json({ status: "error", message: "Municipality could not be matched." });
      return;
    }

    await client.query(
      `
        INSERT INTO sarva.municipal_indicator_definition
          (key, label, theme, description, unit, direction, source_name, source_url, is_proxy, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 500)
        ON CONFLICT (key) DO UPDATE SET
          label = COALESCE(EXCLUDED.label, sarva.municipal_indicator_definition.label),
          theme = EXCLUDED.theme,
          description = EXCLUDED.description,
          unit = EXCLUDED.unit,
          direction = EXCLUDED.direction,
          source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          is_proxy = false,
          updated_at = now()
      `,
      [indicatorKey, label || indicatorKey, theme, description, unit, direction, sourceName, sourceUrl]
    );

    await client.query(
      `
        INSERT INTO sarva.municipal_indicator_value
          (municipality_gid, indicator_key, period, scenario, value, raw_value, raw_unit, confidence, source_label, source_url, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', $8, $9, $10)
        ON CONFLICT (municipality_gid, indicator_key, period, scenario) DO UPDATE SET
          value = EXCLUDED.value,
          raw_value = EXCLUDED.raw_value,
          raw_unit = EXCLUDED.raw_unit,
          confidence = EXCLUDED.confidence,
          source_label = EXCLUDED.source_label,
          source_url = EXCLUDED.source_url,
          notes = EXCLUDED.notes,
          updated_at = now()
      `,
      [
        municipalityGid,
        indicatorKey,
        period,
        scenario,
        normalizedValue == null ? 50 : normalizedValue,
        rawValue,
        unit,
        sourceName,
        sourceUrl,
        notes || "Admin-entered municipal indicator value.",
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({ status: "ok", data: { municipalityGid, indicatorKey, period, scenario } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving municipal indicator value", error);
    res.status(500).json({ status: "error", message: "Municipal indicator value could not be saved." });
  } finally {
    client.release();
  }
});

municipalProfilesRouter.get("/municipalities/:gid/admin/indicator-values", requireAdmin, async (req, res) => {
  const gid = Number.parseInt(req.params.gid, 10);
  if (!Number.isFinite(gid)) {
    res.status(400).json({ status: "error", message: "A numeric municipality gid is required." });
    return;
  }

  try {
    const result = await pool.query(
      `
        SELECT
          v.municipality_gid AS "municipalityGid",
          mb.namecode AS "municipalityCode",
          COALESCE(NULLIF(mb.municname, ''), NULLIF(mb.map_title, ''), 'Municipality') AS municipality,
          d.key AS "indicatorKey",
          d.label,
          d.theme,
          d.description,
          d.unit,
          d.direction,
          COALESCE(v.source_label, d.source_name) AS "sourceName",
          COALESCE(v.source_url, d.source_url) AS "sourceUrl",
          v.period,
          v.scenario,
          v.raw_value::double precision AS "rawValue",
          COALESCE(v.raw_unit, d.unit) AS "displayUnit",
          v.value::double precision AS "normalizedValue",
          v.notes,
          v.updated_at AS "updatedAt"
        FROM sarva.municipal_indicator_value v
        JOIN sarva.municipal_indicator_definition d ON d.key = v.indicator_key
        JOIN sarva.municipal_boundaries mb ON mb.gid = v.municipality_gid
        WHERE v.municipality_gid = $1
          AND v.confidence = 'admin'
        ORDER BY v.updated_at DESC, d.label, v.period DESC
      `,
      [gid]
    );

    res.json({ status: "ok", data: { records: result.rows } });
  } catch (error) {
    console.error("Error fetching admin municipal indicator values", error);
    res.status(500).json({ status: "error", message: "Admin municipal indicator values could not be loaded." });
  }
});

municipalProfilesRouter.delete("/municipalities/admin/indicator-values", requireAdmin, async (req, res) => {
  const municipalityCode = cleanText(req.body.municipalityCode || req.body.municipality_code || req.body.gid || req.query.municipalityCode);
  const indicatorKey = cleanText(req.body.indicatorKey || req.body.indicator_key || req.query.indicatorKey);
  const period = cleanText(req.body.period || req.query.period);
  const scenario = cleanText(req.body.scenario || req.query.scenario) || "admin import";

  if (!municipalityCode || !indicatorKey || !period) {
    res.status(400).json({
      status: "error",
      message: "municipalityCode, indicatorKey and period are required.",
    });
    return;
  }

  const client = await pool.connect();
  try {
    const municipalityGid = await resolveMunicipalityGid(client, municipalityCode);
    if (!municipalityGid) {
      res.status(404).json({ status: "error", message: "Municipality could not be matched." });
      return;
    }

    const result = await client.query(
      `
        DELETE FROM sarva.municipal_indicator_value
        WHERE municipality_gid = $1
          AND indicator_key = $2
          AND period = $3
          AND scenario = $4
          AND confidence = 'admin'
        RETURNING municipality_gid, indicator_key, period, scenario
      `,
      [municipalityGid, indicatorKey, period, scenario]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ status: "error", message: "No matching admin-entered value was found." });
      return;
    }

    res.json({ status: "ok", data: result.rows[0] });
  } catch (error) {
    console.error("Error deleting admin municipal indicator value", error);
    res.status(500).json({ status: "error", message: "Admin municipal indicator value could not be deleted." });
  } finally {
    client.release();
  }
});

municipalProfilesRouter.get("/municipalities/:gid/profile", async (req, res) => {
  const gid = Number.parseInt(req.params.gid, 10);
  if (!Number.isFinite(gid)) {
    res.status(400).json({ status: "error", message: "A numeric municipality gid is required." });
    return;
  }

  try {
    const result = await pool.query(
      `
        WITH municipality AS (
          SELECT
            gid,
            COALESCE(NULLIF(municname, ''), NULLIF(map_title, ''), 'Municipality') AS municipality,
            province,
            district_n,
            namecode,
            category,
            ST_Transform(geom, 4326) AS geom4326,
            ST_Area(geom) / 1000000.0 AS area_km2
          FROM sarva.municipal_boundaries
          WHERE gid = $1
          LIMIT 1
        ),
        latest_run AS (
          SELECT id, source, started_at, finished_at, forecast_days
          FROM sarva.forecast_risk_sync_run
          WHERE status = 'success'
          ORDER BY
            (source = 'ecmwf-open-data') DESC,
            finished_at DESC NULLS LAST,
            started_at DESC
          LIMIT 1
        ),
        points AS (
          SELECT p.*
          FROM sarva.forecast_risk_points p
          JOIN latest_run lr ON lr.id = p.sync_run_id
          JOIN municipality m ON ST_Intersects(m.geom4326, p.geom)
        ),
        risk_summary AS (
          SELECT
            count(*)::int AS point_count,
            min(forecast_date) AS forecast_start,
            max(forecast_date) AS forecast_end,
            max(rainfall_mm)::double precision AS max_rainfall_mm,
            avg(rainfall_mm)::double precision AS avg_rainfall_mm,
            max(temperature_max_c)::double precision AS max_temperature_c,
            max(wind_max_kmh)::double precision AS max_wind_kmh,
            max(rain_risk_score)::double precision AS rain_risk_score,
            max(heat_risk_score)::double precision AS heat_risk_score,
            max(wind_risk_score)::double precision AS wind_risk_score,
            max(fire_risk_score)::double precision AS fire_risk_score,
            max(overall_risk_score)::double precision AS overall_risk_score
          FROM points
        ),
        dominant AS (
          SELECT dominant_hazard
          FROM points
          WHERE NULLIF(dominant_hazard, '') IS NOT NULL
          GROUP BY dominant_hazard
          ORDER BY count(*) DESC, max(overall_risk_score) DESC NULLS LAST
          LIMIT 1
        ),
        observation_sites AS (
          SELECT
            station_name,
            display_name,
            longitude,
            latitude,
            altitude,
            description,
            website_url,
            doi,
            ST_Contains(m.geom4326, s.geom) AS inside,
            ST_Distance(m.geom4326::geography, s.geom::geography) / 1000.0 AS distance_km
          FROM municipality m
          JOIN sarva.loggernet_site_mappings s ON s.geom IS NOT NULL
          WHERE ST_DWithin(m.geom4326::geography, s.geom::geography, 120000)
          ORDER BY inside DESC, distance_km
          LIMIT 8
        ),
        extent AS (
          SELECT
            ST_XMin(ST_Extent(geom4326)) AS minx,
            ST_YMin(ST_Extent(geom4326)) AS miny,
            ST_XMax(ST_Extent(geom4326)) AS maxx,
            ST_YMax(ST_Extent(geom4326)) AS maxy
          FROM municipality
        )
        SELECT
          row_to_json(m) AS municipality,
          row_to_json(e) AS extent,
          row_to_json(lr) AS latest_run,
          row_to_json(rs) AS risk_summary,
          (SELECT dominant_hazard FROM dominant) AS dominant_hazard,
          (
            SELECT COALESCE(jsonb_agg(to_jsonb(os) ORDER BY os.inside DESC, os.distance_km), '[]'::jsonb)
            FROM observation_sites os
          ) AS observation_sites
        FROM municipality m
        CROSS JOIN extent e
        LEFT JOIN latest_run lr ON true
        LEFT JOIN risk_summary rs ON true
      `,
      [gid]
    );

    const row = result.rows[0];
    if (!row?.municipality) {
      res.status(404).json({ status: "error", message: "Municipality was not found." });
      return;
    }

    const municipality = row.municipality;
    const risk = row.risk_summary || {};
    const latestRun = row.latest_run || null;
    const indicatorResult = await pool.query(
      `
        WITH latest_values AS (
          SELECT DISTINCT ON (v.indicator_key)
            v.*
          FROM sarva.municipal_indicator_value v
          WHERE v.municipality_gid = $1
          ORDER BY
            v.indicator_key,
            (v.confidence <> 'proxy') DESC,
            v.period DESC,
            v.updated_at DESC
        ),
        indicators AS (
          SELECT
            d.key,
            d.label,
            d.theme,
            d.description,
            d.unit,
            d.direction,
            d.source_name,
            d.source_url,
            d.is_proxy,
            d.sort_order,
            v.period,
            v.scenario,
            v.value::double precision AS value,
            v.raw_value::double precision AS raw_value,
            v.raw_unit,
            CASE
              WHEN d.direction = 'higher_resilience' THEN 100 - v.value
              ELSE v.value
            END::double precision AS adjusted_value,
            v.confidence,
            v.notes
          FROM latest_values v
          JOIN sarva.municipal_indicator_definition d ON d.key = v.indicator_key
        ),
        indices AS (
          SELECT
            idx.key,
            idx.label,
            idx.theme,
            idx.description,
            idx.source_name,
            idx.source_url,
            idx.is_proxy,
            idx.sort_order,
            CASE
              WHEN sum(ii.weight) FILTER (WHERE i.adjusted_value IS NOT NULL) > 0 THEN
                sum(i.adjusted_value * ii.weight) FILTER (WHERE i.adjusted_value IS NOT NULL)
                / sum(ii.weight) FILTER (WHERE i.adjusted_value IS NOT NULL)
              ELSE NULL
            END::double precision AS score,
            count(i.key)::int AS indicator_count,
            count(ii.indicator_key)::int AS expected_indicator_count,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'key', i.key,
                  'label', i.label,
                  'theme', i.theme,
                  'description', i.description,
                  'direction', i.direction,
                  'rawValue', i.raw_value,
                  'displayUnit', COALESCE(i.raw_unit, i.unit),
                  'normalizedValue', i.value,
                  'adjustedValue', i.adjusted_value,
                  'weight', ii.weight,
                  'period', i.period,
                  'scenario', i.scenario,
                  'sourceName', i.source_name,
                  'sourceUrl', i.source_url,
                  'confidence', i.confidence,
                  'notes', i.notes
                )
                ORDER BY ii.weight DESC, i.label
              ) FILTER (WHERE i.key IS NOT NULL),
              '[]'::jsonb
            ) AS components,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'key', d.key,
                  'label', d.label,
                  'theme', d.theme,
                  'description', d.description,
                  'sourceName', d.source_name,
                  'sourceUrl', d.source_url
                )
                ORDER BY ii.sort_order, d.label
              ) FILTER (WHERE i.key IS NULL AND d.key IS NOT NULL),
              '[]'::jsonb
            ) AS missing_components
          FROM sarva.municipal_index_definition idx
          JOIN sarva.municipal_index_indicator ii ON ii.index_key = idx.key
          JOIN sarva.municipal_indicator_definition d ON d.key = ii.indicator_key
          LEFT JOIN indicators i ON i.key = ii.indicator_key
          GROUP BY idx.key, idx.label, idx.theme, idx.description, idx.source_name, idx.source_url, idx.is_proxy, idx.sort_order
        ),
        drivers AS (
          SELECT
            ii.index_key,
            i.key,
            i.label,
            i.theme,
            i.description,
            i.direction,
            i.value,
            i.raw_value,
            i.raw_unit,
            i.adjusted_value,
            i.period,
            i.scenario,
            i.source_name,
            i.source_url,
            i.confidence,
            i.notes,
            ii.weight::double precision AS weight,
            (i.adjusted_value * ii.weight)::double precision AS contribution
          FROM sarva.municipal_index_indicator ii
          JOIN indicators i ON i.key = ii.indicator_key
        ),
        driver_source AS (
          SELECT
            CASE
              WHEN EXISTS (SELECT 1 FROM drivers WHERE index_key = 'imported_composite_risk')
                THEN 'imported_composite_risk'
              ELSE 'composite_risk'
            END AS index_key
        )
        SELECT
          (
            SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.sort_order, i.label), '[]'::jsonb)
            FROM indicators i
          ) AS indicators,
          (
            SELECT COALESCE(jsonb_agg(to_jsonb(idx) ORDER BY idx.sort_order, idx.label), '[]'::jsonb)
            FROM indices idx
          ) AS indices,
          (
            SELECT COALESCE(jsonb_agg(to_jsonb(limited_drivers) ORDER BY limited_drivers.contribution DESC NULLS LAST, limited_drivers.label), '[]'::jsonb)
            FROM (
              SELECT d.*
              FROM drivers d
              WHERE d.index_key = (SELECT index_key FROM driver_source)
              ORDER BY d.contribution DESC NULLS LAST, d.label
              LIMIT 8
            ) limited_drivers
          ) AS drivers
      `,
      [gid]
    );
    const indicatorRow = indicatorResult.rows[0] || {};
    const indicators = Array.isArray(indicatorRow.indicators) ? indicatorRow.indicators.map(normaliseIndicator) : [];
    const indices = Array.isArray(indicatorRow.indices)
      ? indicatorRow.indices.map((rawItem) => {
        const item = presentIndex(rawItem);
        const expectedIndicatorCount = Number(item.expected_indicator_count || item.indicator_count || 0);
        const indicatorCount = Number(item.indicator_count || 0);
        return {
          key: item.key,
          label: item.label,
          theme: item.theme,
          description: item.description,
          sourceName: item.source_name,
          sourceUrl: item.source_url,
          isProxy: Boolean(item.is_proxy),
          score: numberOrNull(item.score, 1),
          riskLabel: scoreLabel(item.score),
          indicatorCount,
          expectedIndicatorCount,
          coveragePercent: expectedIndicatorCount > 0 ? numberOrNull((indicatorCount / expectedIndicatorCount) * 100, 0) : null,
          components: Array.isArray(item.components)
            ? item.components.map((component) => ({
                key: component.key,
                label: component.label,
                theme: component.theme,
                description: component.description,
                direction: component.direction,
                rawValue: numberOrNull(component.rawValue, 3),
                displayUnit: component.displayUnit,
                normalizedValue: numberOrNull(component.normalizedValue, 1),
                adjustedValue: numberOrNull(component.adjustedValue, 1),
                weight: numberOrNull(component.weight, 3),
                period: component.period,
                scenario: component.scenario,
                sourceName: component.sourceName,
                sourceUrl: component.sourceUrl,
                confidence: component.confidence,
                notes: component.notes,
              }))
            : [],
          missingComponents: Array.isArray(item.missing_components)
            ? item.missing_components.slice(0, 8).map((component) => ({
                key: component.key,
                label: component.label,
                theme: component.theme,
                description: component.description,
                sourceName: component.sourceName,
                sourceUrl: component.sourceUrl,
              }))
            : [],
        };
      })
      : [];
    const drivers = Array.isArray(indicatorRow.drivers)
      ? indicatorRow.drivers.map((item) => ({
          key: item.key,
          label: item.label,
          theme: item.theme,
          description: item.description,
          direction: item.direction,
          value: numberOrNull(item.value, 1),
          normalizedValue: numberOrNull(item.value, 1),
          rawValue: numberOrNull(item.raw_value, 3),
          displayValue: numberOrNull(item.raw_value, 3) ?? numberOrNull(item.value, 1),
          displayUnit: item.raw_unit,
          adjustedValue: numberOrNull(item.adjusted_value, 1),
          period: item.period,
          scenario: item.scenario,
          sourceName: item.source_name,
          sourceUrl: item.source_url,
          confidence: item.confidence,
          notes: item.notes,
          weight: numberOrNull(item.weight, 3),
          contribution: numberOrNull(item.contribution, 1),
        }))
      : [];
    const indicatorThemes = indicators.reduce((groups, indicator) => {
      const theme = indicator.theme || "Other";
      if (!groups[theme]) groups[theme] = [];
      groups[theme].push(indicator);
      return groups;
    }, {});

    res.json({
      status: "ok",
      data: {
        description: PROFILE_DESCRIPTION,
        municipality: {
          gid: municipality.gid,
          municipality: municipality.municipality,
          province: municipality.province,
          district: municipality.district_n,
          code: municipality.namecode,
          category: municipality.category,
          areaKm2: numberOrNull(municipality.area_km2, 1),
          bbox: bboxFromRow(row.extent || {}),
        },
        forecast: {
          latestRun: latestRun
            ? {
                id: latestRun.id,
                source: latestRun.source,
                startedAt: latestRun.started_at,
                finishedAt: latestRun.finished_at,
                forecastDays: latestRun.forecast_days,
              }
            : null,
          pointCount: Number(risk.point_count || 0),
          forecastStart: risk.forecast_start || null,
          forecastEnd: risk.forecast_end || null,
          dominantHazard: row.dominant_hazard || null,
          maxRainfallMm: numberOrNull(risk.max_rainfall_mm, 1),
          avgRainfallMm: numberOrNull(risk.avg_rainfall_mm, 1),
          maxTemperatureC: numberOrNull(risk.max_temperature_c, 1),
          maxWindKmh: numberOrNull(risk.max_wind_kmh, 1),
          rainRiskScore: numberOrNull(risk.rain_risk_score, 0),
          heatRiskScore: numberOrNull(risk.heat_risk_score, 0),
          windRiskScore: numberOrNull(risk.wind_risk_score, 0),
          fireRiskScore: numberOrNull(risk.fire_risk_score, 0),
          overallRiskScore: numberOrNull(risk.overall_risk_score, 0),
          overallRiskLabel: scoreLabel(Number(risk.overall_risk_score)),
        },
        observationSites: Array.isArray(row.observation_sites)
          ? row.observation_sites.map((site) => ({
              stationName: site.station_name,
              displayName: site.display_name,
              longitude: numberOrNull(site.longitude, 6),
              latitude: numberOrNull(site.latitude, 6),
              altitude: numberOrNull(site.altitude, 0),
              description: site.description,
              websiteUrl: site.website_url,
              doi: site.doi,
              inside: Boolean(site.inside),
              distanceKm: numberOrNull(site.distance_km, 1),
            }))
          : [],
        indicators: {
          status: indicators.length > 0 ? "available" : "empty",
          caveat:
            "Municipal indicators are stored in the SARVA Docker database. Imported values show their source and period. Values marked as proxy are deterministic fallback placeholders and should not be used as official statistics.",
          indices,
          drivers,
          themes: Object.entries(indicatorThemes).map(([theme, records]) => ({ theme, records })),
          records: indicators,
        },
        links: {
          catalogueSearch: `/search?q=${encodeURIComponent(municipality.municipality || "")}`,
          resourcesSearch: `/resources?search=${encodeURIComponent(municipality.municipality || "")}`,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching municipal risk profile", error);
    res.status(500).json({ status: "error", message: "Municipal risk profile could not be loaded." });
  }
});
