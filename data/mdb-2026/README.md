# MDB 2026 Boundary Downloads

Downloaded from the Municipal Demarcation Board Spatial Knowledge Hub on 2026-08-31.

Source page:
https://spatialhub-mdb-sa.opendata.arcgis.com/pages/data-download

Downloaded datasets:

- `mdb_2026_district_municipalities.geojson`
  - Title: MDB District Municipalities 2026
  - ArcGIS item: `ffd2fc85aec74f5594c670e6def67787`
  - Feature service: `https://services7.arcgis.com/oeoyTUJC8HEeYsRB/arcgis/rest/services/MDB_District_Municipalities_2026/FeatureServer/0`
  - Feature count: 52

- `mdb_2026_local_municipalities.geojson`
  - Title: MDB Local Municipalities 2026
  - ArcGIS item: `82c7a6d178454ddcb4dc1ef6bf2a4303`
  - Feature service: `https://services7.arcgis.com/oeoyTUJC8HEeYsRB/arcgis/rest/services/MDB_L_ocal_Municipalities_2026/FeatureServer/0`
  - Feature count: 214

- `mdb_2026_wards.geojson`
  - Title: MDB Wards 2026
  - ArcGIS item: `30b6e281a5074eddbf1a3f82aa00459e`
  - Feature service: `https://services7.arcgis.com/oeoyTUJC8HEeYsRB/arcgis/rest/services/MDB_Wards_2026/FeatureServer/0`
  - Feature count: 4,488

Important note:
The MDB metadata for Local Municipalities 2026 says the dataset comes into effect on 4 November 2026. Treat these as latest/future-effective boundaries, not a silent replacement for current operational boundaries.

Licence note:
MDB metadata says the data is released for public use with limited restrictions. It may be used in research, publications and value-added applications with appropriate acknowledgement of MDB as producer and custodian. It must not be sold, commercially appropriated, altered and passed off as an MDB product, or used without reporting detected faults back to MDB where appropriate.

## Server Refresh

The raw GeoJSON files are not committed to Git because the wards layer is larger than GitHub's normal file limit.

If running on the Docker server, recreate the files and import them from the repository root with:

```bash
mkdir -p data/mdb-2026
docker compose run --rm --volume "$(pwd)/data:/data:rw" backend npm run download:mdb-2026-boundaries
docker compose run --rm backend npm run import:mdb-2026-boundaries
docker compose up -d --force-recreate martin frontend
```

If running directly on a host with backend dependencies installed, use:

```bash
cd backend
npm run download:mdb-2026-boundaries
npm run import:mdb-2026-boundaries
```
