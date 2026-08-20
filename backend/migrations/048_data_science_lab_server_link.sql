UPDATE sarva.site_nav_item
SET to_path = NULL,
    href = '/ds-lab/',
    is_external = true
WHERE label = 'Data Science Lab';
