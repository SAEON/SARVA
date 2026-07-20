# Relevant Documents Feature Implementation Summary

## Source

- Source page: `https://sarva.saeon.ac.za/resources/`
- The page returns one static HTML table with class names indicating client-side search/pagination.
- The table declares `data-items-per-page="20"`, but all 56 resource rows are present in the returned HTML.
- Columns verified in source order: `Resource`, `Author`, `Publication Year`, `Resource Type`, `Keyword`.

## Files Created

- `backend/migrations/001_resources.sql`
- `backend/migrations/002_relevant_documents_nav_label.sql`
- `backend/scripts/migrate.js`
- `backend/scripts/import-sarva-resources.js`
- `backend/src/routes/resources.js`
- `frontend/src/pages/Resources.jsx`
- `frontend/src/styles/resources.css`
- `RESOURCE_IMPLEMENTATION_SUMMARY.md`

## Files Changed

- `backend/package.json`
- `backend/src/server.js`
- `backend/src/routes/nav.js`
- `frontend/src/main.jsx`

## Database Schema

Created `sarva.resources`:

- `id bigserial primary key`
- `title text not null`
- `url text`
- `author text`
- `publication_year text`
- `resource_type text`
- `keywords text[] not null default '{}'`
- `source_page text not null default 'https://sarva.saeon.ac.za/resources/'`
- `source_identifier text not null unique`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`publication_year` is stored as text because the source contains the non-numeric value `na`, and preserving source values is safer than inventing or coercing data.

Indexes and constraints:

- Unique `source_identifier`
- Unique lower-case URL index where URL is present
- Lower-case title index
- Lower-case author index
- `resource_type` index
- `publication_year` index
- GIN index on `keywords`

The migrations add a `Relevant Documents` nav item under `RESOURCES & TRAINING`, immediately after `Glossary of terms`.

## Importer

Command:

```sh
cd backend
npm run import:resources
```

Dry run:

```sh
cd backend
npm run import:resources:dry-run
```

Importer behavior:

- Fetches the source page with a browser-like user agent.
- Retries failed requests.
- Falls back to disabled TLS verification with a warning because the source server certificate chain is not accepted by Node in this environment.
- Extracts all `<tr>` records from the full static table, not only the first 20 displayed rows.
- Normalizes whitespace, relative URLs, trailing keyword commas, and duplicate rows.
- Splits keywords into `text[]`.
- Uses URL-based stable identifiers where URLs exist; otherwise falls back to title/author identity.
- Upserts records inside a transaction.

Import results:

- Source records discovered: 56
- Records imported: 56
- Duplicates skipped: 0
- Malformed rows: 0
- Re-running importer: 0 inserted, 56 updated

Data-quality checks:

- Missing titles: 0
- Missing URLs: 0
- Duplicate URLs: 0
- Duplicate title/author combinations: 0
- Invalid/non-numeric publication years: 1 (`na`, preserved)
- Blank authors: 0
- Blank resource types: 0
- Malformed keywords: 0

## API

Routes:

- `GET /api/resources`
- `GET /api/resources/:id`

Supported query parameters:

- `q` or `search`
- `resource_type`
- `publication_year`
- `keyword`
- `page`
- `limit`
- `sort`
- `order`

Example:

```sh
curl 'http://localhost:5050/api/resources?search=climate&resource_type=Report&page=1&limit=20'
```

Response shape:

```json
{
  "status": "ok",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  },
  "filters": {
    "resourceTypes": [],
    "publicationYears": [],
    "keywords": []
  }
}
```

The API uses parameterized SQL, bounded `page`/`limit`, and a whitelist for sortable columns. Unknown sort fields fall back to title sorting.

## Frontend

- Route: `/resources`
- Navigation: `RESOURCES & TRAINING` dropdown now shows `Glossary of terms` followed by `Relevant Documents`.
- The page loads from `GET /api/resources`.
- Features: debounced search, resource type filter, publication year filter, keyword filter, clear filters, result count, loading/error/empty states, server-side pagination, safe external links, and keyword badges.

## Commands

Run migration:

```sh
cd backend
npm run migrate
```

Populate or refresh resources:

```sh
cd backend
npm run import:resources
```

Start backend:

```sh
cd backend
npm start
```

Start frontend:

```sh
cd frontend
npm run dev
```

Test endpoint:

```sh
curl 'http://localhost:5050/api/resources?page=1&limit=5'
```

Build frontend:

```sh
cd frontend
npm run build
```

Lint frontend:

```sh
cd frontend
npm run lint
```

## Tests Performed

- `npm run import:resources:dry-run`
- `npm run migrate`
- `npm run import:resources`
- Re-ran `npm run import:resources` to verify no duplicate inserts.
- Queried database quality checks.
- Started this backend on port `5051` and verified:
  - `/api/resources?search=climate&resource_type=Report&page=1&limit=5`
  - `/api/resources?keyword=disaster&page=1&limit=3&sort=unsafe_field&order=desc`
  - `/api/nav`
- `node --check src/routes/resources.js`
- `node --check scripts/import-sarva-resources.js`
- `node --check scripts/migrate.js`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## Unresolved Issues

- The source website requires a browser-like user agent and, in this Node environment, TLS certificate verification fallback. The importer logs the TLS fallback instead of hiding it.
- No backend or frontend test framework exists in the current project, so validation was performed through migration/import checks, direct DB checks, endpoint calls, linting and production build.

## National Policy & Legislation Add-on

Added a second source catalogue from `https://sarva.saeon.ac.za/national-policy-and-legislation/`.

Files added:

- `backend/migrations/004_national_policy_legislation.sql`
- `backend/scripts/import-national-policy-legislation.js`
- `backend/src/routes/nationalPolicy.js`
- `frontend/src/pages/NationalPolicy.jsx`

Database table:

- `sarva.national_policy_legislation`
- Fields: `id`, `title`, `url`, `publication_year`, `publisher`, `abstract`, `keywords`, `source_page`, `source_identifier`, `created_at`, `updated_at`

Commands:

```sh
cd backend
npm run migrate
npm run import:policy:dry-run
npm run import:policy
```

API:

- `GET /api/national-policy-legislation`
- `GET /api/national-policy-legislation/:id`
- Supports `search`, `publisher`, `publication_year`, `keyword`, `page`, `limit`, `sort`, and `order`

Frontend:

- Route: `/national-policy-and-legislation`
- Nav: `RESOURCES & TRAINING` now shows `Glossary of terms`, `Relevant Documents`, and `National Policy & Legislation`

Import results:

- Source rows discovered: 33
- Unique imported records: 32
- Duplicate source URL skipped: 1
- Malformed records: 0
- Missing titles: 0
- Missing URLs: 0
- Blank publishers: 0
- Blank abstracts: 0
- Invalid years: 0

Validation:

- Re-running importer inserted 0 and updated 32.
- `GET /api/national-policy-legislation?page=1&limit=2` returned 32 total records.
- Search/filter check with `search=climate&keyword=climate change` returned the expected filtered record.
- Frontend lint and production build passed.
