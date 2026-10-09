import FireDetectionsLayer from "./FireDetectionsLayer";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiUrl, martinUrl } from "../config/api";

const MUNICIPAL_TILE_URL = martinUrl("/municipal_boundaries/{z}/{x}/{y}");
const SOUTH_AFRICA_BOUNDS = [
    [16.45, -34.84],
    [32.95, -22.13],
];
const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };
const FORECAST_RISK_REFRESH_MS = 30 * 60 * 1000;
const FORECAST_LAYER_BY_MODE = {
    "forecast-risk": "rainfall",
    "environmental-risk": "overall",
    "heat-risk": "heat",
    "wind-risk": "wind",
    "fire-risk": "fire",
};
const FORECAST_METRIC_WEIGHT = [
    "case",
    ["==", ["get", "layer"], "rainfall"],
    ["interpolate", ["linear"], ["get", "metricValue"], 0, 0, 10, 0.25, 25, 0.58, 50, 1],
    ["==", ["get", "layer"], "heat"],
    ["interpolate", ["linear"], ["get", "metricValue"], 5, 0.06, 15, 0.24, 25, 0.66, 35, 1],
    ["==", ["get", "layer"], "wind"],
    ["interpolate", ["linear"], ["get", "metricValue"], 0, 0.05, 15, 0.28, 30, 0.68, 60, 1],
    ["interpolate", ["linear"], ["get", "metricValue"], 0, 0.06, 20, 0.28, 40, 0.52, 60, 0.76, 100, 1],
];
const FORECAST_METRIC_COLOR = [
    "case",
    ["==", ["get", "layer"], "rainfall"],
    [
        "interpolate",
        ["linear"],
        ["get", "metricValue"],
        0,
        "#5f9f7a",
        10,
        "#b3bd66",
        25,
        "#d8a648",
        50,
        "#c96f4a",
        100,
        "#8c2d24",
    ],
    ["==", ["get", "layer"], "heat"],
    [
        "interpolate",
        ["linear"],
        ["get", "metricValue"],
        5,
        "#4f8f99",
        15,
        "#7aa13c",
        25,
        "#d8a648",
        35,
        "#c96f4a",
        42,
        "#8c2d24",
    ],
    ["==", ["get", "layer"], "wind"],
    [
        "interpolate",
        ["linear"],
        ["get", "metricValue"],
        0,
        "#5f9f7a",
        15,
        "#76a6a8",
        30,
        "#d8a648",
        50,
        "#c96f4a",
        80,
        "#8c2d24",
    ],
    [
        "interpolate",
        ["linear"],
        ["get", "metricValue"],
        0,
        "#5f9f7a",
        20,
        "#8fb45c",
        40,
        "#d8a648",
        60,
        "#c96f4a",
        80,
        "#8c2d24",
    ],
];

function forecastLegendTicks(layer) {
    return {
        rainfall: "0 | 10 | 25 | 50+ mm/day",
        heat: "5 | 15 | 25 | 35+ °C",
        wind: "0 | 15 | 30 | 60+ km/h",
        fire: "0 | 20 | 40 | 60 | 80+ index",
        overall: "0 | 20 | 40 | 60 | 80+ index",
    }[layer] || "0 | 20 | 40 | 60 | 80+ index";
}

function formatSastDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-ZA", {
        timeZone: "Africa/Johannesburg",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short",
    }).format(date);
}

function classifySite(site) {
    const label = `${site.stationName || ""} ${site.displayName || ""}`.toLowerCase();
    if (label.includes("eddy covariance") || label.includes("flux") || label.includes("_ec")) return "Eddy covariance";
    if (label.includes("aws")) return "Weather station";
    if (label.includes("ers")) return "Reference site";
    return "Observation site";
}

