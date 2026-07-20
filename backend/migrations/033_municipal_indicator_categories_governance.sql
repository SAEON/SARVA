INSERT INTO sarva.municipal_index_definition
  (key, label, theme, description, source_name, source_url, is_proxy, sort_order)
VALUES
  ('safety_violent_contact_imported', 'Violent contact crime pressure', 'Safety', 'Imported SAPS violent/contact-crime indicators grouped separately from property and public-order offences.', 'SAPS crime statistics, official release series', 'https://www.saps.gov.za/services/crimestats.php', false, 70),
  ('safety_property_economic_imported', 'Property and economic crime pressure', 'Safety', 'Imported SAPS property, theft, commercial and damage-to-property indicators.', 'SAPS crime statistics, official release series', 'https://www.saps.gov.za/services/crimestats.php', false, 72),
  ('safety_gender_violence_imported', 'Gender and sexual violence pressure', 'Safety', 'Imported SAPS sexual-offence and gender-safety indicators where available.', 'SAPS crime statistics, official release series', 'https://www.saps.gov.za/services/crimestats.php', false, 74),
  ('safety_public_order_imported', 'Public-order and police-detected crime pressure', 'Safety', 'Imported SAPS public-order, drug, firearm and police-detected crime indicators.', 'SAPS crime statistics, official release series', 'https://www.saps.gov.za/services/crimestats.php', false, 76),
  ('crime_safety_imported', 'Combined crime and safety pressure', 'Safety', 'Compatibility roll-up of imported SAPS safety indicators; use the more specific safety indices for interpretation.', 'SAPS crime statistics, official release series', 'https://www.saps.gov.za/services/crimestats.php', false, 78),
  ('governance_audit_compliance_imported', 'Audit and compliance governance pressure', 'Governance', 'Imported AGSA audit-outcome, MFMA compliance and UIFW expenditure indicators where available.', 'Auditor-General South Africa MFMA local government audit outcomes 2023-24; National Treasury Municipal Money API, 2026 Q2 snapshot', 'https://mfma-2024.agsareports.co.za/', false, 100),
  ('governance_financial_resilience_imported', 'Financial resilience governance pressure', 'Governance', 'Imported National Treasury Municipal Money liquidity, operating-balance, debt, creditor and collection indicators where available.', 'National Treasury Municipal Money API, 2026 Q2 snapshot of Section 71 and audited municipal finance data', 'https://municipaldata.treasury.gov.za/docs', false, 102),
  ('governance_infrastructure_investment_imported', 'Infrastructure investment governance pressure', 'Governance', 'Imported National Treasury Municipal Money capital expenditure, infrastructure investment, repairs, maintenance and grant-delivery indicators where available.', 'National Treasury Municipal Money API, 2026 Q2 snapshot of Section 71 and audited municipal finance data', 'https://municipaldata.treasury.gov.za/docs', false, 104),
  ('governance_institutional_capacity_imported', 'Institutional response capacity pressure', 'Governance', 'Imported municipal institutional-capacity, vacancy and response-capacity indicators where available.', 'Municipal institutional and disaster-management capacity source imports', NULL, false, 106),
  ('imported_governance_risk', 'Imported governance risk pressure', 'Governance', 'Composite of imported audit, finance, infrastructure and institutional-capacity governance indicators.', 'SARVA municipal risk profiler using AGSA and National Treasury source indicators', 'https://municipaldata.treasury.gov.za/docs', false, 108),
  ('imported_composite_risk', 'Imported composite municipal risk', 'Overall', 'Composite of imported Stats SA, SAPS, National Treasury, AGSA and municipal-context indicators currently available in the SARVA Docker database.', 'SARVA municipal risk profiler', NULL, false, 120)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  theme = EXCLUDED.theme,
  description = EXCLUDED.description,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_proxy = EXCLUDED.is_proxy,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

