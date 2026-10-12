CREATE TABLE IF NOT EXISTS sarva.access_source (
 id bigserial PRIMARY KEY, osm_key text UNIQUE NOT NULL, kind text NOT NULL CHECK(kind IN ('road','facility')),
 name text NOT NULL DEFAULT '', category text NOT NULL, tags jsonb NOT NULL, nodes jsonb,
 imported_at timestamptz NOT NULL DEFAULT now(), geom geometry(Geometry,3857) NOT NULL
);
CREATE INDEX IF NOT EXISTS access_source_geom ON sarva.access_source USING gist(geom);
CREATE TABLE IF NOT EXISTS sarva.access_edit (
 id bigserial PRIMARY KEY, source_id bigint UNIQUE REFERENCES sarva.access_source(id),
 kind text NOT NULL CHECK(kind IN ('road','facility','zone')), name text NOT NULL, category text NOT NULL,
 hidden boolean NOT NULL DEFAULT false, geom geometry(Geometry,3857),
 updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_edit_geom ON sarva.access_edit USING gist(geom);
CREATE TABLE IF NOT EXISTS sarva.access_history (
 id bigserial PRIMARY KEY, edit_id bigint NOT NULL, before_record jsonb, after_record jsonb,
 actor text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE VIEW sarva.access_features AS
 SELECT s.id, s.id AS source_id, e.id AS edit_id, s.kind, COALESCE(e.name,s.name) AS name,
 COALESCE(e.category,s.category) AS category, COALESCE(e.geom,s.geom) AS geom,
 s.imported_at, 'OSM (unverified)'::text AS provenance
 FROM sarva.access_source s LEFT JOIN sarva.access_edit e ON e.source_id=s.id WHERE NOT COALESCE(e.hidden,false)
 UNION ALL SELECT -e.id,NULL::bigint,e.id,e.kind,e.name,e.category,e.geom,NULL::timestamptz,'Local planning feature'
 FROM sarva.access_edit e WHERE e.source_id IS NULL AND NOT e.hidden;
CREATE OR REPLACE VIEW sarva.access_roads AS SELECT * FROM sarva.access_features WHERE kind='road';
CREATE OR REPLACE VIEW sarva.access_facilities AS SELECT * FROM sarva.access_features WHERE kind='facility';
CREATE OR REPLACE VIEW sarva.access_zones AS SELECT * FROM sarva.access_features WHERE kind='zone';
