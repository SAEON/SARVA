import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleHomeForecasts, formatForecastDate, explainHomeForecast } from "../src/config/homeForecast.js";
test("homepage retains all dated forecast cards and excludes expired or invalid dates", () => {
 const values = ["environmental-risk", "fire-risk", "forecast-risk", "heat-risk", "wind-risk"].map(mapMode => ({mapMode, forecastDate:"2026-10-28"}));
 values.push({mapMode:"forecast-risk",forecastDate:"2026-10-27"}, {mapMode:"heat-risk"}, {mapMode:"heat-risk",forecastDate:"2026-02-30"});
 const before = JSON.stringify(values);
 assert.deepEqual(visibleHomeForecasts(values, new Date("2026-10-27T22:30:00Z")).map(x=>x.mapMode), ["environmental-risk","fire-risk","forecast-risk","heat-risk","wind-risk"]);
 assert.equal(JSON.stringify(values), before);
});
test("forecast dates have human readable day month and year", () => {
 assert.match(formatForecastDate("2026-10-28"), /28 October 2026/);
 assert.equal(formatForecastDate("2026-02-30"), "Date unavailable");
});

test("index cards retain scores and explain their meaning without probabilities", () => {
 const combined = explainHomeForecast({mapMode:"environmental-risk", value:"100/100 experimental index"});
 assert.equal(combined.value,"100 out of 100");
 assert.match(combined.explainer,/highest/);
 assert.match(combined.explainer,/not a 100% chance/);
 const fire = explainHomeForecast({mapMode:"fire-risk",value:"63.3/100 experimental index"});
 assert.equal(fire.value,"63.3 out of 100");
 assert.match(fire.explainer,/not a probability of fire/);
 assert.equal(explainHomeForecast({mapMode:"fire-risk",value:"Model index unavailable"}).value,"Score unavailable");
});
