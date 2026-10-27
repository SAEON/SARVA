-- Pseudonymous IP identifiers only. Historical events cannot be backfilled.
ALTER TABLE sarva.analytics_event ADD COLUMN IF NOT EXISTS visitor_ip_hash text;
CREATE INDEX IF NOT EXISTS analytics_event_ip_date_idx
 ON sarva.analytics_event(created_at,visitor_ip_hash)
 WHERE kind='page' AND visitor_ip_hash IS NOT NULL;
