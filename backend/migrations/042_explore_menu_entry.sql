WITH explore_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label = 'Explore'
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET sort_order = sort_order + 1
WHERE nav_id = (SELECT id FROM explore_nav)
  AND sort_order >= 1
  AND label <> 'Explore SARVA';

WITH explore_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label = 'Explore'
  LIMIT 1
)
INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT id, 'Explore SARVA', '/explore', NULL, false, 1, true
FROM explore_nav
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav_item item
  WHERE item.nav_id = explore_nav.id
    AND item.label = 'Explore SARVA'
);

WITH explore_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label = 'Explore'
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET to_path = '/explore',
    href = NULL,
    is_external = false,
    sort_order = 1,
    is_active = true
WHERE nav_id = (SELECT id FROM explore_nav)
  AND label = 'Explore SARVA';
