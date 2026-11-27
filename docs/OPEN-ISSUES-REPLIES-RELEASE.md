# Open issues and unread replies badges

Deployed on 27 November 2026 through PR #74. The operator confirmed that the live update works.

The administrator-only Open issues shortcut counts every non-deleted report whose status is Open, including earlier reports, and links to the Open filter. Reading a notification does not resolve an issue. In-review and resolved reports are excluded.

Unread replies shows the signed-in recipient's unread reply count. Existing issue and registration notices remain under Notifications. Opening a reply acknowledges only that notification and opens the matching reply. Counts refresh on navigation, window focus, the existing polling interval and review/reply changes on the current page.

Validation: 39 backend integration tests passed serially, including global workload counts, status changes, recipient restrictions, independent read state and existing CGC/issue workflows. Frontend build and targeted lint passed. Synthetic browser password sign-in succeeded for administrator and contributor accounts; earlier Open reports appeared, the shortcut applied the Open filter, and an administrator response produced an unread reply for the original contributor which cleared when acknowledged. Passkey authentication code is unchanged; live passkey validation remains pending.

No new migration or authentication configuration change is required. Migration 072 from the preceding analytics/notification release must already be applied. Back up and retain current application images, database, uploads and configuration; update only the SARVA backend, then prepare and switch its frontend using the established deployment process. Retain rollbacks and persistent volumes. No host routing, upload-limit, Lab, tracker, WEF or spatial-database change is required. No cleanup is part of this release.

## Handover update - 27 November 2026

The operator confirmed successful live operation of the analytics/notification release and the open-issues/unread-replies follow-up. Database migration 072 was applied for the first release; the badge follow-up required no additional migration. Existing authentication configuration was checked before application replacement, and database/upload backups and application rollback images were retained.

GitHub branch housekeeping is complete: 68 deployment branches with tips confirmed as ancestors of main were removed using exact-tip checks. Six branches remain, preserving main, the collaborator branch and four branches not fully merged. Local working branches, tags and uncommitted work were retained; no unmerged branch was automatically merged or deleted.

Production server cleanup is pending operator execution and verification. Keep the latest rollbacks, database and upload backups, all persistent volumes, existing notifications, CGC work, Lab login, WEF services, the independent tracker database and the existing PostGIS recovery setup. Do not treat HTTP availability as a complete functional or spatial-database test.