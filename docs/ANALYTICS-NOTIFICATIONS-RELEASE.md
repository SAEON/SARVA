# Analytics reports and account notifications

Deployed on 27 November 2026 through PR #73. The operator confirmed that the live update works.

## Behaviour

- Retains inclusive South African calendar-day date ranges and existing analytics reports. Adds a plain-text report with Copy and Download .txt actions, prioritising page views, browser sessions, distinct tracked signed-in accounts, registrations, countries, popular pages and map/resource interactions. Download-link clicks remain a secondary measure, not completed downloads.
- Adds red unread badges for new issues and account registrations for active platform administrators. Private reply/review notifications go to the original issue reporter. Existing Issues & feedback permissions remain in force.
- Read state is persisted per recipient and notification. Opening one notice acknowledges that notice only. Links open the relevant account, issue or highlighted reply, including replies on older history pages.
- Notifications start with newly recorded activity; historical activity is not backfilled. Existing registration and reply writes deliver notifications within the same database transaction. No email or OS push is sent.

## Validation

53 checks passed: 38 integration tests covering notifications, SAST boundaries, permissions and existing issue/CGC workflows; 13 existing analytics/privacy checks; and two text-report/export tests. Frontend build and targeted lint passed. Browser checks confirmed applied dates, Copy success feedback, the downloaded text report, separate unread categories, account/issue links and original-reporter reply links. One existing analytics test now checks explicit user filtering without assuming it is the only user in the synthetic database.

The synthetic test database does not contain the catalogue and forecast datasets; their existing panels correctly show unavailable. Production-data validation and normal password/passkey browser checks remain part of rollout acceptance. Counts reflect available tracking and must not be interpreted as total unique people.

## Rollout and recovery

Back up the database, uploaded files and configuration and retain current application images before applying migration 072. Apply the migration before starting the new backend. Prepare the frontend separately, then switch after backend health checks. Preserve existing authentication configuration and persistent volumes. No new upload-limit or host-routing change is required. Keep the additive migration if reverting application images; retained notifications can be used after reapplying the new application.

This update targets SARVA only. The Lab, tracker database, WEF services and existing spatial-database recovery setup should remain outside the deployment scope. Do not prune rollback images or volumes during rollout.

## Handover update - 27 November 2026

The operator confirmed successful live operation of the analytics/notification release and the open-issues/unread-replies follow-up. Database migration 072 was applied for the first release; the badge follow-up required no additional migration. Existing authentication configuration was checked before application replacement, and database/upload backups and application rollback images were retained.

GitHub branch housekeeping is complete: 68 deployment branches with tips confirmed as ancestors of main were removed using exact-tip checks. Six branches remain, preserving main, the collaborator branch and four branches not fully merged. Local working branches, tags and uncommitted work were retained; no unmerged branch was automatically merged or deleted.

Production server cleanup was completed and verified by operator output on 27 November 2026. Only build cache older than 24 hours was pruned, reclaiming 214.3 MB. The running-container comparison was unchanged. The current frontend rollback and pre-update backend rollback images were successfully inspected. All application images, persistent volumes, databases and backups were retained.
### Post-cleanup verification

Operator output confirmed HTTP 200 for SARVA home, SARVA API health, public CGC work, WEF Nexus, Environmental Data & Research Lab home, Lab API health and the El Niño tracker. The Lab database returned PostGIS library version 3.6.4. No application image, container, database volume or backup was removed by the cleanup command.

The latest recovery assets, existing login configuration, notification data, CGC work and uploads, WEF services, independent tracker database and spatial-database recovery setup remain retained. Functional acceptance was operator-confirmed before cleanup; HTTP checks and the extension-version query do not replace full login, notification or spatial-query regression testing. GitHub branch cleanup remains complete: 68 fully merged branches removed and six retained, including unmerged work.