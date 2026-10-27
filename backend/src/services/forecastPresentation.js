export const FORECAST_NOTICE = "Experimental model outputs for research and exploration. SARVA interprets ECMWF model data; these outputs are not official forecasts, warnings or emergency advice. Rainfall does not establish flood risk. The fire-weather indicator is not an official fire-danger rating. A low model value does not mean conditions are safe. Check SAWS warnings and local authorities before acting.";
export const OFFICIAL_WARNINGS_URL = "https://www.weathersa.co.za/warnings";
export const FORECAST_LICENCE = "CC BY 4.0";
export const FORECAST_ATTRIBUTION = "Based on data and products of the European Centre for Medium-Range Weather Forecasts (ECMWF). © ECMWF. Licensed under CC BY 4.0. SARVA caches and aggregates model fields and derives experimental indices; these changes are SARVA analysis and do not imply ECMWF or SAWS endorsement. ECMWF provides data without warranty and disclaims liability for errors, availability and loss arising from use. See ECMWF terms.";
export const FORECAST_METADATA = Object.freeze({ experimental: true, officialWarning: false, notice: FORECAST_NOTICE, officialWarningsUrl: OFFICIAL_WARNINGS_URL, licence: FORECAST_LICENCE, licenceUrl: "https://creativecommons.org/licenses/by/4.0/", termsUrl: "https://www.ecmwf.int/en/forecasts/datasets/open-data" });

// Normalize old cached headlines at response time; cache content must not restore warning-like wording.
export function presentHomeForecast(payload) {
 const labels = {
  "environmental-risk": ["Experimental combined model index", "SARVA-derived index, not a probability of harm or an official warning."],
  "forecast-risk": ["Modelled daily rainfall", "ECMWF rainfall estimate, not a flood assessment or warning."],
  "heat-risk": ["Modelled maximum temperature", "ECMWF temperature estimate, not a heat warning."],
  "wind-risk": ["Modelled maximum wind speed", "ECMWF wind estimate, not a wind warning."],
  "fire-risk": ["Experimental fire-weather indicator", "SARVA heat, wind and dryness indicator, not an official fire-danger rating."]
 };
 return { ...payload, ...FORECAST_METADATA, attribution: FORECAST_ATTRIBUTION,
  title: "Experimental weather model outputs",
  summary: "Cached model estimates and SARVA-derived experimental indices. Check forecast dates and official SAWS warnings.",
  highlights: (payload.highlights || []).map(item => {
   if (item.mapMode === "environmental-risk") return presentMainWeatherSignal(item);
   const info=labels[item.mapMode]; if(!info) return item;
   const isIndex=["environmental-risk","fire-risk"].includes(item.mapMode);
   const match=String(item.detail || "").match(/(\d+(?:\.\d+)?)\s*\/100/);
   const hasValue=item.value != null && !["", "--"].includes(String(item.value).trim());
   const value=isIndex ? (match && hasValue ? `${match[1]}/100 experimental index` : "Model index unavailable") : item.value;
   return { ...item, experimental:true, officialWarning:false, label:info[0], value,
    tag:"Experimental", severity:"Experimental", severityKey:"experimental", explainer:info[1],
    detail:[item.location,item.forecastDate].filter(Boolean).join(" | "),
    source:"ECMWF model data · SARVA interpretation" };
  }) };
}

// Use measurements from the selected overall row, never another card's maximum.
export function presentMainWeatherSignal(item) {
 const fields = item.weatherValues || {};
 const number = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
  ? new Intl.NumberFormat("en-GB", {maximumFractionDigits:1}).format(Number(value)) : null;
 const measurements = [
  {label:"Maximum temperature", value:number(fields.temperatureMaxC), unit:"°C"},
  {label:"Daily rainfall", value:number(fields.rainfallMm), unit:"mm/day"},
  {label:"Maximum wind speed", value:number(fields.windMaxKmh), unit:"km/h"},
 ].map(measurement => ({...measurement, value:measurement.value === null ? "Unavailable" : `${measurement.value} ${measurement.unit}`}));
 return { ...item, mainWeatherSignal:true, combinedWeatherSummary:true, experimental:true, officialWarning:false,
  label:"Combined risk",
  value:measurements.map(measurement => `${measurement.label}: ${measurement.value}`).join(" · "),
  measurements,
  mapMode:"environmental-risk",
  tag:"Experimental", severity:"Experimental", severityKey:"experimental",
  explainer:"Experimental weather summary for one location and forecast date, not an official warning or a prediction of harm. The location is selected using SARVA's internal screening calculation.",
  detail:[item.location,item.forecastDate].filter(Boolean).join(" | "),
  source:"ECMWF model data · SARVA interpretation",
 };
}
