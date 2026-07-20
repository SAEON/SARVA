CREATE TABLE IF NOT EXISTS sarva.municipal_indicator_definition (
  key text PRIMARY KEY,
  label text NOT NULL,
  theme text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'score',
  direction text NOT NULL DEFAULT 'higher_risk',
  source_name text NOT NULL,
  source_url text,
  is_proxy boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT municipal_indicator_direction_chk CHECK (direction IN ('higher_risk', 'higher_resilience', 'context'))
);

CREATE TABLE IF NOT EXISTS sarva.municipal_index_definition (
  key text PRIMARY KEY,
  label text NOT NULL,
  theme text NOT NULL,
  description text NOT NULL,
  source_name text NOT NULL DEFAULT 'SARVA municipal risk profiler',
  source_url text,
  is_proxy boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sarva.municipal_index_indicator (
  index_key text NOT NULL REFERENCES sarva.municipal_index_definition(key) ON DELETE CASCADE,
  indicator_key text NOT NULL REFERENCES sarva.municipal_indicator_definition(key) ON DELETE CASCADE,
  weight numeric(8, 5) NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (index_key, indicator_key)
);

CREATE TABLE IF NOT EXISTS sarva.municipal_indicator_value (
  municipality_gid integer NOT NULL,
  indicator_key text NOT NULL REFERENCES sarva.municipal_indicator_definition(key) ON DELETE CASCADE,
  period text NOT NULL DEFAULT '2026',
  scenario text NOT NULL DEFAULT 'baseline_proxy',
  value numeric(8, 3) NOT NULL,
  confidence text NOT NULL DEFAULT 'proxy',
  source_label text NOT NULL DEFAULT 'SARVA generated baseline proxy',
  source_url text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (municipality_gid, indicator_key, period, scenario)
);

CREATE INDEX IF NOT EXISTS municipal_indicator_value_gid_idx
  ON sarva.municipal_indicator_value (municipality_gid);

CREATE INDEX IF NOT EXISTS municipal_indicator_value_indicator_idx
  ON sarva.municipal_indicator_value (indicator_key, period, scenario);

CREATE OR REPLACE FUNCTION sarva.seeded_score(seed text, low numeric DEFAULT 15, high numeric DEFAULT 85)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round(
    (
      low + (
        (('x' || substr(md5(seed), 1, 8))::bit(32)::bigint % 10000)::numeric
        / 10000.0
      ) * (high - low)
    )::numeric,
    1
  );
$$;

INSERT INTO sarva.municipal_indicator_definition
  (key, label, theme, description, unit, direction, source_name, source_url, is_proxy, sort_order)
VALUES
  ('population_exposure', 'Population exposure', 'Exposure', 'Relative number of people potentially exposed to hazards and service disruption.', '0-100 score', 'higher_risk', 'Stats SA population and census products', 'https://www.statssa.gov.za/', true, 10),
  ('settlement_density', 'Settlement density', 'Exposure', 'Relative built-up or settlement concentration pressure within the municipality.', '0-100 score', 'higher_risk', 'Stats SA small-area and municipal geography products', 'https://www.statssa.gov.za/', true, 20),
  ('dependency_pressure', 'Dependency pressure', 'Social vulnerability', 'Indicative pressure from children, older people and other groups likely to need support during shocks.', '0-100 score', 'higher_risk', 'Stats SA census demographic indicators', 'https://www.statssa.gov.za/', true, 30),
  ('poverty_pressure', 'Poverty pressure', 'Social vulnerability', 'Indicative socio-economic stress relevant to recovery capacity.', '0-100 score', 'higher_risk', 'Stats SA household and deprivation indicators', 'https://www.statssa.gov.za/', true, 40),
  ('unemployment_pressure', 'Unemployment pressure', 'Economic vulnerability', 'Indicative labour-market stress affecting local resilience.', '0-100 score', 'higher_risk', 'Stats SA labour and census indicators', 'https://www.statssa.gov.za/', true, 50),
  ('informal_dwelling_pressure', 'Informal dwelling pressure', 'Built environment', 'Indicative share of households in structures more exposed to flood, heat, fire and service disruption.', '0-100 score', 'higher_risk', 'Stats SA census dwelling-type indicators', 'https://www.statssa.gov.za/', true, 60),
  ('water_service_stress', 'Water service stress', 'Basic services', 'Indicative pressure around reliable access to safe water.', '0-100 score', 'higher_risk', 'Stats SA basic-service indicators', 'https://www.statssa.gov.za/', true, 70),
  ('sanitation_service_stress', 'Sanitation service stress', 'Basic services', 'Indicative sanitation-service constraints relevant to public-health risk.', '0-100 score', 'higher_risk', 'Stats SA basic-service indicators', 'https://www.statssa.gov.za/', true, 80),
  ('electricity_service_stress', 'Electricity service stress', 'Basic services', 'Indicative electricity-access and continuity pressure.', '0-100 score', 'higher_risk', 'Stats SA basic-service indicators', 'https://www.statssa.gov.za/', true, 90),
  ('crime_safety_pressure', 'Crime and safety pressure', 'Safety', 'Indicative personal and property safety pressure for emergency planning context.', '0-100 score', 'higher_risk', 'SAPS crime statistics', 'https://www.saps.gov.za/services/crimestats.php', true, 100),
  ('gender_safety_pressure', 'Gender safety pressure', 'Safety', 'Indicative safety pressure affecting women, children and vulnerable groups.', '0-100 score', 'higher_risk', 'SAPS crime statistics and social-risk datasets', 'https://www.saps.gov.za/services/crimestats.php', true, 110),
  ('health_access_pressure', 'Health access pressure', 'Health', 'Indicative pressure around access to health services during hazard events.', '0-100 score', 'higher_risk', 'Public health facility and demographic datasets', NULL, true, 120),
  ('governance_capacity_stress', 'Governance capacity stress', 'Governance', 'Indicative institutional and financial-management stress relevant to preparedness and recovery.', '0-100 score', 'higher_risk', 'Municipal audit and governance indicators', NULL, true, 130),
  ('response_capacity', 'Response capacity', 'Governance', 'Indicative local ability to prepare, respond and recover.', '0-100 score', 'higher_resilience', 'Municipal capacity and disaster-management indicators', NULL, true, 140)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  theme = EXCLUDED.theme,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  direction = EXCLUDED.direction,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_proxy = EXCLUDED.is_proxy,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO sarva.municipal_index_definition
  (key, label, theme, description, source_name, source_url, is_proxy, sort_order)
VALUES
  ('composite_risk', 'Composite municipal risk', 'Overall', 'Weighted view of exposure, vulnerability, services, safety and governance capacity.', 'SARVA municipal risk profiler', NULL, true, 10),
  ('social_vulnerability', 'Social vulnerability', 'People', 'Population, dependency, poverty and labour-market stress.', 'SARVA municipal risk profiler', NULL, true, 20),
  ('service_resilience', 'Service resilience pressure', 'Services', 'Water, sanitation and electricity service pressures.', 'SARVA municipal risk profiler', NULL, true, 30),
  ('safety_security', 'Safety and security pressure', 'Safety', 'Crime and safety context relevant to disruption and response planning.', 'SARVA municipal risk profiler', NULL, true, 40),
  ('governance_capacity', 'Governance and response capacity', 'Governance', 'Municipal governance stress and indicative response capacity.', 'SARVA municipal risk profiler', NULL, true, 50)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  theme = EXCLUDED.theme,
  description = EXCLUDED.description,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_proxy = EXCLUDED.is_proxy,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO sarva.municipal_index_indicator (index_key, indicator_key, weight, sort_order)
VALUES
  ('social_vulnerability', 'population_exposure', 0.20, 10),
  ('social_vulnerability', 'dependency_pressure', 0.25, 20),
  ('social_vulnerability', 'poverty_pressure', 0.30, 30),
  ('social_vulnerability', 'unemployment_pressure', 0.25, 40),
  ('service_resilience', 'water_service_stress', 0.35, 10),
  ('service_resilience', 'sanitation_service_stress', 0.35, 20),
  ('service_resilience', 'electricity_service_stress', 0.30, 30),
  ('safety_security', 'crime_safety_pressure', 0.70, 10),
  ('safety_security', 'gender_safety_pressure', 0.30, 20),
  ('governance_capacity', 'governance_capacity_stress', 0.60, 10),
  ('governance_capacity', 'response_capacity', 0.40, 20),
  ('composite_risk', 'population_exposure', 0.11, 10),
  ('composite_risk', 'settlement_density', 0.07, 20),
  ('composite_risk', 'dependency_pressure', 0.09, 30),
  ('composite_risk', 'poverty_pressure', 0.11, 40),
  ('composite_risk', 'unemployment_pressure', 0.09, 50),
  ('composite_risk', 'informal_dwelling_pressure', 0.08, 60),
  ('composite_risk', 'water_service_stress', 0.09, 70),
  ('composite_risk', 'sanitation_service_stress', 0.08, 80),
  ('composite_risk', 'electricity_service_stress', 0.06, 90),
  ('composite_risk', 'crime_safety_pressure', 0.09, 100),
  ('composite_risk', 'gender_safety_pressure', 0.04, 110),
  ('composite_risk', 'health_access_pressure', 0.04, 120),
  ('composite_risk', 'governance_capacity_stress', 0.03, 130),
  ('composite_risk', 'response_capacity', 0.02, 140)
ON CONFLICT (index_key, indicator_key) DO UPDATE SET
  weight = EXCLUDED.weight,
  sort_order = EXCLUDED.sort_order;

WITH municipalities AS (
  SELECT
    gid,
    COALESCE(NULLIF(namecode, ''), gid::text) AS code,
    COALESCE(NULLIF(municname, ''), NULLIF(map_title, ''), 'Municipality') AS municipality,
    COALESCE(NULLIF(province, ''), 'South Africa') AS province,
    ST_Area(geom) / 1000000.0 AS area_km2
  FROM sarva.municipal_boundaries
),
scores AS (
  SELECT
    m.gid,
    d.key,
    CASE d.key
      WHEN 'population_exposure' THEN LEAST(95, GREATEST(10, sarva.seeded_score(m.code || d.key, 25, 90) + CASE WHEN m.area_km2 < 1800 THEN 6 ELSE 0 END))
      WHEN 'settlement_density' THEN LEAST(95, GREATEST(5, sarva.seeded_score(m.code || d.key, 15, 88) + CASE WHEN m.area_km2 < 1200 THEN 9 ELSE -3 END))
      WHEN 'poverty_pressure' THEN sarva.seeded_score(m.province || m.code || d.key, 25, 86)
      WHEN 'unemployment_pressure' THEN sarva.seeded_score(m.province || d.key || m.code, 22, 84)
      WHEN 'crime_safety_pressure' THEN sarva.seeded_score('saps-' || m.province || m.code, 18, 82)
      WHEN 'gender_safety_pressure' THEN sarva.seeded_score('safety-' || m.code || m.province, 16, 78)
      WHEN 'response_capacity' THEN sarva.seeded_score('capacity-' || m.code, 28, 86)
      ELSE sarva.seeded_score(m.code || m.province || d.key, 18, 82)
    END AS value
  FROM municipalities m
  CROSS JOIN sarva.municipal_indicator_definition d
)
INSERT INTO sarva.municipal_indicator_value
  (municipality_gid, indicator_key, period, scenario, value, confidence, source_label, source_url, notes)
SELECT
  gid,
  key,
  '2026',
  'baseline_proxy',
  value,
  'proxy',
  'SARVA generated baseline proxy; replace with official Stats SA, SAPS or sector source values when imported',
  NULL,
  'Deterministic seed value for interface design, ranking behaviour and migration testing. Not an official statistic.'
FROM scores
ON CONFLICT (municipality_gid, indicator_key, period, scenario) DO NOTHING;
