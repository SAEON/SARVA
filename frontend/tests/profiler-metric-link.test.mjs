import {test} from "node:test";
import assert from "node:assert/strict";
import {profilerMetricFromSearch} from "../src/config/profilerMetricLink.js";
test("question links select their specific raw indicator",()=>{
 for(const key of ["population_total","finance_operating_margin_pressure","governance_uifw_to_revenue","crime_murder","pct_piped_water_dwelling"])
  assert.equal(profilerMetricFromSearch(`?metric=indicator:${key}`),`indicator:${key}`);
});
test("missing and malformed metrics retain the existing default",()=>{
 for(const search of ["","?metric=", "?metric=indicator:bad%27;drop", "?metric=governance"])
  assert.equal(profilerMetricFromSearch(search),"indicator:crime_murder");
});
