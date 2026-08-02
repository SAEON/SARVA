UPDATE sarva.site_hero
SET cta_label = 'Explore Now',
    cta_href = '/explore'
WHERE slug = 'home'
  AND is_active = true;
