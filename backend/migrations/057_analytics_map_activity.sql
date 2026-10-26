-- Historical events remain unclassified; identity is never inferred retrospectively.
ALTER TABLE sarva.analytics_event DROP CONSTRAINT IF EXISTS analytics_event_kind_check;
ALTER TABLE sarva.analytics_event ADD CONSTRAINT analytics_event_kind_check CHECK (kind IN ('page','api','click','interaction'));
ALTER TABLE sarva.analytics_event
 ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES sarva.app_user(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'legacy',
 ADD COLUMN IF NOT EXISTS latitude numeric,
 ADD COLUMN IF NOT EXISTS longitude numeric,
 ADD COLUMN IF NOT EXISTS action text,
 ADD COLUMN IF NOT EXISTS subject text;
CREATE INDEX IF NOT EXISTS analytics_event_user_created_idx ON sarva.analytics_event(user_id,created_at);
