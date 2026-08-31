import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { martinUrl } from "../config/api";
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
};

function boundaryStyle() {
    return {
        version: 8,
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
        },
        layers: [
            { id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.82 } },
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
        ],
    };
}

function popupHtml(properties, type) {
    if (type === "wards") {
        return `
            <strong>Ward ${properties.wardno || properties.wardid || ""}</strong>
            <span>${properties.municname || properties.municipali || "Municipality not named"}</span>
            <small>${properties.province || ""} ${properties.wardid ? `| ${properties.wardid}` : ""}</small>
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

export default function MdbBoundaryPreview() {
    const mapNode = useRef(null);
    const mapRef = useRef(null);
    const [visible, setVisible] = useState({ districts: true, locals: true, wards: false });
    const layersBySource = useMemo(() => ({
        districts: ["districts-fill", "districts-line"],
        locals: ["locals-fill", "locals-line"],
        wards: ["wards-fill", "wards-line"],
    }), []);

    useEffect(() => {
        if (!mapNode.current || mapRef.current) return undefined;

        const map = new maplibregl.Map({
            container: mapNode.current,
            style: boundaryStyle(),
            center: [24.7, -29.1],
            zoom: 5,
            maxBounds: [[15.2, -36.2], [34.4, -20.8]],
            attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        map.on("load", () => {
            map.fitBounds([[16.45, -34.84], [32.95, -22.13]], { padding: 32, duration: 0 });
            map.setLayoutProperty("wards-fill", "visibility", "none");
            map.setLayoutProperty("wards-line", "visibility", "none");
        });

        for (const sourceKey of Object.keys(SOURCE_META)) {
            map.on("click", `${sourceKey}-fill`, (event) => {
                const feature = event.features?.[0];
                if (!feature) return;
                new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
                    .setLngLat(event.lngLat)
                    .setHTML(`<div class="mdb-popup">${popupHtml(feature.properties || {}, sourceKey)}</div>`)
                    .addTo(map);
            });
            map.on("mouseenter", `${sourceKey}-fill`, () => {
                map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", `${sourceKey}-fill`, () => {
                map.getCanvas().style.cursor = "";
            });
        }

        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
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

    function toggleLayer(key) {
        setVisible((current) => ({ ...current, [key]: !current[key] }));
    }

    return (
        <main className="mdb-preview">
            <section className="mdb-preview__header">
                <div>
                    <p>MDB 2026 Boundary Preview</p>
                    <h1>Municipal and ward boundary layers</h1>
                    <span>
                        Latest Municipal Demarcation Board spatial downloads, published for SARVA review before
                        replacing any operational profiler layers.
                    </span>
                </div>
                <a href="https://spatialhub-mdb-sa.opendata.arcgis.com/pages/data-download" target="_blank" rel="noreferrer">
                    Source: MDB Spatial Data Hub
                </a>
            </section>

            <section className="mdb-preview__workspace">
                <aside className="mdb-preview__panel" aria-label="Boundary layer controls">
                    <div className="mdb-preview__note">
                        <strong>Important</strong>
                        <span>These 2026 boundaries take effect on 4 November 2026, so this is a planning preview layer set.</span>
                    </div>

                    {Object.entries(SOURCE_META).map(([key, meta]) => (
                        <button
                            key={key}
                            type="button"
                            className={`mdb-preview__layer ${visible[key] ? "is-active" : ""}`}
                            onClick={() => toggleLayer(key)}
                        >
                            <span className="mdb-preview__swatch" style={{ backgroundColor: meta.color, borderColor: meta.line }} />
                            <span>
                                <strong>{meta.label}</strong>
                                <small>{meta.count.toLocaleString("en-ZA")} features via Martin vector tiles</small>
                            </span>
                        </button>
                    ))}

                    <div className="mdb-preview__tips">
                        <strong>Inspection tips</strong>
                        <span>Click a boundary for its MDB attributes. Turn wards on after zooming in for a clearer view.</span>
                    </div>
                </aside>

                <div className="mdb-preview__map" ref={mapNode} />
            </section>
        </main>
    );
}
