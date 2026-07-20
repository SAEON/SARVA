ALTER TABLE sarva.municipal_indicator_value
  ADD COLUMN IF NOT EXISTS raw_value numeric;

ALTER TABLE sarva.municipal_indicator_value
  ADD COLUMN IF NOT EXISTS raw_unit text;

CREATE INDEX IF NOT EXISTS municipal_indicator_value_confidence_idx
  ON sarva.municipal_indicator_value (confidence, period, scenario);
