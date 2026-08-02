WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET is_active = false
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label = 'Interactive Maps';

WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET sort_order = 1,
    to_path = '/municipal-risk-profiler',
    href = NULL,
    is_external = false,
    is_active = true
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label = 'Municipal Risk Profiler';

WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET sort_order = 2,
    to_path = '/#risk-map',
    href = NULL,
    is_external = false,
    is_active = true
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label = 'Rainfall Risk Layers';

WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET label = 'Air Quality (PM2.5) Predictions',
    sort_order = 7,
    to_path = NULL,
    href = 'https://sarvamaps.saeon.ac.za/air-quality/',
    is_external = true,
    is_active = true
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label IN ('Air Quality Predictions', 'Air Quality (PM2.5) Predictions');

WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
),
items(label, to_path, href, is_external, sort_order) AS (
  VALUES
    ('SARVA Atlas Gallery', NULL, 'https://sarva.saeon.ac.za/atlas/', true, 3),
    ('2017 Agriculture Census', NULL, 'https://sarvamaps.saeon.ac.za/agri-census/', true, 4),
    ('Climate Risk Tool', NULL, 'https://sarvamaps.saeon.ac.za/climate-tool/', true, 5),
    ('Environmental Vulnerability', NULL, 'https://sarvamaps.saeon.ac.za/sanbi/', true, 6),
    ('BioEnergy Technology Decision Support Tool', NULL, 'https://nrf-saeon.maps.arcgis.com/apps/dashboards/55aab230007f4712b62100988d182d2c', true, 8),
    ('Global Disasters Risk Dashboard', NULL, 'https://sarvamaps.saeon.ac.za/global-disasters/map', true, 9),
    ('HST District Health Barometer', NULL, 'https://dhb.hst.org.za/reproductive-maternal-child-health', true, 10),
    ('National Climate Change Information System', NULL, 'https://gisportal.saeon.ac.za/portal/apps/webappviewer/index.html?id=2d572dcf9c5f47c484540f8c934e03f4', true, 11),
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
