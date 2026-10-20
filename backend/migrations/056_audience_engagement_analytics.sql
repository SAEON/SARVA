ALTER TABLE sarva.analytics_event DROP CONSTRAINT IF EXISTS analytics_event_kind_check;
ALTER TABLE sarva.analytics_event ADD CONSTRAINT analytics_event_kind_check CHECK (kind IN ('page','api','click'));
ALTER TABLE sarva.analytics_event
  ADD COLUMN IF NOT EXISTS view_id text,
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS device text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS referrer_domain text,
  ADD COLUMN IF NOT EXISTS target_url text,
  ADD COLUMN IF NOT EXISTS link_label text,
  ADD COLUMN IF NOT EXISTS link_type text,
  ADD COLUMN IF NOT EXISTS scroll_depth integer;
CREATE UNIQUE INDEX IF NOT EXISTS analytics_page_view_unique ON sarva.analytics_event (view_id) WHERE kind='page' AND view_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_event_session_idx ON sarva.analytics_event (session_id,created_at) WHERE kind='page';
