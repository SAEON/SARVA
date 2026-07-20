DROP MATERIALIZED VIEW IF EXISTS catalogue.record_search_index;

CREATE MATERIALIZED VIEW catalogue.record_search_index AS
SELECT
  cr.id AS record_id,
  setweight(to_tsvector('english', coalesce(cr.title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(cr.doi, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(cr.collection_name, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(cr.provider_name, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(cr.publisher_name, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(keywords.values, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(subjects.values, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(creators.values, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(contributors.values, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(cr.abstract, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(cr.download_label, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(cr.download_filename, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(cr.download_format, '')), 'D') ||
  setweight(to_tsvector('english', coalesce(cr.licence_identifier, '')), 'D') AS search_vector,
  concat_ws(
    ' ',
    cr.title,
    cr.doi,
    cr.collection_name,
    cr.provider_name,
    cr.publisher_name,
    keywords.values,
    subjects.values,
    creators.values,
    contributors.values,
    cr.abstract,
    cr.download_label,
    cr.download_filename,
    cr.download_format,
    cr.licence_identifier
  ) AS search_text
FROM catalogue.catalogue_records cr
LEFT JOIN LATERAL (
  SELECT string_agg(rk.keyword, ' ') AS values
  FROM catalogue.record_keywords rk
  WHERE rk.record_id = cr.id
) keywords ON true
LEFT JOIN LATERAL (
  SELECT string_agg(rs.subject, ' ') AS values
  FROM catalogue.record_subjects rs
  WHERE rs.record_id = cr.id
) subjects ON true
LEFT JOIN LATERAL (
  SELECT string_agg(concat_ws(' ', rc.name, rc.affiliation), ' ') AS values
  FROM catalogue.record_creators rc
  WHERE rc.record_id = cr.id
) creators ON true
LEFT JOIN LATERAL (
  SELECT string_agg(concat_ws(' ', rcon.name, rcon.affiliation, rcon.contributor_type), ' ') AS values
  FROM catalogue.record_contributors rcon
  WHERE rcon.record_id = cr.id
) contributors ON true;

CREATE UNIQUE INDEX catalogue_record_search_index_record_idx
  ON catalogue.record_search_index (record_id);

CREATE INDEX catalogue_record_search_index_vector_idx
  ON catalogue.record_search_index USING gin (search_vector);

CREATE INDEX catalogue_record_search_index_text_trgm_idx
  ON catalogue.record_search_index USING gin (search_text gin_trgm_ops);
