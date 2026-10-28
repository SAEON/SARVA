# Municipal Planning Workspace removal

Deployed and operator-accepted on production 28 October 2026 via PR #27 (merge 14e56f6). All deployment checks passed; workspace removal, password login, passkey login and DS Lab were confirmed working. Rollback cleanup is complete, operator-confirmed on 28 October 2026. All post-cleanup checks passed; workspace removal, password/passkey login and DS Lab remain working.

Removed Municipal Planning Workspace from fallback navigation, database-backed navigation responses, Explore cards/links and the standalone boundary viewer's return link. The application no longer lazy-loads/routes to the workspace; its former URL redirects to /explore. The Municipal Risk Profiler, standalone MDB boundary viewer, accessibility tools, password/passkey login and DS Lab remain available. Privacy text now describes previously saved browser planning drafts rather than an active workspace.

No records, browser drafts or historical analytics are deleted. Original unused workspace source and styles remain for recoverability but are not routed into the application. No schema migration is required. This is not a deletion of the Municipal Risk Profiler or underlying municipal data.

Validation: frontend lint and backend/frontend Docker production builds passed. Browser verified old URL redirects to /explore and workspace menu/Explore entry points are absent. Navigation API check passed; local DS Lab returned 200 and passkeys remain enabled. Authentication/session code and settings are unchanged.

Deploy backend and frontend only after preserving both current images. Verify navigation, old URL redirect, Municipal Risk Profiler, standalone boundary viewer, privacy page, password/passkey browser login and DS Lab. Production acceptance and cleanup were confirmed by the operator on 28 October 2026.

Production acceptance is operator-reported. No schema migration or data deletion was performed; the latest workspace-removal backend/frontend rollback pair was verified and retained through cleanup, alongside current running images. Older SARVA rollback tags were removed. Databases, volumes, backups, build cache and DS Lab images/services were preserved. The exact rollback timestamp was not supplied in chat; recovery should use the verified server-side backup manifest.
