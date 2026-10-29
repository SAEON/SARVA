# CGC work showcase (local implementation)

Public page: /partners/centres-for-global-change. API: /api/cgc/work.
Migrations 066 and 067 create submissions/review events and eight verified publisher/repository links. Seven records are papers or conference abstracts and one is a repository collection; none is an invented dataset download. Centre links are based on explicit affiliation evidence, including former RVSC/RVAC names. Original files are not mirrored.

Accounts with cgc-user, cgc-admin or the normal SARVA admin role can propose work for one or more centres. Only normal SARVA admins can assign these roles through Users & roles. CGC admins manage CGC work only and cannot access general user administration or analytics. Centre association is a contributor claim checked during admin review, not an automatic institutional authorisation. New items and all edits/file replacements are pending. CGC admins and normal SARVA admins can publish, request changes or archive with notes. Optimistic revisions prevent overwriting simultaneous changes. Review history is available to owner/admin and excludes admin identity from the public response.

One file per submission, maximum 8 MiB: PDF, UTF-8 CSV/TXT/JSON/GeoJSON, PNG or JPEG. Signature/encoding/JSON checks are performed; these are not a malware scan. Reviewers must inspect the file and sharing rights before publication. HTML, SVG, executables, archives and Office documents are not accepted. Large datasets should be hosted in a research repository and linked. Hosted files require reuse permission/licence metadata before approval. File downloads are attachments with nosniff and sandbox headers, and pending/archived files cannot be downloaded anonymously.

Metadata is in PostgreSQL; file bytes are stored under CGC_UPLOAD_DIR (default /app/uploads/cgc). Production compose defines cgc_uploads mounted there. This volume must be backed up along with the database before deployment or cleanup; never prune it. Local candidate uses sarva-cgc-local-uploads, separate from production. No production deployment or changes are authorised by these local tests alone.

The frontend Nginx limit is 10 MiB and backend accepts up to 8 MiB. The existing host production limit is 10 MiB; validate it before deployment. All mutations use POST; reads use GET. Source URLs are validated but are never fetched by the backend. Application auth, password/passkey settings and DS Lab are unchanged.

Local review accounts use example.invalid addresses only; credentials are stored outside Git in .local/cgc-demo.json. Tests run only with CGC_TEST=synthetic-only against the existing isolated test database. User/audit mutations are transactional. File writes are removed if metadata/audit commit fails. File replacements remove the previous stored file after successful commit; a process crash can leave an unreferenced file requiring later reconciliation. Archived work retains its file and audit history.

Migration 068 adds CGC roles; 069 simplifies curated work descriptions without changing verified centre associations. The collection starts collapsed with its published count and an explicit expand/collapse button.

Production deployment and cleanup were operator-confirmed on 29 October 2026 following PR #55. Persistent upload storage and eight public works were verified. Latest retained rollback pair: sarva-frontend:rollback-bluegreen-20261029-125355 and sarva-backend:rollback-cgc-showcase-20261029-145037. See DEPLOYMENT-2026-10-22.md for acceptance evidence and backup paths.
