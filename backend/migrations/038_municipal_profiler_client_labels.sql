UPDATE sarva.municipal_index_definition
SET
  label = 'Municipal risk overview',
  description = 'Balanced screening overview combining available people, services, safety and governance indicators. Use it as a starting point, then inspect category indices and drivers.',
  updated_at = now()
WHERE key = 'imported_composite_risk';

UPDATE sarva.municipal_index_definition
SET
  label = 'Governance and finance pressure',
  description = 'Composite of available audit, municipal finance, infrastructure investment and institutional-capacity indicators.',
  updated_at = now()
WHERE key = 'imported_governance_risk';

UPDATE sarva.municipal_index_definition
SET
  label = 'Combined safety pressure',
  description = 'Roll-up of available SAPS safety indicators. Use the specific violent contact, property, sexual violence and public-order layers for interpretation.',
  updated_at = now()
WHERE key = 'crime_safety_imported';

UPDATE sarva.municipal_index_definition
SET
  label = 'People and vulnerability context',
  updated_at = now()
WHERE key = 'stats_sa_vulnerability_imported';

UPDATE sarva.municipal_index_definition
SET
  label = 'Basic service access pressure',
  updated_at = now()
WHERE key = 'service_access_imported';
