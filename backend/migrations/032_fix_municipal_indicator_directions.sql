UPDATE sarva.municipal_indicator_definition
SET
  direction = 'higher_resilience',
  updated_at = now()
WHERE
  (
    key ~* '(higher.*education|tertiary|matric|completed.*secondary|literacy)'
    OR label ~* '(higher education|tertiary|matric|completed secondary|literacy)'
    OR description ~* '(higher education|tertiary|matric|completed secondary|literacy)'
  )
  AND NOT (
    key ~* '(no[_ -]?school|no schooling|low[_ -]?education|lack|without|deprivation|pressure|stress)'
    OR label ~* '(no schooling|low education|lack|without|deprivation|pressure|stress)'
    OR description ~* '(no schooling|low education|lack|without|deprivation|pressure|stress)'
  );
