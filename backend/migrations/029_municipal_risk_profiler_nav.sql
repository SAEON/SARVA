WITH nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE label IN ('MAPS & TOOLS', 'Maps & Tools')
  ORDER BY sort_order
  LIMIT 1
)
INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT nav.id, 'Municipal Risk Profiler', '/municipal-risk-profiler', NULL, false, 0, true
FROM nav
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav_item item
  WHERE item.nav_id = nav.id
    AND item.label = 'Municipal Risk Profiler'
);

UPDATE sarva.site_nav_item
SET to_path = '/municipal-risk-profiler',
    href = NULL,
    is_external = false,
    is_active = true
WHERE label = 'Municipal Risk Profiler';
