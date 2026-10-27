# Experimental forecast presentation

Status: deployed and operator-accepted on production, 27 October 2026, via PR #20 (merge 7abeffb). Production cleanup complete.

The main-page highlights, map labels/popups, planning context and public forecast API identify SARVA outputs as experimental interpretations of ECMWF model data rather than official forecasts, warnings or emergency advice. Home severity headlines are replaced by model values and explicitly labelled experimental indices. Cached home payloads are normalised on read so old High/Very high screening-signal wording cannot reappear. Values, locations, dates and model calculations are preserved.

Notices link to official SAWS forecasts and warnings and explain that rainfall is not a flood assessment, fire-weather indicators are not official fire-danger ratings, and low model values do not establish safety. ECMWF source, copyright, CC BY 4.0 link and derivative/disclaimer information are supplied. This presentation change does not independently validate the model methods or constitute legal approval. Existing saved user planning drafts are not rewritten; newly downloaded stormwater briefs include the experimental notice.

Validation: three forecast-presentation tests cover cached labels, missing indices and metadata; all five local model layers (1,813 features each) retain identical numeric values compared with the unchanged local API. Frontend lint and Docker builds passed. Existing 48 password/passkey, analytics and review tests passed in the isolated database; local DS Lab smoke checks passed. The operator accepted the local main-page wording.

## Production rollout

Save the current database, configuration, Git commit and tagged backend/frontend rollback images. Pull the merged release, build backend/frontend sequentially and recreate only those two services with --no-deps. No database migration or model refresh is required. Preserve AUTH_SECRET, passkey origin/RP ID and existing password configuration. Do not restart the retired preview gate or DS Lab services.

Verify public SARVA/DS Lab health, protected endpoint responses, passkey enablement, experimental API metadata and forecast highlight labels. In the browser check the homepage, map popups and official SAWS link, then password and passkey login and DS Lab. Retain rollback images until acceptance; record cleanup separately after successful checks.

References: https://www.weathersa.co.za/warnings and https://www.ecmwf.int/en/forecasts/datasets/open-data .

## Production acceptance

All deployment checks passed and the operator confirmed the live forecast wording, password login, passkey login and DS Lab work. Rollback is saved at /home/marc/sarva-backups/before-forecast-wording-20261027-165810. Preserve the corresponding backend/frontend rollback-forecast-wording pair and current running images. The operator confirmed cleanup of older SARVA rollback tags is complete and all post-cleanup checks passed. Current running images and the latest forecast rollback pair are retained; password login, passkey login and DS Lab remain working. This is operator-reported acceptance, not an independently executed server audit. No database migration, model refresh or authentication change was performed for this release.
