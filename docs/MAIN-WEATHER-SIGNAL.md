# Main homepage weather signal

Prepared and locally tested; production deployment and browser acceptance pending.

The main card remains in place but replaces the 0–100 combined score with the dominant weather signal and physical model values from that same forecast row. Rainfall uses mm/day, heat uses °C, wind uses km/h. If fire-weather dominates, the card shows the modelled temperature, wind and rainfall ingredients rather than inventing a physical fire probability. Missing measurements are explicitly unavailable. The separate fire-weather card remains unchanged.

Location, coordinates and forecast date stay attached to the selected row; do not substitute the maximum from another card/place/day. The main card opens the matching forecast map layer. Existing experimental notice and official SAWS link remain; password/passkey/session settings and DS Lab are unchanged.

Snapshot reads reject older payloads without the new physical measurements and refresh after SAST midnight. Snapshot rebuilding selects current/future forecast dates before selecting maxima. This refreshes only the homepage summary, not the forecast worker. No migration or deletion is required.

Validation: five backend forecast-presentation tests, four frontend card/date tests, 49 isolated password/passkey, analytics and review tests passed; frontend lint/build and backend/frontend Docker builds passed. Local API/browser confirmed Main weather signal: Rainfall, 73.2 mm/day, Mnquma EC, forecast 27 October 2026, with refresh time separate. This is a model estimate, not an official warning. Local DS Lab availability checked separately.

Deployment requires backend and frontend rebuilds. Preserve current images and configuration for rollback; no authentication changes or DS Lab restart.
