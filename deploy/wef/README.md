# WEF Nexus alongside SARVA

Source: https://github.com/MfopaC/WEF_Website (independent repository).
Clone to /opt/WEF_Website. Record the selected commit before deploying.
Run from /opt/sarva:

    sudo docker compose -p wef-nexus-production -f deploy/wef/compose.production.yml up --build -d

The website binds only 127.0.0.1:8188. Check that port is unused before the first deployment. No database, SARVA network, authentication or DS Lab dependency is needed.

Back up /etc/nginx/conf.d/sarva.conf, then include nginx-location.conf inside its HTTPS server block. Copy the snippet outside conf.d (for example /etc/nginx/sarva-wef-location.inc) so it is not loaded at HTTP scope. Validate nginx -t before graceful reload. /wef-nexus/ strips the prefix on the proxy hop; the source website uses relative local assets. Verify the homepage and assets through the public prefix before switching the SARVA frontend.

SARVA frontend defaults VITE_WEF_NEXUS_URL to /wef-nexus/. Local preview overrides it to http://localhost:8088/. Deploy the partners/menu/logo changes through the existing frontend blue-green process. Keep both frontend slots and rollback tags until browser acceptance. Do not rebuild backend, restart Docker, prune volumes or change password/passkey settings.

Rollback: restore the backed-up host configuration, validate and reload Nginx. Roll back the frontend via the blue-green script. Stop only the wef-nexus-production compose project if needed. Retain its source checkout for review.
