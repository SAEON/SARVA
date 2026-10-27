import {test} from "node:test";
import assert from "node:assert/strict";
import {presentHomeForecast,FORECAST_METADATA} from "../src/services/forecastPresentation.js";
test("old cached highlights cannot restore warning-like ratings",()=>{
 const cached={highlights:[{mapMode:"forecast-risk",value:"56 mm/day",detail:"Very high rain/flood screening signal",severity:"Very high",location:"Example municipality",forecastDate:"2026-10-27"},{mapMode:"fire-risk",value:"High",detail:"Heat and wind, 76.3/100",severity:"High"},{mapMode:"environmental-risk",value:"Minimal",detail:"rain signal, 0/100"}]};
 const before=JSON.stringify(cached);const result=presentHomeForecast(cached);
 assert.equal(JSON.stringify(cached),before);assert.equal(result.experimental,true);assert.equal(result.officialWarning,false);
 assert.equal(result.highlights[0].value,"56 mm/day");assert.equal(result.highlights[1].value,"76.3/100 experimental index");assert.equal(result.highlights[2].value,"0/100 experimental index");
 assert.ok(result.highlights.every(h=>h.severity==="Experimental"&&h.tag==="Experimental"&&h.officialWarning===false));
 assert.ok(!/Very high|rain\/flood screening signal/.test(JSON.stringify(result.highlights)));
 assert.match(result.notice,/A low model value does not mean conditions are safe/);
 assert.equal(result.highlights[0].location,"Example municipality");assert.equal(result.highlights[0].forecastDate,"2026-10-27");
});
test("missing cached indices are unavailable rather than a reassuring zero",()=>{
 const data=presentHomeForecast({highlights:[{mapMode:"fire-risk",value:null,detail:"No value"}]});
 assert.equal(data.highlights[0].value,"Model index unavailable");
 const missing=presentHomeForecast({highlights:[{mapMode:"fire-risk",value:"--",detail:"No data, 0/100"}]});
 assert.equal(missing.highlights[0].value,"Model index unavailable");
});
test("metadata points to official SAWS warnings and explains derivative use",()=>{
 assert.equal(FORECAST_METADATA.officialWarningsUrl,"https://www.weathersa.co.za/warnings");
 assert.equal(FORECAST_METADATA.licence,"CC BY 4.0");assert.equal(FORECAST_METADATA.officialWarning,false);
 assert.match(FORECAST_METADATA.notice,/not an official fire-danger rating/);
 assert.match(FORECAST_METADATA.notice,/not official forecasts, warnings or emergency advice/);
});
