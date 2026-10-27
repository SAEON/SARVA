ALTER TABLE sarva.app_user ADD COLUMN IF NOT EXISTS access_revision integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS sarva.user_access_audit (
 id bigserial PRIMARY KEY,
 actor_user_id bigint NOT NULL REFERENCES sarva.app_user(id),
 target_user_id bigint NOT NULL REFERENCES sarva.app_user(id),
 before_access jsonb NOT NULL,
 after_access jsonb NOT NULL,
 reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_access_audit_target_idx ON sarva.user_access_audit(target_user_id, id DESC);
