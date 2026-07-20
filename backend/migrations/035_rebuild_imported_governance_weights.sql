DELETE FROM sarva.municipal_index_indicator
WHERE index_key IN (
  'governance_audit_compliance_imported',
  'governance_financial_resilience_imported',
  'governance_infrastructure_investment_imported',
  'imported_governance_risk'
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
    AND is_proxy = false
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
    AND is_proxy = false
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
