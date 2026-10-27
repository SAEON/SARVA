import { Router } from "express";
import { pool } from "../db/pool.js";
import { FORECAST_NOTICE, FORECAST_ATTRIBUTION, FORECAST_METADATA } from "../services/forecastPresentation.js";

export const forecastRiskRouter = Router();

const FORECAST_RISK_DESCRIPTION = FORECAST_NOTICE;
const FORECAST_RISK_ATTRIBUTION = FORECAST_ATTRIBUTION;

const FORECAST_RISK_SOURCE_URL = "https://www.ecmwf.int/en/forecasts/datasets/open-data";
const LEGACY_FORECAST_ATTRIBUTION =
  "Older cached model rainfall retained while direct ECMWF refresh retries. Check forecast dates; display bands are not official warning thresholds.";

const RISK_LAYERS = {
  rainfall: {
    label: "Experimental ECMWF rainfall estimate",
    description:
      "Largest modelled daily rainfall total on the cached 0.25 degree grid. Rainfall alone is not a flood assessment.",
    units: "mm/day",
  },
  overall: {
    label: "Experimental SARVA combined model index",
    description:
      "Experimental SARVA index derived from modelled rain, temperature, wind and dryness. Not a probability of harm or warning level.",
    units: "0-100",
  },
  heat: {
    label: "Experimental ECMWF temperature estimate",
    description: "Modelled daily maximum 2 m temperature. SARVA experimental indices are not official heat warnings.",
    units: "°C max",
  },
  wind: {
    label: "Experimental ECMWF wind estimate",
    description: "Modelled daily maximum 10 m wind speed. SARVA experimental indices are not official wind warnings.",
    units: "km/h max",
  },
  fire: {
    label: "Experimental SARVA fire-weather indicator",
    description:
      "Experimental indicator derived from modelled heat, wind and dryness. Not an official fire-danger rating, fire prediction or instruction about lighting fires.",
    units: "0-100",
  },
};

function riskLabel(score) {
  return score == null || !Number.isFinite(Number(score)) ? "Model band unavailable" : `Experimental band ${Number(score)}/4`;
}

function scoreLabel(score) {
  return score == null || !Number.isFinite(Number(score)) ? "Model band unavailable" : riskLabel(scoreClass(Number(score)));
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
        ...FORECAST_METADATA,
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
          ...FORECAST_METADATA,
        description: FORECAST_RISK_DESCRIPTION,
          attribution: FORECAST_RISK_ATTRIBUTION,
          sourceUrl: FORECAST_RISK_SOURCE_URL,
          latestRun: null,
          count: 0,
          records: [],
          geojson: { type: "FeatureCollection", features: [] },
          message: "Experimental ECMWF rainfall estimate has not synced yet.",
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
        ...FORECAST_METADATA,
        description: FORECAST_RISK_DESCRIPTION,
        attribution: isFallback ? `${FORECAST_RISK_ATTRIBUTION} ${LEGACY_FORECAST_ATTRIBUTION}` : FORECAST_RISK_ATTRIBUTION,
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
              attribution: isFallback ? `${FORECAST_RISK_ATTRIBUTION} ${LEGACY_FORECAST_ATTRIBUTION}` : FORECAST_RISK_ATTRIBUTION,
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
