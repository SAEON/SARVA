# Direct Explore navigation

Operator local review accepted 28 October 2026; production deployment pending.

Explore is a single top-level link to /explore, without a dropdown. Normalisation handles database-backed/cached and fallback navigation while leaving other groups and their items unchanged. This does not change the Explore page, profiler calculations, backend, authentication/session settings or DS Lab.

Validation: two menu tests passed, including immutable conversion of an old Explore dropdown; frontend lint and Docker production build passed. Browser confirmed Explore is a link and opens /explore directly. Deploy frontend only; no migration. Preserve the current frontend image before rollout and verify password/passkey login and DS Lab afterward.
