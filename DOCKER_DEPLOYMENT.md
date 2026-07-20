# SARVA Docker Deployment

This stack runs:

- React frontend served by Nginx
- Express backend
- PostgreSQL with PostGIS extensions
- Martin vector tile server connected to the same database

## Files

- `docker-compose.yml`
- `docker-compose.dev.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `docker/db/init/001-postgis.sql`
- `docker/martin/config.yaml`
- `docker/municipal-importer/Dockerfile`
- `backend/migrations/000_core_schema.sql`
- `backend/migrations/005_postgis_extensions.sql`
- `.env.docker.example`

## First Run

```sh
cp .env.docker.example .env
docker compose up --build -d db
docker compose run --rm backend npm run migrate
docker compose run --rm backend npm run import:glossary
docker compose run --rm backend npm run import:resources
docker compose run --rm backend npm run import:policy
docker compose --profile tools run --rm municipal-importer
docker compose run --rm backend npm run sync:catalogue
docker compose restart martin
docker compose up --build
```

Run `npm run migrate` before using login/register or the catalogue pages on a fresh Docker database. The baseline migration creates the core navigation, hero, glossary and auth tables; later migrations add resources, policy records, PostGIS extensions and roles. Then run the import scripts to populate the SARVA source content.

Expected imported content:

- Glossary: 64 terms
- Relevant Documents: 56 records
- National Policy and Legislation: 32 records
- Municipal boundaries: 213 features
- SAEON Catalogue mirror: populated from `https://catalogue.saeon.ac.za/graphql`

Open:

- Frontend: `http://localhost:8080`
- Backend health: `http://localhost:5050/api/health`
- Martin: `http://localhost:3000`
- Martin through frontend proxy: `http://localhost:8080/tiles/`
- Municipal boundaries TileJSON/catalog entry: `http://localhost:3000/catalog`
- Municipal boundaries vector tile example: `http://localhost:3000/municipal_boundaries/5/18/18`

The frontend container is built with `VITE_API_BASE=.` so existing frontend calls such as `/api/nav` resolve through the Nginx same-origin proxy.

## PostGIS

The PostGIS image is `postgis/postgis:16-3.4`. On a fresh database volume, `docker/db/init/001-postgis.sql` installs:

- `postgis`
- `postgis_topology`
- `postgis_raster`

For existing databases, `npm run migrate` also applies `backend/migrations/005_postgis_extensions.sql`.

## Martin

Martin is included now so map tile infrastructure is ready before layers are added. Once spatial tables are created in PostGIS, Martin can expose tile endpoints from those tables.

The frontend Nginx config proxies:

- `/api/` to the backend
- `/tiles/` to Martin

The municipal boundaries layer is configured in `docker/martin/config.yaml` as:

- tile source: `municipal_boundaries`
- vector layer: `municipalities`
- tile URL: `/tiles/municipal_boundaries/{z}/{x}/{y}`

## Municipal Boundaries

The MDB local municipal boundary shapefile was copied into:

- `data/municipal-boundaries/MDB_Local_Municipal_Boundary_2018.*`

Local import:

```sh
cd backend
npm run import:municipalities
```

Docker import:

```sh
docker compose --profile tools run --rm municipal-importer
```

The importer service has its own image at `docker/municipal-importer/Dockerfile` because the base PostGIS database image does not include the `shp2pgsql` client utility by default.

After importing the shapefile, restart Martin so it reloads configured table metadata:

```sh
docker compose restart martin
```

Local verification:

```sh
curl http://localhost:3000/catalog
curl -I http://localhost:3000/municipal_boundaries/5/18/18
```

## SAEON Catalogue Mirror

SARVA keeps a local mirror of the SAEON catalogue in the `catalogue` database schema. The backend exposes:

- `GET /api/catalogue/status`
- `GET /api/catalogue/search`
- `GET /api/catalogue/single-sites/locations`

Manual sync:

```sh
docker compose run --rm backend npm run sync:catalogue
```

Quick test sync, limited to one GraphQL page:

```sh
docker compose run --rm backend npm run sync:catalogue -- --max-pages=1
```

