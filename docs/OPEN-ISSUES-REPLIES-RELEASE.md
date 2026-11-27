# Open issues and unread replies badges

Release prepared 27 November 2026. Production rollout and browser acceptance are pending.

The administrator-only Open issues shortcut counts every non-deleted report whose status is Open, including earlier reports, and links to the Open filter. Reading a notification does not resolve an issue. In-review and resolved reports are excluded.

Unread replies shows the signed-in recipient's unread reply count. Existing issue and registration notices remain under Notifications. Opening a reply acknowledges only that notification and opens the matching reply. Counts refresh on navigation, window focus, the existing polling interval and review/reply changes on the current page.

Validation: 39 backend integration tests passed serially, including global workload counts, status changes, recipient restrictions, independent read state and existing CGC/issue workflows. Frontend build and targeted lint passed. Synthetic browser password sign-in succeeded for administrator and contributor accounts; earlier Open reports appeared, the shortcut applied the Open filter, and an administrator response produced an unread reply for the original contributor which cleared when acknowledged. Passkey authentication code is unchanged; live passkey validation remains pending.

No new migration or authentication configuration change is required. Migration 072 from the preceding analytics/notification release must already be applied. Back up and retain current application images, database, uploads and configuration; update only the SARVA backend, then prepare and switch its frontend using the established deployment process. Retain rollbacks and persistent volumes. No host routing, upload-limit, Lab, tracker, WEF or spatial-database change is required. No cleanup is part of this release.
