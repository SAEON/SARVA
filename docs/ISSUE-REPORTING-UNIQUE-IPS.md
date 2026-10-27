# Issue reporting and unique-IP analytics: local review

Prepared locally on 27 October 2026. Not yet pushed or deployed to production.

## Issue reporting

The affected page is optional: omitted, null, empty and whitespace-only values
are stored as an empty path. Reporters may enter a relative path without a
leading slash or paste a SARVA URL. The server strips queries and fragments;
external hosts, embedded credentials, unsafe schemes and invalid paths are
rejected. The existing 201-character stored-path limit is retained.

The shared footer includes Report an issue with this page. It opens the report
form with the current pathname filled in, without carrying query strings or
fragments. It works with the home page's own footer as well as shared layouts.
The title and description give card/button examples. Sign-in and issue ownership
rules remain in force, including generic Admin reply names for non-admins.

## Unique IP addresses

Migration 061 adds nullable visitor_ip_hash and an index. New browser events get
a domain-separated HMAC-SHA256 identifier derived from Express's trusted client
address and AUTH_SECRET (DB_PASSWORD fallback). No raw address or hash is returned
in reports. No identifier is recorded if a secret/address is unavailable. IPv4
mapped IPv6 and equivalent IPv6 spellings normalize to the same identifier.

Summary and audience-explorer totals count distinct hashes on page events only,
within their existing dates/filters. CSV exports include those totals. Both
views show missing-identifier page-view coverage; summary also gives the earliest
counted visit within the selected dates. Historical events cannot be backfilled.

This measures network addresses, not people. Shared networks and VPNs merge
visitors; changing addresses can count one person more than once. Private
addresses are counted but have no geographic location. Trusted proxy settings
must continue to identify clients correctly. Rotating the authentication secret
changes identifiers. Existing privacy-signal opt-outs still apply.

## Validation

- 25 isolated backend tests passed, covering issue permissions, blank/omitted
  paths, URL normalization, rejected external/unsafe URLs, HMAC normalization,
  deduplication, missing historical identifiers and administrator-only analytics.
- Frontend lint and production builds passed. Existing large bundle warning
  remains; no dependency change was needed.
- Browser: footer report action populated / from Home; a synthetic report with
  blank affected page submitted successfully; unique-IP totals and historical
  coverage appeared in both local analytics views.

Review at http://localhost:8095/testing and http://localhost:8095/analytics using
the existing synthetic local account. Production and DS Lab were not changed.

Deployment requires a normal database/config/image rollback backup, backend and
frontend builds, applying migration 061 before starting the new backend, and
recreating those two SARVA services. Host Nginx and DS Lab need no change. Verify
normal sign-in, report creation with blank and pasted page values, analytics
admin access, anonymous rejection and both sites before any image cleanup.
