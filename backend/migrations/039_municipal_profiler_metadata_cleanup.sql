UPDATE sarva.municipal_indicator_definition
SET
  theme = 'Economic vulnerability',
  source_name = 'Stats SA Census 2022 and municipal indicator products',
  source_url = 'https://www.statssa.gov.za/',
  updated_at = now()
WHERE key = 'poverty_pressure';

UPDATE sarva.municipal_indicator_definition
SET
  source_name = 'Municipal audit and governance indicators',
  source_url = NULL,
  updated_at = now()
WHERE key = 'governance_capacity_stress';

UPDATE sarva.municipal_indicator_definition
SET
  source_name = 'SAPS crime statistics, official release series',
  source_url = 'https://www.saps.gov.za/services/crimestats.php',
  updated_at = now()
WHERE key LIKE 'crime_%';
