import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "../config/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiUrl, martinUrl } from "../config/api";
import "../styles/mdb-boundary-preview.css";

const SOURCE_META = {
    districts: {
        label: "District municipalities",
        count: 52,
        layerId: "mdb_2026_district_municipalities",
        tilePath: "/mdb_2026_district_municipalities/{z}/{x}/{y}",
        color: "#b45b41",
        line: "#7b3b2b",
    },
    locals: {
        label: "Local and metropolitan municipalities",
        count: 214,
        layerId: "mdb_2026_local_municipalities",
        tilePath: "/mdb_2026_local_municipalities/{z}/{x}/{y}",
        color: "#5d8f6b",
        line: "#173b2e",
    },
    wards: {
        label: "Wards",
        count: 4488,
        layerId: "mdb_2026_wards",
        tilePath: "/mdb_2026_wards/{z}/{x}/{y}",
        color: "#e9bf58",
        line: "#8a6d28",
    },
    slope: {
        label: "Topography slope zones",
        count: 0,
        layerId: "topography_slope_zones",
        tilePath: "/topography_slope_zones/{z}/{x}/{y}",
        color: "#6c8f7a",
        line: "#365743",
        importedLabel: "slope polygons",
    },
    contours: {
        label: "Topography contours",
        count: 0,
        layerId: "topography_contours",
        tilePath: "/topography_contours/{z}/{x}/{y}",
        color: "#7b6f5b",
        line: "#4c4336",
        importedLabel: "contour lines",
    },
};
const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };
const EMPTY_TOPOGRAPHY_COVERAGE = { type: "FeatureCollection", features: [] };
const EMPTY_TOPOGRAPHY_GRID = { type: "FeatureCollection", features: [] };
const SOUTH_AFRICA_BOUNDS = [[16.1, -35.2], [33.3, -21.9]];
const REGIONAL_CONTEXT_BOUNDS = [[7.5, -39.5], [42.5, -13.5]];
const SIGNAL_COLOR = [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "metricValue"], ["get", "riskIndex"], 0],
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
];
const SIGNAL_WEIGHT = [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "metricValue"], ["get", "riskIndex"], 0],
    0,
    0.05,
    20,
    0.25,
    50,
    0.65,
    80,
    1,
];

function featureLabel(properties, type) {
    if (type === "wards") {
        return `Ward ${properties.wardno || properties.WardNo || properties.wardid || properties.WardID || ""}`.trim();
    }
    if (type === "districts") {
        return properties.map_label || properties.district_n || properties.district || "District municipality";
    }
    return properties.map_title || properties.municname || properties.namecode || "Municipality";
}