The backend schedules a catalogue sync every day at midnight. Docker sets `TZ=Africa/Johannesburg` for the backend service, so midnight means South African local time.

Useful environment variables:

- `CATALOGUE_SYNC_ENABLED=true`
- `CATALOGUE_SYNC_ON_START=false`
- `CATALOGUE_GRAPHQL_ENDPOINT=https://catalogue.saeon.ac.za/graphql`
- `CATALOGUE_SYNC_PAGE_SIZE=200`

## Loggernet Rainfall Risk Layer

The Explore South Africa map can show latest Loggernet rainfall readings as a SARVA risk layer. SARVA does not store those readings yet; the backend queries the Campbell Scientific LoggerNet open API directly with `browsesymbols` and `dataquery`, then returns the latest rainfall values in a MapLibre-friendly shape.

Backend endpoints:

- `GET /api/rainfall/latest?field_name=rain_tot&table_name=daily&days=30`
- `GET /api/rainfall-data?field_name=rain_tot&table_name=daily`

Default open API settings:

- `LOGGERNET_RAW_BASE=https://lognet.saeon.ac.za`
- `LOGGERNET_RAW_ENABLED=true`
- `LOGGERNET_RAW_SERVER_LIMIT=60`
- `LOGGERNET_RAW_RECENT_ROWS=3`
- `LOGGERNET_RAW_CONCURRENCY=4`
- `LOGGERNET_RAW_TABLE_NAMES=Daily,Public`
- `LOGGERNET_API_USER_AGENT=Mozilla/5.0 SARVA rainfall risk layer`

The raw LoggerNet feed provides station readings but not station coordinates. SARVA stores station coordinates in `sarva.loggernet_station_locations` and merges them into live rainfall responses. Refresh the local mapping table after editing `data/loggernet-station-locations.tsv`:

```sh
docker compose exec -T backend npm run import:loggernet-locations
```

The importer can also load a pasted LoggerNet Unified Mapping or Site Mappings export. It stores visible field mapping rows in `sarva.loggernet_field_mappings`, stores site metadata in `sarva.loggernet_site_mappings`, then derives map coordinates in `sarva.loggernet_station_locations` for rows with real longitude and latitude:

```sh
docker compose cp pasted-text.txt backend:/tmp/loggernet-pasted-text.txt
docker compose exec -T backend npm run import:loggernet-locations -- /tmp/loggernet-pasted-text.txt
```

You can inspect the loaded coordinate mappings with:

```sh
curl http://localhost:5050/api/loggernet/station-locations
curl "http://localhost:5050/api/loggernet/site-mappings?search=Haenertsburg&limit=5"
curl "http://localhost:5050/api/loggernet/field-mappings?search=rain&limit=20"
```

As an alternative for temporary local testing, set `LOGGERNET_LOCATIONS_URL` to a JSON location endpoint, or add station coordinate overrides in `.env`:

```sh
LOGGERNET_LOCATION_OVERRIDES={"SAEON_Haenertsburg_AWS":{"latitude":-23.95,"longitude":29.94}}
```

The older wrapper and database settings are still available as fallback:

- `LOGGERNET_API_BASE=` optional wrapper API origin, for example `http://host.docker.internal:3001`
- `LOGGERNET_RAINFALL_URL=` optional full override for a wrapper rainfall endpoint
- `LOGGERNET_LOCATIONS_URL=` optional full override for a locations endpoint
- `LOGGERNET_API_USERNAME=` optional Basic Auth username for hosted Loggernet APIs
- `LOGGERNET_API_PASSWORD=` optional Basic Auth password for hosted Loggernet APIs

## Useful Commands

```sh
docker compose ps
docker compose logs -f backend
docker compose logs -f martin
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose down
```

## Backups

Before risky local development work, create a timestamped database and source snapshot:

```sh
npm run backup:dev
```

Restore the latest Docker development database backup:

```sh
npm run restore:dev -- latest --yes
```

See `BACKUP_RESTORE.md` for the full workflow.

To remove the database volume and start from a completely fresh DB:

```sh
docker compose down -v
```
