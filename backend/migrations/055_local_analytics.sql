CREATE TABLE IF NOT EXISTS sarva.analytics_event (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('page', 'api')),
  path text NOT NULL,
  session_id text,
  status_code integer,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_event_created_idx ON sarva.analytics_event (created_at);
