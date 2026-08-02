WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET href = 'https://sarvamaps.saeon.ac.za/global-disasters/map',
    sort_order = 9,
    to_path = NULL,
    is_external = true,
    is_active = true
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label = 'Global Disasters Risk Dashboard';

WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET sort_order = 7,
    href = 'https://sarvamaps.saeon.ac.za/air-quality/',
    to_path = NULL,
    is_external = true,
    is_active = true
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label = 'Air Quality (PM2.5) Predictions';

WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
),
items(label, to_path, href, is_external, sort_order) AS (
  VALUES
    ('2017 Agriculture Census', NULL, 'https://sarvamaps.saeon.ac.za/agri-census/', true, 4),
    ('BioEnergy Technology Decision Support Tool', NULL, 'https://nrf-saeon.maps.arcgis.com/apps/dashboards/55aab230007f4712b62100988d182d2c', true, 8),
    ('Ocean Data Explorer Tool', NULL, 'https://dash.saeon.ac.za/apps/ocean/PELTER', true, 12)
)
INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT maps_nav.id,
       items.label,
       items.to_path,
       items.href,
       items.is_external,
       items.sort_order,
       true
FROM maps_nav
CROSS JOIN items
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav_item existing
  WHERE existing.nav_id = maps_nav.id
    AND existing.label = items.label
);

WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET sort_order = CASE label
    WHEN 'Municipal Risk Profiler' THEN 1
    WHEN 'Rainfall Risk Layers' THEN 2
    WHEN 'SARVA Atlas Gallery' THEN 3
    WHEN '2017 Agriculture Census' THEN 4
    WHEN 'Climate Risk Tool' THEN 5
    WHEN 'Environmental Vulnerability' THEN 6
    WHEN 'Air Quality (PM2.5) Predictions' THEN 7
    WHEN 'BioEnergy Technology Decision Support Tool' THEN 8
    WHEN 'Global Disasters Risk Dashboard' THEN 9
    WHEN 'HST District Health Barometer' THEN 10
    WHEN 'National Climate Change Information System' THEN 11
    WHEN 'Ocean Data Explorer Tool' THEN 12
    ELSE sort_order
  END
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label IN (
    'Municipal Risk Profiler',
    'Rainfall Risk Layers',
    'SARVA Atlas Gallery',
    '2017 Agriculture Census',
    'Climate Risk Tool',
    'Environmental Vulnerability',
    'Air Quality (PM2.5) Predictions',
    'BioEnergy Technology Decision Support Tool',
    'Global Disasters Risk Dashboard',
    'HST District Health Barometer',
    'National Climate Change Information System',
    'Ocean Data Explorer Tool'
  );
