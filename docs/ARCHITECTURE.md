# SARVA Architecture

SARVA is split into a React frontend, an Express backend, PostgreSQL/PostGIS storage, a Martin tile server and optional worker/importer containers.

## High-Level Flow

```text
Browser
  |
  | React + Vite app
  v
Nginx or Vite dev proxy
  |
  +--> Express API (/api)
  |      |
  |      +--> PostgreSQL/PostGIS
  |      +--> SAEON catalogue GraphQL
  |      +--> LoggerNet/raw observation sources
  |      +--> public alert/news APIs
  |
  +--> Martin vector tiles (/tiles)
         |
         +--> PostGIS spatial tables
```

## Frontend

The frontend lives in `frontend/` and uses React, Vite, React Router and MapLibre GL.

Important areas:

- `frontend/src/pages/Home.jsx`: landing page, forecast highlights, resource panels and national map section.
- `frontend/src/pages/Explore.jsx`: guided navigation into maps, profiles, resources and atlas tools.
- `frontend/src/pages/MunicipalRiskProfiler.jsx`: municipal profile interface.
- `frontend/src/pages/Search.jsx`: SAEON catalogue mirror search.
- `frontend/src/components/SouthAfricaMap.jsx`: national map, forecast risk and observation layers.
- `frontend/src/components/Header.jsx`: navigation and search.
- `frontend/src/styles/`: page and component CSS.

## Backend

The backend lives in `backend/` and uses Express.

Main route groups:

- `health.js`: health checks.
- `site.js`: home page metadata and portal statistics.
- `nav.js`: database-backed site navigation.
- `resources.js`: resource library records.
- `glossary.js`: glossary terms.
- `nationalPolicy.js`: policy and legislation records.
- `catalogue.js`: SAEON catalogue mirror search and live catalogue support.
- `rainfall.js`: LoggerNet and observation-derived endpoints.
- `forecastRisk.js`: forecast environmental risk cache.
- `alerts.js`: public risk-watch feed aggregation.
- `municipalProfiles.js`: municipal profiles, indicators, nearby observations and PDFs.
- `auth.js`, `libraryAdmin.js`: authentication and admin library workflows.

## Database

PostgreSQL stores:

- Site content and navigation.
- Resource, glossary and policy records.
- Catalogue mirror tables.
- LoggerNet station and site mapping tables.
- Municipal boundaries and spatial geometries.
- Municipal indicator definitions, values, index definitions and profile metadata.
- Forecast risk cache tables.

Migrations are ordered SQL files in `backend/migrations/`. Run them with:

```sh
cd backend
npm run migrate
```

## Map Layers

SARVA map layers currently include:

- Municipal boundaries from MDB-derived local municipal data.
- SAEON live observation/site context.
- Forecast rainfall, heat, wind, fire-weather proxy and environmental risk layers.
- Municipal risk profiler layers based on indicator and composite scores.

Martin serves vector tiles from PostGIS. The current Martin config is in `docker/martin/config.yaml`.

## External Services

Core external dependencies include:

- SAEON catalogue GraphQL: `https://catalogue.saeon.ac.za/graphql`
- LoggerNet raw endpoint: `https://lognet.saeon.ac.za`
- ECMWF Open Data forecast products via the forecast risk worker.
- National Treasury Municipal Money API for finance/governance indicators.
- Public alert/news sources used by the risk-watch feed.

Where possible, external endpoints are configured through environment variables rather than hard-coded into route logic.
