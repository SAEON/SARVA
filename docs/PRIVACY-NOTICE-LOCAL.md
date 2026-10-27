# SARVA privacy notice local review

Status: locally accepted 27 October 2026; publication as an under-review notice requested. Production deployment pending. This is not approved as a final legal notice.

Sources checked: NRF Privacy Policy (https://www.nrf.ac.za/privacy-policy/), NRF PAIA Information (https://www.nrf.ac.za/paia-information/), and Information Regulator complaints (https://inforegulator.org.za/complaints/). NRF's published general notice email is info@nrf.ac.za, postal address NRF, PO Box 2600, Pretoria 0001. The PAIA page links Information Officer/deputy details; do not copy names from an older manual as current appointments without verification. The public policy did not establish a SARVA-specific retention schedule.

The /privacy page explains accounts, passkey public-key metadata, signed-in analytics, keyed IP identifiers, approximate location, browser storage, feedback/history, infrastructure logs and external services. The homepage introduction, registration/login, passkey setup, feedback and footer link to it. No blanket consent checkbox or change to login/registration requirements is introduced.

Optional browser analytics can be disabled without touching the sign-in token, passkeys, roles or planning drafts. A local browser preference disables future events and flushes, clears analytics session labels and is respected across tabs. DNT/GPC override an allow choice. The analytics endpoint also returns 204 without recording requests with either privacy signal. Existing records, necessary service metrics/security logs and third-party requests are separate. The choice is not a deletion request or cross-device account preference. Clearing local storage loses the preference.

## Decisions required for final approval

- Responsible officer to confirm the applicable processing grounds and scope; this draft does not assume that all processing requires or is justified by consent.
- Confirm a dedicated SAEON/SARVA privacy contact and the responsible party address/contact particulars for the collection notice; the general NRF notice route is not asserted to be a dedicated privacy mailbox.
- Approve and implement retention/deletion rules for identifiable analytics, accounts, review history, security logs and backups. Current application code has no automatic deletion schedule for those records. Token expiry is not data retention.
- Inventory actual hosting, operators, map/image providers and contribution-form recipients, onward metadata publication and international processing, and confirm applicable POPIA section 72 arrangements with the Information Officer. No unsupported no-sharing/no-transfer promise is made.
- Clarify privacy notices on the linked Google Form and contribution services separately. Adding a SARVA page does not amend external forms or establish permission to publish third-party contact details.
- Decide whether identifiable usage is necessary, reduce retention and access accordingly, and review the default analytics setting with the responsible officer. The new control preserves the current default while providing a real opt-out; it is not itself a legal-basis assessment.

No backend schema, password/passkey/session settings, authentication secret or DS Lab configuration is changed. Test locally before any production approval.

## Release and production validation

The public page retains a clear review-in-progress status and states unresolved policy items; remove no such qualifications without confirmation. An additional link beside the homepage introduction makes privacy choices discoverable without scrolling to the footer. Publication is not a legal-compliance certification.

Local validation: four frontend privacy tests and 49 isolated backend authentication, analytics and review tests passed. The analytics opt-out persists after reload and does not alter authentication storage. DNT/GPC requests return 204 without storing optional events. Frontend lint/build and local DS Lab smoke checks passed. Existing account, password and passkey behaviour is unchanged.

Back up database, configuration and backend/frontend images before production rollout. No migration or retention purge is included. Build and recreate only SARVA backend/frontend with --no-deps, retaining current secrets and passkey settings. Verify the homepage privacy link, /privacy, registration disclosure, opt-out persistence, existing login methods and DS Lab. Preserve rollback images until browser acceptance. No data deletion, separate analytics consent flow or provider/retention policy has been authorised or implemented by this release.
