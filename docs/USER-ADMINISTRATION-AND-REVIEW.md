# Local SARVA user administration and testing review

Status: implemented locally on 27 October 2026. Not pushed to GitHub or deployed.
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
