WITH community_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label = 'Community'
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET sort_order = sort_order + 1
WHERE nav_id = (SELECT id FROM community_nav)
  AND sort_order >= 2;

WITH community_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label = 'Community'
  ORDER BY sort_order
  LIMIT 1
)
INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT
  community_nav.id,
  'Data Science Lab',
  '/resources?search=data%20science%20lab',
  NULL,
  false,
  2,
  true
FROM community_nav
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav_item item
  WHERE item.nav_id = community_nav.id
    AND item.label = 'Data Science Lab'
);
