CREATE TABLE IF NOT EXISTS sarva.loggernet_station_locations (
  id bigserial PRIMARY KEY,
  station_name text NOT NULL UNIQUE,
  display_name text,
  longitude double precision NOT NULL,
  latitude double precision NOT NULL,
  altitude double precision,
  description text,
  source text NOT NULL DEFAULT 'loggernet-site-mapping',
  raw_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loggernet_station_locations_longitude_chk CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT loggernet_station_locations_latitude_chk CHECK (latitude BETWEEN -90 AND 90)
);

CREATE INDEX IF NOT EXISTS loggernet_station_locations_geom_idx
  ON sarva.loggernet_station_locations USING gist (geom);

CREATE INDEX IF NOT EXISTS loggernet_station_locations_display_name_idx
  ON sarva.loggernet_station_locations (display_name);

INSERT INTO sarva.loggernet_station_locations
  (station_name, display_name, longitude, latitude, altitude, raw_mapping)
VALUES
  (
    'EFTEON_Benfontein_Savanna',
    'Benfontein Savanna Eddy Covariance',
    24.86112,
    -28.8906,
    0,
    '{"current_table_name":"Flux_Notes","current_field_name":"no_sonic_head_Tot"}'::jsonb
  ),
  (
    'EFTEON_NamahadiPass_ERS',
    'Namahadi Pass AWS',
    28.869943,
    -28.756748,
    NULL,
    '{"current_table_name":"Public","current_field_name":"CellEnabled"}'::jsonb
  )
ON CONFLICT (station_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  longitude = EXCLUDED.longitude,
  latitude = EXCLUDED.latitude,
  altitude = EXCLUDED.altitude,
  raw_mapping = sarva.loggernet_station_locations.raw_mapping || EXCLUDED.raw_mapping,
  updated_at = now();
