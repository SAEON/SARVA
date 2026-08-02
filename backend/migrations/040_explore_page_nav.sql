UPDATE sarva.site_nav
SET sort_order = sort_order + 1
WHERE sort_order >= 2
  AND label <> 'Explore';

INSERT INTO sarva.site_nav (label, sort_order, is_active)
SELECT 'Explore', 2, true
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav
  WHERE label = 'Explore'
);

UPDATE sarva.site_nav
SET sort_order = 2,
    is_active = true
WHERE label = 'Explore';
