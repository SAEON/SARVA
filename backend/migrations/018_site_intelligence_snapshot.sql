CREATE TABLE IF NOT EXISTS sarva.site_intelligence_snapshot (
  id bigserial PRIMARY KEY,
  snapshot_key text NOT NULL UNIQUE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_summary jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS site_intelligence_snapshot_expires_idx
  ON sarva.site_intelligence_snapshot (snapshot_key, expires_at DESC);

COMMENT ON TABLE sarva.site_intelligence_snapshot IS
  'Daily cached home-page intelligence snapshots assembled from SARVA local database, forecast risk cache, catalogue mirror and library health tables.';
