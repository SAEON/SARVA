# POST-only update actions

Resolve/review, report editing, assignment, user-role management and resource/policy/glossary editing use POST. No frontend PATCH requests or backend PATCH route registrations remain. GET remains read-only; existing DELETE operations are unchanged. Review uses POST /api/review/issues/:id/review; POST /api/review/issues/:id also invokes the same handler. The review shortcut still requires fix notes before the final Mark as resolved submission.

Admin permissions, current database roles, password confirmation for access changes, revision conflicts and transactional audit history are retained. Review connection and rollback failures now return JSON without exposing internal errors. No schema migration or auth configuration change.

Validation: 68 isolated backend tests passed, covering resolution/reopening and history, note requirements, permissions, conflicts, role-management protections and persisted resource/policy/glossary POST edits. A frontend regression guard rejects literal PATCH requests in app source. Lint and backend/frontend Docker builds passed. Local SARVA/DS Lab return 200 and passkeys remain enabled. Production acceptance pending.

Deployment requires backend and frontend; preserve rollback images/configuration, prepare the replacement frontend, then update backend and switch promptly. Old open clients will no longer be able to submit PATCH; they must load the new frontend (automatic idle refresh or manual refresh). Preserve unfinished form text before refreshing. Reload both frontend proxies after backend replacement. Verify public-route resolution and editing, password/passkey login and DS Lab.
