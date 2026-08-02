# SARVA Frontend

The SARVA frontend is a React + Vite application. It provides the public portal, Explore page, resource library, catalogue search, municipal risk profiler, national map and supporting content pages.

## Key Files

```text
frontend/src/main.jsx                       Router setup
frontend/src/layouts/                       Shared layouts
frontend/src/components/Header.jsx          Navigation and global search
frontend/src/components/SouthAfricaMap.jsx  MapLibre national map
frontend/src/pages/Home.jsx                 Landing page and map workspace
frontend/src/pages/Explore.jsx              Guided navigation and atlas tool links
frontend/src/pages/MunicipalRiskProfiler.jsx Municipal profiles and indicators
frontend/src/pages/Search.jsx               SAEON catalogue mirror search
frontend/src/pages/Resources.jsx            Resource library
frontend/src/styles/                        CSS and design tokens
```

## Development

```sh
cd frontend
npm install
npm run dev
```

The dev server normally starts at http://localhost:5173.

Set API and tile origins with:

```sh
VITE_API_BASE=http://localhost:5050
VITE_MARTIN_BASE=http://localhost:3000
```

## Build and Lint

```sh
npm run build
npm run lint
```

## Design Notes

- Use shared tokens from `src/styles/tokens.css`.
- Keep map overlays compact and avoid blocking the spatial view.
- Prefer clear task labels over generic labels such as "overview" or "interactive maps".
- Keep public-facing data caveats visible when indicators are comparative, provisional or incomplete.
- Check responsive layouts after changing cards, menus, map panels or profile tabs.

## Routing

Routes are declared in `src/main.jsx`. Main routes include:

- `/`
- `/explore`
- `/search`
- `/resources`
- `/glossary`
- `/national-policy-and-legislation`
- `/municipal-risk-profiler`
- `/about`
