WITH data_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE lower(label) IN ('data', 'data & observations')
)
UPDATE sarva.site_nav_item
SET is_active = false
WHERE nav_id IN (SELECT id FROM data_nav);

WITH data_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE lower(label) IN ('data', 'data & observations')
  ORDER BY sort_order
  LIMIT 1
),
items(label, to_path, href, is_external, sort_order) AS (
  VALUES
    ('Search SAEON Data', '/search', NULL, false, 1),
    ('Terrestrial Observations Monitor', NULL, 'https://observationsmonitor.saeon.ac.za', true, 2),
    ('Data Curation', NULL, 'https://www.saeon.ac.za/data-curation/', true, 3),
    ('SAEON Data Policy', NULL, 'https://repository.saeon.ac.za/index.php/s/nscR6iaHcy4LYds?dir=/&editing=false&openfile=true', true, 4)
)
INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT data_nav.id, items.label, items.to_path, items.href, items.is_external, items.sort_order, true
FROM data_nav
CROSS JOIN items
ON CONFLICT DO NOTHING;
