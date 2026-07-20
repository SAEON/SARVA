UPDATE sarva.forecast_risk_sync_run
SET source = 'sarva-legacy-forecast-cache'
WHERE source IN ('open-meteo-ecmwf', 'ecmwf-ifs025-via-open-meteo');

UPDATE sarva.forecast_risk_points
SET source = 'sarva-legacy-forecast-cache',
    source_url = 'https://www.ecmwf.int/en/forecasts/datasets/open-data',
    attribution = 'SARVA legacy cached forecast rainfall risk retained while the direct ECMWF Open Data refresh retries. Risk classes are SARVA development thresholds derived from forecast daily rainfall totals.'
WHERE source IN ('open-meteo-ecmwf', 'ecmwf-ifs025-via-open-meteo');
