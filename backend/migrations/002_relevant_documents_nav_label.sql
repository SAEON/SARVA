UPDATE sarva.site_nav_item
SET label = 'Relevant Documents'
WHERE to_path = '/resources'
  AND lower(label) = 'resources';