UPDATE sarva.municipal_indicator_definition
SET
  theme = CASE
    WHEN key || ' ' || label || ' ' || description ~* '(sexual|rape|assault.*sexual|gender|gbv|domestic violence|women|children)' THEN 'Safety - gender and sexual violence'
    WHEN key || ' ' || label || ' ' || description ~* '(murder|attempted murder|assault|robbery|carjacking|hijacking|kidnapping|violent|contact crime)' OR key ~* '^crime_contact' THEN 'Safety - violent contact crime'
    WHEN key || ' ' || label || ' ' || description ~* '(burglary|theft|vehicle|stock theft|property|commercial|shoplifting|fraud|arson|malicious damage)' THEN 'Safety - property and economic crime'
    WHEN key || ' ' || label || ' ' || description ~* '(drug|public order|illegal possession|firearm|community reported|police detected)' OR key ~* '^crime_' THEN 'Safety - public order and police-detected crime'
    WHEN key || ' ' || label || ' ' || description ~* '(audit|auditor|agsa|uifw|unauthorised|irregular|fruitless|wasteful|mfma|governance|compliance)' THEN 'Governance - audit and compliance'
    WHEN key || ' ' || label || ' ' || description ~* '(cash|liquid|current ratio|creditor|debtor|collection|operating|surplus|deficit|borrow|liabilit|financial health)' THEN 'Governance - financial resilience'
    WHEN key || ' ' || label || ' ' || description ~* '(capital expenditure|capex|infrastructure|repairs|maintenance|grant)' THEN 'Governance - infrastructure investment'
    WHEN key || ' ' || label || ' ' || description ~* '(capacity|official|manager|cfo|vacanc|response|disaster|institution)' THEN 'Governance - institutional capacity'
    ELSE theme
  END,
  source_name = CASE
    WHEN key || ' ' || label || ' ' || description ~* '(audit|auditor|agsa)' THEN 'Auditor-General South Africa MFMA local government audit outcomes 2023-24'
    WHEN key || ' ' || label || ' ' || description ~* '(uifw|unauthorised|irregular|fruitless|wasteful|cash|liquid|current ratio|creditor|debtor|collection|operating|surplus|deficit|capital expenditure|capex|infrastructure|borrow|liabilit|municipal money|national treasury|section 71|mfma|mscoa)' THEN 'National Treasury Municipal Money API, 2026 Q2 snapshot of Section 71 and audited municipal finance data'
    WHEN key || ' ' || label || ' ' || description ~* '(crime|murder|assault|robbery|burglary|theft|rape|sexual|drug|firearm)' THEN 'SAPS crime statistics, official release series'
    WHEN key || ' ' || label || ' ' || description ~* '(population|household|age|youth|elder|dependency|income|poverty|employment|unemployment|education|water|sanitation|electricity|refuse|dwelling)' THEN 'Stats SA Census 2022 and municipal indicator products'
    ELSE source_name
  END,
  source_url = CASE
    WHEN key || ' ' || label || ' ' || description ~* '(audit|auditor|agsa)' THEN 'https://mfma-2024.agsareports.co.za/'
    WHEN key || ' ' || label || ' ' || description ~* '(uifw|unauthorised|irregular|fruitless|wasteful|cash|liquid|current ratio|creditor|debtor|collection|operating|surplus|deficit|capital expenditure|capex|infrastructure|borrow|liabilit|municipal money|national treasury|section 71|mfma|mscoa)' THEN 'https://municipaldata.treasury.gov.za/docs'
    WHEN key || ' ' || label || ' ' || description ~* '(crime|murder|assault|robbery|burglary|theft|rape|sexual|drug|firearm)' THEN 'https://www.saps.gov.za/services/crimestats.php'
    WHEN key || ' ' || label || ' ' || description ~* '(population|household|age|youth|elder|dependency|income|poverty|employment|unemployment|education|water|sanitation|electricity|refuse|dwelling)' THEN 'https://www.statssa.gov.za/'
    ELSE source_url
  END,
  direction = CASE
    WHEN key || ' ' || label || ' ' || description ~* '(clean audit|unqualified.*no findings|cash cover|current ratio|collection rate|capital expenditure|infrastructure expenditure|response capacity|institutional capacity)' THEN 'higher_resilience'
    WHEN key || ' ' || label || ' ' || description ~* '(audit finding|qualified|adverse|disclaimed|deficit|uifw|unauthorised|irregular|fruitless|wasteful|liabilit|creditor|overdraft|vacanc)' THEN 'higher_risk'
    ELSE direction
  END,
  updated_at = now()