function siteIntensity(siteType) {
    return {
        "Weather station": 0.72,
        "Eddy covariance": 0.58,
        "Reference site": 0.48,
        "Observation site": 0.4,
    }[siteType] || 0.4;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    if (/^doi:/i.test(text)) return `https://doi.org/${text.replace(/^doi:\s*/i, "")}`;
    if (/^10\.\d{4,9}\//.test(text)) return `https://doi.org/${text}`;
    return "";
}

function renderStationPopup(properties, { expanded = false } = {}) {
    const name = properties?.displayName || properties?.station || "Observation site";
    const station = properties?.station || "";
    const siteType = properties?.siteType || "Observation site";
    const altitude = Number(properties?.altitude);
    const description = expanded && properties?.description ? String(properties.description).trim() : "";
    const modalContent = expanded && properties?.modalContent ? String(properties.modalContent).trim() : "";
    const citation = expanded && properties?.citation ? String(properties.citation).trim() : "";
    const websiteUrl = normalizeUrl(properties?.websiteUrl);
    const doiUrl = normalizeUrl(properties?.doi);

    return `<div class="sarva-map__stationPopup">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(siteType)}${Number.isFinite(altitude) ? ` | ${altitude.toFixed(0)} m` : ""}</span>
        ${station && station !== name ? `<span>${escapeHtml(station)}</span>` : ""}
        <div class="sarva-map__popupReading">
            <b>${websiteUrl ? "Open observation site" : "No website URL available"}</b>
            <span>Click the site marker to open its source page.</span>
        </div>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        ${modalContent ? `<p>${escapeHtml(modalContent)}</p>` : ""}
        ${citation ? `<small>${escapeHtml(citation)}</small>` : ""}
        ${
            expanded && (websiteUrl || doiUrl)
                ? `<div class="sarva-map__popupActions">
                    ${websiteUrl ? `<a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">Open source</a>` : ""}
                    ${doiUrl ? `<a href="${escapeHtml(doiUrl)}" target="_blank" rel="noopener noreferrer">DOI</a>` : ""}
                </div>`
                : ""
        }
    </div>`;
}

function renderForecastRiskPopup(properties, { expanded = false } = {}) {
    const rainfall = Number(properties?.rainfallMm);
    const metricValue = Number(properties?.metricValue);
    const riskIndex = Number(properties?.riskIndex);
    const riskScore = Number(properties?.riskScore);
    const layer = properties?.layer || "rainfall";
    const layerLabel = properties?.layerLabel || "ECMWF rainfall screening";
    const layerUnits = properties?.layerUnits || (layer === "rainfall" ? "mm/day" : "0-100");
    const temperature = Number(properties?.temperatureMaxC);
    const wind = Number(properties?.windMaxKmh);
    const forecastDate = properties?.forecastDate
        ? new Date(properties.forecastDate).toLocaleDateString("en-ZA", {
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : "Forecast day";
    const sourceUrl = normalizeUrl(properties?.sourceUrl) || "https://www.ecmwf.int/en/forecasts/datasets/open-data";
    const attribution =
        properties?.attribution ||
        "ECMWF Open Data IFS 0.25 degree total precipitation forecast.";
    const fallbackNote =
        String(properties?.isFallback) === "true"
            ? "Showing latest cached forecast while the direct ECMWF refresh retries."
            : "Direct ECMWF forecast cache.";
    const updatedAt = formatSastDateTime(properties?.updatedAt);

    return `<div class="sarva-map__forecastPopup">
        <strong>${escapeHtml(layerLabel)}: ${escapeHtml(properties?.riskLabel || "Unknown")}</strong>
        <span>${escapeHtml(forecastDate)} | ${
            Number.isFinite(metricValue)
                ? `${metricValue.toFixed(layer === "rainfall" || layer === "heat" || layer === "wind" ? 1 : 0)} ${escapeHtml(layerUnits)}`
                : "No forecast value"
        }</span>
        <span>${
            layer === "rainfall"
                ? Number.isFinite(riskScore)
                    ? `Risk score ${riskScore}/4`
                    : "Risk score unavailable"
                : Number.isFinite(riskIndex)
                  ? `Risk index ${riskIndex.toFixed(0)}/100 | Class ${Number.isFinite(riskScore) ? `${riskScore}/4` : "unavailable"}`
                  : "Risk index unavailable"
        } | 0.25 degree grid</span>
        ${
            expanded
                ? `<p>Rain: ${Number.isFinite(rainfall) ? `${rainfall.toFixed(1)} mm/day` : "n/a"} | Heat: ${
                      Number.isFinite(temperature) ? `${temperature.toFixed(1)} °C max` : "n/a"
                  } | Wind: ${Number.isFinite(wind) ? `${wind.toFixed(1)} km/h max` : "n/a"}</p>
                   <p>${
                       layer === "rainfall"
                           ? "Daily forecast rainfall is classified as: Minimal 0 mm, Low >0-10 mm, Moderate 10-25 mm, High 25-50 mm, Very high 50+ mm."
                           : "Index classes use 0-100 SARVA development scores: Very low 0-20, Low 20-40, Moderate 40-60, High 60-80, Very high 80-100."
                   }</p>
                   <small>${escapeHtml(fallbackNote)}</small>
                   ${updatedAt ? `<small>Updated: ${escapeHtml(updatedAt)}</small>` : ""}
                   <small>${escapeHtml(attribution)}</small>
                   <div class="sarva-map__popupActions">
                       <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Source docs</a>
                   </div>`
                : ""
        }
    </div>`;
}

function renderHighlightFocusPopup(highlight) {
    return `<div class="sarva-map__highlightPopup">
        <small>Selected highlight</small>
        <strong>${escapeHtml(highlight?.label || "Forecast highlight")}</strong>
        <b>${escapeHtml(highlight?.value || "")}</b>
        ${highlight?.location ? `<span>${escapeHtml(highlight.location)}</span>` : ""}
        ${highlight?.forecastDate ? `<span>Forecast date: ${escapeHtml(highlight.forecastDate)}</span>` : ""}
        ${highlight?.updatedAtLabel ? `<span>Updated: ${escapeHtml(highlight.updatedAtLabel)}</span>` : ""}
    </div>`;
}

export default function SouthAfricaMap({ activeMode, onModeChange, focusHighlight }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const popupRef = useRef(null);
    const clickPopupRef = useRef(null);
    const focusPopupRef = useRef(null);
    const focusMarkerRef = useRef(null);
    const clickPopupStationRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [tileError, setTileError] = useState(false);
    const [forecastRiskLayer, setForecastRiskLayer] = useState(null);
    const [forecastRiskStatus, setForecastRiskStatus] = useState({ source: "loading", message: null });
    const [forecastInfoOpen, setForecastInfoOpen] = useState(false);
    const [sites, setSites] = useState([]);
    const [siteStatus, setSiteStatus] = useState({ source: "loading", message: null });
    const forecastLayer = FORECAST_LAYER_BY_MODE[activeMode] || "rainfall";

    const forecastRiskFeatures = useMemo(
        () => forecastRiskLayer?.geojson || EMPTY_FEATURE_COLLECTION,
        [forecastRiskLayer]
    );
    const forecastDateRange = useMemo(() => {
        const range = forecastRiskLayer?.dateRange;
        if (!range?.startDate || !range?.endDate) return null;
        const formatter = new Intl.DateTimeFormat("en-ZA", {
            day: "numeric",
            month: "short",
        });
        const start = formatter.format(new Date(range.startDate));
        const end = formatter.format(new Date(range.endDate));
        return start === end ? start : `${start} - ${end}`;
    }, [forecastRiskLayer]);
    const forecastUpdatedAt = formatSastDateTime(
        forecastRiskLayer?.latestRun?.finishedAt || forecastRiskLayer?.latestRun?.startedAt
    );

    const siteFeatures = useMemo(
        () => ({
            type: "FeatureCollection",
            features: sites
                .filter((site) => Number.isFinite(site.longitude) && Number.isFinite(site.latitude))
                .map((site) => {
                    const siteType = classifySite(site);
                    return {
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [site.longitude, site.latitude],
                        },
                        properties: {
                            station: site.stationName || "Observation site",
                            displayName: site.displayName || site.stationName || "Observation site",
                            siteType,
                            intensity: siteIntensity(siteType),
                            altitude: Number.isFinite(Number(site.altitude)) ? Number(site.altitude) : null,
                            description: site.description || "",
                            image: site.image || "",
                            websiteUrl: site.websiteUrl || "",
                            modalContent: site.modalContent || "",
                            citation: site.citation || "",
                            doi: site.doi || "",
                        },
                    };
                }),
        }),
        [sites]
    );

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return undefined;
        const mapContainer = containerRef.current;

        const map = new maplibregl.Map({
            container: mapContainer,
            bounds: SOUTH_AFRICA_BOUNDS,
            fitBoundsOptions: { padding: 22 },
            attributionControl: false,
            scrollZoom: false,
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: "raster",
                        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                        tileSize: 256,
                        attribution: "OpenStreetMap contributors",
                    },
                    municipal_boundaries: {
                        type: "vector",
                        tiles: [MUNICIPAL_TILE_URL],
                        minzoom: 0,
                        maxzoom: 14,
                        promoteId: "gid",
                    },
                    forecast_risk_grid: {
                        type: "geojson",
                        data: EMPTY_FEATURE_COLLECTION,
                    },
                    observation_sites: {
                        type: "geojson",
                        data: EMPTY_FEATURE_COLLECTION,
                    },
                },
                layers: [
                    {
                        id: "osm",
                        type: "raster",
                        source: "osm",
                        paint: {
                            "raster-saturation": -0.35,
                            "raster-opacity": 0.82,
                        },
                    },
                    {
                        id: "municipalities-fill",
                        type: "fill",
                        source: "municipal_boundaries",
                        "source-layer": "municipalities",
                        paint: {
                            "fill-color": "#7aa13c",
                            "fill-opacity": 0.58,
                        },
                    },
                    {
                        id: "municipalities-line",
                        type: "line",
                        source: "municipal_boundaries",
                        "source-layer": "municipalities",
                        paint: {
                            "line-color": "#203a31",
                            "line-opacity": 0.74,
                            "line-width": [
                                "interpolate",
                                ["linear"],
                                ["zoom"],
                                4,
                                0.45,
                                8,
                                1.1,
                            ],
                        },
                    },
                    {
                        id: "forecast-risk-heat",
                        type: "heatmap",
                        source: "forecast_risk_grid",
                        layout: { visibility: "none" },
                        paint: {
                            "heatmap-weight": FORECAST_METRIC_WEIGHT,
                            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.95, 8, 1.7],
                            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 18, 8, 34],
                            "heatmap-opacity": 0.7,
                            "heatmap-color": [
                                "interpolate",
                                ["linear"],
                                ["heatmap-density"],
                                0,
                                "rgba(24, 93, 124, 0)",
                                0.18,
                                "#5f9f7a",
                                0.38,
                                "#b3bd66",
                                0.58,
                                "#d8a648",
                                0.78,
                                "#c96f4a",
                                1,
                                "#8c2d24",
                            ],
                        },
                    },
                    {
                        id: "forecast-risk-points",
                        type: "circle",
                        source: "forecast_risk_grid",
                        layout: { visibility: "none" },
                        paint: {
                            "circle-radius": ["interpolate", ["linear"], FORECAST_METRIC_WEIGHT, 0, 3, 1, 8],
                            "circle-color": FORECAST_METRIC_COLOR,
                            "circle-opacity": 0.66,
                            "circle-stroke-color": "rgba(255, 253, 247, 0.78)",
                            "circle-stroke-width": 0.4,
                        },
                    },
                    {
                        id: "observation-site-bubbles",
                        type: "circle",
                        source: "observation_sites",
                        paint: {
                            "circle-radius": [
                                "match",
                                ["get", "siteType"],
                                "Weather station",
                                13,
                                "Eddy covariance",
                                11,
                                "Reference site",
                                10,
                                9,
                            ],
                            "circle-color": [
                                "match",
                                ["get", "siteType"],
                                "Weather station",
                                "#c96f4a",
                                "Eddy covariance",
                                "#168f8b",
                                "Reference site",
                                "#7aa13c",
                                "#4f6f95",
                            ],
                            "circle-opacity": 0.24,
                            "circle-blur": 0.42,
                            "circle-stroke-width": 0,
                        },
                    },
                    {
                        id: "observation-site-pins",
                        type: "circle",
                        source: "observation_sites",
                        paint: {
                            "circle-radius": [
                                "interpolate",
                                ["linear"],
                                ["zoom"],
                                4,
                                3,
                                8,
                                4.8,
                                11,
                                6.5,
                            ],
                            "circle-color": [
                                "match",
                                ["get", "siteType"],
                                "Weather station",
                                "#c96f4a",
                                "Eddy covariance",
                                "#168f8b",
                                "Reference site",
                                "#7aa13c",
                                "#4f6f95",
                            ],
                            "circle-opacity": 0.96,
                            "circle-stroke-color": "#fffdf7",
                            "circle-stroke-width": 1.5,
                        },
                    },
                ],
            },
        });
        const handleWheelZoom = (event) => {
            if (!event.metaKey && !event.ctrlKey) return;

            event.preventDefault();
            const direction = event.deltaY > 0 ? -1 : 1;
            const magnitude = Math.min(Math.abs(event.deltaY) / 240, 1);
            const nextZoom = Math.max(
                map.getMinZoom(),
                Math.min(map.getMaxZoom(), map.getZoom() + direction * Math.max(magnitude, 0.2))
            );
            const rect = mapContainer.getBoundingClientRect();
            const around = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);

            map.easeTo({
                zoom: nextZoom,
                around,
                duration: 90,
            });
        };

        mapContainer.addEventListener("wheel", handleWheelZoom, { passive: false });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        map.on("load", () => setReady(true));
        map.on("error", (event) => {
            if (String(event?.error?.message || "").includes("municipal_boundaries")) {
                setTileError(true);
            }
        });

        map.on("mousemove", "municipalities-fill", (event) => {
            map.getCanvas().style.cursor = "pointer";
            const feature = event.features?.[0];
            if (!feature) return;

            const name = feature.properties?.municname || feature.properties?.map_title || "Municipality";
            const district = feature.properties?.district_n;
            const province = feature.properties?.province;
            const detail = [district, province].filter(Boolean).join(" | ");

            if (!popupRef.current) {
                popupRef.current = new maplibregl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    offset: 12,
                });
            }

            popupRef.current
                .setLngLat(event.lngLat)
                .setHTML(
                    `<strong>${escapeHtml(name)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}`
                )
                .addTo(map);
        });

        map.on("mouseleave", "municipalities-fill", () => {
            map.getCanvas().style.cursor = "";
            popupRef.current?.remove();
        });

        map.on("mousemove", "forecast-risk-points", (event) => {
            map.getCanvas().style.cursor = "pointer";
            const feature = event.features?.[0];
            if (!feature) return;

            if (!popupRef.current) {
                popupRef.current = new maplibregl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    offset: 12,
                });
            }

            popupRef.current
                .setLngLat(event.lngLat)
                .setHTML(renderForecastRiskPopup(feature.properties))
                .addTo(map);
        });

        map.on("mouseleave", "forecast-risk-points", () => {
            map.getCanvas().style.cursor = "";
            popupRef.current?.remove();
        });

        map.on("click", "forecast-risk-points", (event) => {
            const feature = event.features?.[0];
            if (!feature) return;

            popupRef.current?.remove();
            clickPopupRef.current?.remove();
            clickPopupStationRef.current = null;
            clickPopupRef.current = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: true,
                maxWidth: "330px",
                offset: 14,
            })
                .setLngLat(event.lngLat)
                .setHTML(renderForecastRiskPopup(feature.properties, { expanded: true }))
                .addTo(map);
        });

        map.on("mousemove", "observation-site-pins", (event) => {
            map.getCanvas().style.cursor = "pointer";
            const feature = event.features?.[0];
            if (!feature) return;

            if (!popupRef.current) {
                popupRef.current = new maplibregl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    offset: 12,
                });
            }

            popupRef.current
                .setLngLat(event.lngLat)
                .setHTML(renderStationPopup(feature.properties))
                .addTo(map);
        });

        map.on("mouseleave", "observation-site-pins", () => {
            map.getCanvas().style.cursor = "";
            popupRef.current?.remove();
        });

        map.on("click", "observation-site-pins", (event) => {
            const feature = event.features?.[0];
            if (!feature) return;
            const websiteUrl = normalizeUrl(feature.properties?.websiteUrl);

            popupRef.current?.remove();
            clickPopupRef.current?.remove();
            clickPopupStationRef.current = null;

            if (websiteUrl) {
                window.open(websiteUrl, "_blank", "noopener,noreferrer");
                return;
            }

            clickPopupStationRef.current = feature.properties?.station || feature.properties?.displayName || null;
            clickPopupRef.current = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: true,
                maxWidth: "320px",
                offset: 14,
            })
                .setLngLat(event.lngLat)
                .setHTML(renderStationPopup(feature.properties, { expanded: true }))
                .addTo(map);
            clickPopupRef.current.on("close", () => {
                clickPopupStationRef.current = null;
            });
        });

        mapRef.current = map;

        return () => {
            mapContainer.removeEventListener("wheel", handleWheelZoom);
            popupRef.current?.remove();
            clickPopupRef.current?.remove();
            focusPopupRef.current?.remove();
            focusMarkerRef.current?.remove();
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready || !focusHighlight) return;

        const longitude = Number(focusHighlight.longitude);
        const latitude = Number(focusHighlight.latitude);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;

        const lngLat = [longitude, latitude];
        popupRef.current?.remove();
        clickPopupRef.current?.remove();
        clickPopupStationRef.current = null;
        focusPopupRef.current?.remove();
        focusMarkerRef.current?.remove();

        const markerEl = document.createElement("button");
        markerEl.type = "button";
        markerEl.className = `sarva-map__focusMarker is-${focusHighlight.severityKey || "unknown"}`;
        markerEl.setAttribute("aria-label", `Dismiss ${focusHighlight.label || "map"} highlight`);
        markerEl.addEventListener("click", () => {
            focusPopupRef.current?.remove();
            focusMarkerRef.current?.remove();
            focusPopupRef.current = null;
            focusMarkerRef.current = null;
        });

        focusMarkerRef.current = new maplibregl.Marker({ element: markerEl, anchor: "center" })
            .setLngLat(lngLat)
            .addTo(map);

        focusPopupRef.current = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: false,
            maxWidth: "280px",
            offset: 24,
            className: "sarva-map__highlightPopupWrap",
        })
            .setLngLat(lngLat)
            .setHTML(renderHighlightFocusPopup(focusHighlight))
            .addTo(map);

        focusPopupRef.current.on("close", () => {
            focusMarkerRef.current?.remove();
            focusMarkerRef.current = null;
            focusPopupRef.current = null;
        });

        window.requestAnimationFrame(() => {
            map.resize();
            map.flyTo({
                center: lngLat,
                zoom: Math.max(map.getZoom(), 7.4),
                duration: 1400,
                curve: 1.35,
                essential: true,
            });
        });
    }, [focusHighlight, ready]);

    useEffect(() => {
        const controller = new AbortController();

        async function loadSites() {
            try {
                setSiteStatus({ source: "loading", message: null });
                const response = await fetch(apiUrl("/api/loggernet/site-mappings?limit=500"), {
                    signal: controller.signal,
                });
                const payload = await response.json();

                if (!response.ok || payload.status !== "ok") {
                    throw new Error(payload.message || "Observation sites could not be loaded.");
                }

                setSites(Array.isArray(payload.data?.records) ? payload.data.records : []);
                setSiteStatus({ source: "loggernet-site-mappings", message: null });
            } catch (error) {
                if (error.name === "AbortError") return;
                setSites([]);
                setSiteStatus({ source: "error", message: error.message });
            }
        }

        loadSites();

        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let intervalId = null;

        async function loadForecastRisk({ showLoading = false } = {}) {
            try {
                if (showLoading) {
                    setForecastRiskStatus({ source: "loading", message: null });
                }
                const response = await fetch(apiUrl(`/api/forecast-risk/layer?layer=${encodeURIComponent(forecastLayer)}`), {
                    signal: controller.signal,
                });
                const payload = await response.json();

                if (!response.ok || payload.status !== "ok") {
                    throw new Error(payload.message || "Forecast risk layer could not be loaded.");
                }

                setForecastRiskLayer(payload.data || null);
                setForecastRiskStatus({
                    source: payload.data?.latestRun?.source || "forecast-risk-cache",
                    message: payload.data?.message || null,
                });
            } catch (error) {
                if (error.name === "AbortError") return;
                setForecastRiskLayer(null);
                setForecastRiskStatus({ source: "error", message: error.message });
            }
        }

        loadForecastRisk({ showLoading: true });
        intervalId = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                loadForecastRisk();
            }
        }, FORECAST_RISK_REFRESH_MS);

        const refreshOnFocus = () => loadForecastRisk();
        window.addEventListener("focus", refreshOnFocus);

        return () => {
            controller.abort();
            window.clearInterval(intervalId);
            window.removeEventListener("focus", refreshOnFocus);
        };
    }, [forecastLayer]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) return;

        const source = map.getSource("forecast_risk_grid");
        source?.setData(forecastRiskFeatures);
    }, [forecastRiskFeatures, ready]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) return;

        const source = map.getSource("observation_sites");
        source?.setData(siteFeatures);

        const openStation = clickPopupStationRef.current;
        if (clickPopupRef.current && openStation) {
            const updatedFeature = siteFeatures.features.find((feature) => {
                const properties = feature.properties || {};
                return properties.station === openStation || properties.displayName === openStation;
            });
            if (updatedFeature) {
                clickPopupRef.current.setHTML(renderStationPopup(updatedFeature.properties, { expanded: true }));
            }
        }
    }, [siteFeatures, ready]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) return;

        const observationsVisible = activeMode === "rainfall-risk";
        const forecastRiskVisible = Boolean(FORECAST_LAYER_BY_MODE[activeMode]);
        const sitesVisible = observationsVisible;
        const fillColor =
            forecastRiskVisible
                ? "#7aa13c"
                : activeMode === "risk"
                ? [
                      "match",
                      ["get", "province"],
                      "WC",
                      "#c96f4a",
                      "EC",
                      "#d7a84d",
                      "KZN",
                      "#a4342a",
                      "LP",
                      "#6f8f3a",
                      "MP",
                      "#7f6f3d",
                      "GT",
                      "#8c5f75",
                      "FS",
                      "#c08d47",
                      "NW",
                      "#946b38",
                      "NC",
                      "#b57945",
                      "#c96f4a",
                  ]
                : [
                      "match",
                      ["get", "province"],
                      "WC",
                      "#5f9f7a",
                      "EC",
                      "#7aa13c",
                      "KZN",
                      "#4f965c",
                      "LP",
                      "#8ba94d",
                      "MP",
                      "#6d9b56",
                      "GT",
                      "#75a76b",
                      "FS",
                      "#9daf55",
                      "NW",
                      "#789c48",
                      "NC",
                      "#b8a85a",
                      "#7aa13c",
                  ];

        map.setPaintProperty("municipalities-fill", "fill-color", fillColor);
        map.setPaintProperty(
            "municipalities-fill",
            "fill-opacity",
            forecastRiskVisible ? 0.18 : observationsVisible ? 0.34 : activeMode === "risk" ? 0.64 : 0.58
        );
        map.setLayoutProperty("forecast-risk-heat", "visibility", forecastRiskVisible ? "visible" : "none");
        map.setLayoutProperty("forecast-risk-points", "visibility", forecastRiskVisible ? "visible" : "none");
        map.setLayoutProperty("observation-site-bubbles", "visibility", sitesVisible ? "visible" : "none");
        map.setLayoutProperty("observation-site-pins", "visibility", sitesVisible ? "visible" : "none");
    }, [activeMode, ready]);

    const observationsVisible = activeMode === "rainfall-risk";
    const forecastRiskVisible = Boolean(FORECAST_LAYER_BY_MODE[activeMode]);
    const forecastLayerMeta = forecastRiskLayer?.layerMeta || {
        label: forecastLayer === "rainfall" ? "ECMWF rainfall screening" : "SARVA combined screening index",
        description:
            forecastLayer === "rainfall"
                ? "Highest daily forecast rainfall risk on a 0.25 degree grid for the cached forecast window."
                : "Highest SARVA development environmental risk index on a 0.25 degree grid for the cached forecast window.",
        units: forecastLayer === "rainfall" ? "mm/day" : "0-100",
    };
    const forecastRiskCount = forecastRiskFeatures.features.length;
    const sitesVisible = observationsVisible;
    const locatedSiteCount = siteFeatures.features.length;
    const forecastRiskNotice =
        forecastRiskVisible && forecastRiskStatus.source === "error"
            ? "ECMWF rainfall screening could not be loaded."
            : forecastRiskVisible && forecastRiskStatus.source !== "loading" && forecastRiskCount === 0
              ? forecastRiskStatus.message || "ECMWF rainfall screening has not synced yet."
              : null;
    const siteNotice =
        sitesVisible && siteStatus.source === "error"
            ? "Observation source sites could not be loaded."
            : sitesVisible && siteStatus.source !== "loading" && locatedSiteCount === 0
              ? "No observation source sites with coordinates were found."
              : null;

    return (
        <div className="sarva-map">
            <div ref={containerRef} className="sarva-map__canvas" aria-label="South Africa municipal boundaries map" />
            <div className="sarva-map__zoomHint" aria-hidden="true">
                Hold <kbd>⌘</kbd> or <kbd>Ctrl</kbd> and scroll to zoom
            </div>
            <div className="sarva-map__toolbar">
                <select
                    aria-label="Selected map layer"
                    value={activeMode}
                    onChange={(event) => {
                        if (!FORECAST_LAYER_BY_MODE[event.target.value]) {
                            setForecastInfoOpen(false);
                        }
                        onModeChange?.(event.target.value);
                    }}
                >
                    <option value="rainfall-risk">SAEON live observations</option>
                    <option value="satellite-fires">Satellite fire detections</option>
                    <option value="forecast-risk">ECMWF rainfall screening</option>
                    <option value="environmental-risk">SARVA combined screening index</option>
                    <option value="heat-risk">ECMWF temperature screening</option>
                    <option value="wind-risk">ECMWF wind screening</option>
                    <option value="fire-risk">SARVA fire-weather screening</option>
                </select>
            </div>
            <FireDetectionsLayer map={mapRef.current} ready={ready} visible={activeMode === "satellite-fires"} />
            {forecastRiskVisible && (
                <div className="sarva-map__legend sarva-map__legend--forecast" aria-label={`${forecastLayerMeta.label} legend`}>
                    <p className="sarva-map__authorityNotice">SARVA screening of <a href="https://www.ecmwf.int/en/forecasts/datasets/open-data" target="_blank" rel="noreferrer">ECMWF Open Data ↗</a>. Not an official forecast or warning. <a href="https://www.weathersa.co.za/warnings" target="_blank" rel="noreferrer">Official forecasts &amp; warnings: SAWS ↗</a></p>
                    <div className="sarva-map__legendHeader">
                        <strong>{forecastLayerMeta.label}</strong>
                        <button
                            type="button"
                            className="sarva-map__infoButton"
                            aria-label={`${forecastLayerMeta.label} details`}
                            aria-expanded={forecastInfoOpen}
                            onClick={() => setForecastInfoOpen((open) => !open)}
                        >
                            i
                        </button>
                        <div className={`sarva-map__infoPopover${forecastInfoOpen ? " is-open" : ""}`} role="tooltip">
                            <div className="sarva-map__infoPopoverHeader">
                                <strong>About this layer</strong>
                                <button
                                    type="button"
                                    className="sarva-map__infoClose"
                                    aria-label={`Close ${forecastLayerMeta.label} details`}
                                    onClick={() => setForecastInfoOpen(false)}
                                >
                                    x
                                </button>
                            </div>
                            {forecastDateRange && <span>Date range: {forecastDateRange}</span>}
                            {forecastUpdatedAt && <span>Updated: {forecastUpdatedAt}</span>}
                            <p>{forecastLayerMeta.description} This is a SARVA development layer for screening and exploration, not formal warnings.</p>
                            <p>
                                {forecastLayer === "rainfall"
                                    ? "Thresholds are indicative: 10 mm marks a wet day, 25 mm flags meaningful daily accumulation, and 50+ mm/day is treated as high screening risk. Local flood risk depends on exposure, drainage, terrain and antecedent wetness."
                                    : "The map colours the selected ECMWF forecast metric. Popups also show the SARVA development risk index from 0-100; heat uses daily maximum 2 m temperature, wind uses daily maximum 10 m wind speed, and the fire-weather proxy combines heat, wind and forecast dryness."}
                            </p>
                            <p>{forecastRiskLayer?.attribution || "ECMWF Open Data forecast environmental risk cache."}</p>
                            <div className="sarva-map__infoLinks">
                                <a href={forecastRiskLayer?.sourceUrl || "https://www.ecmwf.int/en/forecasts/datasets/open-data"} target="_blank" rel="noreferrer">
                                    Forecast source
                                </a>
                            </div>
                        </div>
                    </div>
                    <span>{forecastRiskLayer?.isFallback ? "Latest cached forecast" : `ECMWF IFS | 0.25 degree | ${forecastLayerMeta.units}`}</span>
                    {forecastUpdatedAt && <span>Updated {forecastUpdatedAt}</span>}
                    {forecastDateRange && <span>{forecastDateRange}</span>}
                    <div className="sarva-map__legendScale" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                    </div>
                    <small>{forecastLegendTicks(forecastLayer)}</small>
                </div>
            )}
            {sitesVisible && (
                <div className="sarva-map__legend sarva-map__legend--sites" aria-label="Observation source legend">
                    <strong>SAEON live observations</strong>
                    <span>{locatedSiteCount} mapped sites</span>
                    <div className="sarva-map__siteLegend">
                        <i className="is-weather" />
                        <span>Weather station</span>
                        <i className="is-eddy" />
                        <span>Eddy covariance</span>
                        <i className="is-reference" />
                        <span>Reference site</span>
                    </div>
                </div>
            )}
            {tileError && (
                <div className="sarva-map__notice">
                    Municipal tiles are not available yet. Import boundaries and start Martin.
                </div>
            )}
            {forecastRiskNotice && <div className="sarva-map__notice sarva-map__notice--rainfall">{forecastRiskNotice}</div>}
            {siteNotice && <div className="sarva-map__notice sarva-map__notice--rainfall">{siteNotice}</div>}
        </div>
    );
}
