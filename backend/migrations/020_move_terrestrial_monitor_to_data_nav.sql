DO $$
DECLARE
  monitor_nav_label text;
  data_nav_id integer;
  maps_nav_id integer;
BEGIN
  SELECT id INTO data_nav_id
  FROM sarva.site_nav
  WHERE label = 'Data';

  SELECT id INTO maps_nav_id
  FROM sarva.site_nav
  WHERE label = 'Maps & Tools';

  SELECT n.label INTO monitor_nav_label
  FROM sarva.site_nav_item i
  JOIN sarva.site_nav n ON n.id = i.nav_id
  WHERE i.label = 'Terrestrial Observations Monitor'
  LIMIT 1;

  IF monitor_nav_label = 'Maps & Tools' THEN
    UPDATE sarva.site_nav_item
    SET sort_order = sort_order + 1
    WHERE nav_id = data_nav_id
      AND sort_order >= 4;

    UPDATE sarva.site_nav_item
    SET nav_id = data_nav_id,
        sort_order = 4
    WHERE label = 'Terrestrial Observations Monitor'
      AND nav_id = maps_nav_id;

    UPDATE sarva.site_nav_item
    SET sort_order = sort_order - 1
    WHERE nav_id = maps_nav_id
      AND sort_order > 3;
  END IF;
END $$;