function boundaryStyle() {
    return {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
            osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors",
            },
            districts: {
                type: "vector",
                tiles: [martinUrl(SOURCE_META.districts.tilePath)],
                minzoom: 0,
                maxzoom: 14,
            },
            locals: {
                type: "vector",
                tiles: [martinUrl(SOURCE_META.locals.tilePath)],
                minzoom: 0,
                maxzoom: 14,
            },
            wards: {
                type: "vector",
                tiles: [martinUrl(SOURCE_META.wards.tilePath)],
                minzoom: 5,
                maxzoom: 16,
            },
            slope: {
                type: "vector",
                tiles: [martinUrl(SOURCE_META.slope.tilePath)],
                minzoom: 6,
                maxzoom: 14,
            },
            contours: {
                type: "vector",
                tiles: [martinUrl(SOURCE_META.contours.tilePath)],
                minzoom: 8,
                maxzoom: 14,
            },
            topography_coverage: {
                type: "geojson",
                data: EMPTY_TOPOGRAPHY_COVERAGE,
            },
            topography_grid: {
                type: "geojson",
                data: EMPTY_TOPOGRAPHY_GRID,
            },
            planning_signal: {
                type: "geojson",
                data: EMPTY_FEATURE_COLLECTION,
            },
        },
        layers: [
            { id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.82 } },
            {
                id: "planning-signal-heat",
                type: "heatmap",
                source: "planning_signal",
                paint: {
                    "heatmap-weight": SIGNAL_WEIGHT,
                    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 1.15, 8, 1.8, 10, 2.2],
                    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 34, 8, 74, 10, 112],
                    "heatmap-opacity": 0,
                    "heatmap-color": [
                        "interpolate",
                        ["linear"],
                        ["heatmap-density"],
                        0,
                        "rgba(95,159,122,0)",
                        0.35,
                        "rgba(216,166,72,0.65)",
                        0.65,
                        "rgba(201,111,74,0.78)",
                        1,
                        "rgba(140,45,36,0.9)",
                    ],
                },
            },
            {
                id: "districts-fill",
                type: "fill",
                source: "districts",
                "source-layer": SOURCE_META.districts.layerId,
                paint: { "fill-color": SOURCE_META.districts.color, "fill-opacity": 0.14 },
            },
            {
                id: "districts-line",
                type: "line",
                source: "districts",
                "source-layer": SOURCE_META.districts.layerId,
                paint: { "line-color": SOURCE_META.districts.line, "line-width": 2.2, "line-opacity": 0.95 },
            },
            {
                id: "locals-fill",
                type: "fill",
                source: "locals",
                "source-layer": SOURCE_META.locals.layerId,
                paint: { "fill-color": SOURCE_META.locals.color, "fill-opacity": 0.16 },
            },
            {
                id: "locals-line",
                type: "line",
                source: "locals",
                "source-layer": SOURCE_META.locals.layerId,
                paint: { "line-color": SOURCE_META.locals.line, "line-width": 1.2, "line-opacity": 0.88 },
            },
            {
                id: "wards-fill",
                type: "fill",
                source: "wards",
                "source-layer": SOURCE_META.wards.layerId,
                minzoom: 6,
                paint: { "fill-color": SOURCE_META.wards.color, "fill-opacity": 0.08 },
            },
            {
                id: "wards-line",
                type: "line",
                source: "wards",
                "source-layer": SOURCE_META.wards.layerId,
                minzoom: 6,
                paint: { "line-color": SOURCE_META.wards.line, "line-width": 0.65, "line-opacity": 0.72 },
            },
            {
                id: "topography-grid-fill",
                type: "fill",
                source: "topography_grid",
                paint: {
                    "fill-color": [
                        "match",
                        ["get", "status"],
                        "imported",
                        "#5f9f7a",
                        "downloaded",
                        "#5b9db4",
                        "missing",
                        "#c96f4a",
                        "#d8a648",
                    ],
                    "fill-opacity": [
                        "match",
                        ["get", "status"],
                        "imported",
                        0.18,
                        "downloaded",
                        0.08,
                        "missing",
                        0.035,
                        0.05,
                    ],
                },
            },
            {
                id: "topography-grid-line",
                type: "line",
                source: "topography_grid",
                paint: {
                    "line-color": [
                        "match",
                        ["get", "status"],
                        "imported",
                        "#1f5d43",
                        "downloaded",
                        "#2b748d",
                        "missing",
                        "#b45b41",
                        "#7b6f5b",
                    ],
                    "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 8, 1.5],
                    "line-opacity": [
                        "match",
                        ["get", "status"],
                        "imported",
                        0.9,
                        "downloaded",
                        0.72,
                        "missing",
                        0.46,
                        0.5,
                    ],
                    "line-dasharray": [
                        "match",
                        ["get", "status"],
                        "imported",
                        ["literal", [1, 0]],
                        "downloaded",
                        ["literal", [1, 0]],
                        "missing",
                        ["literal", [2, 2]],
                        ["literal", [1, 1]],
                    ],
                },
            },
            {
                id: "slope-fill",
                type: "fill",
                source: "slope",
                "source-layer": SOURCE_META.slope.layerId,
                minzoom: 6,
                paint: {
                    "fill-color": [
                        "match",
                        ["get", "slope_class"],
                        "flat",
                        "#eef4e8",
                        "gentle",
                        "#c6d96a",
                        "moderate",
                        "#e2a74e",
                        "steep",
                        "#bd593d",
                        "#f1eadb",
                    ],
                    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.08, 8, 0.13, 11, 0.17],
                },
            },
            {
                id: "topography-coverage-fill",
                type: "fill",
                source: "topography_coverage",
                paint: { "fill-color": "#d8a648", "fill-opacity": 0.08 },
            },
            {
                id: "topography-coverage-line",
                type: "line",
                source: "topography_coverage",
                paint: {
                    "line-color": "#b45b41",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.4, 10, 2.2],
                    "line-dasharray": [2, 1.4],
                    "line-opacity": 0.76,
                },
            },
            {
                id: "contours-major-casing",
                type: "line",
                source: "contours",
                "source-layer": SOURCE_META.contours.layerId,
                minzoom: 8,
                filter: ["==", ["%", ["to-number", ["get", "elevation_m"]], 100], 0],
                paint: {
                    "line-color": "#fffdf7",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.6, 12, 3],
                    "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.58, 11, 0.84],
                },
            },
            {
                id: "contours-major-line",
                type: "line",
                source: "contours",
                "source-layer": SOURCE_META.contours.layerId,
                minzoom: 8,
                filter: ["==", ["%", ["to-number", ["get", "elevation_m"]], 100], 0],
                paint: {
                    "line-color": "#332c22",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 12, 1.45],
                    "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 11, 0.95],
                },
            },
            {
                id: "contours-major-label",
                type: "symbol",
                source: "contours",
                "source-layer": SOURCE_META.contours.layerId,
                minzoom: 10,
                filter: ["==", ["%", ["to-number", ["get", "elevation_m"]], 100], 0],
                layout: {
                    "symbol-placement": "line",
                    "text-field": ["concat", ["to-string", ["get", "elevation_m"]], " m"],
                    "text-font": ["Open Sans Regular"],
                    "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 13, 12],
                    "text-rotation-alignment": "map",
                    "symbol-spacing": 420,
                    "text-padding": 3,
                },
                paint: {
                    "text-color": "#2b241d",
                    "text-halo-color": "#fffdf7",
                    "text-halo-width": 1.8,
                    "text-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.62, 12, 0.9],
                },
            },
            {
                id: "contours-medium-casing",
                type: "line",
                source: "contours",
                "source-layer": SOURCE_META.contours.layerId,
                minzoom: 10,
                filter: ["==", ["%", ["to-number", ["get", "elevation_m"]], 50], 0],
                paint: {
                    "line-color": "#fffdf7",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 13, 2.25],
                    "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.45, 12, 0.72],
                },
            },
            {
                id: "contours-medium-line",
                type: "line",
                source: "contours",
                "source-layer": SOURCE_META.contours.layerId,
                minzoom: 10,
                filter: ["==", ["%", ["to-number", ["get", "elevation_m"]], 50], 0],
                paint: {
                    "line-color": "#5b4e3d",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.62, 13, 1.05],
                    "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.55, 12, 0.82],
                },
            },
            {
                id: "contours-medium-label",
                type: "symbol",
                source: "contours",
                "source-layer": SOURCE_META.contours.layerId,
                minzoom: 12,
                filter: ["==", ["%", ["to-number", ["get", "elevation_m"]], 50], 0],
                layout: {
                    "symbol-placement": "line",
                    "text-field": ["concat", ["to-string", ["get", "elevation_m"]], " m"],
                    "text-font": ["Open Sans Regular"],
                    "text-size": 10,
                    "text-rotation-alignment": "map",
                    "symbol-spacing": 520,
                    "text-padding": 2,
                },
                paint: {
                    "text-color": "#5b4e3d",
                    "text-halo-color": "#fffdf7",
                    "text-halo-width": 1.4,
                    "text-opacity": 0.72,
                },
            },
            {
                id: "contours-fine-casing",
                type: "line",
                source: "contours",
                "source-layer": SOURCE_META.contours.layerId,
                minzoom: 12,
                paint: {
                    "line-color": "#fffdf7",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.9, 14, 1.7],
                    "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.3, 14, 0.52],
                },
            },
            {
                id: "contours-fine-line",
                type: "line",
                source: "contours",
                "source-layer": SOURCE_META.contours.layerId,
                minzoom: 12,
                paint: {
                    "line-color": "#766852",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.42, 14, 0.82],
                    "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.42, 14, 0.68],
                },
            },
            {
                id: "planning-signal-points",
                type: "circle",
                source: "planning_signal",
                paint: {
                    "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 8, 5.5],
                    "circle-color": SIGNAL_COLOR,
                    "circle-stroke-color": "#fffdf8",
                    "circle-stroke-width": 1,
                    "circle-opacity": 0,
                },
            },
        ],
    };
}

