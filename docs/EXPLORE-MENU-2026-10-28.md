# Explore and menu update

Local review accepted 28 October 2026; production deployment pending.

Explore removes duplicate Atlas overview, All SARVA atlas apps and bottom DS Lab banner cards, removes Ocean Data Explorer and three placeholder questions, and makes the top DS Lab card open the configured DS Lab website in a new tab. The three primary entry cards fill their row.

Interactive atlases, tools and links replaces the old atlas-only section heading. NCCIS uses https://nccis.saeon.ac.za/ and is placed beside Free State Climate Information System (https://fsccis.saeon.ac.za/). Added BioEnergy Atlas (https://bea.saeon.ac.za/), SAEON Observations Monitor (/home on observationsmonitor.saeon.ac.za), SAEON Observations Database, uLwazi and the SAEON website using the operator-supplied URLs. The existing BioEnergy decision-support dashboard remains distinct. URLs were verified in the rendered cards; availability/content of every external service was not independently audited.

Useful theme shortcuts are consolidated into Explore by question. Finance, audit-related expenditure, crime, piped-water access and population use real raw indicator keys. The profiler honours those metric query parameters and selects the corresponding category instead of always defaulting to crime. Training/methods opens DS Lab directly. No model calculations or source data change.

Maps & Tools omits Ocean, renames SARVA Atlas Gallery to Atlases, tools and links and opens /explore#atlas-tools internally. NCCIS uses its current URL. Frontend normalisation applies to cached/database-backed and fallback menus; no navigation database mutation or migration is required.

Validation: 7 focused menu/deep-link/privacy tests, frontend lint and Docker production build passed. Browser verified finance and services categories/indicators, the menu jump, absent duplicate/placeholder cards, requested service URLs and direct DS Lab opening. Password/passkey/session settings, backend and DS Lab are unchanged.

Deploy frontend only after preserving its current image. Verify Explore, Maps & Tools, DS Lab card/training links, finance and piped-water question links, ordinary password/passkey browser sign-in, experimental/source notices and DS Lab. Record operator production acceptance and cleanup after checks pass.
