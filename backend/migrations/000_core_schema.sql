CREATE SCHEMA IF NOT EXISTS sarva;

CREATE TABLE IF NOT EXISTS sarva.schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sarva.site_nav (
  id bigserial PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS sarva.site_nav_item (
  id bigserial PRIMARY KEY,
  nav_id bigint NOT NULL REFERENCES sarva.site_nav(id) ON DELETE CASCADE,
  label text NOT NULL,
  to_path text,
  href text,
  is_external boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS sarva.site_hero (
  id bigserial PRIMARY KEY,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  subtitle text,
  description text,
  cta_label text,
  cta_href text,
  image_path text NOT NULL,
  image_alt text NOT NULL DEFAULT 'Hero image',
  overlay_strength numeric NOT NULL DEFAULT 0.45,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sarva.glossary_term (
  id bigserial PRIMARY KEY,
  term text NOT NULL,
  definition text NOT NULL,
  category text,
  source text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_nav_sort_idx
  ON sarva.site_nav (sort_order);

CREATE INDEX IF NOT EXISTS site_nav_item_nav_sort_idx
  ON sarva.site_nav_item (nav_id, sort_order);

CREATE INDEX IF NOT EXISTS glossary_term_active_sort_idx
  ON sarva.glossary_term (is_active, lower(term));

INSERT INTO sarva.site_nav (label, sort_order, is_active)
SELECT value.label, value.sort_order, true
FROM (
  VALUES
    ('HOME', 1),
    ('DATA & OBSERVATIONS', 2),
    ('MAPS & TOOLS', 3),
    ('RESOURCES & TRAINING', 4)
) AS value(label, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav existing
  WHERE existing.label = value.label
);

INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT n.id, item.label, item.to_path, item.href, item.is_external, item.sort_order, true
FROM sarva.site_nav n
JOIN (
  VALUES
    ('DATA & OBSERVATIONS', 'SAEON Data Catalogue', NULL, 'https://catalogue.saeon.ac.za', true, 1),
    ('DATA & OBSERVATIONS', 'Terrestrial Observations Monitor', '/data/datasets', 'https://observationsmonitor.saeon.ac.za', true, 2),
    ('DATA & OBSERVATIONS', 'SAEON Observations Database', NULL, 'https://observations.saeon.ac.za', true, 3),
    ('MAPS & TOOLS', 'Air quality predictions', NULL, 'https://sarvamaps.saeon.ac.za/air-quality/', true, 1),
    ('RESOURCES & TRAINING', 'Glossary of terms', '/glossary', NULL, false, 1)
) AS item(nav_label, label, to_path, href, is_external, sort_order)
  ON n.label = item.nav_label
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav_item existing
  WHERE existing.nav_id = n.id
    AND existing.label = item.label
);

INSERT INTO sarva.site_hero (
  slug,
  is_active,
  title,
  subtitle,
  description,
  cta_label,
  cta_href,
  image_path,
  image_alt,
  overlay_strength,
  sort_order
)
SELECT
  'home',
  true,
  'Environmental intelligence for a resilient and sustainable South Africa',
  'South African Risk and Vulnerability Atlas',
  'Integrated data. Trusted insights. Collaborative solutions.',
  'Open dashboard',
  '/overview',
  '/public/hero/test-home.png',
  'South African landscape',
  0.45,
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_hero
  WHERE slug = 'home'
);
