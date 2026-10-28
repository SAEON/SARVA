# Issue assignment reliability

The original intermittent assignment error was investigated locally and on production. A subsequent public-route capture confirmed an HTML HTTP 403 for assignment PATCH; the exact rejecting component/rule remains unconfirmed.

The assignment route now catches connection acquisition and rollback failures and returns JSON without exposing internal errors. Failed rollback connections are discarded. Existing active-admin permissions, revision conflict checks and transactional audit history remain enforced. The UI explains unexpected HTTP responses, avoids cached review requests and clears old save notices before another attempt. Mutations are not automatically retried because a lost response does not prove the save failed.

Tests cover a second administrator assigning, reloading, reassigning and unassigning a report, stale revisions, permissions, audit rollback, connection acquisition failure, rollback failure and an HTML gateway response.

Deployment requires backend and frontend images, no schema migration. Preserve current backend/frontend rollback images, database and configuration backups. Follow the staged frontend deployment process. After recreating the backend and checking readiness, reload Nginx in both running frontend slots so a changed backend container address does not leave an old upstream. Test the prepared frontend, switch, and check password/passkey login and DS Lab. Do not prune recovery images during this rollout.

## POST compatibility

The frontend now saves assignment using POST. PATCH remains registered to the identical handler for existing open pages. GET does not mutate assignments. This is a compatibility change for the observed public-route HTML 403; the filtering rule is not yet confirmed and was subsequently accepted by the operator from the public route after deployment (see below). No permission checks or audit requirements are relaxed.

## Production acceptance, 28 October 2026

PR #34 (merge d2c8cf9) deployed assignment error handling. The Mac public-route request then showed PATCH /api/review/issues/10/assignment returning HTML 403, while successful internal PATCH requests returned 200. The failed request was absent from the supplied origin logs. A firewall/proxy filter is suspected; no exact rule was identified. Thabang succeeded on VPN after a hard refresh.

PR #35 (merge 31fb933) deployed POST assignment with legacy PATCH compatibility. Both images built, backend readiness passed, both frontend Nginx proxies were reloaded, and the replacement frontend was prepared while live remained on 8091. Preparation saved /var/backups/sarva-frontend-bluegreen/20261028-101033 and sarva-frontend:rollback-bluegreen-20261028-101033; candidate 0955b1c5d34b867e34ae4f6cd6af0613acb0e8f1f28d32dcbf76fc4cc61faa22 on 8090. The operator subsequently confirmed assignment worked from the Mac outside VPN. This confirms the tested action, not all public write operations or a firewall rule diagnosis.

Local validation: 53 isolated backend tests, frontend response tests and lint, both Docker builds, local SARVA/DS Lab HTTP 200 and passkeys enabled. No database migration or DS Lab deployment was required. Password/passkey authentication code and configuration were unchanged; a new explicit browser recheck of both login methods after this specific release has not yet been supplied.

Cleanup is pending. Retain both frontend slots, current backend/frontend images, rollback/reconstructed recovery images, all file/config/database backups and volumes. Only dangling-image cleanup is proposed; no broad prune or Docker restart. Separate analytics POST /api/analytics/events HTTP 400 responses were observed and remain unresolved.
