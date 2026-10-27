# Homepage forecast dates and score explanations

Prepared for production; operator deployment and browser acceptance pending.

Both index cards remain. The combined score is explained as the highest rain, heat, wind or fire-weather score; 100 is the top of the model scale, not a 100% chance of harm or an official warning. Fire-weather wording explains the heat/wind/dryness scale and is not an official fire-danger rating. Existing model values and calculations are unchanged.

All five homepage cards show a prominent forecast date (SAST), separate from the cached data refresh time. Expired, undated and invalid-date highlights are excluded from the homepage; underlying historical/map data is unchanged. Existing experimental wording and official SAWS warnings link remain.

Validation: three frontend tests cover SAST midnight, expired/missing/invalid dates, retained index cards, score text and input immutability. Frontend lint and production build pass. No backend, schema, authentication, passkey, session or DS Lab changes. Deploy frontend only after preserving its current image for rollback.
