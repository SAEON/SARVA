WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
),
items(label, to_path, href, is_external, sort_order) AS (
  VALUES
    ('Municipal Planning Workspace', '/municipal-planning-workspace', NULL, false, 2)
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
SET sort_order = sort_order + 1
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label <> 'Municipal Planning Workspace'
  AND sort_order >= 2;

WITH maps_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Maps & Tools', 'MAPS & TOOLS')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET to_path = '/municipal-planning-workspace',
    href = NULL,
    is_external = false,
    sort_order = 2,
    is_active = true
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label = 'Municipal Planning Workspace';

WITH explore_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Explore', 'EXPLORE')
  ORDER BY sort_order
  LIMIT 1
),
items(label, to_path, href, is_external, sort_order) AS (
  VALUES
    ('Municipal Planning Workspace', '/municipal-planning-workspace', NULL, false, 5)
)
INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT explore_nav.id,
       items.label,
       items.to_path,
       items.href,
       items.is_external,
       items.sort_order,
       true
FROM explore_nav
CROSS JOIN items
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav_item existing
  WHERE existing.nav_id = explore_nav.id
    AND existing.label = items.label
);

WITH explore_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('Explore', 'EXPLORE')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET to_path = '/municipal-planning-workspace',
    href = NULL,
    is_external = false,
    sort_order = 5,
    is_active = true
WHERE nav_id = (SELECT id FROM explore_nav)
  AND label = 'Municipal Planning Workspace';
