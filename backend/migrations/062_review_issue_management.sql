ALTER TABLE sarva.review_issue
 ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
 ADD COLUMN IF NOT EXISTS deleted_by bigint REFERENCES sarva.app_user(id);
ALTER TABLE sarva.review_issue_event DROP CONSTRAINT IF EXISTS review_issue_event_event_type_check;
ALTER TABLE sarva.review_issue_event ADD CONSTRAINT review_issue_event_event_type_check
 CHECK(event_type IN ('created','comment','reply','review','edited','deleted','restored'));
CREATE INDEX IF NOT EXISTS review_issue_active_updated_idx
 ON sarva.review_issue(updated_at DESC,id DESC) WHERE deleted_at IS NULL;
