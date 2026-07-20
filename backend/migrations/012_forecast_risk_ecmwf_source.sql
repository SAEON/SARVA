ALTER TABLE sarva.forecast_risk_sync_run
  ALTER COLUMN source SET DEFAULT 'ecmwf-open-data';

ALTER TABLE sarva.forecast_risk_points
  ALTER COLUMN source SET DEFAULT 'ecmwf-open-data';

COMMENT ON TABLE sarva.forecast_risk_points IS
  'Daily cached ECMWF Open Data forecast precipitation risk points for SARVA map display. Values are refreshed by the forecast-risk worker and retained as temporary forecast guidance.';
