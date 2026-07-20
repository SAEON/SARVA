ALTER TABLE sarva.resources
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE sarva.national_policy_legislation
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS resources_active_title_idx
  ON sarva.resources (is_active, lower(title));

CREATE INDEX IF NOT EXISTS national_policy_legislation_active_title_idx
  ON sarva.national_policy_legislation (is_active, lower(title));
