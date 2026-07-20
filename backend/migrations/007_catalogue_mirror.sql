CREATE SCHEMA IF NOT EXISTS catalogue;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS catalogue.sync_run (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  total_count integer,
  processed_count integer NOT NULL DEFAULT 0,
  error_message text
);

CREATE TABLE IF NOT EXISTS catalogue.catalogue_records (
  id bigserial PRIMARY KEY,
  saeon_id text NOT NULL UNIQUE,
  doi text,
  title text NOT NULL,
  abstract text,
  publisher_name text,
  publication_year integer,
  collection_key text,
  collection_name text,
  provider_key text,
  provider_name text,
  temporal_start text,
  temporal_end text,
  spatial_north double precision,
  spatial_east double precision,
  spatial_south double precision,
  spatial_west double precision,
  download_label text,
  download_filename text,
  download_url text,
  download_format text,
  licence_text text,
  licence_uri text,
  licence_identifier text,
  download_count integer,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalogue.record_creators (
  id bigserial PRIMARY KEY,
  record_id bigint NOT NULL REFERENCES catalogue.catalogue_records(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_type text,
  affiliation text
);

CREATE TABLE IF NOT EXISTS catalogue.record_contributors (
  id bigserial PRIMARY KEY,
  record_id bigint NOT NULL REFERENCES catalogue.catalogue_records(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_type text,
  contributor_type text,
  affiliation text
);

CREATE TABLE IF NOT EXISTS catalogue.record_keywords (
  id bigserial PRIMARY KEY,
  record_id bigint NOT NULL REFERENCES catalogue.catalogue_records(id) ON DELETE CASCADE,
  keyword text NOT NULL
);

CREATE TABLE IF NOT EXISTS catalogue.record_subjects (
  id bigserial PRIMARY KEY,
  record_id bigint NOT NULL REFERENCES catalogue.catalogue_records(id) ON DELETE CASCADE,
  subject text NOT NULL
);

CREATE TABLE IF NOT EXISTS catalogue.record_formats (
  id bigserial PRIMARY KEY,
  record_id bigint NOT NULL REFERENCES catalogue.catalogue_records(id) ON DELETE CASCADE,
  format text NOT NULL
);

CREATE INDEX IF NOT EXISTS catalogue_records_title_trgm_idx
  ON catalogue.catalogue_records USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS catalogue_records_abstract_trgm_idx
  ON catalogue.catalogue_records USING gin (abstract gin_trgm_ops);

CREATE INDEX IF NOT EXISTS catalogue_records_collection_idx
  ON catalogue.catalogue_records (collection_name);

CREATE INDEX IF NOT EXISTS catalogue_records_provider_idx
  ON catalogue.catalogue_records (provider_name);

CREATE INDEX IF NOT EXISTS catalogue_records_download_format_idx
  ON catalogue.catalogue_records (download_format);

CREATE INDEX IF NOT EXISTS catalogue_records_licence_idx
  ON catalogue.catalogue_records (licence_identifier);

CREATE INDEX IF NOT EXISTS catalogue_records_publication_year_idx
  ON catalogue.catalogue_records (publication_year);

CREATE INDEX IF NOT EXISTS catalogue_record_creators_record_idx
  ON catalogue.record_creators (record_id);

CREATE INDEX IF NOT EXISTS catalogue_record_creators_name_trgm_idx
  ON catalogue.record_creators USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS catalogue_record_contributors_record_idx
  ON catalogue.record_contributors (record_id);

CREATE INDEX IF NOT EXISTS catalogue_record_contributors_name_trgm_idx
  ON catalogue.record_contributors USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS catalogue_record_keywords_record_idx
  ON catalogue.record_keywords (record_id);

CREATE INDEX IF NOT EXISTS catalogue_record_keywords_keyword_idx
  ON catalogue.record_keywords (keyword);

CREATE INDEX IF NOT EXISTS catalogue_record_subjects_record_idx
  ON catalogue.record_subjects (record_id);

CREATE INDEX IF NOT EXISTS catalogue_record_subjects_subject_idx
  ON catalogue.record_subjects (subject);

CREATE INDEX IF NOT EXISTS catalogue_record_formats_record_idx
  ON catalogue.record_formats (record_id);
