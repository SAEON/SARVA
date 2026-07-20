CREATE TABLE IF NOT EXISTS sarva.national_policy_legislation (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  url text,
  publication_year text,
  publisher text,
  abstract text,
  keywords text[] NOT NULL DEFAULT '{}',
  source_page text NOT NULL DEFAULT 'https://sarva.saeon.ac.za/national-policy-and-legislation/',
  source_identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT national_policy_legislation_source_identifier_key UNIQUE (source_identifier)
);

CREATE UNIQUE INDEX IF NOT EXISTS national_policy_legislation_url_unique_idx
  ON sarva.national_policy_legislation (lower(url))
  WHERE url IS NOT NULL AND btrim(url) <> '';

CREATE INDEX IF NOT EXISTS national_policy_legislation_title_lower_idx
  ON sarva.national_policy_legislation (lower(title));

CREATE INDEX IF NOT EXISTS national_policy_legislation_publisher_lower_idx
  ON sarva.national_policy_legislation (lower(publisher));

CREATE INDEX IF NOT EXISTS national_policy_legislation_year_idx
  ON sarva.national_policy_legislation (publication_year);

CREATE INDEX IF NOT EXISTS national_policy_legislation_keywords_gin_idx
  ON sarva.national_policy_legislation USING gin (keywords);

SELECT setval(
  pg_get_serial_sequence('sarva.site_nav_item', 'id'),
  COALESCE((SELECT max(id) FROM sarva.site_nav_item), 1),
  true
)
WHERE pg_get_serial_sequence('sarva.site_nav_item', 'id') IS NOT NULL;

INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT n.id, 'National Policy & Legislation', '/national-policy-and-legislation', NULL, false, 3, true
FROM sarva.site_nav n
WHERE n.label = 'RESOURCES & TRAINING'
  AND NOT EXISTS (
    SELECT 1
    FROM sarva.site_nav_item i
    WHERE i.nav_id = n.id
      AND (
        i.to_path = '/national-policy-and-legislation'
        OR lower(i.label) = 'national policy & legislation'
      )
  );
