# Municipal source data correction

Status: deployed and operator-accepted on production, 27 October 2026, via PR #19 (merge 325e3ba). Cleanup pending.

Public municipality profiles, map metrics, historical trends and indicator metadata exclude rows marked as proxy by their definition, confidence, scenario or known deterministic-seed markers. Selection applies eligibility before choosing the latest value. Context inputs and legacy proxy index definitions cannot contribute to public indices. No stored records are deleted and no migration is needed.

Absent scores remain JSON null, with availability insufficient_verified_data and label Insufficient verified data. Actual zero remains a valid value. Coverage counts only eligible non-context inputs; partial available scores retain their coverage information. This is source eligibility, not independent scientific validation.

The public page retains the simple raw-value map, categories, source table and municipal comparison. Advanced evidence, legacy layer controls and composite-score panels are removed. The downloadable PDF now lists eligible raw source values, periods, units and sources, without composite scores or forecasts. Login and passkeys are unchanged.

Local candidate: http://localhost:8096/municipal-risk-profiler. Existing local passkey candidate remains on 8095. Production was subsequently deployed and accepted separately.

Validation: read-only checks across 213 populated local municipality profiles exclude all 2,982 seeded values, leave imported overall scores unchanged, and return institutional-capacity scores as insufficient data for all 213 municipalities. Regression coverage includes conflicting proxy flags, seed markers, null versus genuine zero, metadata, map and trend responses. Existing 48 authentication, analytics and review tests passed in the isolated synthetic test database. Local DS Lab smoke checks passed. Frontend build and lint passed. Source PDF downloaded through the UI and checked for excluded synthetic content.

## Production rollout

Back up the database and existing configuration, record the deployed commit, and preserve tagged backend/frontend rollback images before pulling the merged change. Preserve the existing authentication secret, passkey origin and relying-party ID. No new database migration, seed deletion, import or volume recreation is required.

Build only SARVA backend and frontend, then recreate only those two services with --no-deps. Leave DS Lab, the database, Martin and the forecast worker running. Check the public homepage and health endpoint, anonymous restrictions on admin/review/analytics endpoints, passkey configuration, and DS Lab HTTPS. Verify public municipal API exclusion and missing-score behaviour, and check password and passkey sign-in in the browser before cleanup. Do not restart the retired preview gateway.

For Ba-Phalaborwa (gid 205), institutional-capacity score must be null with availability insufficient_verified_data and no component values. Public records and trend/map responses must not expose proxy values. The local imported overall score was 42.3 before and after exclusion; production values may differ as source data changes. The visible profiler and source PDF contain raw source values rather than legacy composite panels.

Do not prune rollback images until production browser acceptance is recorded.

## Production acceptance

The operator confirmed all deployment checks passed and the simpler profiler, source-only PDF, password login, passkey login and DS Lab work. Rollback is saved under /home/marc/sarva-backups/before-profiler-20261027-163143. Keep the corresponding rollback-profiler backend/frontend pair and current running images. Removal of older SARVA rollback tags is pending; do not report cleanup complete until the operator supplies its successful checks.
