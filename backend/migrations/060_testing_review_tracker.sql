CREATE TABLE IF NOT EXISTS sarva.review_issue (
 id bigserial PRIMARY KEY,
 title text NOT NULL CHECK (length(title) BETWEEN 3 AND 180),
 kind text NOT NULL CHECK (kind IN ('bug','update','comment')),
 description text NOT NULL CHECK (length(description) BETWEEN 10 AND 10000),
 page_path text NOT NULL DEFAULT '',
 priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in-review','resolved')),
 resolution text NOT NULL DEFAULT '',
 created_by bigint NOT NULL REFERENCES sarva.app_user(id),
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 CHECK (status <> 'resolved' OR length(resolution) >= 5)
);
CREATE TABLE IF NOT EXISTS sarva.review_issue_event (
 id bigserial PRIMARY KEY,
 issue_id bigint NOT NULL REFERENCES sarva.review_issue(id),
 actor_user_id bigint NOT NULL REFERENCES sarva.app_user(id),
 event_type text NOT NULL CHECK (event_type IN ('created','comment','reply','review')),
 note text NOT NULL CHECK (length(note) BETWEEN 1 AND 10000),
 changes jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_issue_owner_idx ON sarva.review_issue(created_by,id DESC);
CREATE INDEX IF NOT EXISTS review_issue_status_idx ON sarva.review_issue(status,id DESC);
CREATE INDEX IF NOT EXISTS review_issue_event_issue_idx ON sarva.review_issue_event(issue_id,id);

ALTER TABLE sarva.review_issue_event DROP CONSTRAINT IF EXISTS review_issue_event_event_type_check;
ALTER TABLE sarva.review_issue_event ADD CONSTRAINT review_issue_event_event_type_check
 CHECK (event_type IN ('created','comment','reply','review'));
