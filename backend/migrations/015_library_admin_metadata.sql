ALTER TABLE sarva.resources
  ADD COLUMN IF NOT EXISTS link_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS link_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_status_code integer,
  ADD COLUMN IF NOT EXISTS admin_notes text;

ALTER TABLE sarva.national_policy_legislation
  ADD COLUMN IF NOT EXISTS link_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS link_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_status_code integer,
  ADD COLUMN IF NOT EXISTS admin_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resources_link_status_chk'
  ) THEN
    ALTER TABLE sarva.resources
      ADD CONSTRAINT resources_link_status_chk
      CHECK (link_status IN ('unchecked', 'active', 'broken', 'redirected', 'missing'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'national_policy_legislation_link_status_chk'
  ) THEN
    ALTER TABLE sarva.national_policy_legislation
      ADD CONSTRAINT national_policy_legislation_link_status_chk
      CHECK (link_status IN ('unchecked', 'active', 'broken', 'redirected', 'missing'));
  END IF;
END $$;

UPDATE sarva.resources
SET link_status = 'missing'
WHERE (url IS NULL OR btrim(url) = '')
  AND link_status = 'unchecked';

UPDATE sarva.national_policy_legislation
SET link_status = 'missing'
WHERE (url IS NULL OR btrim(url) = '')
  AND link_status = 'unchecked';
