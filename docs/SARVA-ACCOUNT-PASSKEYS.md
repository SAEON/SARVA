# SARVA device passkeys: local candidate

Implemented locally on 27 October 2026. Not pushed or deployed. Password login
and DS Lab remain available. This replaces the earlier abandoned local passkey
experiment with a device-focused flow based on the current main branch.

## Account flow

Existing registered users sign in normally, open the account icon and choose
Passkey sign-in. New account registration offers the same page after success
when passkeys are enabled. No new account or role change is required. The page
is /account/passkeys, with Enable passkey, an optional device label, a list of
enabled credentials and password-confirmed removal. Adding a key requires the
existing SARVA account password; device PIN/biometrics never go to the server.

Logged-out Login has Sign in with a passkey independently of the password form;
it does not require typing an email. The user chooses an account in the device
prompt. Normal password login remains, including if setup is cancelled or a
device is unavailable. This does not add a password-reset email service or extend
normal session lifetime. Removing a passkey stops later use of that credential,
but does not revoke sessions that were already issued.

## Device preference and QR limitations

Registration requests authenticatorAttachment=platform, residentKey=required,
userVerification=required and client-device hints. A reported cross-platform
registration is rejected. Login uses discoverable credentials with required
user verification and client-device hints; it does not enumerate account keys.
The application provides no USB/security-key selection control. Browser/OS
prompts remain under the browser/OS's control; hints cannot guarantee that all
alternative methods are hidden. The attachment/transport metadata alone is not
a signed hardware attestation and must not be described as a hardware policy.

Saving on the current device or a syncing passkey manager permits later PIN,
fingerprint or face confirmation. A phone QR authentication alone does not save
a credential on the computer; repeated phone use may be required unless the
credential is synced or a separate current-device passkey is enrolled. Unsupported
devices keep password login. There is no silent automatic authentication or
server-side storage of biometric templates, device PINs or private keys.

## Security and configuration

SimpleWebAuthn server 14.0.3/browser 14.0.0 verify signatures, expected origin,
RP hash, user verification, challenge, user handle and counters. Migration 065
adds identities, credentials and database-backed challenges without modifying
account passwords. Random per-user handles are used instead of emails as IDs.
Five-minute, single-use challenges are bound to HttpOnly SameSite=Strict cookies,
Secure on HTTPS, the ceremony purpose, configured origin/RP and enrollment user.
Enrollment's final write rechecks active account and the ten-key cap under lock;
authentication locks the credential counter and active account, then reads fresh
roles for normal tokens. Removal is owner/password scoped and returns 404 for
another account's credential. Mutating endpoints require the exact Origin and
attempts are rate-limited. Public APIs never return stored public-key bytes.

Disabled by default. Future approved production configuration in private .env:

    PASSKEY_ORIGIN=https://sarva.saeon.ac.za
    PASSKEY_RP_ID=sarva.saeon.ac.za

Compose forwards these values to the backend. Explicit origin/RP are never
inferred from Host headers; production requires HTTPS. The local test uses
http://localhost:8095 with RP localhost, not 127.0.0.1. Local passkeys cannot log
into production; users must enable a separate passkey on the live hostname.

## Local verification

48 backend tests passed, including actual ES256/WebAuthn responses, invalid
signature/challenge/RP/origin rejection, mandatory UV, replay and expiry,
account binding, inactive accounts, ownership/password checks, current roles,
device options, disabled configuration, throttling and existing issue/analytics
regressions. Frontend lint/build passed. Both npm audits reported zero
vulnerabilities. Local SARVA health returned 200; full existing DS Lab smoke
checks passed, including legacy links and excluded Chordata 503.

Browser inspected the signed-in setup page with existing synthetic account and
no enrolled keys. Actual device enrollment, passkey sign-in, cancellation and
password fallback in the real browser remain pending human testing. Do not mark
hardware compatibility or production readiness accepted without that result.

The candidate containers serve localhost:8095 and use only the existing
synthetic local database. Private synthetic credentials are under
.local/analytics/credentials.json; no production credentials were copied.

Manual acceptance: open localhost:8095/account/passkeys in a normal supported
browser; sign in with the synthetic account; human completes password/device
confirmation and enrollment; sign out, use Sign in with a passkey and confirm
correct account/roles; then test password login and verify key removal blocks
new passkey login. Check ordinary issue/feedback access and DS Lab again.
Do not drive a personal PIN, biometric prompt or credential creation through
automation. No push, merge, production migration or cleanup is part of this task.

References:
https://simplewebauthn.dev/docs/packages/server
https://simplewebauthn.dev/docs/packages/browser
https://web.dev/articles/passkey-registration
https://developer.chrome.com/blog/passkeys-updates-chrome-129
