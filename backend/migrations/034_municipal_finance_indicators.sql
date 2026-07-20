INSERT INTO sarva.municipal_indicator_definition
  (key, label, theme, description, unit, direction, source_name, source_url, is_proxy, sort_order)
VALUES
  ('governance_audit_outcome_risk', 'Audit outcome risk', 'Governance - audit and compliance', 'Risk score derived from the latest audit opinion, where clean audits score lowest and disclaimed/adverse/outstanding outcomes score highest.', 'audit risk score', 'higher_risk', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 300),
  ('governance_uifw_to_revenue', 'UIFW expenditure to revenue', 'Governance - audit and compliance', 'Unauthorised, irregular, fruitless and wasteful expenditure as a share of operating revenue.', 'percent', 'higher_risk', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 310),
  ('governance_unauthorised_to_revenue', 'Unauthorised expenditure to revenue', 'Governance - audit and compliance', 'Unauthorised expenditure as a share of operating revenue.', 'percent', 'higher_risk', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 320),
  ('governance_irregular_to_revenue', 'Irregular expenditure to revenue', 'Governance - audit and compliance', 'Irregular expenditure as a share of operating revenue.', 'percent', 'higher_risk', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 330),
  ('governance_fruitless_to_revenue', 'Fruitless and wasteful expenditure to revenue', 'Governance - audit and compliance', 'Fruitless and wasteful expenditure as a share of operating revenue.', 'percent', 'higher_risk', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 340),
  ('finance_operating_margin_pressure', 'Operating deficit pressure', 'Governance - financial resilience', 'Risk score from operating surplus or deficit margin. Larger deficits produce higher pressure.', 'percent', 'higher_risk', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 350),
  ('finance_debt_to_revenue', 'Debt to revenue', 'Governance - financial resilience', 'Borrowings and financial liabilities as a share of operating revenue.', 'percent', 'higher_risk', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 360),
  ('finance_liabilities_to_revenue', 'Total liabilities to revenue', 'Governance - financial resilience', 'Total liabilities as a share of operating revenue.', 'percent', 'higher_risk', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 370),
  ('finance_cash_ratio', 'Cash ratio', 'Governance - financial resilience', 'Cash and short-term investments divided by current liabilities.', 'ratio', 'higher_resilience', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 380),
  ('finance_current_ratio', 'Current ratio', 'Governance - financial resilience', 'Current assets divided by current liabilities.', 'ratio', 'higher_resilience', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 390),
  ('finance_capex_to_revenue', 'Capital expenditure to revenue', 'Governance - infrastructure investment', 'Capital expenditure as a share of operating revenue.', 'percent', 'higher_resilience', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 400),
  ('finance_infrastructure_capex_share', 'Infrastructure share of capital expenditure', 'Governance - infrastructure investment', 'Infrastructure capital expenditure as a share of total capital expenditure.', 'percent', 'higher_resilience', 'National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality', 'https://municipaldata.treasury.gov.za/docs', false, 410)
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
  ('governance_audit_compliance_imported', 'Audit and compliance governance pressure', 'Governance', 'AGSA audit outcomes and National Treasury UIFW expenditure indicators.', 'SARVA municipal risk profiler using National Treasury Municipal Money API and AGSA audit opinions', 'https://municipaldata.treasury.gov.za/docs', false, 100),
  ('governance_financial_resilience_imported', 'Financial resilience governance pressure', 'Governance', 'National Treasury Municipal Money liquidity, operating-balance, debt and liabilities indicators.', 'SARVA municipal risk profiler using National Treasury Municipal Money API and AGSA audit opinions', 'https://municipaldata.treasury.gov.za/docs', false, 102),
  ('governance_infrastructure_investment_imported', 'Infrastructure investment governance pressure', 'Governance', 'National Treasury Municipal Money capital expenditure and infrastructure investment indicators.', 'SARVA municipal risk profiler using National Treasury Municipal Money API and AGSA audit opinions', 'https://municipaldata.treasury.gov.za/docs', false, 104),
  ('imported_governance_risk', 'Imported governance risk pressure', 'Governance', 'Composite of AGSA audit, National Treasury finance, infrastructure and compliance indicators.', 'SARVA municipal risk profiler using National Treasury Municipal Money API and AGSA audit opinions', 'https://municipaldata.treasury.gov.za/docs', false, 108),
  ('imported_composite_risk', 'Imported composite municipal risk', 'Overall', 'Balanced composite of imported people, services, safety and governance indicators. Domain weights prevent large indicator families, such as crime, from dominating only because they contain more rows.', 'SARVA municipal risk profiler', NULL, false, 120)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  theme = EXCLUDED.theme,
  description = EXCLUDED.description,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_proxy = EXCLUDED.is_proxy,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

DELETE FROM sarva.municipal_index_indicator
WHERE index_key IN (
  'governance_audit_compliance_imported',
  'governance_financial_resilience_imported',
  'governance_infrastructure_investment_imported',
  'imported_governance_risk',
  'imported_composite_risk'
);

WITH governance_rollups AS (
  SELECT
    CASE
      WHEN theme = 'Governance - audit and compliance' THEN 'governance_audit_compliance_imported'
      WHEN theme = 'Governance - financial resilience' THEN 'governance_financial_resilience_imported'
      WHEN theme = 'Governance - infrastructure investment' THEN 'governance_infrastructure_investment_imported'
      ELSE 'governance_institutional_capacity_imported'
    END AS index_key,
    key
  FROM sarva.municipal_indicator_definition
  WHERE direction <> 'context'
    AND theme IN (
      'Governance - audit and compliance',
      'Governance - financial resilience',
      'Governance - infrastructure investment',
      'Governance - institutional capacity'
    )
  UNION ALL
  SELECT 'imported_governance_risk', key
  FROM sarva.municipal_indicator_definition
  WHERE direction <> 'context'
    AND theme IN (
      'Governance - audit and compliance',
      'Governance - financial resilience',
      'Governance - infrastructure investment',
      'Governance - institutional capacity'
    )
),
governance_weighted AS (
  SELECT
    index_key,
    key,
    1.0 / count(*) OVER (PARTITION BY index_key) AS weight,
    row_number() OVER (PARTITION BY index_key ORDER BY key) AS sort_order
  FROM governance_rollups
)
INSERT INTO sarva.municipal_index_indicator (index_key, indicator_key, weight, sort_order)
SELECT index_key, key, weight, sort_order
FROM governance_weighted
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
