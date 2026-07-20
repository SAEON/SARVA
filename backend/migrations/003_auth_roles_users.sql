CREATE TABLE IF NOT EXISTS sarva.auth_role (
  id bigserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sarva.app_user (
  id bigserial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS sarva.app_user_role (
  user_id bigint NOT NULL REFERENCES sarva.app_user(id) ON DELETE CASCADE,
  role_id bigint NOT NULL REFERENCES sarva.auth_role(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS app_user_email_lower_idx
  ON sarva.app_user (lower(email));

CREATE INDEX IF NOT EXISTS app_user_role_role_id_idx
  ON sarva.app_user_role (role_id);

INSERT INTO sarva.auth_role (name, label, description)
VALUES
  ('viewer', 'Viewer', 'Default access for registered SARVA users.'),
  ('contributor', 'Contributor', 'Can contribute content once role-based functions are enabled.'),
  ('admin', 'Administrator', 'Can administer users and platform content once role-based functions are enabled.')
ON CONFLICT (name)
DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;
