# Issues and feedback: production acceptance

Deployed and accepted on production on 27 October 2026 after PR #17 merged
into main (3ee417f). The operator confirmed Issues & feedback, assignment,
resolution, normal SARVA login and DS Lab work.
This follows the issue-reporting and unique-IP release in PR #16.

## User flow

The banner asks people to register or sign in, then open Issues & feedback from
the account icon. The shared footer can still carry the originating pathname.
The report types are Bug / issue, Needs updating, Feedback / suggestion and
Question, with legacy comments retained. Questions and feedback are unrestricted
free-text titles and descriptions, not a predetermined questionnaire. Example
reports in the local database are synthetic tests, not required templates.

Registered viewers can submit their own reports with optional contact name and
email. Their account display name initializes the name field; email is blank
unless supplied. Contact details are visible only to the reporter and admins,
not to other viewers or anonymous requests. Supplied contact email is explicitly
unverified. Replies are recorded in the thread; no automatic email is sent.

## Management

- Close details dismisses the panel without changing status.
- Resolve issue is admin-only, selects Resolved and focuses the fix/outcome
  notes. Mark as resolved saves the status, resolution, timestamp and history.
  Existing review controls also permit reopening while retaining history.
- Owners and current admins can edit report details. Stale revisions cannot
  overwrite a newer edit/review/assignment. Review state is preserved by edits.
- Delete report requires a reason and confirmation. It hides the report from
  active lists/counts, retaining data and history. Show deleted reports exposes
  only authorized reports; owners/admins can restore them with a reason.
- Only current admins may assign to active admins or unassign. Admin filters
  include Assigned to me and Unassigned. Assignment changes are audited and do
  not send notifications. Non-admins see generic assignment status, not admin
  names or IDs; assignment-history details are redacted for non-admins.

All mutations use current account/role checks, row locking, optimistic revision
checks where applicable, and transactional history writes. An audit failure
rolls back the mutation. Deleted reports cannot be edited/commented/reviewed or
assigned until restored. Existing generic administrator reply names remain.

## Validation

35 focused isolated-backend tests passed: issue permissions, free-text questions
and optional contact validation, private contact access, generic admin replies,
resolution, edit/delete/restore lifecycle, stale updates, assignment authorization,
filters, inactive target rejection, assignment name redaction, audit rollback,
and existing unique-IP analytics behavior. Frontend builds and lint passed.

Browser acceptance on localhost:8095: created a free-text question with optional
email and blank affected page; assigned to another synthetic admin; edited its
title; marked resolved with notes; closed/reopened details; deleted and restored
the synthetic report with resolution and history retained. Local SARVA health
and DS Lab root both returned 200. Production was not accessed or changed.

Deployment requires backup and backend/frontend images, then migrations 062,
063 and 064 before recreating the backend. No new packages, DS Lab changes or
host Nginx changes are required. Keep rollback images and preserve report data.

## Production acceptance, 27 October 2026

Before deployment the operator saved verified database/configuration backups and
tagged backend/frontend rollback images under:
/home/marc/sarva-backups/before-feedback-20261027-152120

The supplied terminal output confirms migrations 062_review_issue_management.sql,
063_review_issue_assignment.sql and 064_review_feedback_contacts.sql applied.
Backend/frontend were recreated. Backend became healthy; an initial frontend
connection reset during startup was followed by successful readiness checks.
Host Nginx syntax passed and hostname-validating local HTTPS checks returned:

- SARVA homepage and /api/health: 200.
- Anonymous /api/review/issues: 401.
- Anonymous /api/admin/users and /api/analytics/insights: 403.
- DS Lab homepage: 200.

The operator subsequently confirmed everything works, specifically Issues &
feedback, assignment, resolving, normal SARVA login and DS Lab. This records
operator-supplied production evidence, not an independently executed remote audit.

Post-release image cleanup is authorized but execution/verification is pending.
Retain the current running images and the latest pre-release rollback pair:

- sarva-backend:rollback-feedback-20261027-152120
- sarva-frontend:rollback-feedback-20261027-152120

Only older rollback tags in the sarva-backend and sarva-frontend repositories
are eligible for the planned removal. Never force-remove images, remove volumes,
or use docker system prune -a. Preserve DS Lab images, backup files and current
container images. Do not mark cleanup complete until removal and both-site
checks are reported by the operator.
