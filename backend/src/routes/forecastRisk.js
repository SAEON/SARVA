import { Router } from "express";
import { pool } from "../db/pool.js";

export const forecastRiskRouter = Router();

const FORECAST_RISK_DESCRIPTION =
  "Forecast environmental risk layers are SARVA development screening layers showing cached ECMWF forecast rainfall, heat, wind, fire-weather proxy and overall risk indices over the next forecast window. They are intended for exploration, not formal warnings.";

const FORECAST_RISK_ATTRIBUTION =
  "ECMWF Open Data IFS 0.25 degree forecast fields. SARVA development indices use daily precipitation totals, maximum 2 m temperature and maximum 10 m wind speed for screening and exploration.";

const FORECAST_RISK_SOURCE_URL = "https://www.ecmwf.int/en/forecasts/datasets/open-data";
const LEGACY_FORECAST_ATTRIBUTION =
  "SARVA legacy cached forecast rainfall risk retained while the direct ECMWF Open Data refresh retries. Risk classes are SARVA development thresholds derived from forecast daily rainfall totals.";

const RISK_LAYERS = {
  rainfall: {
    label: "ECMWF rainfall screening",
    description:
      "Highest daily forecast rainfall risk on a 0.25 degree grid for the cached forecast window.",
    units: "mm/day",
  },
  overall: {
    label: "SARVA combined screening index",
    description:
      "Highest SARVA development environmental risk index from rainfall, heat, wind and fire-weather proxy components.",
    units: "0-100",
  },
  heat: {
    label: "ECMWF temperature screening",
    description: "SARVA development heat index derived from daily maximum ECMWF 2 m temperature.",
    units: "°C max",
  },
  wind: {
    label: "ECMWF wind screening",
    description: "SARVA development wind index derived from daily maximum ECMWF 10 m wind speed.",
    units: "km/h max",
  },
  fire: {
    label: "SARVA fire-weather screening",
    description:
      "SARVA development fire-weather proxy derived from heat, wind and forecast dryness. This is not a formal fire danger index.",
    units: "0-100",
  },
};

function riskLabel(score) {
  return {
    0: "Minimal",
    1: "Low",
    2: "Moderate",
    3: "High",
    4: "Very high",
  }[Number(score)] || "Unknown";
}

function scoreLabel(score) {
  if (!Number.isFinite(score)) return "Unknown";
  if (score >= 80) return "Very high";
  if (score >= 60) return "High";
  if (score >= 40) return "Moderate";
  if (score >= 20) return "Low";
  return "Very low";
}

function scoreClass(score) {
  if (!Number.isFinite(score)) return 0;
  if (score >= 80) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

function rainfallClass(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount >= 50) return 4;
  if (amount >= 25) return 3;
  if (amount >= 10) return 2;
  return 1;
}

function selectedLayerValue(record, layer) {
  if (layer === "rainfall") {
    return {
      metricValue: record.rainfallMm,
      riskIndex: record.rainRiskScore,
      riskScore: rainfallClass(record.rainfallMm),
      riskLabel: riskLabel(rainfallClass(record.rainfallMm)),
    };
  }

  const riskIndex = Number({
    overall: record.overallRiskScore,
    heat: record.heatRiskScore,
    wind: record.windRiskScore,
    fire: record.fireRiskScore,
  }[layer]);
  const metricValue = Number({
    overall: record.overallRiskScore,
    heat: record.temperatureMaxC,
    wind: record.windMaxKmh,
    fire: record.fireRiskScore,
  }[layer]);

  return {
    metricValue: Number.isFinite(metricValue) ? metricValue : null,
    riskIndex: Number.isFinite(riskIndex) ? riskIndex : null,
    riskScore: scoreClass(riskIndex),
    riskLabel: scoreLabel(riskIndex),
  };
}

