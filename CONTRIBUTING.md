# Contributing to SARVA

Thank you for improving SARVA. The project combines public-facing web pages, spatial data, catalogue search, municipal indicators and operational data pipelines, so small changes can affect several user journeys. Please keep contributions focused and easy to review.

## Development Workflow

1. Create a feature branch.
2. Check the relevant code and data flow before editing.
3. Keep changes scoped to the feature or fix.
4. Add or update documentation when behaviour, setup, data sources or environment variables change.
5. Run the relevant checks before opening a pull request.

## Local Checks

Frontend:

```sh
cd frontend
npm run build
npm run lint
```

Backend:

```sh
cd backend
npm run migrate
```

Run the relevant import script when changing an importer, migration or source-data shape. For example:

```sh
cd backend
npm run import:resources:dry-run
npm run import:glossary:dry-run
npm run import:policy:dry-run
```

## Database Changes

- Add a new numbered SQL migration under `backend/migrations/`.
- Do not edit old migrations after they have been applied in shared environments unless the change is explicitly coordinated.
- Make migrations idempotent where practical.
- Include clear source names, dates and URLs for new indicator or evidence records.

## Data Source Changes

For new or changed external data sources, document:

- Source organisation.
- Source URL or API endpoint.
- Access method and required environment variables.
- Update cadence.
- Licence or usage constraints where known.
- Date or period represented by the data.
- How missing values should be shown to users.

## Frontend Changes

- Preserve existing navigation and workflows unless the task explicitly changes them.
- Keep map, profile and resource interfaces understandable for non-technical users.
- Use existing styles and design tokens from `frontend/src/styles/`.
- Check desktop and mobile layouts for any new panel, menu, table or map overlay.
- Avoid introducing decorative UI that competes with the data.

## Backend Changes

- Keep route handlers small enough to follow.
- Prefer explicit input validation for query parameters and request bodies.
- Use parameterised SQL queries.
- Avoid logging secrets, tokens or full credentials.
- Make external service failures visible but graceful where users can continue with cached or partial data.

## Pull Request Checklist

- [ ] The change is scoped and described clearly.
- [ ] Relevant frontend build or backend migration/import checks were run.
- [ ] New environment variables are documented.
- [ ] New data sources include source, date/period and URL metadata.
- [ ] Missing-data behaviour is explicit for indicators or maps.
- [ ] Screenshots are included for visible UI changes.
