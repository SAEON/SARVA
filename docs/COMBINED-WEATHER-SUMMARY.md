# Combined risk homepage weather summary

Local implementation verified; production deployment pending.

The main card is titled Combined risk, as requested, and displays maximum temperature (°C), daily rainfall (mm/day) and maximum wind speed (km/h) together for the same selected forecast row, location and date. No combined numeric score or dominant-signal-only headline is shown. The existing internal screening calculation continues selecting the location/date; it is not a national summary or a new scientific combined risk assessment. The card explains it is an experimental weather summary, not an official warning or prediction of harm.

The date and refresh time remain separate; the experimental/SAWS notice remains. The main card opens the combined map layer. Other cards are unchanged, including the separate experimental fire-weather indicator. Missing individual values say Unavailable rather than zero; genuine zero/negative temperatures are preserved.

Validation: five backend forecast tests and five frontend card/date tests passed, frontend lint/build and backend/frontend Docker builds passed. Local browser confirmed Mnquma EC, 27 October 2026, maximum temperature 16.8 °C, daily rainfall 73.2 mm/day, maximum wind speed 21.7 km/h. Passkeys remain enabled; local DS Lab returns 200. No authentication/session settings, migrations or DS Lab changes.

Deploy backend and frontend only after preserving current images for rollback. Operator production and browser acceptance remain pending. This supersedes the main-signal-only presentation in PR #23, not the forecast calculations or historic data.
