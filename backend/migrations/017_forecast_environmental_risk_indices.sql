ALTER TABLE sarva.forecast_risk_points
  ADD COLUMN IF NOT EXISTS temperature_max_c numeric(6, 2),
  ADD COLUMN IF NOT EXISTS wind_max_kmh numeric(6, 2),
  ADD COLUMN IF NOT EXISTS rain_risk_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS heat_risk_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS wind_risk_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS fire_risk_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS overall_risk_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS dominant_hazard text;

COMMENT ON TABLE sarva.forecast_risk_points IS
  'Daily cached ECMWF Open Data 0.25 degree forecast environmental risk points for SARVA map display. Component indices are development screening layers refreshed by the forecast-risk worker and retained as temporary forecast guidance.';

COMMENT ON COLUMN sarva.forecast_risk_points.rain_risk_score IS
  'SARVA development rainfall/flood proxy index, 0-100, derived from ECMWF daily total precipitation.';

COMMENT ON COLUMN sarva.forecast_risk_points.heat_risk_score IS
  'SARVA development heat index, 0-100, derived from ECMWF daily maximum 2 m temperature.';

COMMENT ON COLUMN sarva.forecast_risk_points.wind_risk_score IS
  'SARVA development wind index, 0-100, derived from ECMWF daily maximum 10 m wind speed.';

COMMENT ON COLUMN sarva.forecast_risk_points.fire_risk_score IS
  'SARVA development fire-weather proxy index, 0-100, derived from heat, wind and forecast dryness. This is not a formal fire danger index.';
