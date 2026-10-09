# South African Risk and Vulnerability Atlas (SARVA)

SARVA is an open access risk and vulnerability atlas implemented by SAEON. This repository contains the SARVA web application, backend API, data import workflows, local catalogue mirror, municipal risk profiler, forecast risk map layers and Docker deployment stack.

The platform brings together:

- SARVA landing, explore, resources, glossary, policy and about pages.
- Municipal risk profiles with indicators, finance and governance layers, missing-data flags and downloadable profile views.
- A local mirror of the SAEON catalogue for fast search and discovery.
- Forecast environmental risk layers derived from ECMWF Open Data.
- SAEON live observation and LoggerNet-derived map context.
- PostGIS municipal boundary tiles served through Martin.
- Admin tools for library records and link health checks.

## Repository Layout

```text
.
|-- backend/                    Express API, migrations, import scripts
|-- frontend/                   React + Vite application
|-- docker/                     PostGIS, Martin, forecast worker and importer assets
|-- data/                       Local source data used by import scripts
|-- scripts/                    Local backup and restore helpers
|-- docker-compose.yml          Full local/container stack
|-- docker-compose.dev.yml      Development overrides
|-- DOCKER_DEPLOYMENT.md        Detailed Docker deployment notes
|-- BACKUP_RESTORE.md           Local backup and restore workflow
`-- docs/                       Architecture, configuration and operations notes
```

## Technology Stack

- Frontend: React, Vite, React Router, MapLibre GL.
- Backend: Node.js, Express, PostgreSQL client.
- Database: PostgreSQL with PostGIS.
- Tiles: Martin vector tile server.
- Forecast worker: Python worker for ECMWF forecast risk cache.
- Deployment: Docker Compose.

## Quick Start With Docker

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

Open:

- Frontend: http://localhost:8080
- Backend health: http://localhost:5050/api/health
- Martin catalog: http://localhost:3000/catalog

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for full deployment, data import and tile-server notes.

More supporting documentation:

- [Architecture](docs/ARCHITECTURE.md)
- [Configuration](docs/CONFIGURATION.md)
- [Data sources](docs/DATA_SOURCES.md)
- [Operations](docs/OPERATIONS.md)
- [Backup and restore](BACKUP_RESTORE.md)

## Local Development

If the Docker database, backend and Martin services are already running, start
the frontend from the repository root with `npm run dev` and open
http://127.0.0.1:5173. The development server proxies `/api` and `/public` to
http://127.0.0.1:5060 and `/tiles` to http://127.0.0.1:3010, matching the
Docker Compose defaults. This serves current frontend edits without rebuilding
the frontend container.

To use a separately started backend or custom ports, set `DEV_API_TARGET` and
`DEV_TILE_TARGET` in `frontend/.env.local`, for example:

```dotenv
DEV_API_TARGET=http://127.0.0.1:5050
DEV_TILE_TARGET=http://127.0.0.1:3010
```

Restart the development server after changing these settings. Leave
`VITE_API_BASE` and `VITE_MARTIN_BASE` unset to use the same-origin proxies.

Install dependencies in each app directory:

```sh
cd backend
npm install
npm run migrate
npm run dev
```

In another terminal:

```sh
cd frontend
npm install
npm run dev
```

Default local endpoints:

- Backend API: http://localhost:5050
- Frontend dev server: usually http://localhost:5173
- Martin: http://localhost:3000 when run through Docker.

## Important Environment Variables

Common backend variables:

- `PORT`: backend port, default `5050`.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: SARVA PostgreSQL connection.
- `AUTH_SECRET`: local JWT/session signing secret.
- `CATALOGUE_GRAPHQL_ENDPOINT`: defaults to `https://catalogue.saeon.ac.za/graphql`.
- `CATALOGUE_SYNC_ENABLED`: set to `false` to disable scheduled catalogue sync.
- `LOGGERNET_RAW_BASE`: defaults to `https://lognet.saeon.ac.za`.
- `LOGGERNET_API_BASE`, `LOGGERNET_RAINFALL_URL`, `LOGGERNET_LOCATIONS_URL`: optional LoggerNet wrapper or override endpoints.
- `FORECAST_RISK_*`: forecast worker bounds, runtime and cache settings.

Common frontend variables:

- `VITE_API_BASE`: API origin. In Docker this is `.` so Nginx proxies `/api`.
- `VITE_MARTIN_BASE`: vector tile origin for local development.

Use `.env.docker.example` as the safest starting point for new environments.

## Data Workflows

Run these from `backend/` unless using the Docker equivalents in [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md).

```sh
npm run migrate
npm run import:glossary
npm run import:resources
npm run import:policy
npm run import:municipalities
npm run import:loggernet-locations
npm run import:sa-risk-indicators
npm run import:municipal-finance-indicators
npm run sync:catalogue
npm run refresh:catalogue-ev
npm run check:links
```

The municipal finance indicators use National Treasury Municipal Money and AGSA-derived inputs. The municipal risk profiler treats missing source values explicitly so users can distinguish available evidence from data gaps.

## Useful API Areas

- `/api/health`: backend health check.
- `/api/nav`: site navigation.
- `/api/site`: home page and portal metadata.
- `/api/resources`: resources, reports, data spotlight and library records.
- `/api/glossary`: glossary terms.
- `/api/national-policy-and-legislation`: policy library.
- `/api/catalogue/*`: SAEON catalogue mirror, suggestions and live lookups.
- `/api/rainfall/*`, `/api/loggernet/*`: observation and LoggerNet-derived layers.
- `/api/forecast-risk/*`: cached ECMWF forecast risk layers.
- `/api/municipal-profiles/*`: municipal profile, layer and indicator endpoints.

## Quality Checks

```sh
cd frontend
npm run build
npm run lint
```

The backend currently uses migration/import script checks rather than a formal test runner. For backend changes, at minimum run:

```sh
cd backend
npm run migrate
```

For map or profile changes, also check the relevant frontend page in a browser and verify API responses with `curl` or the browser network panel.

## Backups

For local development database snapshots:

```sh
npm run backup:dev
npm run restore:dev -- latest --yes
```

Backups are written under `backups/dev/`.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Keep changes scoped, document new data sources, and add migration scripts for database changes.

## Licence

No repository licence file is currently included. Confirm the intended licence with SAEON before redistributing or reusing code outside the project.
