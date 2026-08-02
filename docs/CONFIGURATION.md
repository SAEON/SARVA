# SARVA Configuration

This document summarises the most important SARVA environment variables. Use `.env.docker.example` as the starting point for Docker deployments.

## Core Backend

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5050` | Express API port. |
| `DB_HOST` | varies | PostgreSQL host. |
| `DB_PORT` | `5432` | PostgreSQL port. |
| `DB_NAME` | `sarva` | PostgreSQL database name. |
| `DB_USER` | `sarva` | PostgreSQL user. |
| `DB_PASSWORD` | varies | PostgreSQL password. |
| `AUTH_SECRET` | local fallback | Secret used for SARVA auth tokens. Set this in every non-local environment. |

## Frontend

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE` | `http://localhost:5050` | API origin for browser requests. Docker builds usually use `.` for same-origin Nginx proxying. |
| `VITE_MARTIN_BASE` | `http://localhost:3000` | Martin tile server origin for local development. |

## Catalogue

| Variable | Default | Purpose |
| --- | --- | --- |
| `CATALOGUE_SYNC_ENABLED` | `true` | Enables the scheduled catalogue sync. |
| `CATALOGUE_SYNC_ON_START` | `false` | Runs sync on backend startup when true. |
| `CATALOGUE_SYNC_STALE_HOURS` | `26` | Startup freshness threshold. |
| `CATALOGUE_GRAPHQL_ENDPOINT` | `https://catalogue.saeon.ac.za/graphql` | SAEON catalogue GraphQL endpoint. |
| `CATALOGUE_SYNC_PAGE_SIZE` | `200` | Number of records requested per sync page. |
| `CATALOGUE_GRAPHQL_TIMEOUT_MS` | `8000` | GraphQL request timeout. |

## LoggerNet and Observations

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOGGERNET_RAW_BASE` | `https://lognet.saeon.ac.za` | Raw LoggerNet endpoint base. |
| `LOGGERNET_RAW_ENABLED` | `true` | Enables direct raw LoggerNet reads. |
| `LOGGERNET_RAW_SERVER_LIMIT` | `60` | Max LoggerNet servers queried per request. |
| `LOGGERNET_RAW_RECENT_ROWS` | `12` | Recent rows inspected per station/table. |
| `LOGGERNET_RAW_CONCURRENCY` | `4` | Concurrent LoggerNet requests. |
| `LOGGERNET_RAW_TABLE_NAMES` | `Daily,Public` | Table names considered for rainfall observations. |
| `LOGGERNET_LOCATION_OVERRIDES` | empty | JSON object for station coordinate overrides. |
| `LOGGERNET_API_BASE` | empty | Optional wrapper API base. |
| `LOGGERNET_RAINFALL_URL` | empty | Optional full rainfall endpoint override. |
| `LOGGERNET_LOCATIONS_URL` | empty | Optional full locations endpoint override. |
| `LOGGERNET_API_TIMEOUT_MS` | `12000` | Observation API timeout. |
| `LOGGERNET_API_USERNAME` | empty | Optional Basic Auth username. |
| `LOGGERNET_API_PASSWORD` | empty | Optional Basic Auth password. |
| `LOGGERNET_DATABASE_URL` | empty | Optional direct LoggerNet database connection string. |
| `LOGGERNET_DB_HOST` etc. | empty | Optional direct LoggerNet database settings. |

## Forecast Risk Worker

The forecast worker uses `FORECAST_RISK_*` variables for forecast window, bounds and execution mode. See `docker/forecast-risk-worker/sync_ecmwf_forecast_risk.py` and `.env.docker.example` for the current supported set.

## ODP Hostname Note

As of this documentation update, SARVA does not hard-code `auth.odp.saeon.ac.za` or `api.odp.saeon.ac.za`. If production environments inject external ODP endpoints, check:

- `CATALOGUE_GRAPHQL_ENDPOINT`
- `LOGGERNET_API_BASE`
- `LOGGERNET_RAINFALL_URL`
- `LOGGERNET_LOCATIONS_URL`

Any old `*.odp.saeon.ac.za` host should be replaced with the corresponding hyphenated host supplied by SAEON infrastructure.
