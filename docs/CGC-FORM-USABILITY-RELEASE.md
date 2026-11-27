# CGC submission and issue-report form improvements

Deployed on 27 November 2026 through PR #75. The operator supplied a live screenshot showing the new source-link wording and guidance.

The affected-page field previously invited plain page names but rejected names containing spaces. The local reproduction failed for Partners and collaboration and succeeded for the corresponding path/URL. Reporting now accepts known page names as SARVA paths and retains other page names as reporter-supplied description context. It does not invent links. Unsafe protocols, external URLs and invalid content remain rejected.

The CGC report link and account-menu report shortcut capture the source page. The editable page field is under Page details (optional). Validation errors retain entered values and explain how to correct them.

The submission source field is now Link to your work (optional if uploading a file), with a full-link example and inline guidance. Plain text is checked before saving, without clearing title, description, centre, selected file or the entered link. Users may correct the link or leave it blank and upload a file. Existing draft, review, publication and notification permissions remain unchanged.

Validation: 42 serial backend integration tests and two link-validation tests passed, covering CGC-admin reporting, context preservation, rejected-edit rollback, correction and existing submissions/notifications. Targeted lint and production frontend build passed. Browser checks confirmed automatic source-page capture, optional page details, preservation after errors, corrected draft save and corrected issue creation. The corresponding live report has not been changed or marked resolved.

No new database migration, host-routing, upload-limit or authentication configuration change is required. Use the established database/upload/configuration backup and rollback-image process, update only the SARVA backend, then prepare and switch its frontend. Keep existing notifications, application images and persistent volumes. Lab, tracker, WEF and spatial-database services are outside this change scope. Live login and form checks remain part of production acceptance. No cleanup is part of this release.

## Production handover - 27 November 2026

The operator verified a readable full database archive and CGC upload backup before application replacement. Current backend/frontend rollback images and configuration backups were retained. Builds completed with running containers unchanged before activation. The updated frontend was prepared through the established frontend switch process; the subsequent live screenshot showed the new field label and help text.

No new migration was required. Existing authentication settings, submissions and notification data remain outside the intended change scope; Lab, WEF, the independent tracker database and PostGIS services were not targeted. Full live error-correction, submission and reply-notification checks have not been separately evidenced beyond the supplied screenshot and local validation.

A reply and resolution note were drafted for issue 44. Saving that reply and marking the ticket resolved have not been independently confirmed, so this handover does not claim the live ticket was closed.

Conservative server cleanup completed on 27 November 2026, confirmed by operator output. The old-build-cache prune reclaimed 0 B; no eligible cache remained. Running container names and IDs were unchanged. Latest frontend and pre-update backend rollback images were successfully inspected. All application images, persistent volumes, databases, uploads and backups were retained.
### Post-cleanup verification

All seven availability checks returned HTTP 200: SARVA home, SARVA API health, public CGC work, WEF Nexus, Environmental Data & Research Lab home, Lab API health and the El Niño tracker. The Lab database returned PostGIS library version 3.6.4. Existing login configuration, notification data, CGC submissions and uploads, the independent tracker database and the PostGIS recovery setup remain retained. These checks establish availability and extension presence, not a fresh end-to-end login or notification test.

The merged PR #75 release branch was removed after confirming its exact tip was included in main. Unmerged branches and local work remain preserved. No live issue status was changed as part of this documentation or cleanup work.