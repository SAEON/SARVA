CREATE TABLE IF NOT EXISTS catalogue.search_event (
  id bigserial PRIMARY KEY,
  search_text text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  user_agent text,
  source text NOT NULL DEFAULT 'sarva',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalogue_search_event_created_idx
  ON catalogue.search_event (created_at DESC);

CREATE INDEX IF NOT EXISTS catalogue_search_event_text_trgm_idx
  ON catalogue.search_event USING gin (search_text gin_trgm_ops);

