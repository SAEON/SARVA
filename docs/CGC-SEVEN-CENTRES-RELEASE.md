# Seven CGC institutions

Production accepted by the operator on 27 November 2026. PR #76 merged as e1a1d1529cd2ca874414f972c9602c952c8e0697.

Adds North-West University and the University of Venda to the original five centres, including centre cards, partner logos, homepage footer links, submission choices, filters and saved affiliations. Uses the requested official NWU purple acronym logo.

Builds on GalaletsangK's PR #72, head e77d4bbbc7a0216c7393c467d8fdb279ae3d68a9. That contribution is incorporated and credited here.

Migration 073 extends the saved-centre constraint without removing existing preferences. Centre choices do not grant roles. Authentication, notifications, review permissions and existing submissions retain their behavior.

Validation: 45 backend integration tests passed on the isolated synthetic database, including both new centres, preferences, draft/review/publication, access restrictions, notifications, issue replies and existing submissions. Targeted lint and frontend production build passed; homepage footer logos visually verified.

Deployment: retain database, CGC uploads, configuration and image backups. Apply migration 073 with the existing migration runner, update only the SARVA backend, then prepare and switch the SARVA frontend using the established blue-green deployment. Verify login, notifications, CGC submissions and affiliation choices in the browser, plus SARVA, WEF, Lab, tracker and spatial database health. Retain the latest rollback. No cleanup or other service replacement is included.

Migration 073 was confirmed applied. The SARVA backend was updated and the candidate frontend prepared; the operator subsequently confirmed the site working and the associated ticket resolved. Acceptance is operator-reported; final per-endpoint health output was not supplied in this chat. Existing recovery backups and latest frontend/backend rollback images are to be retained. Server cleanup is pending confirmation and is limited to unused build cache older than 24 hours, followed by unchanged-container, HTTP and PostGIS checks.

Branch review: four older deployment branches were verified patch-equivalent to main, and the seven-CGC feature branch was verified merged. Recovery references were saved locally before branch removal. Caroline's collaboration branch is retained. PR #72's contribution is superseded by the credited implementation in PR #76.
