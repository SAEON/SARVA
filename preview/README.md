# Private preview access

This is a separate local authentication gateway for review before any public
deployment. It does not change the running live server or SARVA user roles.

## Run in WSL Docker

Keep the existing SARVA analytics preview running on port 5174, then:

```bash
cd /mnt/c/Users/Marc/Documents/SAEON/SAEON_GitHub/sarva
bash scripts/start-preview-local.sh
python3 scripts/preview-credentials.py show
```

Open http://127.0.0.1:5180. A generated `dev` account is local-test-only; the
password is shown only when you explicitly run the show command in your own
terminal. No password is committed or included in the Docker image. The hash
is in the ignored `.local/preview-access/auth` directory; the generated login
note stays in its parent directory and is not mounted into the auth container.
The gateway and auth containers use the separate `sarva-preview-access`
Compose project; the database and existing app containers are unchanged.

To choose a different local username and password interactively:

```bash
python3 scripts/preview-credentials.py set
docker compose -f preview/compose.local.yml up -d --force-recreate preview-auth
```

Passwords are read without echo and stored as salted scrypt hashes. The set
command also supports `--local-short-password` for a 4–9 character test password.
Those credential files are marked local-only and refused in production mode.
The set
command removes the old generated-password note; remember the credentials you
choose. Restarting/recreating auth invalidates all preview sessions. The auth
directory is mounted read-only so replacing the hash file does not leave a
stale Docker file mount. Existing credentials are migrated without changing the password.

After login, use the **Dev preview · Access / sign out** link in SARVA to return
to the session page and end access. Sessions expire after two hours. The preview
login grants viewing access only; administrator tools still require SARVA's own
login. A cookie is used for the gate, preserving API Bearer authentication.

Stop the isolated gateway with:

```bash
docker compose -f preview/compose.local.yml down
```

## Protection and tests

Nginx auth_request checks every proxied request before forwarding pages, APIs,
assets, downloads, map tiles and WebSocket handshakes. Only the login page,
its CSS, logout endpoint and minimal session status endpoint are public.
Browser navigation redirects to login; API/asset requests receive 401. The
internal auth-check path is not publicly callable. Auth responses and protected
responses are no-store. Passwords, login bodies and session cookies are not
logged by the service. Do not enable request-body/header debug logging.

The auth service uses opaque random sessions stored in memory (hashed session
identifiers), expiry, server-side revocation, generic login errors, a bounded
ten-attempt/15-minute rate limit and exact Origin checks on login/logout. A
session cookie is HttpOnly, SameSite=Lax and host-only. Production defaults
require Secure cookies and configured HTTPS origins. HTTP mode is an explicit
local override restricted to loopback origins. Missing configuration fails
closed. Single-instance in-memory sessions deliberately reset after restart;
multiple auth replicas would require a shared session store.

```bash
docker compose -f preview/compose.local.yml exec -T preview-auth node --test security.test.mjs
python3 preview/check-local.py
```

The integration check reads the generated local credential note in memory and
prints only pass/fail results, never passwords or cookies. It tests blocked
anonymous pages/APIs/assets/tiles, wrong credentials, correct login, Origin
checks, app/API access, map tiles, SARVA admin separation, logout, replay and
forged cookies. Node tests cover password hashes, session expiry, rate limits,
secure-cookie defaults and unsafe HTTP production configuration. Existing
frontend checks remain applicable.

## Before exposing a preview to the internet

The local Compose file is **not a production deployment configuration**.

1. Obtain an approved preview DNS hostname, public routing and a valid TLS
   certificate from IT. The server's private IP is not a public DNS target.
2. Use the compiled SARVA frontend, not the Vite dev server. Route a dedicated
   hostname through host Nginx over HTTPS into the preview gateway. Avoid
   applying the gate to unrelated sites already hosted on this server.
3. Run auth with PREVIEW_LOCAL_HTTP unset/false and PREVIEW_ALLOWED_ORIGINS set
   to the exact HTTPS preview origin. Set a fresh production username/password
   interactively; never reuse the generated local credentials or Linux/DB keys.
4. Restrict every alternate SARVA app/API/tile port to localhost or private
   Docker networks. The existing local ports 5174, 5061 and 8090 remain available
   for local comparison here; they must not offer an unauthenticated public
   bypass in production. Check existing default/IP-based virtual hosts too.
5. Restrict the auth service to the gateway's private network. Configure any
   trusted real-client-IP handling explicitly at Nginx; never trust arbitrary
   internet-supplied forwarding headers. The current limiter safely shares a
   bucket where a reverse proxy presents one source address.
6. Preserve existing SARVA API Authorization headers and TLS forwarding. Do not
   add a second Basic Auth gate over Bearer-authenticated APIs. Test anonymous
   access against pages, APIs, static assets and sample tiles from outside the
   organisation, including alternate ports and hostnames.
7. Verify correct login, expiry, logout, SARVA admin login, maps and Data Health
   over HTTPS before inviting reviewers. Add HTTPS-only transport policy at
   the public ingress. Set a removal date and rotate shared credentials when
   membership changes. Individual reviewer accounts/organisation SSO are a
   later option when per-person revocation/auditing is needed.

This gate protects only traffic routed through it. Linked external services,
including a separately hosted Data Science Lab, need their own access policy.
No deployment, public exposure, Git push or DNS change is performed by the
local start command.

## Server test before DNS and HTTPS

Use compose.server-tunnel.yml to test the compiled server frontend through an SSH tunnel. It binds only 127.0.0.1:5180 on the server and accepts only loopback browser origins. It does not protect or change the existing public port 80/8090 site. Do not publish port 5180 externally.

On the server, create a separate credential (do not copy the local credential file):

```sh
cd /opt/sarva
python3 scripts/preview-credentials.py set
sudo docker compose -f preview/compose.server-tunnel.yml up -d
sudo docker compose -f preview/compose.server-tunnel.yml exec -T preview-gateway nginx -t
```

On your workstation, stop the local preview gateway first if it occupies port 5180, then run:

```sh
ssh -N -L 5180:127.0.0.1:5180 marc@192.168.115.77
```

Then open http://127.0.0.1:5180. DNS, a certificate, HTTPS cookies, and closing all direct SARVA access paths are still required before internet hosting. Preserve the shared host Nginx routes for other applications.

## Internal server landing page

compose.server-internal.yml explicitly permits http://192.168.115.77 with full-length credentials. This is for the trusted internal network only: HTTP does not encrypt passwords or cookies. It cannot use local short-password credentials. Keep the gateway on loopback, route only the host Nginx SARVA root to 5180, and bind the original frontend port 8090 to loopback to prevent bypass. Preserve other host Nginx application locations. For public internet hosting use HTTPS mode and Secure cookies instead.
