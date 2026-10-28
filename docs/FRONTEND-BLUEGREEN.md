# Frontend blue-green rollout

Prepared 28 October 2026. Production installation/first slot switch pending operator verification. Seven isolated Python tests cover config parsing, scoped rewrite, unready candidate, config drift, reload failure, HTTPS failure and rollback. These use mocked system/Docker calls: the full production Docker/Nginx path still requires the staged prepare and manual acceptance below.

Only for ULWSARVADSL01, /opt/sarva, host Nginx /etc/nginx/conf.d/sarva.conf and frontend loopback ports 8090/8091. Backend, database, authentication/session settings and DS Lab config are untouched. A lock prevents concurrent runs. Coordinate with other operators before deployment.

## Build and prepare

Pull the intended main commit and build frontend using the normal operator workflow. Building does not change the running service. Then run:

    sudo python3 scripts/deploy-frontend-bluegreen.py prepare

Prepare detects the active port in the host Nginx SARVA config, backs up that file and tags the active frontend image under /var/backups/sarva-frontend-bluegreen/<UTC timestamp> (not the older ~/sarva-backups convention). It starts/recreates only the inactive slot: Compose frontend sarva-frontend on 8090, or Compose one-off sarva-frontend-green on 8091 with restart unless-stopped. Never use --remove-orphans. It preserves the previous container's hashed assets in the replacement for open tabs/lazy loading, then checks homepage and proxied API health. Live Nginx routing remains unchanged during prepare. Failure leaves the active slot serving; investigate before switching.

Prepare does not build. Build first. It may replace the inactive container from an earlier deployment; the currently active image is tagged before any such action. It retains both live and previous slots after a successful switch. Do not prune either running slot or its rollback image.

Inspect the prepared port using an SSH tunnel and check Explore, normal/password passkey login if appropriate to its origin, source credits and asset loading. Passkey registration/authentication is bound to the public hostname: a different tunnel/localhost origin is not a valid passkey production test. Test real password/passkey flows at the public origin after switching; do not alter RP/origin settings for preview.

## Switch

    sudo python3 scripts/deploy-frontend-bluegreen.py switch
    sudo python3 scripts/deploy-frontend-bluegreen.py status

Switch refuses stale candidate/config state, checks the candidate again, changes only the single SARVA proxy_pass port, runs nginx -t and gracefully reloads host Nginx. It checks SARVA homepage/API and DS Lab through local HTTPS with the real hostnames. Failed checks restore the preceding Nginx configuration and reload it. If that recovery itself fails, resolve Nginx errors using the saved config; do not claim automatic recovery is guaranteed. Existing connections can drain during reload. This reduces frontend interruption; it does not promise zero downtime.

## Rollback

    sudo python3 scripts/deploy-frontend-bluegreen.py rollback

Requires the last switched config to be unchanged and the previous frontend to be healthy, then restores its routing. It does not stop either slot. The latest state is /var/lib/sarva-frontend-deploy/state.json, private to root.

## Future deployments

Use this workflow after adoption. Plain docker compose ps shows the canonical blue frontend, which may be standby; use script status to identify the active slot and docker ps to inspect both. Plain docker compose up frontend can interrupt traffic if blue is active, so do not use the old replacement step for routine frontend releases. Backend deployments remain separate: both frontend Nginx instances may need reloads after backend IP changes, and backend/database changes are not made disruption-free by this script. Retained static assets can increase disk use over repeated deployments; review asset retention separately rather than blindly pruning active slots. No permanent broad cleanup task is added.

## Deployment ribbon update

Once the ribbon component is deployed, use `sudo python3 scripts/deploy-frontend-bluegreen.py build` followed by prepare and switch so the ribbon is enabled before building. It clears after failed build/prepare, switch or rollback, or after a 45-minute marker expiry. `notice-on` / `notice-off` allow manual testing/recovery. See DEPLOYMENT-RIBBON-LOCAL.md for the first-rollout limitation and marker storage. This adds no fixed staging port or separate database.
