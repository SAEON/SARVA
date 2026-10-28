# Compact forecast cards

Operator local review accepted 28 October 2026; production deployment pending.

The homepage separates Selected location weather outlook (all three physical values for one selected place/day) from Highest modelled values (independent maxima across available forecast locations/dates). Places and compact forecast dates appear above the values. The lower heading explains that places and dates differ. Group headings are accessible and absent groups are not rendered.

Compact spacing, short labels and a shared experimental warning reduce repeated text. Detailed per-card explanations remain in the fx calculation dialog. Shared source/limitations details and the official SAWS link remain. Each card retains its refresh time and map action. The selected location still comes from the same internal screening calculation; model data, numbers, cache selection and backend are unchanged. The separate fire-weather score is unchanged.

Validation: five existing frontend forecast tests passed; frontend lint and Docker production build passed. Browser review confirmed the distinct groups, compact cards, dates/locations and visible experimental/SAWS notice. Four privacy preference tests passed during the local preview build. Authentication/session settings and DS Lab configuration are unchanged. Local DS Lab root returned 200 and passkeys remain enabled.

Deploy frontend only after retaining the current frontend image. No migration, backend recreation or forecast-worker change. Production acceptance and cleanup must be recorded after operator verification.
