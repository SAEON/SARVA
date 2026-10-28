# Resource and policy link verification (local)

The saved GBIF Occurrence Search and USGS EarthExplorer records were last checked on 15 July 2026. GBIF was labelled broken after HTTP 403; EarthExplorer had no HTTP status. These observations did not establish that either URL was gone.

The checker now confirms HEAD rejections/404/410 with GET, cancels response bodies rather than downloading documents, and only marks confirmed 404/410 responses broken. Successful final destinations are active or redirected. Other HTTP failures, automation restrictions, timeouts and TLS/DNS failures are stored as unchecked and displayed as Not verified. Redirects ending in errors are not labelled healthy. Existing database states are reused; no migration. Missing URLs remain Missing URL. Last checked means an attempted check, not guaranteed availability or content accuracy.

Local recheck on 28 October 2026: EarthExplorer returned HTTP 200 and is now active; GBIF returned HTTP 403 and is now Not verified, with current checked timestamps. The checker did not bypass the access restriction or force an active label. Production data is unchanged. Official references: https://www.usgs.gov/tools/earthexplorer and https://training.gbif.org/en/data-use/gbif-data-portal.

## Monthly schedule (prepared, not installed)

Units: deploy/systemd/sarva-library-links.service and .timer. The timer runs on the first day of each month at 02:00 SAST, with up to 15 minutes random delay. Persistent=true catches a missed run when the timer next starts. The service uses flock to prevent overlapping scheduled/manual service runs, invokes the existing production backend container without restarting services, and checks a snapshot of every active resource and policy (not only the first 100/250 records). Individual requests time out after 10 seconds; service maximum runtime is six hours. Errors updating records result in a failed CLI exit status; inconclusive remote HTTP checks remain Not verified. Logs are in the system journal.

Before installing, deploy backend/frontend, save appropriate database/config backups and perform a manual complete dry-run followed by a real run. Dry run: docker compose exec -T backend node scripts/check-library-links.js --complete --dry-run. Real run: docker compose exec -T backend node scripts/check-library-links.js --complete. Then install both unit files root-owned mode 0644 in /etc/systemd/system, run systemctl daemon-reload, validate on production and manually start the service before enabling the timer. Check journalctl -u sarva-library-links.service and systemctl list-timers sarva-library-links.timer. Weekly alternative: OnCalendar=Sun *-*-* 02:00:00 Africa/Johannesburg.

The calendar expression was validated locally. Full service dependency validation is pending production because this WSL environment does not have docker.service installed. No production schedule has been enabled.

## Validation

Mock HTTP tests cover 200, redirects, redirects to 404, HEAD fallback, 401/403/405/429/500/503, network failure and invalid schemes. An isolated database dry-run test verifies more than 250 candidates are included without status writes. Frontend lint and backend/frontend builds are checked locally; no authentication configuration or DS Lab changes.

## Production installation and acceptance, 28 October 2026

PR #49 merged as f9492e7aa73b4150a8f1ed0896504933d6d7c463. Backend/frontend images deployed; candidate prepared on 8090 while live remained on 8091, then switched to 8090. Backup: /var/backups/sarva-frontend-bluegreen/20261028-143427; frontend rollback: sarva-frontend:rollback-bluegreen-20261028-143427; candidate: fd0cfba23becd0f2d25707227a8eb9216b355e3d31e9f7c105b2b39708c56006. Production dry run found 98 candidates without writes. Units were installed and systemd-analyze verify passed on production.

Manual service run 16:35:28–16:38:02 SAST completed successfully: requested/checked/updated 98 (66 resources, 32 policies); 49 active, 20 redirected, 11 broken, 18 unchecked/Not verified, 0 missing, 0 errors. The operator then confirmed completion of the timer-enable and site-check procedure. Monthly checks are enabled for the first day at 02:00 SAST with up to 15 minutes jitter. No actual next-trigger timestamp output was supplied. This records installation/manual success, not proof of a future scheduled run. No separate production GBIF/EarthExplorer per-record or password/passkey browser result was supplied.

Both sites returned HTTP 200 in the supplied deployment output, and the final procedure included site checks. DS Lab was not redeployed. Cleanup completed, confirmed by the operator after the supplied procedure. Retained latest rollback pair: sarva-frontend:rollback-bluegreen-20261028-143427 (verified against previous frontend slot; image prefix 02276296f18f) and sarva-backend:rollback-library-links-20261028-163104 (image prefix 5f76709b2a82). Seven listed older/duplicate rollback tags were removed without force. Both frontend slots, current backend, DS Lab images, database/configuration backups, timer units and volumes were retained; build cache was not pruned. The procedure included rollback/container checks, Nginx validation, timer enabled/active checks and SARVA/DS Lab HTTP 200 checks; no separate final terminal output was supplied.
