WITH maps_nav AS (
    SELECT id
    FROM sarva.site_nav
    WHERE label ILIKE 'Maps & Tools'
    LIMIT 1
)
UPDATE sarva.site_nav_item
SET sort_order = sort_order + 1
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label <> 'MDB 2026 Boundary Preview'
  AND sort_order >= 3;

WITH maps_nav AS (
    SELECT id
    FROM sarva.site_nav
    WHERE label ILIKE 'Maps & Tools'
    LIMIT 1
)
UPDATE sarva.site_nav_item
SET to_path = '/mdb-2026-boundaries',
    href = NULL,
    sort_order = 3,
    is_active = true
WHERE nav_id = (SELECT id FROM maps_nav)
  AND label = 'MDB 2026 Boundary Preview';

WITH maps_nav AS (
    SELECT id
    FROM sarva.site_nav
    WHERE label ILIKE 'Maps & Tools'
    LIMIT 1
)
INSERT INTO sarva.site_nav_item (nav_id, label, to_path, sort_order, is_active)
SELECT id, 'MDB 2026 Boundary Preview', '/mdb-2026-boundaries', 3, true
FROM maps_nav
WHERE NOT EXISTS (
    SELECT 1
    FROM sarva.site_nav_item
    WHERE nav_id = maps_nav.id
      AND label = 'MDB 2026 Boundary Preview'
);
