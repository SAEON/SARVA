CREATE TABLE IF NOT EXISTS sarva.forecast_risk_sync_run (
  id bigserial PRIMARY KEY,
  source text NOT NULL DEFAULT 'ecmwf-open-data',
  sync_date date NOT NULL DEFAULT CURRENT_DATE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  forecast_days integer NOT NULL DEFAULT 5,
  point_count integer NOT NULL DEFAULT 0,
  error_message text,
  CONSTRAINT forecast_risk_sync_run_status_chk CHECK (status IN ('running', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS forecast_risk_sync_run_date_idx
  ON sarva.forecast_risk_sync_run (sync_date DESC, started_at DESC);

CREATE TABLE IF NOT EXISTS sarva.forecast_risk_points (
  id bigserial PRIMARY KEY,
  sync_run_id bigint REFERENCES sarva.forecast_risk_sync_run(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'ecmwf-open-data',
  source_url text,
  attribution text NOT NULL,
  forecast_date date NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  rainfall_mm numeric(8, 2) NOT NULL DEFAULT 0,
  risk_score integer NOT NULL DEFAULT 0,
  risk_label text NOT NULL DEFAULT 'Minimal',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forecast_risk_points_latitude_chk CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT forecast_risk_points_longitude_chk CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT forecast_risk_points_score_chk CHECK (risk_score BETWEEN 0 AND 4)
);

CREATE INDEX IF NOT EXISTS forecast_risk_points_geom_idx
  ON sarva.forecast_risk_points USING gist (geom);

CREATE INDEX IF NOT EXISTS forecast_risk_points_date_idx
  ON sarva.forecast_risk_points (forecast_date, source);

COMMENT ON TABLE sarva.forecast_risk_points IS
  'Daily cached ECMWF Open Data forecast precipitation risk points for SARVA map display. Values are refreshed by the forecast-risk worker and retained as temporary forecast guidance.';
