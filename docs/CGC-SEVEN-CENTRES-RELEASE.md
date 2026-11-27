# Seven CGC institutions

Release prepared 27 November 2026; production acceptance pending.

Adds North-West University and the University of Venda to the original five centres, including centre cards, partner logos, homepage footer links, submission choices, filters and saved affiliations. Uses the requested official NWU purple acronym logo.

Builds on GalaletsangK's PR #72, head e77d4bbbc7a0216c7393c467d8fdb279ae3d68a9. That contribution is incorporated and credited here.

Migration 073 extends the saved-centre constraint without removing existing preferences. Centre choices do not grant roles. Authentication, notifications, review permissions and existing submissions retain their behavior.

Validation: 45 backend integration tests passed on the isolated synthetic database, including both new centres, preferences, draft/review/publication, access restrictions, notifications, issue replies and existing submissions. Targeted lint and frontend production build passed; homepage footer logos visually verified.

Deployment: retain database, CGC uploads, configuration and image backups. Apply migration 073 with the existing migration runner, update only the SARVA backend, then prepare and switch the SARVA frontend using the established blue-green deployment. Verify login, notifications, CGC submissions and affiliation choices in the browser, plus SARVA, WEF, Lab, tracker and spatial database health. Retain the latest rollback. No cleanup or other service replacement is included.