forecastRiskRouter.get("/forecast-risk/status", async (_req, res) => {
  try {
    const latestRun = await pool.query(`
      SELECT
        id,
        source,
        sync_date AS "syncDate",
        started_at AS "startedAt",
        finished_at AS "finishedAt",
        status,
        forecast_days AS "forecastDays",
        point_count AS "pointCount",
        error_message AS "errorMessage"
      FROM sarva.forecast_risk_sync_run
      ORDER BY started_at DESC
      LIMIT 1
    `);

    const dates = await pool.query(`
      SELECT forecast_date AS "forecastDate", count(*)::int AS count
      FROM sarva.forecast_risk_points
      WHERE source = 'ecmwf-open-data'
      GROUP BY forecast_date
      ORDER BY forecast_date
    `);

    res.json({
      status: "ok",
      data: {
        description: FORECAST_RISK_DESCRIPTION,
        attribution: FORECAST_RISK_ATTRIBUTION,
        sourceUrl: FORECAST_RISK_SOURCE_URL,
        latestRun: latestRun.rows[0] || null,
        dates: dates.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching forecast risk status", error);
    res.status(500).json({ status: "error", message: "Forecast risk status could not be loaded." });
  }
});

forecastRiskRouter.get("/forecast-risk/layer", async (req, res) => {
  const mode = String(req.query.mode || "max").toLowerCase();
  const requestedLayer = String(req.query.layer || "rainfall").toLowerCase();
  const layer = RISK_LAYERS[requestedLayer] ? requestedLayer : "rainfall";
  const layerMeta = RISK_LAYERS[layer];

  try {
    const latestSuccessfulRun = await pool.query(`
      SELECT id, source, started_at, finished_at, forecast_days
      FROM sarva.forecast_risk_sync_run
      WHERE status = 'success'
      ORDER BY
        (source = 'ecmwf-open-data') DESC,
        finished_at DESC NULLS LAST,
        started_at DESC
      LIMIT 1
    `);

    const run = latestSuccessfulRun.rows[0];
    if (!run) {
      res.json({
        status: "ok",
        data: {
          description: FORECAST_RISK_DESCRIPTION,
          attribution: FORECAST_RISK_ATTRIBUTION,
          sourceUrl: FORECAST_RISK_SOURCE_URL,
          latestRun: null,
          count: 0,
          records: [],
          geojson: { type: "FeatureCollection", features: [] },
          message: "ECMWF rainfall screening has not synced yet.",
        },
      });
      return;
    }
    const isFallback = run.source !== "ecmwf-open-data";

    const values = [run.id];
    let whereDate = "";
    if (req.query.date) {
      values.push(String(req.query.date));
      whereDate = `AND forecast_date = $${values.length}::date`;
    }

    const result = await pool.query(
      `
        SELECT
          forecast_date AS "forecastDate",
          latitude,
          longitude,
          rainfall_mm::double precision AS "rainfallMm",
          temperature_max_c::double precision AS "temperatureMaxC",
          wind_max_kmh::double precision AS "windMaxKmh",
          rain_risk_score::double precision AS "rainRiskScore",
          heat_risk_score::double precision AS "heatRiskScore",
          wind_risk_score::double precision AS "windRiskScore",
          fire_risk_score::double precision AS "fireRiskScore",
          overall_risk_score::double precision AS "overallRiskScore",
          dominant_hazard AS "dominantHazard",
          risk_score AS "riskScore",
          risk_label AS "riskLabel",
          source,
          source_url AS "sourceUrl",
          attribution,
          raw_payload AS "rawPayload"
        FROM sarva.forecast_risk_points
        WHERE sync_run_id = $1
        ${whereDate}
        ORDER BY forecast_date, latitude, longitude
      `,
      values
    );

    const rankedByPoint = new Map();
    for (const row of result.rows) {
      const selected = selectedLayerValue(row, layer);
      const record = {
        ...row,
        ...selected,
        layer,
        layerLabel: layerMeta.label,
        riskLabel: selected.riskLabel,
      };
      const key = `${row.latitude}:${row.longitude}`;
      const previous = rankedByPoint.get(key);
      if (
        !previous ||
        Number(record.riskScore) > Number(previous.riskScore) ||
        (Number(record.riskScore) === Number(previous.riskScore) &&
          Number(record.riskIndex ?? record.metricValue ?? 0) >
            Number(previous.riskIndex ?? previous.metricValue ?? 0)) ||
        (Number(record.riskScore) === Number(previous.riskScore) &&
          Number(record.riskIndex ?? 0) === Number(previous.riskIndex ?? 0) &&
          Number(record.metricValue ?? 0) > Number(previous.metricValue ?? 0))
      ) {
        rankedByPoint.set(key, record);
      }
    }
    const records = [...rankedByPoint.values()].sort((a, b) => a.latitude - b.latitude || a.longitude - b.longitude);

    const dateRangeResult = await pool.query(
      `
        SELECT
          min(forecast_date) AS "startDate",
          max(forecast_date) AS "endDate",
          count(DISTINCT forecast_date)::int AS "dayCount"
        FROM sarva.forecast_risk_points
        WHERE sync_run_id = $1
      `,
      [run.id]
    );
    const dateRange = dateRangeResult.rows[0] || null;

    res.json({
      status: "ok",
      data: {
        mode,
        layer,
        layerMeta,
        description: FORECAST_RISK_DESCRIPTION,
        attribution: isFallback ? LEGACY_FORECAST_ATTRIBUTION : records[0]?.attribution || FORECAST_RISK_ATTRIBUTION,
        sourceUrl: FORECAST_RISK_SOURCE_URL,
        latestRun: {
          id: run.id,
          source: run.source,
          startedAt: run.started_at,
          finishedAt: run.finished_at,
          forecastDays: run.forecast_days,
        },
        dateRange,
        count: records.length,
        records,
        geojson: {
          type: "FeatureCollection",
          features: records.map((record) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [record.longitude, record.latitude],
            },
            properties: {
              forecastDate: record.forecastDate,
              rainfallMm: record.rainfallMm,
              temperatureMaxC: record.temperatureMaxC,
              windMaxKmh: record.windMaxKmh,
              rainRiskScore: record.rainRiskScore,
              heatRiskScore: record.heatRiskScore,
              windRiskScore: record.windRiskScore,
              fireRiskScore: record.fireRiskScore,
              overallRiskScore: record.overallRiskScore,
              dominantHazard: record.dominantHazard,
              metricValue: record.metricValue,
              riskIndex: record.riskIndex,
              layer: record.layer,
              layerLabel: record.layerLabel,
              layerUnits: layerMeta.units,
              riskScore: record.riskScore,
              riskLabel: record.riskLabel,
              source: record.source,
              sourceUrl: FORECAST_RISK_SOURCE_URL,
              attribution: isFallback ? LEGACY_FORECAST_ATTRIBUTION : record.attribution || FORECAST_RISK_ATTRIBUTION,
              isFallback,
              updatedAt: run.finished_at || run.started_at,
            },
          })),
        },
        isFallback,
        message: isFallback ? "Showing the latest cached forecast while the direct ECMWF refresh retries." : null,
      },
    });
  } catch (error) {
    console.error("Error fetching forecast risk layer", error);
    res.status(500).json({ status: "error", message: "Forecast risk layer could not be loaded." });
  }
});

forecastRiskRouter.post("/forecast-risk/sync", async (_req, res) => {
  res.status(202).json({
    status: "ok",
    data: {
      message:
        "Forecast risk is synced by the ECMWF worker container. Run `docker compose run --rm forecast-risk-worker` for a manual one-off refresh.",
    },
  });
});
