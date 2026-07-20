CREATE TABLE IF NOT EXISTS catalogue.essential_variable_frameworks (
  id text PRIMARY KEY,
  acronym text NOT NULL,
  title text NOT NULL,
  owner text,
  framework_type text,
  url text,
  summary text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalogue.essential_variable_rules (
  key text PRIMARY KEY,
  framework_id text NOT NULL REFERENCES catalogue.essential_variable_frameworks(id) ON DELETE CASCADE,
  label text NOT NULL,
  category text,
  terms text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalogue.record_essential_variables (
  record_id bigint NOT NULL REFERENCES catalogue.catalogue_records(id) ON DELETE CASCADE,
  rule_key text NOT NULL REFERENCES catalogue.essential_variable_rules(key) ON DELETE CASCADE,
  framework_id text NOT NULL REFERENCES catalogue.essential_variable_frameworks(id) ON DELETE CASCADE,
  matched_terms text[] NOT NULL DEFAULT '{}'::text[],
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (record_id, rule_key)
);

CREATE TABLE IF NOT EXISTS catalogue.essential_variable_refresh_run (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  matched_records integer NOT NULL DEFAULT 0,
  matched_variables integer NOT NULL DEFAULT 0,
  error_message text
);

CREATE INDEX IF NOT EXISTS record_essential_variables_record_idx
  ON catalogue.record_essential_variables (record_id);

CREATE INDEX IF NOT EXISTS record_essential_variables_framework_idx
  ON catalogue.record_essential_variables (framework_id);

CREATE INDEX IF NOT EXISTS record_essential_variables_rule_idx
  ON catalogue.record_essential_variables (rule_key);

CREATE INDEX IF NOT EXISTS essential_variable_rules_framework_idx
  ON catalogue.essential_variable_rules (framework_id);
