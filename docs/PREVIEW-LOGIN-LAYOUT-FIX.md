# Preview control / SARVA login overlap, 23 October 2026

Status: deployed as release `34db7be` (PR #6), with operator browser
acceptance confirmed on 23 October 2026.

The header's backdrop-filter creates a containing block for fixed descendants.
PreviewAccess was rendered inside it, so bottom/right positioning placed the
preview link over the SARVA Login button. Render the same link through a React
portal into document.body, retaining its existing bottom-right viewport CSS.
Preview login checks, credentials, cookie handling, URLs and authorization are
unchanged. This patch changes only the compiled frontend's rendering location.

Validation: full frontend lint and production Docker build passed. Isolated
loopback test at port 8093 used an explicit authenticated-status visual fixture
to render the preview control, not real preview sign-in. Browser confirmed its
parent is BODY, its bounds do not intersect the Login button, and the SARVA login
panel opens. Actual production preview sign-in remains an operator acceptance
step. No production services or unfinished essential-variable feature files were
modified during local validation.

## Production rollout

Use /opt/sarva, a clean main checkout, its existing private .env and the active
preview/compose.production.yml gateway. Before pulling, save the current commit,
tag the running frontend image for rollback, and back up the existing frontend
Nginx/Compose files. Do not copy local status fixtures or start commands into
production. Build frontend only, recreate frontend with --no-deps --wait, then
recreate preview-gateway to refresh the frontend's Docker address. Leave
preview-auth and its private credential files running/unchanged; do not reset
credentials. Leave host Nginx and all DS Lab services unchanged.

Verify SARVA direct frontend API 200, HTTPS preview page 200 and anonymous API
401; verify DS Lab root/API 200 and its old /ds-lab/ redirect. In the browser,
sign into preview as needed, confirm the control is bottom-right and SARVA Login
opens without overlap. Preserve images and backups until acceptance. Rollback
uses the previous frontend image via an image override and a preview-gateway
refresh; no database restore or volume removal is required.

## Production deployment and cleanup status

Operator saved rollback under
`/home/marc/sarva-backups/before-preview-layout-20261023-152858`, containing
the previous commit, frontend image tag and private configuration archive.
The previous frontend image was tagged
`sarva-frontend:before-preview-layout-20261023-152858`.
Server-specific untracked `preview/compose.production.yml` was retained.

After the frontend update and preview-gateway refresh, the operator confirmed
the preview control is bottom-right, SARVA login works and DS Lab still works.
Preview-auth/credentials and DS Lab services were not part of the instructed
restart. Fresh per-endpoint terminal status output was not supplied for this
acceptance; do not infer additional production checks from browser confirmation.

Older-image cleanup completed on 23 October 2026, as confirmed by the operator,
who reports everything is still working afterwards. The instructed scope was
`docker image prune --filter "until=24h"` (eligible dangling images only), with
the tagged rollback image and database/content/configuration backups designated
for retention. No image inventory, prune transcript or reclaimed-space total was
supplied; retention and endpoint results were not independently re-inspected.
No container, volume or broad `-a` image pruning was part of the instructions.

Status: preview layout fix deployment and subsequent cleanup complete on the
operator's confirmation. Catalogue connectivity and wider migration/network
acceptance remain separate outstanding checks; this does not close those items.
