# SARVA Operations

This document collects common operational tasks for local and Docker environments.

## Start the Docker Stack

```sh
cp .env.docker.example .env
docker compose up --build
```

Run migrations before using a fresh database:

```sh
docker compose run --rm backend npm run migrate
```

## Import Baseline Content

```sh
docker compose run --rm backend npm run import:glossary
docker compose run --rm backend npm run import:resources
docker compose run --rm backend npm run import:policy
docker compose --profile tools run --rm municipal-importer
docker compose run --rm backend npm run sync:catalogue
docker compose restart martin
```

## Catalogue Sync

Manual full sync:

```sh
docker compose run --rm backend npm run sync:catalogue
```

Limited smoke-test sync:

```sh
docker compose run --rm backend npm run sync:catalogue -- --max-pages=1
```

Check status:

```sh
curl http://localhost:5050/api/catalogue/status
```

## Municipal Data

Import boundaries:

```sh
docker compose --profile tools run --rm municipal-importer
docker compose restart martin
```

Import municipal indicators and finance indicators from local/backend workflows:

```sh
cd backend
npm run import:sa-risk-indicators
npm run import:municipal-finance-indicators
```

## LoggerNet Site Mapping

Refresh local site mappings:

```sh
docker compose exec -T backend npm run import:loggernet-locations
```

Inspect loaded mappings:

```sh
curl http://localhost:5050/api/loggernet/station-locations
curl "http://localhost:5050/api/loggernet/site-mappings?limit=5"
```

## Link Health

```sh
cd backend
npm run check:links
```

## Backups and Restore

Create a development backup:

```sh
npm run backup:dev
```

Restore the latest development backup:

```sh
npm run restore:dev -- latest --yes
```

## Logs

```sh
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f martin
docker compose logs -f db
```

## Common Health Checks

```sh
curl http://localhost:5050/api/health
curl http://localhost:3000/catalog
curl http://localhost:8080/tiles/
```

## Reset Local Docker Database

This removes the local database volume.

```sh
docker compose down -v
```

Then rerun migrations and imports.
