CREATE TABLE IF NOT EXISTS sarva.loggernet_field_mappings (
  id bigserial PRIMARY KEY,
  current_server_name text NOT NULL,
  current_table_name text NOT NULL,
  current_field_name text NOT NULL,
  display_server_name text,
  display_table_name text,
  display_field_name text,
  longitude double precision,
  latitude double precision,
  units text,
  multiplier double precision,
  aggregation_type text,
  include_in_summary boolean,
  source text NOT NULL DEFAULT 'loggernet-unified-mapping',
  raw_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    CASE
      WHEN longitude IS NULL OR latitude IS NULL THEN NULL
      ELSE ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loggernet_field_mappings_unique UNIQUE (
    current_server_name,
    current_table_name,
    current_field_name
  ),
  CONSTRAINT loggernet_field_mappings_longitude_chk CHECK (
    longitude IS NULL OR longitude BETWEEN -180 AND 180
  ),
  CONSTRAINT loggernet_field_mappings_latitude_chk CHECK (
    latitude IS NULL OR latitude BETWEEN -90 AND 90
  )
);

CREATE INDEX IF NOT EXISTS loggernet_field_mappings_geom_idx
  ON sarva.loggernet_field_mappings USING gist (geom);

CREATE INDEX IF NOT EXISTS loggernet_field_mappings_current_server_idx
  ON sarva.loggernet_field_mappings (current_server_name);

CREATE INDEX IF NOT EXISTS loggernet_field_mappings_display_server_idx
  ON sarva.loggernet_field_mappings (display_server_name);

CREATE INDEX IF NOT EXISTS loggernet_field_mappings_display_field_idx
  ON sarva.loggernet_field_mappings (display_field_name);
