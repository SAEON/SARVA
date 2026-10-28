# Issue assignment reliability

Local verification of the intermittent production HTML response report. The production failure has not been captured, so its root cause remains unconfirmed.

The assignment route now catches connection acquisition and rollback failures and returns JSON without exposing internal errors. Failed rollback connections are discarded. Existing active-admin permissions, revision conflict checks and transactional audit history remain enforced. The UI explains unexpected HTTP responses, avoids cached review requests and clears old save notices before another attempt. Mutations are not automatically retried because a lost response does not prove the save failed.

Tests cover a second administrator assigning, reloading, reassigning and unassigning a report, stale revisions, permissions, audit rollback, connection acquisition failure, rollback failure and an HTML gateway response.

Deployment requires backend and frontend images, no schema migration. Preserve current backend/frontend rollback images, database and configuration backups. Follow the staged frontend deployment process. After recreating the backend and checking readiness, reload Nginx in both running frontend slots so a changed backend container address does not leave an old upstream. Test the prepared frontend, switch, and check password/passkey login and DS Lab. Do not prune recovery images during this rollout.

## POST compatibility

The frontend now saves assignment using POST. PATCH remains registered to the identical handler for existing open pages. GET does not mutate assignments. This is a compatibility change for the observed public-route HTML 403; the filtering rule is not yet confirmed and must be tested from the public route after deployment. No permission checks or audit requirements are relaxed.
