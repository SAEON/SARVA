CREATE TABLE IF NOT EXISTS sarva.loggernet_site_mappings (
  id bigserial PRIMARY KEY,
  station_name text NOT NULL UNIQUE,
  display_name text,
  longitude double precision,
  latitude double precision,
  altitude double precision,
  description text,
  image text,
  website_url text,
  modal_content text,
  citation text,
  doi text,
  source text NOT NULL DEFAULT 'loggernet-site-mapping',
  raw_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    CASE
      WHEN longitude IS NULL OR latitude IS NULL THEN NULL
      ELSE ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loggernet_site_mappings_longitude_chk CHECK (
    longitude IS NULL OR longitude BETWEEN -180 AND 180
  ),
  CONSTRAINT loggernet_site_mappings_latitude_chk CHECK (
    latitude IS NULL OR latitude BETWEEN -90 AND 90
  )
);

CREATE INDEX IF NOT EXISTS loggernet_site_mappings_geom_idx
  ON sarva.loggernet_site_mappings USING gist (geom);

CREATE INDEX IF NOT EXISTS loggernet_site_mappings_display_name_idx
  ON sarva.loggernet_site_mappings (display_name);
