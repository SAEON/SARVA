UPDATE sarva.site_hero
SET is_active = false
WHERE slug <> 'home-hero-2026';

UPDATE sarva.site_hero
SET
  is_active = true,
  title = 'South African Risk & Vulnerability Atlas',
  subtitle = 'Mapping the way to a resilient future',
  description = 'An open access platform linking datasets, indicators, and tools.',
  cta_label = 'Explore Now',
  cta_href = '/maps/explore',
  image_path = '/public/hero/storm.jpg',
  image_alt = 'Storm clouds over landscape',
  overlay_strength = 0.45,
  sort_order = 0
WHERE slug = 'home-hero-2026';

INSERT INTO sarva.site_hero (
  slug,
  is_active,
  title,
  subtitle,
  description,
  cta_label,
  cta_href,
  image_path,
  image_alt,
  overlay_strength,
  sort_order
)
SELECT
  'home-hero-2026',
  true,
  'South African Risk & Vulnerability Atlas',
  'Mapping the way to a resilient future',
  'An open access platform linking datasets, indicators, and tools.',
  'Explore Now',
  '/maps/explore',
  '/public/hero/storm.jpg',
  'Storm clouds over landscape',
  0.45,
  0
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_hero
  WHERE slug = 'home-hero-2026'
);
