CREATE SCHEMA IF NOT EXISTS sarva;

CREATE TABLE IF NOT EXISTS sarva.schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sarva.resources (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  url text,
  author text,
  publication_year text,
  resource_type text,
  keywords text[] NOT NULL DEFAULT '{}',
  source_page text NOT NULL DEFAULT 'https://sarva.saeon.ac.za/resources/',
  source_identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resources_source_identifier_key UNIQUE (source_identifier)
);

CREATE UNIQUE INDEX IF NOT EXISTS resources_url_unique_idx
  ON sarva.resources (lower(url))
  WHERE url IS NOT NULL AND btrim(url) <> '';

CREATE INDEX IF NOT EXISTS resources_title_lower_idx
  ON sarva.resources (lower(title));

CREATE INDEX IF NOT EXISTS resources_author_lower_idx
  ON sarva.resources (lower(author));

CREATE INDEX IF NOT EXISTS resources_resource_type_idx
  ON sarva.resources (resource_type);

CREATE INDEX IF NOT EXISTS resources_publication_year_idx
  ON sarva.resources (publication_year);

CREATE INDEX IF NOT EXISTS resources_keywords_gin_idx
  ON sarva.resources USING gin (keywords);

SELECT setval(
  pg_get_serial_sequence('sarva.site_nav_item', 'id'),
  COALESCE((SELECT max(id) FROM sarva.site_nav_item), 1),
  true
)
WHERE pg_get_serial_sequence('sarva.site_nav_item', 'id') IS NOT NULL;

INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT n.id, 'Relevant Documents', '/resources', NULL, false, 2, true
FROM sarva.site_nav n
WHERE n.label = 'RESOURCES & TRAINING'
  AND NOT EXISTS (
    SELECT 1
    FROM sarva.site_nav_item i
    WHERE i.nav_id = n.id
      AND lower(i.label) IN ('resources', 'relevant documents')
  );
