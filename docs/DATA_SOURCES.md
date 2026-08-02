# SARVA Data Sources

SARVA combines live services, mirrored catalogues, curated resource records and imported indicator datasets. This document records the main source families and the provenance expectations for new data.

## Current Source Families

| Area | Source | Used For |
| --- | --- | --- |
| SAEON Catalogue | `https://catalogue.saeon.ac.za/graphql` | Local searchable catalogue mirror and record links. |
| LoggerNet | `https://lognet.saeon.ac.za` and optional configured wrappers | Observation and rainfall context layers. |
| ECMWF Open Data | Forecast worker inputs | Forecast rainfall, heat, wind, fire-weather proxy and environmental risk layers. |
| Municipal boundaries | MDB local municipal boundary files in `data/municipal-boundaries/` | PostGIS municipal boundaries and Martin vector tiles. |
| National Treasury Municipal Money | `https://municipaldata.treasury.gov.za/docs` | Municipal finance, liquidity, debt, capex and UIFW-derived governance indicators. |
| AGSA local government audit outcomes | AGSA MFMA reporting | Audit outcome and compliance context. |
| SARVA curated resources | Import scripts and admin library records | Reports, stories, websites, tools, policy records and data spotlight items. |
| Public alert/news feeds | Backend alert aggregation | Risk-watch panel on the home page. |

## Provenance Requirements

Every imported indicator, resource or public-facing data layer should carry:

- Source organisation.
- Source name.
- Source URL.
- Publication year, period or retrieval snapshot date.
- Unit and direction where it becomes an indicator.
- Missing-data behaviour.
- Caveat if the value is provisional, cached, modelled or a SARVA development proxy.

## Missing Data

Missing data should be visible rather than silently converted into zero. For composite indicators, SARVA should show:

- How many inputs were available.
- Which inputs were missing for the selected municipality or layer.
- Whether the score is still comparable for the selected view.
- Whether no-data municipalities are excluded, greyed out or scored from partial inputs.

## Comparative Scores

SARVA municipal profiler scores are normally 0-100 comparison scores within the available South African municipal dataset for the selected layer and period. They are not international standards unless a layer explicitly says so.

Use wording such as:

> 0-100 is relative to South African municipalities for this layer and period, not an international benchmark.

## Adding a New Source

When adding a new source:

1. Add or update the importer, migration or route.
2. Store raw values where practical.
3. Store source metadata with source name, URL and period.
4. Add user-facing interpretation text.
5. Show missing data explicitly.
6. Update this file and any relevant README or operations notes.
