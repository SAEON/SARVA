ALTER TABLE sarva.review_issue ADD COLUMN IF NOT EXISTS assigned_to bigint REFERENCES sarva.app_user(id);
ALTER TABLE sarva.review_issue_event DROP CONSTRAINT IF EXISTS review_issue_event_event_type_check;
ALTER TABLE sarva.review_issue_event ADD CONSTRAINT review_issue_event_event_type_check
 CHECK(event_type IN ('created','comment','reply','review','edited','deleted','restored','assigned'));
CREATE INDEX IF NOT EXISTS review_issue_assigned_active_idx ON sarva.review_issue(assigned_to,updated_at DESC) WHERE deleted_at IS NULL;
