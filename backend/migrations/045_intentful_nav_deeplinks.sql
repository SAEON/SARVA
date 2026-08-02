UPDATE sarva.site_nav_item
SET to_path = '/#risk-map',
    href = NULL,
    is_external = false
WHERE label IN ('Explore South Africa', 'Interactive Maps', 'Rainfall Risk Layers');

UPDATE sarva.site_nav_item
SET to_path = '/explore#themes',
    href = NULL,
    is_external = false
WHERE label = 'Environmental Themes';

UPDATE sarva.site_nav_item
SET to_path = '/municipal-risk-profiler?metric=governance&tab=drivers',
    href = NULL,
    is_external = false
WHERE label = 'Risk & Vulnerability Layers';

UPDATE sarva.site_nav_item
SET to_path = '/municipal-risk-profiler?tab=indicators',
    href = NULL,
    is_external = false
WHERE label = 'Dashboards & Indicators';
