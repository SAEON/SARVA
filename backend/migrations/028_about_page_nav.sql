UPDATE sarva.site_nav_item
SET to_path = '/about',
    href = NULL,
    is_external = false
WHERE label = 'About SARVA';

UPDATE sarva.site_nav_item
SET to_path = '/about',
    href = NULL,
    is_external = false
WHERE label IN ('Partners', 'Governance')
  AND nav_id = (SELECT id FROM sarva.site_nav WHERE label = 'About' LIMIT 1);

UPDATE sarva.site_nav_item
SET label = 'About SARVA',
    to_path = '/about',
    href = NULL,
    is_external = false
WHERE label = 'About'
  AND nav_id = (SELECT id FROM sarva.site_nav WHERE label = 'About' LIMIT 1);
