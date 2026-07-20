WITH data_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE lower(label) IN ('data', 'data & observations')
  ORDER BY sort_order
  LIMIT 1
)
UPDATE sarva.site_nav_item
SET sort_order = sort_order + 1
WHERE nav_id IN (SELECT id FROM data_nav)
  AND sort_order >= 3;

WITH data_nav AS (
  SELECT id
  FROM sarva.site_nav
  WHERE lower(label) IN ('data', 'data & observations')
  ORDER BY sort_order
  LIMIT 1
)
INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT
  data_nav.id,
  'Submit Data',
  NULL,
  'https://docs.google.com/forms/d/1bxnefRblVoQ8hpJJx_KL1nzeZHQfEK-QKVCxoPIXnAU/viewform?edit_requested=true',
  true,
  3,
  true
FROM data_nav
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav_item i
  WHERE i.nav_id = data_nav.id
    AND lower(i.label) = 'submit data'
);
