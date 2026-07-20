UPDATE sarva.municipal_indicator_definition
SET
  theme = CASE
    WHEN key || ' ' || label || ' ' || description ~* '(police[_ -]?action[_ -]?subindex|police-action sub-index|police-action detected crimes sub-index)' THEN 'Safety - public order and police-detected crime'
    WHEN key || ' ' || label || ' ' || description ~* '(contact[_ -]?subindex|contact crimes sub-index)' THEN 'Safety - violent contact crime'
    WHEN key || ' ' || label || ' ' || description ~* '(sexual|rape|assault.*sexual|gbv|gender-based violence|domestic violence)' THEN 'Safety - gender and sexual violence'
    WHEN key || ' ' || label || ' ' || description ~* '(murder|attempted murder|assault|robbery|carjacking|hijacking|kidnapping|violent|contact crime)' OR key ~* '^crime_contact' THEN 'Safety - violent contact crime'
    WHEN key || ' ' || label || ' ' || description ~* '(burglary|theft|vehicle|stock theft|property|commercial|shoplifting|fraud|arson|malicious damage)' THEN 'Safety - property and economic crime'
    WHEN key || ' ' || label || ' ' || description ~* '(drug|public order|illegal possession|firearm|community reported|police detected)' OR key ~* '^crime_' THEN 'Safety - public order and police-detected crime'
    ELSE theme
  END,
  updated_at = now()
WHERE key ~* '^crime_';

DELETE FROM sarva.municipal_index_indicator
WHERE index_key IN (
  'safety_violent_contact_imported',
  'safety_property_economic_imported',
  'safety_gender_violence_imported',
  'safety_public_order_imported',
  'crime_safety_imported',
  'imported_composite_risk'
);

WITH classified AS (
  SELECT
    key,
    CASE
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(police[_ -]?action[_ -]?subindex|police-action sub-index|police-action detected crimes sub-index)' THEN 'safety_public_order_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(contact[_ -]?subindex|contact crimes sub-index)' THEN 'safety_violent_contact_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(sexual|rape|assault.*sexual|gbv|gender-based violence|domestic violence)' THEN 'safety_gender_violence_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(murder|attempted murder|assault|robbery|carjacking|hijacking|kidnapping|violent|contact crime)' OR key ~* '^crime_contact' THEN 'safety_violent_contact_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(burglary|theft|vehicle|stock theft|property|commercial|shoplifting|fraud|arson|malicious damage)' THEN 'safety_property_economic_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(drug|public order|illegal possession|firearm|community reported|police detected)' OR key ~* '^crime_' THEN 'safety_public_order_imported'
      ELSE NULL
    END AS index_key
  FROM sarva.municipal_indicator_definition
  WHERE direction <> 'context'
    AND is_proxy = false
    AND key ~* '^crime_'
),
safety_rollups AS (
  SELECT index_key, key
  FROM classified
  WHERE index_key IS NOT NULL
  UNION ALL
  SELECT 'crime_safety_imported', key
  FROM classified
  WHERE index_key IS NOT NULL
),
safety_weighted AS (
  SELECT
    index_key,
    key,
    1.0 / count(*) OVER (PARTITION BY index_key) AS weight,
    row_number() OVER (PARTITION BY index_key ORDER BY key) AS sort_order
  FROM safety_rollups
)
INSERT INTO sarva.municipal_index_indicator (index_key, indicator_key, weight, sort_order)
SELECT index_key, key, weight, sort_order
FROM safety_weighted
ON CONFLICT (index_key, indicator_key) DO UPDATE SET
  weight = EXCLUDED.weight,
  sort_order = EXCLUDED.sort_order;

WITH domain_targets(domain, target_weight) AS (
  VALUES
    ('people', 0.28::numeric),
    ('services', 0.22::numeric),
    ('safety', 0.20::numeric),
    ('governance', 0.25::numeric),
    ('context', 0.05::numeric)
),
classified AS (
  SELECT
    key,
    CASE
      WHEN theme LIKE 'Safety%' OR key LIKE 'crime_%' THEN 'safety'
      WHEN theme LIKE 'Governance%' OR key LIKE 'finance_%' OR key LIKE 'governance_%' THEN 'governance'
      WHEN theme IN ('Basic services', 'Services') OR key ~* '(water|sanitation|electricity|refuse|service)' THEN 'services'
      WHEN theme IN ('Exposure', 'Social vulnerability', 'Economic vulnerability', 'Built environment', 'Demographics', 'Socio-economic', 'Education', 'Households', 'Living conditions', 'Health', 'People') THEN 'people'
      ELSE 'context'
    END AS domain
  FROM sarva.municipal_indicator_definition
  WHERE direction <> 'context'
    AND is_proxy = false
),
present_weights AS (
  SELECT dt.domain, dt.target_weight
  FROM domain_targets dt
  WHERE EXISTS (SELECT 1 FROM classified c WHERE c.domain = dt.domain)
),
normalized_domain_weights AS (
  SELECT
    domain,
    target_weight / sum(target_weight) OVER () AS domain_weight
  FROM present_weights
),
weighted AS (
  SELECT
    c.key,
    ndw.domain_weight / count(*) OVER (PARTITION BY c.domain) AS weight,
    row_number() OVER (ORDER BY c.domain, c.key) AS sort_order
  FROM classified c
  JOIN normalized_domain_weights ndw ON ndw.domain = c.domain
)
INSERT INTO sarva.municipal_index_indicator (index_key, indicator_key, weight, sort_order)
SELECT 'imported_composite_risk', key, weight, sort_order
FROM weighted
ON CONFLICT (index_key, indicator_key) DO UPDATE SET
  weight = EXCLUDED.weight,
  sort_order = EXCLUDED.sort_order;