function popupHtml(properties, type) {
    if (type === "wards") {
        return `
            <strong>Ward ${properties.wardno || properties.WardNo || properties.wardid || properties.WardID || ""}</strong>
            <span>${properties.municname || properties.MUNICNAME || properties.municipali || properties.Municipali || "Municipality not named"}</span>
            <small>${properties.province || properties.Province || ""} ${properties.wardid || properties.WardID ? `| ${properties.wardid || properties.WardID}` : ""}</small>
        `;
    }

    if (type === "districts") {
        return `
            <strong>${properties.map_label || properties.district_n || properties.district || "District municipality"}</strong>
            <span>${properties.category_n || properties.category || "District boundary"}</span>
            <small>${properties.province || ""}</small>
        `;
    }

    return `
        <strong>${properties.map_title || properties.municname || properties.namecode || "Municipality"}</strong>
        <span>${properties.category || properties.cat2 || "Local/metropolitan boundary"}</span>
        <small>${properties.district_n || properties.district || properties.province || ""}</small>
    `;
}

function bboxFeatureCollection(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) {
        return EMPTY_TOPOGRAPHY_COVERAGE;
    }

    const [minx, miny, maxx, maxy] = bbox;
    return {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            properties: { label: "Imported topography coverage" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [minx, miny],
                    [maxx, miny],
                    [maxx, maxy],
                    [minx, maxy],
                    [minx, miny],
                ]],
            },
        }],
    };
}

