# Simplified SARVA privacy notice

Deployed and operator-accepted on production 28 October 2026 via PR #25 (merge ca1fdad6). All deployment checks passed; the notice, password login, passkey login and DS Lab were confirmed working. Frontend rollback cleanup remains pending.

Short overview sections replace the dense table. Expandable sections retain the accurate disclosures about accounts/password hashes, optional passkeys, account-linked/pseudonymous analytics, logs, feedback history, retention limitations, external services and request routes. SAEON general enquiry contact (enquiries@saeon.ac.za, +27 (12) 534 3504) is attributed to the Catalogue privacy policy, not represented as a dedicated privacy office. The notice remains under review.

How we use analytics explains purpose and data first. Manage your analytics preference is a collapsed, accessible native disclosure. The control remains available; default analytics behavior, DNT/GPC and existing preferences are unchanged. No new consent assertion or removal of opt-out. Browser interaction confirmed expand/collapse, toggle and preference persistence; original local preference restored after testing.

Validation: four frontend privacy tests, frontend lint and Docker production build passed. 49 isolated password/passkey, analytics and feedback tests passed, including assignment/unassignment and access-control checks. DS Lab local root returned 200; passkeys remain enabled. This is a frontend-only release: no database migration, authentication/session setting change or DS Lab update.

Separate live issue: the operator subsequently confirmed Save assignment works again. Existing assignment tests also pass locally. No assignment code fix was included, and the cause of the transient HTML response was not established.
