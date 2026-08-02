UPDATE sarva.site_nav_item
SET to_path = '/search',
    href = NULL,
    is_external = false
WHERE label IN ('SARVA Catalogue Mirror', 'Live Observation Feeds');

UPDATE sarva.site_nav_item
SET to_path = '/overview#risk-map',
    href = NULL,
    is_external = false
WHERE label IN ('Explore South Africa', 'Interactive Maps', 'Rainfall Risk Layers');

UPDATE sarva.site_nav_item
SET to_path = '/explore',
    href = NULL,
    is_external = false
WHERE label IN ('Environmental Themes', 'Risk & Vulnerability Layers', 'Dashboards & Indicators');

UPDATE sarva.site_nav_item
SET to_path = '/resources?resource_group=reports_stories',
    href = NULL,
    is_external = false
WHERE label = 'Reports & Stories';

UPDATE sarva.site_nav_item
SET to_path = '/resources?search=training',
    href = NULL,
    is_external = false
WHERE label = 'Help & Training';

UPDATE sarva.site_nav_item
SET to_path = NULL,
    href = 'https://docs.google.com/forms/d/1bxnefRblVoQ8hpJJx_KL1nzeZHQfEK-QKVCxoPIXnAU/viewform?edit_requested=true',
    is_external = true
WHERE label = 'Contribute Data';

UPDATE sarva.site_nav_item
SET to_path = '/about',
    href = NULL,
    is_external = false
WHERE label IN ('Communities of Practice', 'Contact SARVA', 'About SARVA', 'Partners', 'Governance');

UPDATE sarva.site_nav_item
SET to_path = NULL,
    href = 'https://github.com/SAEON',
    is_external = true
WHERE label = 'API & Developers';