WHERE
  key ~* '^(crime_|safety_|governance_|finance_|treasury_|audit_|agsa_|uifw_)'
  OR key || ' ' || label || ' ' || description ~* '(crime|murder|assault|robbery|burglary|theft|rape|sexual|drug|firearm|audit|auditor|agsa|uifw|unauthorised|irregular|fruitless|wasteful|cash|liquid|current ratio|creditor|debtor|collection|operating|surplus|deficit|capital expenditure|capex|infrastructure|borrow|liabilit|municipal money|national treasury|section 71|mfma|mscoa|capacity|official|manager|cfo|vacanc|response|disaster|institution)';

DELETE FROM sarva.municipal_index_indicator
WHERE index_key IN (
  'safety_violent_contact_imported',
  'safety_property_economic_imported',
  'safety_gender_violence_imported',
  'safety_public_order_imported',
  'crime_safety_imported',
  'governance_audit_compliance_imported',
  'governance_financial_resilience_imported',
  'governance_infrastructure_investment_imported',
  'governance_institutional_capacity_imported',
  'imported_governance_risk'
);

WITH classified AS (
  SELECT
    key,
    CASE
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(sexual|rape|assault.*sexual|gender|gbv|domestic violence|women|children)' THEN 'safety_gender_violence_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(murder|attempted murder|assault|robbery|carjacking|hijacking|kidnapping|violent|contact crime)' OR key ~* '^crime_contact' THEN 'safety_violent_contact_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(burglary|theft|vehicle|stock theft|property|commercial|shoplifting|fraud|arson|malicious damage)' THEN 'safety_property_economic_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(drug|public order|illegal possession|firearm|community reported|police detected)' OR key ~* '^crime_' THEN 'safety_public_order_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(audit|auditor|agsa|uifw|unauthorised|irregular|fruitless|wasteful|mfma|governance|compliance)' THEN 'governance_audit_compliance_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(cash|liquid|current ratio|creditor|debtor|collection|operating|surplus|deficit|borrow|liabilit|financial health)' THEN 'governance_financial_resilience_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(capital expenditure|capex|infrastructure|repairs|maintenance|grant)' THEN 'governance_infrastructure_investment_imported'
      WHEN key || ' ' || label || ' ' || description || ' ' || theme ~* '(capacity|official|manager|cfo|vacanc|response|disaster|institution)' THEN 'governance_institutional_capacity_imported'
      ELSE NULL
    END AS index_key
  FROM sarva.municipal_indicator_definition
  WHERE direction <> 'context'
),
rollups AS (
  SELECT index_key, key
  FROM classified
  WHERE index_key IS NOT NULL
  UNION ALL
  SELECT 'crime_safety_imported', key
  FROM classified
  WHERE index_key LIKE 'safety_%'
  UNION ALL
  SELECT 'imported_governance_risk', key
  FROM classified
  WHERE index_key LIKE 'governance_%'
),
weighted AS (
  SELECT
    index_key,
    key,
    1.0 / count(*) OVER (PARTITION BY index_key) AS weight,
    row_number() OVER (PARTITION BY index_key ORDER BY key) AS sort_order
  FROM rollups
)
INSERT INTO sarva.municipal_index_indicator (index_key, indicator_key, weight, sort_order)
SELECT index_key, key, weight, sort_order
FROM weighted
ON CONFLICT (index_key, indicator_key) DO UPDATE SET
  weight = EXCLUDED.weight,
  sort_order = EXCLUDED.sort_order;
