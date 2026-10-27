import {test} from "node:test";
import assert from "node:assert/strict";
import {presentHomeForecast,FORECAST_METADATA} from "../src/services/forecastPresentation.js";
test("old cached highlights cannot restore warning-like ratings",()=>{
 const cached={highlights:[{mapMode:"forecast-risk",value:"56 mm/day",detail:"Very high rain/flood screening signal",severity:"Very high",location:"Example municipality",forecastDate:"2026-10-27"},{mapMode:"fire-risk",value:"High",detail:"Heat and wind, 76.3/100",severity:"High"},{mapMode:"environmental-risk",value:"Minimal",detail:"rain signal, 0/100"}]};
 const before=JSON.stringify(cached);const result=presentHomeForecast(cached);
 assert.equal(JSON.stringify(cached),before);assert.equal(result.experimental,true);assert.equal(result.officialWarning,false);
 assert.equal(result.highlights[0].value,"56 mm/day");assert.equal(result.highlights[1].value,"76.3/100 experimental index");assert.ok(result.highlights[2].measurements.every(m=>m.value === "Unavailable"));
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

test("combined summary uses all measurements from the same selected row", () => {
 const row={mapMode:"environmental-risk",dominantHazard:"Rain / flood proxy",weatherValues:{rainfallMm:73.2,temperatureMaxC:28,windMaxKmh:12},forecastDate:"2026-10-28",location:"Mnquma",latitude:-32,longitude:28};
 const before=JSON.stringify(row);
 const result=presentHomeForecast({highlights:[row,{mapMode:"forecast-risk",value:"150 mm/day",location:"Different place"}]}).highlights[0];
 assert.equal(JSON.stringify(row),before);
 assert.equal(result.label,"Combined risk");
 assert.deepEqual(result.measurements.map(m=>m.value),["28 °C","73.2 mm/day","12 km/h"]);
 assert.equal(result.location,"Mnquma");assert.equal(result.forecastDate,"2026-10-28");
 assert.equal(result.mapMode,"environmental-risk");
 assert.equal(result.combinedWeatherSummary,true);assert.equal(result.officialWarning,false);
 assert.ok(!/out of 100|\/100/.test(result.value));
});
test("combined summary retains zero and negative values and labels missing data",()=>{
 const make=weatherValues=>presentHomeForecast({highlights:[{mapMode:"environmental-risk",weatherValues}]}).highlights[0];
 assert.deepEqual(make({temperatureMaxC:-2,windMaxKmh:0,rainfallMm:0}).measurements.map(m=>m.value),["-2 °C","0 mm/day","0 km/h"]);
 assert.deepEqual(make({temperatureMaxC:null,rainfallMm:"",windMaxKmh:"invalid"}).measurements.map(m=>m.value),["Unavailable","Unavailable","Unavailable"]);
 assert.ok(make(undefined).measurements.every(m=>m.value === "Unavailable"));
});
