WITH ranked_items AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY nav_id, lower(label)
      ORDER BY sort_order ASC, id ASC
    ) AS duplicate_rank
  FROM sarva.site_nav_item
  WHERE is_active = true
)
UPDATE sarva.site_nav_item item
SET is_active = false
FROM ranked_items ranked
WHERE item.id = ranked.id
  AND ranked.duplicate_rank > 1;
