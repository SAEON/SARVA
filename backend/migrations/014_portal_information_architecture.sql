DELETE FROM sarva.site_nav_item;
DELETE FROM sarva.site_nav;

INSERT INTO sarva.site_nav (label, sort_order, is_active)
VALUES
  ('Home', 1, true),
  ('Explore', 2, true),
  ('Data', 3, true),
  ('Maps & Tools', 4, true),
  ('Resources', 5, true),
  ('Community', 6, true),
  ('About', 7, true);

INSERT INTO sarva.site_nav_item (nav_id, label, to_path, href, is_external, sort_order, is_active)
SELECT n.id, item.label, item.to_path, item.href, item.is_external, item.sort_order, true
FROM sarva.site_nav n
JOIN (
  VALUES
    ('Explore', 'Explore South Africa', '/overview', NULL, false, 1),
    ('Explore', 'Environmental Themes', '/overview', NULL, false, 2),
    ('Explore', 'Risk & Vulnerability Layers', '/overview', NULL, false, 3),
    ('Explore', 'Dashboards & Indicators', '/overview', NULL, false, 4),

    ('Data', 'SAEON Data Catalogue', NULL, 'https://catalogue.saeon.ac.za', true, 1),
    ('Data', 'SARVA Catalogue Mirror', '/overview', NULL, false, 2),
    ('Data', 'SAEON Observations Database', NULL, 'https://observations.saeon.ac.za', true, 3),
    ('Data', 'Terrestrial Observations Monitor', NULL, 'https://observationsmonitor.saeon.ac.za', true, 4),
    ('Data', 'Live Observation Feeds', '/overview', NULL, false, 5),

    ('Maps & Tools', 'Interactive Maps', '/overview', NULL, false, 1),
    ('Maps & Tools', 'Rainfall Risk Layers', '/overview', NULL, false, 2),
    ('Maps & Tools', 'Air Quality Predictions', NULL, 'https://sarvamaps.saeon.ac.za/air-quality/', true, 3),

    ('Resources', 'Search Glossary', '/glossary', NULL, false, 1),
    ('Resources', 'Relevant Documents', '/resources', NULL, false, 2),
    ('Resources', 'National Policy & Legislation', '/national-policy-and-legislation', NULL, false, 3),
    ('Resources', 'Reports & Stories', '/overview', NULL, false, 4),

    ('Community', 'Help & Training', '/overview', NULL, false, 1),
    ('Community', 'Contribute Data', '/overview', NULL, false, 2),
    ('Community', 'Communities of Practice', '/overview', NULL, false, 3),
    ('Community', 'Contact SARVA', '/overview', NULL, false, 4),

    ('About', 'About SARVA', '/overview#about', NULL, false, 1),
    ('About', 'Partners', '/overview', NULL, false, 2),
    ('About', 'Governance', '/overview', NULL, false, 3),
    ('About', 'API & Developers', '/overview', NULL, false, 4)
) AS item(nav_label, label, to_path, href, is_external, sort_order)
  ON n.label = item.nav_label;
