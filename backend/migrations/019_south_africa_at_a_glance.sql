CREATE TABLE IF NOT EXISTS sarva.south_africa_at_a_glance_fact (
  id bigserial PRIMARY KEY,
  section text NOT NULL,
  fact text NOT NULL,
  value text NOT NULL,
  unit text,
  place text,
  source text,
  source_type text,
  updated text,
  note text,
  status text NOT NULL DEFAULT 'available',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT south_africa_at_a_glance_fact_unique UNIQUE (section, fact)
);

INSERT INTO sarva.south_africa_at_a_glance_fact
  (section, fact, value, unit, place, source, source_type, updated, note, status, sort_order)
VALUES
  ('Geographic records', 'Highest point', '3450', 'm above sea level', 'Mafadi, Drakensberg', 'Curated geographic reference', 'static', 'Stable fact', 'On the South Africa-Lesotho border', 'available', 10),
  ('Geographic records', 'Lowest elevation', '0', 'm above sea level', 'Atlantic and Indian Ocean coastline', 'Curated geographic reference', 'static', 'Stable fact', '', 'available', 20),
  ('Geographic records', 'Longest river', '2200', 'km', 'Orange-Senqu River', 'Department of Water and Sanitation', 'static', 'Stable fact', 'Rises in Lesotho and reaches the Atlantic Ocean', 'available', 30),
  ('Geographic records', 'Coastline length', '2798', 'km', 'Atlantic and Indian Ocean coasts', 'South African government publications', 'static', 'Stable fact', '', 'available', 40),
  ('Geographic records', 'Largest dam', 'Gariep Dam', '', 'Free State / Eastern Cape / Northern Cape region', 'Department of Water and Sanitation', 'static', 'Stable fact', 'Largest dam in South Africa by storage capacity', 'available', 50),
  ('Geographic records', 'Largest province by area', 'Northern Cape', '', 'South Africa', 'Curated geographic reference', 'static', 'Stable fact', '', 'available', 60),
  ('Geographic records', 'Smallest province by area', 'Gauteng', '', 'South Africa', 'Curated geographic reference', 'static', 'Stable fact', '', 'available', 70),
  ('Country profile', 'Number of provinces', '9', 'provinces', 'South Africa', 'South African Constitution / government structure', 'static', 'Stable fact', '', 'available', 80),
  ('Country profile', 'National capitals', '3', 'capitals', 'Pretoria, Cape Town and Bloemfontein', 'South African government', 'static', 'Stable fact', 'Administrative, legislative and judicial capitals', 'available', 90),
  ('Open-data statistics', 'Population', '64747319', 'people', 'South Africa', 'World Bank API', 'API', '2025', 'Latest available World Bank estimate', 'available', 100),
  ('Open-data statistics', 'Land area', '1213090', 'km2', 'South Africa', 'World Bank API', 'API', '2023', '', 'available', 110),
  ('Environment', 'Forest area', '13.97', '% of land area', 'South Africa', 'World Bank API', 'API', '2023', '', 'available', 120),
  ('Environment', 'Protected terrestrial and marine area', '12.9', '% of total territorial area', 'South Africa', 'World Bank API', 'API', '2025', 'World Bank indicator; methodology may differ from national reporting', 'available', 130),
  ('Biodiversity', 'GBIF occurrence records', '48494560', 'records', 'South Africa', 'GBIF Occurrence API', 'API', 'Current index', '', 'available', 140),
  ('Biodiversity', 'Georeferenced GBIF records', '47118103', 'records', 'South Africa', 'GBIF Occurrence API', 'API', 'Current index', '', 'available', 150),
  ('Biodiversity', 'GBIF species data availability', 'Available', '', 'South Africa', 'GBIF Occurrence API', 'API', 'Current index', 'Distinct species totals require a separate aggregation workflow', 'available', 160),
  ('Heritage and conservation', 'UNESCO World Heritage properties', '3', 'properties', 'South Africa', 'UNESCO World Heritage Convention', 'open webpage', 'Current page', 'Count taken from UNESCO''s South Africa state-party page', 'available', 170)
ON CONFLICT (section, fact) DO UPDATE SET
  value = EXCLUDED.value,
  unit = EXCLUDED.unit,
  place = EXCLUDED.place,
  source = EXCLUDED.source,
  source_type = EXCLUDED.source_type,
  updated = EXCLUDED.updated,
  note = EXCLUDED.note,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
