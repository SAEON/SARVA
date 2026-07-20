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
  AND sort_order >= 2;

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
  'Supporting Data',
  '/?supportingData=true',
  NULL,
  false,
  2,
  true
FROM data_nav
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.site_nav_item i
  WHERE i.nav_id = data_nav.id
    AND lower(i.label) = 'supporting data'
);

WITH records(title, url, author, publication_year, resource_type, keywords, source_identifier) AS (
  VALUES
    ('NASA Earthdata Search', 'https://search.earthdata.nasa.gov/search', 'NASA Earthdata', '2026', 'Satellite Product', ARRAY['satellite', 'remote sensing', 'earth observation'], 'supporting-data:nasa-earthdata-search'),
    ('USGS EarthExplorer', 'https://earthexplorer.usgs.gov/', 'United States Geological Survey', '2026', 'Satellite Product', ARRAY['landsat', 'satellite', 'imagery'], 'supporting-data:usgs-earthexplorer'),
    ('Copernicus Data Space Browser', 'https://browser.dataspace.copernicus.eu/', 'European Union Copernicus Programme', '2026', 'Satellite Product', ARRAY['sentinel', 'copernicus', 'satellite'], 'supporting-data:copernicus-data-space-browser'),
    ('Google Earth Engine Data Catalog', 'https://developers.google.com/earth-engine/datasets', 'Google Earth Engine', '2026', 'Environmental Data', ARRAY['catalogue', 'remote sensing', 'analysis-ready data'], 'supporting-data:google-earth-engine-data-catalog'),
    ('CHIRPS Rainfall Data', 'https://www.chc.ucsb.edu/data/chirps', 'Climate Hazards Center', '2026', 'Climate Data', ARRAY['rainfall', 'precipitation', 'drought'], 'supporting-data:chirps-rainfall'),
    ('Copernicus ERA5 Reanalysis', 'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels', 'Copernicus Climate Data Store', '2026', 'Climate Data', ARRAY['climate', 'reanalysis', 'weather'], 'supporting-data:era5-reanalysis'),
    ('ESA WorldCover', 'https://esa-worldcover.org/en', 'European Space Agency', '2026', 'Satellite Product', ARRAY['land cover', 'satellite', 'classification'], 'supporting-data:esa-worldcover'),
    ('NASA FIRMS Fire Information', 'https://firms.modaps.eosdis.nasa.gov/', 'NASA FIRMS', '2026', 'Environmental Data', ARRAY['fire', 'hotspots', 'near real-time'], 'supporting-data:nasa-firms'),
    ('OpenTopography', 'https://opentopography.org/', 'OpenTopography', '2026', 'Environmental Data', ARRAY['elevation', 'terrain', 'topography'], 'supporting-data:opentopography'),
    ('GBIF Occurrence Search', 'https://www.gbif.org/occurrence/search', 'Global Biodiversity Information Facility', '2026', 'Environmental Data', ARRAY['biodiversity', 'species', 'occurrence'], 'supporting-data:gbif-occurrence')
)
INSERT INTO sarva.resources (
  title,
  url,
  author,
  publication_year,
  resource_type,
  keywords,
  source_page,
  source_identifier,
  link_status,
  admin_notes
)
SELECT
  title,
  url,
  author,
  publication_year,
  resource_type,
  keywords,
  'SARVA supporting data seed',
  source_identifier,
  'unchecked',
  'Seeded supporting-data link; review and curate as needed.'
FROM records
WHERE NOT EXISTS (
  SELECT 1
  FROM sarva.resources r
  WHERE r.source_identifier = records.source_identifier
     OR lower(r.url) = lower(records.url)
);
