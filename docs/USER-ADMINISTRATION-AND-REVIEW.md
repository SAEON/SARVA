# Local SARVA user administration and testing review

Status: locally tested release prepared for GitHub on 27 October 2026. Production deployment is pending operator execution and acceptance.
The candidate at http://localhost:8095 uses a dedicated synthetic database and
synthetic accounts. No production accounts, passwords or issue reports were copied.
Passkeys remain excluded. The experimental release banner and normal password
login remain; there is no shared preview gate in this candidate.

## Users and roles

Open /admin/users, or choose Users & roles from an administrator's account menu.
Search by name or email; view status, existing roles and last sign-in. Lists are
paged in groups of 25. Only active administrators verified against current database
membership can read or change account access. Responses omit credential fields.

Changes require the acting administrator's current SARVA password and a reason.
Existing roles can be selected; this interface does not create new role definitions,
reset passwords, delete accounts or create invitations. Contributor is an existing
designation; access depends on each feature, not this label alone.

Self-deactivation and self-removal of admin access are blocked. Access changes
serialize under a transaction advisory lock, recheck the actor and preserve an
active administrator. Revision checks reject stale edits. Role/status changes
and before/after audit entries commit atomically. Audit insertion failure rolls
back the access change. Account history includes only changes through this API,
not earlier manual SQL changes such as production account promotions.

Existing sensitive content administration routes now recheck active administrator
membership instead of relying only on old token role claims. Deactivated users
cannot sign in. Demoted users lose protected operations even with existing tokens;
their visible menus may require a refresh or a fresh sign-in. Existing read-only
analytics and health routes retain their own fresh database role checks.

## Testing and issues

Open /testing, or Testing & issues in the account menu. Administrators have section
navigation between the tracker and user management. Registered active users can
report and view their own issues and comments; administrators can review all issues.
Anonymous users cannot access reports. Guessed IDs do not expose another user's
thread. This is an internal signed-in review tool, not a public issue board.

Types: Bug, Needs updating, Comment / suggestion. Priorities: Low, Normal, High.
Statuses: Open, In review, Resolved. Reports include a title, reproduction or
description text, and an optional local page path without URL queries/fragments.
No attachments, external notifications or email replies are implemented.

Reporters can comment on their own issues, including follow-up on resolved issues.
Administrators can post replies on any issue, change classification/priority/status,
record review/fix notes, resolve and reopen issues. Resolving requires outcome notes.
Previous resolution notes survive in history when an issue is reopened.
Concurrent stale reviewer drafts receive 409 instead of overwriting newer decisions.
Reports, replies and review events are stored atomically; there is no deletion API.

Administrator reply attribution is assigned server-side. Only current admins receive
administrator author names in reply/review metadata. Other users receive a generic
Admin identity and the UI displays Reply from Admin. The names are not merely
hidden by CSS; they are omitted from non-admin API responses. Free-text reply
content is rendered as text, not HTML. Authors should not include private credentials
or signatures they do not intend the reporter to read.

History is paged, 50 events at a time, newest page first with events displayed
chronologically within each page. Full stored history is retained. Account and
tracker responses are no-store. APIs bound input lengths and validate types;
SQL is parameterized. Account changes and tracker writes have per-account throttles.

## Database and rollout

059_user_administration.sql adds access_revision and user_access_audit.
060_testing_review_tracker.sql adds review_issue and review_issue_event plus indexes.
The abandoned passkey migration is not part of this branch. Production must run
the normal migration runner before the new API is started; back up its database,
configuration and current frontend/backend images before any future rollout.
No new packages, external services, host ports or Docker volumes are required.
The local frontend API-base fix keeps same-origin requests rooted when opening
nested URLs such as /admin/users. It preserves /api-prefixed and public file paths.

## Verification

API integration tests use the isolated synthetic database, with explicit
USER_ADMIN_TEST=synthetic-only, REVIEW_ISSUES_TEST=synthetic-only and
SARVA_ANALYTICS_TEST=synthetic-only guards. They cover current-role authorization,
wrong passwords, input validation, stale edits, concurrency, owner visibility,
replies, administrator-name privacy, resolution/reopening and audit-failure rollback.
Frontend build, lint and API-path/analytics tests are also run in Docker.

Browser checks completed: synthetic administrator sign-in; contributor role change
with password confirmation and recorded history; blocked self-admin/status controls;
report creation; admin reply to another synthetic reporter; review and resolution
notes; ordinary reporter sees only their own report and Reply from Admin, with no
administrator name or review controls. Local sample issues are explicitly synthetic,
not verified defects or fixes in production. Local spatial feeds are empty fixtures;
this review does not establish production map or external-feed availability.


Final local checks passed: 52 backend tests and 4 frontend tests, frontend lint,
Docker builds and browser workflows. Anonymous user management returned 403,
anonymous issue tracker returned 401, local API health passed and DS Lab returned
200. This is synthetic local evidence; production acceptance remains pending.

## Production deployment sequence

1. Verify hostname ulwsarvadsl01 and a clean tracked checkout in /opt/sarva.
   Preserve the server-specific untracked preview/compose.production.yml.
2. Save a PostgreSQL custom-format dump and validate it with pg_restore --list.
   Back up available private .env files, Compose files and host Nginx; tag both
   currently running frontend/backend image IDs and record the tags and commit.
3. Pull main with --ff-only, build backend/frontend only, and run
   docker compose run --rm --no-deps backend npm run migrate. Expect additive
   059_user_administration.sql and 060_testing_review_tracker.sql; existing users,
   roles and credential hashes are preserved. Never restore the synthetic DB.
4. Recreate backend/frontend with --no-deps, keeping the current production env,
   data mounts and database. Refresh frontend Nginx upstream DNS after the API
   is healthy (validate nginx -t, then signal the verified Nginx PID 1 if needed).
   Host Nginx should continue proxying SARVA directly to port 8090; do not restart
   the stopped preview services or change DS Lab's stack or virtual host.
5. Verify SARVA homepage/API 200, anonymous user administration/analytics 403,
   anonymous tracker 401, and DS Lab 200. Operator signs in with their existing
   production SARVA account, opens Users & roles and Testing & issues, and checks
   a report/reply/review. Admins should see author names; ordinary reporters
   should see Reply from Admin and only their own reports. Do not change real
   account roles solely for deployment testing.
6. Record production acceptance before cleanup. Retain rollback tags, database
   dump, private configuration and data volumes. No pruning is part of migration.

Code rollback can restore the saved frontend/backend images while retaining these
additive schema tables. Access changes made through the deployed tool persist in
the database; a code rollback does not reverse them. Database restore is a separate
recovery decision and must account for new user activity since the backup.


## Production rollout evidence, 27 October 2026

Operator confirmed database/image/configuration backup at
/home/marc/sarva-backups/before-user-admin-20261027-132424, followed by successful
frontend/backend builds and application of 059_user_administration.sql and
060_testing_review_tracker.sql. Supplied production output showed frontend Nginx
validation passed, SARVA homepage/API 200, anonymous user management 403,
anonymous tracker 401, and DS Lab 200. The operator subsequently viewed the live
authenticated Testing & issues page. After the separate account-menu release,
the operator confirmed normal SARVA login, the new menu and DS Lab work.

These records supersede the pending technical deployment status above. They do
not establish a production role-change test or an explicit end-to-end report,
admin reply, resolution and non-admin reply-privacy acceptance; those workflows
were verified locally with synthetic accounts. No real role changes are required
solely for deployment testing. Cleanup instructions preserve this release's
backend/frontend rollback tags and database dump; completion remains pending.
