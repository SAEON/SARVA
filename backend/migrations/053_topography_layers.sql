CREATE TABLE IF NOT EXISTS sarva.topography_contours (
  gid serial PRIMARY KEY,
  elevation_m integer NOT NULL,
  contour_interval_m integer NOT NULL DEFAULT 20,
  source_name text NOT NULL,
  source_url text,
  source_date text,
  processing_note text,
  geom geometry(MULTILINESTRING, 3857) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topography_contours_geom
  ON sarva.topography_contours USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_topography_contours_elevation
  ON sarva.topography_contours (elevation_m);

CREATE TABLE IF NOT EXISTS sarva.topography_slope_zones (
  gid serial PRIMARY KEY,
  slope_class text NOT NULL,
  slope_min_degrees numeric,
  slope_max_degrees numeric,
  source_name text NOT NULL,
  source_url text,
  source_date text,
  processing_note text,
  geom geometry(MULTIPOLYGON, 3857) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topography_slope_zones_geom
  ON sarva.topography_slope_zones USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_topography_slope_zones_class
  ON sarva.topography_slope_zones (slope_class);

ANALYZE sarva.topography_contours;
ANALYZE sarva.topography_slope_zones;
