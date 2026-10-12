# Accessibility workspace pilot

The planning workspace displays PostGIS roads, facilities and local zones through Martin. The initial map extent targets Stellenbosch. Source coverage is a pilot extract, not national coverage. Absence of a feature is not evidence that a road or service does not exist.

Apply migration 054, rebuild the backend, and restart Martin after updating its configuration. Import a modest west,south,east,north bounding box:

```
DB_HOST=127.0.0.1 DB_PORT=5440 node backend/scripts/import-accessibility-osm.js '18.75,-34.03,19.03,-33.83'
```

Credentials come from the existing environment. OVERPASS_URL selects an alternative Overpass provider. The optional third argument accepts a saved Overpass-shaped JSON extract if public providers are unavailable. Imports are transactional and upsert OSM type/id keys. Local overrides survive refreshes. Source deletions are not automatically reconciled; review stale source features before reuse. For national coverage, use regional PBF extracts and a dedicated importer rather than large public API queries.

Road line geometry, ordered OSM node references and original tags are retained. Facility ways/relations are represented by centre points, not entrances. Clinic, hospital, doctors, school, college, university, police and fire_station amenity categories are imported. OSM features are unverified and may be incomplete, duplicate or outdated.

Administrator login is required to persist local features and overrides. Add facility captures a clicked point. Draw zone captures at least three vertices. Save rejects empty, invalid or out-of-region geometry. Clicking an existing feature allows name/category corrections or reversible hiding. Hidden edits can be restored. Every successful mutation records before/after data in access_history. These edits are shared within the SARVA database, not private scenarios; road hiding affects display only.

Martin views combine source features with overrides. Base OSM data is kept separate from local edits. The UI retains OSM attribution; data is under ODbL: https://www.openstreetmap.org/copyright.

This phase does not calculate routes, catchments, travel times, population accessibility or exposure. A later routing engine must respect topology, access restrictions, one-way rules and mode-specific costs. Road geometry display alone is not a routable network.