export function MdbBoundaryMap({ embedded = false, activeSignal = null, selectedBoundary = null, onFeatureSelect = null, onClearSignal = null }) {
    const mapNode = useRef(null);
    const mapRef = useRef(null);
    const popupRef = useRef(null);
    const onFeatureSelectRef = useRef(onFeatureSelect);
    const visibleRef = useRef({ districts: false, locals: true, wards: false, slope: false, contours: false });
    const [layersOpen, setLayersOpen] = useState(false);
    const [signalStatus, setSignalStatus] = useState("idle");
    const [topographyStatus, setTopographyStatus] = useState(null);
    const [visible, setVisible] = useState({ districts: false, locals: true, wards: false, slope: false, contours: false });
    const [districtOptions, setDistrictOptions] = useState([]);
    const [municipalityOptions, setMunicipalityOptions] = useState([]);
    const [wardOptions, setWardOptions] = useState([]);
    const [filter, setFilter] = useState({ district: "", municipality: "", ward: "" });
    const [previousSignal, setPreviousSignal] = useState(undefined);
    if (previousSignal !== activeSignal) {
        setPreviousSignal(activeSignal);
        if (activeSignal?.topographyLayer) {
            setVisible(current => ({ ...current, slope: true, contours: true }));
            setSignalStatus("loading topography");
        } else setSignalStatus(activeSignal?.forecastLayer ? "loading" : activeSignal ? "manual" : "idle");
    }
    const wardRequestKey = `${filter.district}:${filter.municipality}`;
    const [previousWardRequest, setPreviousWardRequest] = useState(wardRequestKey);
    if (previousWardRequest !== wardRequestKey) {
        setPreviousWardRequest(wardRequestKey);
        if (!filter.district && !filter.municipality) setWardOptions([]);
    }
    const layersBySource = useMemo(() => ({
        districts: ["districts-fill", "districts-line"],
        locals: ["locals-fill", "locals-line"],
        wards: ["wards-fill", "wards-line"],
        slope: ["slope-fill"],
        contours: [
            "contours-major-casing",
            "contours-major-line",
            "contours-major-label",
            "contours-medium-casing",
            "contours-medium-line",
            "contours-medium-label",
            "contours-fine-casing",
            "contours-fine-line",
        ],
    }), []);

    useEffect(() => {
        if (!mapNode.current || mapRef.current) return undefined;

        const map = new maplibregl.Map({
            container: mapNode.current,
            style: boundaryStyle(),
            center: [24.7, -29.1],
            zoom: 5,
            minZoom: 3.1,
            maxBounds: REGIONAL_CONTEXT_BOUNDS,
            attributionControl: false,
            cooperativeGestures: true,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        map.on("load", () => {
            map.setLayoutProperty("districts-fill", "visibility", "none");
            map.setLayoutProperty("districts-line", "visibility", "none");
            map.touchZoomRotate.disableRotation();
            map.fitBounds(SOUTH_AFRICA_BOUNDS, { padding: 32, duration: 0 });
            map.setLayoutProperty("wards-fill", "visibility", "none");
            map.setLayoutProperty("wards-line", "visibility", "none");
            map.setLayoutProperty("slope-fill", "visibility", "none");
            map.setLayoutProperty("topography-grid-fill", "visibility", "none");
            map.setLayoutProperty("topography-grid-line", "visibility", "none");
            map.setLayoutProperty("topography-coverage-fill", "visibility", "none");
            map.setLayoutProperty("topography-coverage-line", "visibility", "none");
            map.setLayoutProperty("contours-major-casing", "visibility", "none");
            map.setLayoutProperty("contours-major-line", "visibility", "none");
            map.setLayoutProperty("contours-major-label", "visibility", "none");
            map.setLayoutProperty("contours-medium-casing", "visibility", "none");
            map.setLayoutProperty("contours-medium-line", "visibility", "none");
            map.setLayoutProperty("contours-medium-label", "visibility", "none");
            map.setLayoutProperty("contours-fine-casing", "visibility", "none");
            map.setLayoutProperty("contours-fine-line", "visibility", "none");
        });

        function visibleFillLayers() {
            return ["wards", "locals", "districts"]
                .filter((sourceKey) => visibleRef.current[sourceKey])
                .map((sourceKey) => `${sourceKey}-fill`)
                .filter((layerId) => map.getLayer(layerId));
        }

        function firstFeatureByPriority(features) {
            for (const sourceKey of ["wards", "locals", "districts"]) {
                const feature = features.find((item) => item.layer?.id === `${sourceKey}-fill`);
                if (feature) return { feature, sourceKey };
            }
            return null;
        }

        map.on("click", (event) => {
            const layers = visibleFillLayers();
            if (layers.length === 0) return;
            const selected = firstFeatureByPriority(map.queryRenderedFeatures(event.point, { layers }));
            if (!selected) return;

            popupRef.current?.remove();
            popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
                .setLngLat(event.lngLat)
                .setHTML(`<div class="mdb-popup">${popupHtml(selected.feature.properties || {}, selected.sourceKey)}</div>`)
                .addTo(map);
            onFeatureSelectRef.current?.({
                type: selected.sourceKey,
                label: featureLabel(selected.feature.properties || {}, selected.sourceKey),
                properties: selected.feature.properties || {},
            });
        });

        map.on("mousemove", (event) => {
            const layers = visibleFillLayers();
            map.getCanvas().style.cursor = layers.length > 0 && map.queryRenderedFeatures(event.point, { layers }).length > 0
                ? "pointer"
                : "";
        });

        mapRef.current = map;
        return () => {
            popupRef.current?.remove();
            map.remove();
            mapRef.current = null;
            popupRef.current = null;
        };
    }, []);

    useEffect(() => {
        onFeatureSelectRef.current = onFeatureSelect;
    }, [onFeatureSelect]);

    useEffect(() => {
        const map = mapRef.current;
        if (!activeSignal?.topographyLayer) return undefined;

        const controller = new AbortController();
        Promise.all([
            fetch(apiUrl("/api/topography/status"), { signal: controller.signal }).then((response) => response.json()),
            fetch(apiUrl("/api/topography/grid"), { signal: controller.signal }).then((response) => response.json()),
        ])
            .then(([statusBody, gridBody]) => {
                if (statusBody?.status !== "ok") throw new Error(statusBody?.message || "Topography status unavailable");
                const data = statusBody.data || {};
                const grid = gridBody?.data || {};
                setTopographyStatus(data);
                const total = (data.contourCount || 0) + (data.slopeCount || 0);
                const gridSuffix = grid.expectedCount
                    ? `; ${grid.importedCount || 0}/${grid.expectedCount} grid cells visible, ${grid.downloadedCount || 0} downloaded raw, ${grid.missingCount || 0} missing`
                    : "";
                setSignalStatus(total > 0 ? `${total.toLocaleString("en-ZA")} topography features${gridSuffix}` : `topography tables are ready; no features imported yet${gridSuffix}`);
                if (map && grid.geojson) {
                    map.getSource("topography_grid")?.setData(grid.geojson);
                    if (map.getLayer("topography-grid-fill")) map.setLayoutProperty("topography-grid-fill", "visibility", "visible");
                    if (map.getLayer("topography-grid-line")) map.setLayoutProperty("topography-grid-line", "visibility", "visible");
                }
                if (map && data.bbox) {
                    map.getSource("topography_coverage")?.setData(bboxFeatureCollection(data.bbox));
                    if (map.getLayer("topography-coverage-fill")) map.setLayoutProperty("topography-coverage-fill", "visibility", "visible");
                    if (map.getLayer("topography-coverage-line")) map.setLayoutProperty("topography-coverage-line", "visibility", "visible");
                    const fitBounds = grid.expectedCount ? SOUTH_AFRICA_BOUNDS : data.bbox;
                    map.fitBounds(fitBounds, { padding: 74, maxZoom: grid.expectedCount ? 5.1 : 10.8, duration: 750 });
                }
            })
            .catch((error) => {
                if (error.name !== "AbortError") {
                    setSignalStatus("could not load topography status");
                    console.warn("Topography status could not be loaded", error);
                }
            });

        return () => {
            controller.abort();
            if (map?.getSource("topography_grid")) map.getSource("topography_grid").setData(EMPTY_TOPOGRAPHY_GRID);
            if (map?.getLayer("topography-grid-fill")) map.setLayoutProperty("topography-grid-fill", "visibility", "none");
            if (map?.getLayer("topography-grid-line")) map.setLayoutProperty("topography-grid-line", "visibility", "none");
            if (map?.getSource("topography_coverage")) map.getSource("topography_coverage").setData(EMPTY_TOPOGRAPHY_COVERAGE);
            if (map?.getLayer("topography-coverage-fill")) map.setLayoutProperty("topography-coverage-fill", "visibility", "none");
            if (map?.getLayer("topography-coverage-line")) map.setLayoutProperty("topography-coverage-line", "visibility", "none");
        };
    }, [activeSignal]);

    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            fetch(apiUrl("/api/mdb-2026/districts"), { signal: controller.signal }).then((response) => response.json()),
            fetch(apiUrl("/api/mdb-2026/municipalities"), { signal: controller.signal }).then((response) => response.json()),
        ])
            .then(([districtBody, municipalityBody]) => {
                if (districtBody?.status === "ok") setDistrictOptions(districtBody.data?.records || []);
                if (municipalityBody?.status === "ok") setMunicipalityOptions(municipalityBody.data?.records || []);
            })
            .catch((error) => {
                if (error.name !== "AbortError") console.warn("MDB 2026 lookups could not be loaded", error);
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams();
        if (filter.municipality) {
            params.set("municipality", filter.municipality);
            params.set("limit", "5000");
        } else if (filter.district) {
            params.set("district", filter.district);
            params.set("limit", "1000");
        } else {
            return undefined;
        }

        fetch(apiUrl(`/api/mdb-2026/wards?${params.toString()}`), { signal: controller.signal })
            .then((response) => response.json())
            .then((body) => {
                if (body?.status === "ok") setWardOptions(body.data?.records || []);
            })
            .catch((error) => {
                if (error.name !== "AbortError") console.warn("MDB 2026 wards could not be loaded", error);
            });

        return () => controller.abort();
    }, [filter.district, filter.municipality]);

    useEffect(() => {
        visibleRef.current = visible;
        const map = mapRef.current;
        if (!map) return;
        for (const [sourceKey, layers] of Object.entries(layersBySource)) {
            for (const layer of layers) {
                if (map.getLayer(layer)) {
                    map.setLayoutProperty(layer, "visibility", visible[sourceKey] ? "visible" : "none");
                }
            }
        }
    }, [visible, layersBySource]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !activeSignal?.forecastLayer) {
            if (map?.getSource("planning_signal")) map.getSource("planning_signal").setData(EMPTY_FEATURE_COLLECTION);
            if (map?.getLayer("planning-signal-heat")) map.setPaintProperty("planning-signal-heat", "heatmap-opacity", 0);
            if (map?.getLayer("planning-signal-points")) map.setPaintProperty("planning-signal-points", "circle-opacity", 0);
            return undefined;
        }

        const controller = new AbortController();

        function applyForecastLayer() {
            fetch(apiUrl(`/api/forecast-risk/layer?layer=${encodeURIComponent(activeSignal.forecastLayer)}`), {
                signal: controller.signal,
            })
                .then((response) => response.json())
                .then((body) => {
                    const geojson = body?.data?.geojson || EMPTY_FEATURE_COLLECTION;
                    map.getSource("planning_signal")?.setData(geojson);
                    if (map.getLayer("planning-signal-heat")) map.setPaintProperty("planning-signal-heat", "heatmap-opacity", 0.76);
                    if (map.getLayer("planning-signal-points")) map.setPaintProperty("planning-signal-points", "circle-opacity", 0.32);
                    setSignalStatus(`${body?.data?.count || geojson.features?.length || 0} forecast points`);
                })
                .catch((error) => {
                    if (error.name !== "AbortError") {
                        setSignalStatus("could not load forecast layer");
                        map.getSource("planning_signal")?.setData(EMPTY_FEATURE_COLLECTION);
                    }
                });
        }

        if (map.isStyleLoaded() && map.getSource("planning_signal")) {
            applyForecastLayer();
        } else {
            map.once("load", applyForecastLayer);
        }

        return () => {
            controller.abort();
            map.off("load", applyForecastLayer);
        };
    }, [activeSignal]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => mapRef.current?.resize());
        return () => cancelAnimationFrame(frame);
    }, [layersOpen]);

    function toggleLayer(key) {
        setVisible(current => ["districts", "locals", "wards"].includes(key)
            ? {...current, districts: key === "districts", locals: key === "locals", wards: key === "wards"}
            : {...current, [key]: !current[key]});
    }

    function fitToRecord(record, options = {}) {
        const map = mapRef.current;
        if (!map || !record?.bbox) return;
        map.fitBounds(record.bbox, {
            padding: options.padding || 54,
            maxZoom: options.maxZoom || 11,
            duration: 650,
        });
    }

    function selectBoundaryFromLookup(record, type) {
        const boundary = {
            type,
            label: record.label,
            properties: {
                province: record.province,
                district: record.district,
                district_n: record.districtName,
                municname: record.municipality,
                municipali: record.municipality,
                cat_b: record.code,
                wardno: record.wardNo,
                wardid: record.wardId,
                map_title: record.label,
            },
        };
        onFeatureSelectRef.current?.(boundary);
    }

    function selectDistrict(value) {
        setFilter({ district: value, municipality: "", ward: "" });
        const record = districtOptions.find((item) => (item.districtName || item.district || item.label) === value);
        fitToRecord(record, { maxZoom: 7.4 });
        if (record) { setVisible(current => ({...current, districts: true, locals: false, wards: false})); selectBoundaryFromLookup(record, "districts"); }
    }

    function selectMunicipality(value) {
        setFilter((current) => ({ ...current, municipality: value, ward: "" }));
        const record = municipalityOptions.find((item) => (item.code || item.municipality || item.label) === value);
        fitToRecord(record, { maxZoom: 10.2 });
        if (record) {
            setVisible((current) => ({ ...current, locals: true, districts: false, wards: false }));
            selectBoundaryFromLookup(record, "locals");
        }
    }

    function selectWard(value) {
        setFilter((current) => ({ ...current, ward: value }));
        const record = wardOptions.find((item) => String(item.gid) === value);
        fitToRecord(record, { maxZoom: 13 });
        if (record) {
            setVisible((current) => ({ ...current, wards: true, districts: false, locals: false }));
            selectBoundaryFromLookup(record, "wards");
        }
    }

        const filteredMunicipalities = filter.district
        ? municipalityOptions.filter((item) => (item.districtName || item.district) === filter.district)
        : municipalityOptions;

    function layerCountText(key, meta) {
        if (key === "slope" && topographyStatus?.slopeCount) {
            return `${topographyStatus.slopeCount.toLocaleString("en-ZA")} ${meta.importedLabel} available`;
        }
        if (key === "contours" && topographyStatus?.contourCount) {
            return `${topographyStatus.contourCount.toLocaleString("en-ZA")} ${meta.importedLabel} available`;
        }
        if (key === "slope" || key === "contours") {
            return "Coverage may be incomplete; use the terrain overlay to inspect availability";
        }
        return `${meta.count.toLocaleString("en-ZA")} boundaries`;
    }

    return (
            <section className={`mdb-preview__workspace${embedded ? " is-embedded" : ""}${layersOpen ? " has-layer-panel" : ""}`}>
                <div className="mdb-preview__simpleToolbar">
                    <div><strong>{selectedBoundary?.label || "Choose a municipality below"}</strong><small>Drag to pan · use + / − to zoom · click a boundary to select</small></div>
                    <button type="button" aria-expanded={layersOpen} onClick={() => setLayersOpen(open => !open)}>{layersOpen ? "Hide layers" : "Layers & map help"}</button>
                    <button type="button" onClick={() => mapRef.current?.fitBounds(SOUTH_AFRICA_BOUNDS, {padding: 32, duration: 650})}>Show South Africa</button>
                    {filter.municipality && <button type="button" onClick={() => fitToRecord(municipalityOptions.find(item => (item.code || item.municipality || item.label) === filter.municipality))}>Back to municipality</button>}
                </div>
                <aside className="mdb-preview__panel" aria-label="Boundary layer controls" hidden={!layersOpen}>
                    <h3>What layers do</h3>
                    <p>Boundaries select a planning area. Terrain adds physical context. Weather adds a cached screening overlay. Showing a layer does not create evidence or calculate exposure.</p>
                    {activeSignal && (
                        <div className="mdb-preview__activeSignal">
                            <strong>Loaded signal</strong>
                            <span>{activeSignal.name}</span>
                            <small>{activeSignal.detail}</small>
                            <em>{signalStatus}</em>
                            {onClearSignal && (
                                <button type="button" className="mdb-preview__clearSignal" onClick={onClearSignal}>
                                    Remove overlay
                                </button>
                            )}
                        </div>
                    )}
                    {selectedBoundary && (
                        <div className="mdb-preview__activeSignal is-boundary">
                            <strong>Selected geography</strong>
                            <span>{selectedBoundary.label}</span>
                            <small>Click another ward or municipality to change the planning geography.</small>
                        </div>
                    )}
                    <div className="mdb-preview__note">
                        <strong>Important</strong>
                        <span>These 2026 boundaries take effect on 4 November 2026, so this is a planning preview layer set.</span>
                    </div>

                    {Object.entries(SOURCE_META).map(([key, meta]) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={visible[key]}
                            className={`mdb-preview__layer ${visible[key] ? "is-active" : ""}`}
                            onClick={() => toggleLayer(key)}
                        >
                            <span className="mdb-preview__swatch" style={{ backgroundColor: meta.color, borderColor: meta.line }} />
                            <span>
                                <strong>{meta.label}</strong>
                                <small>{visible[key] ? "Shown" : "Hidden"} · {({districts: "Regional planning context", locals: "Select a municipality", wards: "Select a ward after zooming in", slope: "Terrain steepness; not a flood model", contours: "Elevation lines; zoom in for detail"})[key]}</small>
                                <small>{layerCountText(key, meta)}</small>
                            </span>
                        </button>
                    ))}

                    <div className="mdb-preview__tips">
                        <strong>Inspection tips</strong>
                        <span>Click a boundary for its MDB attributes. Turn wards on after zooming in for a clearer view.</span>
                    </div>
                </aside>

                <div className="mdb-preview__mapColumn">
                    <div className="mdb-preview__filters" aria-label="Boundary zoom filters">
                        <div className="mdb-preview__filterIntro">
                            <strong>Find planning geography</strong>
                            <span>Select a district to load its wards, or choose a municipality to narrow the ward list.</span>
                        </div>
                        <label>
                            <span>District</span>
                            <select value={filter.district} onChange={(event) => selectDistrict(event.target.value)}>
                                <option value="">All districts</option>
                                {districtOptions.map((item) => {
                                    const value = item.districtName || item.district || item.label;
                                    return <option key={item.gid} value={value}>{item.label}</option>;
                                })}
                            </select>
                        </label>
                        <label>
                            <span>Municipality</span>
                            <select value={filter.municipality} onChange={(event) => selectMunicipality(event.target.value)}>
                                <option value="">All municipalities</option>
                                {filteredMunicipalities.map((item) => (
                                    <option key={item.gid} value={item.code || item.municipality || item.label}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span>Ward</span>
                            <select value={filter.ward} onChange={(event) => selectWard(event.target.value)} disabled={!filter.district && !filter.municipality}>
                                <option value="">{filter.district || filter.municipality ? "Select ward" : "Select district or municipality to load wards"}</option>
                                {wardOptions.map((item) => (
                                    <option key={item.gid} value={item.gid}>
                                        {item.label}{item.municipality ? ` | ${item.municipality}` : ""}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                setFilter({ district: "", municipality: "", ward: "" });
                                                    mapRef.current?.fitBounds(SOUTH_AFRICA_BOUNDS, { padding: 32, duration: 650 });
                            }}
                        >
                            Clear search & show country
                        </button>
                    </div>
                    <div className="mdb-preview__mapShell">
                        <div className="mdb-preview__map" ref={mapNode} />
                        {activeSignal && (
                            <div className="mdb-preview__mapOverlay">
                                <span>{activeSignal.topographyLayer ? "Terrain context" : "Weather screening"}</span>
                                <strong>{activeSignal.name}</strong>
                                <small>
                                    {activeSignal.topographyLayer
                                        ? `${signalStatus}. Terrain is visible only where processed data is available. Uncovered areas do not mean flat terrain.`
                                        : signalStatus === "loading"
                                        ? "Loading smooth SARVA forecast surface..."
                                        : `${signalStatus}. Smoothed surface with source points kept visible for traceability. Click a ward, local municipality or district to attach this signal to a planning geography.`}
                                </small>
                                {activeSignal.topographyLayer && (
                                    <div className="mdb-preview__topographyLegend" aria-label="Topography legend">
                                        <span><i style={{ backgroundColor: "#dce8dd" }} />Flat</span>
                                        <span><i style={{ backgroundColor: "#c7d08d" }} />Gentle</span>
                                        <span><i style={{ backgroundColor: "#d6a95b" }} />Moderate</span>
                                        <span><i style={{ backgroundColor: "#b45b41" }} />Steep</span>
                                        <span className="is-line"><i />20 m contours</span>
                                        <span className="is-imported"><i />Visible/imported</span>
                                        <span className="is-grid"><i />Raw DEM only</span>
                                        <span className="is-missing"><i />DEM missing</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {selectedBoundary && (
                            <div className="mdb-preview__selectedOverlay">
                                <span>Attached geography</span>
                                <strong>{selectedBoundary.label}</strong>
                            </div>
                        )}
                    </div>
                </div>
            </section>
    );
}

export default function MdbBoundaryPreview() {
    return (
        <main className="mdb-preview">
            <section className="mdb-preview__header">
                <div>
                    <p>Municipal Planning Workspace</p>
                    <h1>MDB 2026 boundary layer preview</h1>
                    <span>
                        Latest Municipal Demarcation Board spatial downloads for planning, ward inspection and
                        future-effective municipal boundary review.
                    </span>
                </div>
                <a href="/municipal-planning-workspace#boundaries">
                    Open inside planning workspace
                </a>
                <a href="https://spatialhub-mdb-sa.opendata.arcgis.com/pages/data-download" target="_blank" rel="noreferrer">
                    Source: MDB Spatial Data Hub
                </a>
            </section>

            <MdbBoundaryMap />
        </main>
    );
}
