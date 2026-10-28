import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { profilerMetricFromSearch } from "../config/profilerMetricLink";
import { trackInteraction } from "../config/analyticsInteraction";
import { municipalMapScale } from "../config/municipalMapScale";
import { hasRawEvidence } from "../config/rawIndicatorTotals";
import maplibregl from "../config/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiUrl, martinUrl } from "../config/api";
import MapIndicatorControls from "../components/MapIndicatorControls";
import RawMunicipalIndicators from "../components/RawMunicipalIndicators";
import "../styles/municipal-risk-profiler.css";

const EMPTY = [];
const MUNICIPAL_TILE_URL = martinUrl("/municipal_boundaries/{z}/{x}/{y}");
const SOUTH_AFRICA_CENTER = [24.7, -29.1];
function formatNumber(value, digits = 1, fallback = "n/a") {
    if (value == null || value === "" || !Number.isFinite(Number(value))) return fallback;
    return Number(value).toLocaleString("en-ZA", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function formatIndicatorValue(value, unit) { return value == null ? "Insufficient verified data" : `${Number(value).toLocaleString("en-ZA", { maximumFractionDigits: 3 })} ${unit || ""}`.trim(); }
function normalise(value) { return String(value || "").trim().toLowerCase(); }
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
function eligibleSource(item) {
    return !item.isProxy && item.confidence !== "proxy" && !/proxy/i.test(item.scenario || "") && !/Deterministic seed value/i.test(item.notes || "");
}
function pdfSafe(value) {
    return String(value ?? "")
        .normalize("NFKD")
        .replace(/[^\x20-\x7E\n]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function pdfEscape(value) {
    return pdfSafe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfText(value, maxChars = 92) {
    const words = pdfSafe(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (next.length > maxChars && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
}

function buildPdf(actions) {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 44;
    const bottom = 46;
    const pages = [];
    let current = [];
    let y = pageHeight - margin;
    const colors = {
        primary: [32, 58, 49],
        muted: [101, 115, 109],
        page: [243, 240, 232],
        surface: [255, 253, 247],
        border: [216, 209, 196],
        accent: [201, 111, 74],
        accentDark: [159, 77, 50],
        success: [79, 124, 82],
        ochre: [215, 168, 77],
        danger: [184, 79, 72],
        pale: [235, 230, 218],
    };

    function colorCommand(kind, color) {
        const [r, g, b] = color;
        return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} ${kind}`;
    }

    function ensureSpace(height) {
        if (y - height < bottom) newPage();
    }

    function newPage() {
        if (current.length > 0) pages.push(current);
        current = [];
        y = pageHeight - margin;
    }

    function write(text, options = {}) {
        const size = options.size || 10;
        const font = options.font || "F1";
        const leading = options.leading || size + 4;
        const indent = options.indent || 0;
        const maxChars = options.maxChars || (size >= 18 ? 48 : 92);
        const lines = wrapPdfText(text, maxChars);
        lines.forEach((line) => {
            if (y < bottom + leading) newPage();
            current.push({ text: line, x: margin + indent, y, size, font, color: options.color });
            y -= leading;
        });
        if (options.after) y -= options.after;
    }

    function rect(x, topY, width, height, options = {}) {
        current.push({
            type: "rect",
            x,
            y: topY - height,
            width,
            height,
            fill: options.fill,
            stroke: options.stroke,
        });
    }

    function sectionTitle(title, eyebrow = "") {
        ensureSpace(52);
        rect(margin, y, pageWidth - margin * 2, 30, { fill: colors.primary });
        current.push({ text: title, x: margin + 12, y: y - 20, size: 13, font: "F2", color: colors.surface });
        if (eyebrow) current.push({ text: eyebrow, x: pageWidth - margin - 170, y: y - 20, size: 8, font: "F2", color: colors.pale });
        y -= 42;
    }

    function statCard(x, topY, width, label, value, note = "") {
        rect(x, topY, width, 62, { fill: colors.surface, stroke: colors.border });
        const cleanValue = pdfSafe(value);
        const valueSize = cleanValue.length > 26 ? 12 : cleanValue.length > 16 ? 14 : 18;
        const valueLines = wrapPdfText(cleanValue, valueSize <= 12 ? 24 : 18).slice(0, 2);
        valueLines.forEach((lineText, index) => {
            current.push({ text: lineText, x: x + 10, y: topY - 19 - index * (valueSize + 2), size: valueSize, font: "F2", color: colors.primary });
        });
        const labelY = topY - (valueLines.length > 1 ? 45 : 39);
        current.push({ text: pdfSafe(label), x: x + 10, y: labelY, size: 8, font: "F2", color: colors.muted });
        if (note) {
            wrapPdfText(note, 34).slice(0, 1).forEach((lineText) => {
                current.push({ text: pdfSafe(lineText), x: x + 10, y: labelY - 12, size: 7, font: "F1", color: colors.muted });
            });
        }
    }

    function scoreColor(score) {
        const value = Number(score);
        if (!Number.isFinite(value)) return colors.muted;
        if (value >= 60) return colors.danger;
        if (value >= 40) return colors.ochre;
        return colors.success;
    }

    function scoreBar(label, score, detail = "", options = {}) {
        if (score == null || score === "" || !Number.isFinite(Number(score))) {
            write(`${label}: Insufficient verified data`, { font: "F2", size: 9, indent: options.indent || 0 });
            if (detail) write(detail, { size: 7, indent: options.indent || 0, maxChars: 105 });
            return;
        }
        ensureSpace(36);
        const value = Math.max(0, Math.min(100, Number(score) || 0));
        const x = margin + (options.indent || 0);
        const width = pageWidth - margin * 2 - (options.indent || 0);
        current.push({ text: pdfSafe(label), x, y, size: options.size || 9, font: "F2", color: colors.primary });
        current.push({ text: `${formatNumber(value, 1)} / 100`, x: x + width - 58, y, size: 8, font: "F2", color: scoreColor(value) });
        y -= 12;
        rect(x, y, width, 8, { fill: colors.pale });
        rect(x, y, width * (value / 100), 8, { fill: scoreColor(value) });
        y -= 13;
        if (detail) write(detail, { size: 7, indent: options.indent || 0, maxChars: 105 });
    }

    function gap(amount = 8) {
        y -= amount;
        if (y < bottom) newPage();
    }

    actions({ write, gap, newPage, rect, sectionTitle, statCard, scoreBar, colors, pageWidth, pageHeight, margin, ensureSpace });
    if (current.length > 0) pages.push(current);

    const objects = [];
    function addObject(body) {
        objects.push(body);
        return objects.length;
    }

    const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesId = addObject("");
    const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds = [];

    pages.forEach((page, pageIndex) => {
        page.push({ type: "footer", pageNumber: pageIndex + 1, pageCount: pages.length });
        const content = [
            ...page.flatMap((item) => {
                if (item.type === "rect") {
                    const commands = [];
                    if (item.fill) commands.push(colorCommand("rg", item.fill), `${item.x.toFixed(2)} ${item.y.toFixed(2)} ${item.width.toFixed(2)} ${item.height.toFixed(2)} re f`);
                    if (item.stroke) commands.push(colorCommand("RG", item.stroke), `${item.x.toFixed(2)} ${item.y.toFixed(2)} ${item.width.toFixed(2)} ${item.height.toFixed(2)} re S`);
                    return commands;
                }
                if (item.type === "line") {
                    return [colorCommand("RG", item.color), `${item.width.toFixed(2)} w`, `${item.x1.toFixed(2)} ${item.y1.toFixed(2)} m ${item.x2.toFixed(2)} ${item.y2.toFixed(2)} l S`];
                }
                if (item.type === "footer") {
                    return [
                        colorCommand("RG", colors.border),
                        `0.75 w`,
                        `${margin.toFixed(2)} 32.00 m ${(pageWidth - margin).toFixed(2)} 32.00 l S`,
                        "BT",
                        colorCommand("rg", colors.muted),
                        `/F1 7 Tf 1 0 0 1 ${margin.toFixed(2)} 20.00 Tm (${pdfEscape("SARVA municipal source profile - verify original data before use")}) Tj`,
                        `/F1 7 Tf 1 0 0 1 ${(pageWidth - margin - 54).toFixed(2)} 20.00 Tm (${pdfEscape(`Page ${item.pageNumber} of ${item.pageCount}`)}) Tj`,
                        "ET",
                    ];
                }
                const color = item.color || colors.primary;
                return [
                    "BT",
                    colorCommand("rg", color),
                    `/${item.font} ${item.size} Tf 1 0 0 1 ${item.x.toFixed(2)} ${item.y.toFixed(2)} Tm (${pdfEscape(item.text)}) Tj`,
                    "ET",
                ];
            }),
        ].join("\n");
        const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
        pageIds.push(pageId);
    });

    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((body, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([pdf], { type: "application/pdf" });
}

export default function MunicipalRiskProfiler() {
    const location = useLocation();
    return <MunicipalProfilerView key={location.search} initialMetric={profilerMetricFromSearch(location.search)} />;
}

function MunicipalProfilerView({initialMetric}) {
    const mapContainerRef = useRef(null), mapRef = useRef(null), popupRef = useRef(null);
    const metricRecordsRef = useRef(new Map()), metricLabelRef = useRef("Selected layer");
    const municipalitiesRef = useRef([]), mapViewModeRef = useRef("country");
    const [municipalities, setMunicipalities] = useState([]);
    const [municipalitiesLoading, setMunicipalitiesLoading] = useState(true);
    const [municipalitiesError, setMunicipalitiesError] = useState("");
    const [query, setQuery] = useState(""), [selected, setSelected] = useState(null);
    const [profile, setProfile] = useState(null), [profileError, setProfileError] = useState("");
    const [loadedGid, setLoadedGid] = useState(null), [mapReady, setMapReady] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState(initialMetric);
    const [selectedPeriod, setSelectedPeriod] = useState("");
    const [metricData, setMetricData] = useState(null), [metricError, setMetricError] = useState("");
    const [infoOpen, setInfoOpen] = useState(false);
    const profileLoading = Boolean(selected && loadedGid !== selected.gid);
    const visibleProfile = profile?.municipality?.gid === selected?.gid ? profile : null;
    const matches = municipalities.filter(item => [item.municipality, item.code, item.district, item.province].some(value => normalise(value).includes(normalise(query))));

    useEffect(() => { municipalitiesRef.current = municipalities; }, [municipalities]);
    useEffect(() => {
        const controller = new AbortController();
        fetch(apiUrl("/api/municipalities"), { signal: controller.signal })
            .then(response => response.json()).then(body => {
                if (body.status !== "ok") throw Error(body.message || "Municipalities could not be loaded");
                setMunicipalities(body.data.records);
            }).catch(error => { if (error.name !== "AbortError") setMunicipalitiesError(error.message); })
            .finally(() => setMunicipalitiesLoading(false));
        return () => controller.abort();
    }, []);
    useEffect(() => {
        if (!selected) return;
        const controller = new AbortController();
        fetch(apiUrl(`/api/municipalities/${selected.gid}/profile`), { signal: controller.signal })
            .then(response => response.json()).then(body => {
                if (body.status !== "ok") throw Error(body.message || "Profile unavailable");
                const records = (body.data.indicators?.records || []).filter(eligibleSource);
                setProfile({ ...body.data, indicators: { ...body.data.indicators, records } });
                setProfileError(""); setLoadedGid(selected.gid);
            }).catch(error => { if (error.name !== "AbortError") { setProfileError(error.message); setLoadedGid(selected.gid); } });
        return () => controller.abort();
    }, [selected]);
    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ metric: selectedMetric });
        if (selectedPeriod) params.set("period", selectedPeriod);
        fetch(apiUrl(`/api/municipalities/metric?${params}`), { signal: controller.signal })
            .then(response => response.json()).then(body => {
                if (body.status !== "ok") throw Error(body.message || "Map values unavailable");
                setMetricData(body.data); setMetricError("");
            }).catch(error => { if (error.name !== "AbortError") setMetricError(error.message); });
        return () => controller.abort();
    }, [selectedMetric, selectedPeriod]);

    function fitCountryView(options = {}) {
        const map = mapRef.current;
        if (!map) return;
        map.resize(); map.easeTo({ center: SOUTH_AFRICA_CENTER, zoom: 3.8, duration: options.duration ?? 650 });
    }
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return undefined;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            center: SOUTH_AFRICA_CENTER,
            zoom: 4.05,
            attributionControl: false,
            scrollZoom: true,
            cooperativeGestures: true,
            dragRotate: false,
            pitchWithRotate: false,
            minZoom: 0,

            style: {
                version: 8,
                sources: {
                    osm: {
                        type: "raster",
                        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                        tileSize: 256,
                        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
                    },
                    municipal_boundaries: {
                        type: "vector",
                        tiles: [MUNICIPAL_TILE_URL],
                        minzoom: 0,
                        maxzoom: 14,
                        promoteId: "gid",
                    },
                },
                layers: [
                    {
                        id: "osm",
                        type: "raster",
                        source: "osm",
                        paint: {
                            "raster-saturation": -0.45,
                            "raster-opacity": 0.72,
                        },
                    },
                    {
                        id: "municipal-profile-fill",
                        type: "fill",
                        source: "municipal_boundaries",
                        "source-layer": "municipalities",
                        paint: {
                            "fill-color": ["case", ["boolean", ["feature-state", "hover"], false], "#d7a84d", "#b7cbbb"],
                            "fill-opacity": [
                                "case",
                                ["boolean", ["feature-state", "selected"], false],
                                0.82,
                                ["boolean", ["feature-state", "hover"], false],
                                0.68,
                                0.88,
                            ],
                        },
                    },
                    {
                        id: "municipal-profile-line",
                        type: "line",
                        source: "municipal_boundaries",
                        "source-layer": "municipalities",
                        paint: {
                            "line-color": "#475569",
                            "line-opacity": 0.82,
                            "line-width": [
                                "case",
                                ["boolean", ["feature-state", "selected"], false],
                                2.4,
                                0.8,
                            ],
                        },
                    },
                ],
            },
        });

        let hoveredId = null;
        const handleMouseMove = (event) => {
            const feature = event.features?.[0];
            if (!feature) return;
            map.getCanvas().style.cursor = "pointer";
            if (hoveredId !== null) {
                map.setFeatureState({ source: "municipal_boundaries", sourceLayer: "municipalities", id: hoveredId }, { hover: false });
            }
            hoveredId = feature.id ?? feature.properties?.gid;
            if (hoveredId !== null && hoveredId !== undefined) {
                map.setFeatureState({ source: "municipal_boundaries", sourceLayer: "municipalities", id: hoveredId }, { hover: true });
            }
            const name = feature.properties?.municname || feature.properties?.map_title || "Municipality";
            const detail = [feature.properties?.district_n, feature.properties?.province].filter(Boolean).join(" | ");
            const metric = metricRecordsRef.current.get(Number(feature.properties?.gid ?? feature.id));
            const metricHtml = metric
                ? `<span>${escapeHtml(metricLabelRef.current)}: ${escapeHtml(formatIndicatorValue(metric.displayValue, metric.displayUnit))}</span>`
                : `<span>${escapeHtml(metricLabelRef.current)}: No data for this layer</span>`;
            if (!popupRef.current) popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
            popupRef.current
                .setLngLat(event.lngLat)
                .setHTML(`<strong>${escapeHtml(name)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}${metricHtml}`)
                .addTo(map);
        };
        const handleMouseLeave = () => {
            map.getCanvas().style.cursor = "";
            if (hoveredId !== null) {
                map.setFeatureState({ source: "municipal_boundaries", sourceLayer: "municipalities", id: hoveredId }, { hover: false });
                hoveredId = null;
            }
            popupRef.current?.remove();
        };
        const handleClick = (event) => {
            const feature = event.features?.[0];
            const gid = Number(feature?.properties?.gid ?? feature?.id);
            if (!Number.isFinite(gid)) return;
            const match = municipalitiesRef.current.find((item) => Number(item.gid) === gid);
            trackInteraction('municipality', String(gid));
            mapViewModeRef.current = "municipality";
            setSelected(match || {
                gid,
                municipality: feature.properties?.municname || feature.properties?.map_title || "Municipality",
                province: feature.properties?.province || "",
                district: feature.properties?.district_n || "",
            });
        };
        map.on("load", () => {
            map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
            map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-left");
            map.on("mousemove", "municipal-profile-fill", handleMouseMove);
            map.on("mouseleave", "municipal-profile-fill", handleMouseLeave);
            map.on("click", "municipal-profile-fill", handleClick);
            fitCountryView({ duration: 0 });
            setMapReady(true);
        });

        mapRef.current = map;
        return () => {
            popupRef.current?.remove();
            map.remove();
            mapRef.current = null;
            setMapReady(false);
        };
    }, []);


    useEffect(() => {
        const map = mapRef.current;
        if (!mapReady || !map) return;
        const current = metricData?.metric?.key === selectedMetric.split(":")[1];
        const records = current ? (metricData?.records || []).filter(record => eligibleSource(record) && hasRawEvidence(record) && record.period === metricData.metric.period && record.displayUnit === metricData.metric.unit && record.scenario === metricData.metric.scenario) : EMPTY;
        const byGid = new Map(records.map(record => [Number(record.gid), record]));
        metricRecordsRef.current = byGid;
        metricLabelRef.current = metricData?.metric?.label || "Selected layer";
        const scale = municipalMapScale(records.map(record => Number(record.rawValue)));
        const colour = scale.length > 1 ? ["step", ["coalesce", ["feature-state", "metricValue"], 0], scale[0].colour, ...scale.slice(1).flatMap(item => [item.value, item.colour])] : scale[0]?.colour || "#cbd5e1";
        map.setPaintProperty("municipal-profile-fill", "fill-color", ["case", ["boolean", ["feature-state", "hover"], false], "#fbbf24", ["!", ["boolean", ["feature-state", "hasMetric"], false]], "#cbd5e1", colour]);
        municipalities.forEach(item => {
            const record = byGid.get(Number(item.gid));
            map.setFeatureState({ source: "municipal_boundaries", sourceLayer: "municipalities", id: Number(item.gid) }, { hasMetric: Boolean(record), metricValue: record ? Number(record.rawValue) : null, selected: Number(item.gid) === Number(selected?.gid) });
        });
    }, [mapReady, metricData, municipalities, selected, selectedMetric]);
    useEffect(() => {
        const map = mapRef.current;
        if (!mapReady || !map || !selected?.bbox) return;
        map.fitBounds([[selected.bbox[0], selected.bbox[1]], [selected.bbox[2], selected.bbox[3]]], { padding: 35, maxZoom: 10, duration: 650 });
    }, [selected, mapReady]);

    function selectMunicipalityFromSearch(event) {
        event.preventDefault();
        if (!query.trim()) return;
        const match = matches.find(item => normalise(item.municipality) === normalise(query) || normalise(item.code) === normalise(query)) || matches[0];
        if (match) { setSelected(match); trackInteraction("municipality", String(match.gid)); }
    }
    function downloadProfilePdf() {
        if (!visibleProfile) return;
        const rows = visibleProfile.indicators.records.filter(hasRawEvidence);
        const municipality = visibleProfile.municipality;
        const blob = buildPdf(({ write, gap, sectionTitle, ensureSpace }) => {
            sectionTitle(municipality.municipality, "Municipal source data");
            write([municipality.district, municipality.province, municipality.code].filter(Boolean).join(" | "), { size: 10 });
            write(`Generated ${new Date().toLocaleDateString("en-ZA")}`, { size: 8 });
            gap();
            write("Source values only. Synthetic placeholders and composite risk scores are excluded. Imported data has not been independently validated here. Check the original sources before use.", { size: 9 });
            write("Crime counts are reported cases, not population-adjusted rates. Source years and units may differ.", { size: 9 });
            gap();
            if (!rows.length) write("Insufficient verified data: no eligible raw source values are available.", { size: 11 });
            rows.forEach(row => {
                ensureSpace(145);
                write(row.label, { font: "F2", size: 12, maxChars: 75 });
                write(row.theme || "Source indicator", { size: 8 });
                write(formatIndicatorValue(row.rawValue, row.displayUnit || row.unit), { size: 12 });
                write(`Period: ${row.period || "Unknown"} | Scenario: ${row.scenario || "Unknown"}`, { size: 8 });
                write(`Source: ${row.sourceName || "Not supplied"}`, { size: 8 });
                if (row.sourceUrl) write(row.sourceUrl, { size: 7 });
                gap();
            });
        });
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = `${pdfSafe(municipality.municipality).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-sarva-source-profile.pdf`;
        document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
        trackInteraction("download", "municipal-source-profile");
    }
    const mapRecords = metricData?.metric?.key === selectedMetric.split(":")[1] ? (metricData?.records || []).filter(record => eligibleSource(record) && hasRawEvidence(record) && record.period === metricData.metric.period && record.displayUnit === metricData.metric.unit && record.scenario === metricData.metric.scenario) : EMPTY;
    const scale = municipalMapScale(mapRecords.map(record => Number(record.rawValue)));
    return <div className="sarva-muniProfiler">
        <section className="sarva-muniProfiler__tools" aria-label="Municipal risk profiler controls">
            <div className="sarva-muniProfiler__intro"><span>SARVA municipal tool</span><h1>Municipal Risk Profiler</h1><p>Explore South Africa’s municipal data. Compare a layer, then select a municipality to inspect its values.</p></div>
            <form className="sarva-muniProfiler__search" onSubmit={selectMunicipalityFromSearch}>
                <label><span>Search municipality</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} list="sarva-municipality-options" placeholder="Type municipality, district, province or code..." /></label>
                <datalist id="sarva-municipality-options">{matches.slice(0, 30).map(item => <option key={item.gid} value={item.municipality} label={[item.district, item.province].filter(Boolean).join(" | ")} />)}</datalist>
                <button type="submit">Search</button>{municipalitiesLoading && <small>Loading municipalities…</small>}{municipalitiesError && <small role="alert">{municipalitiesError}</small>}
            </form>
            <button type="button" className="sarva-muniProfiler__infoButton" onClick={() => setInfoOpen(true)}>Methodology</button>
            <button type="button" className="sarva-muniProfiler__infoButton" onClick={() => fitCountryView()}>Show country</button>
        </section>
        {infoOpen && <div className="sarva-muniProfiler__modal" role="dialog" aria-modal="true" aria-labelledby="municipal-method"><div>
            <button type="button" onClick={() => setInfoOpen(false)} aria-label="Close">x</button><h2 id="municipal-method">About the municipal data</h2>
            <p>The map and tables show source values in their original units. Colours show their distribution across municipalities with the same indicator, period, scenario and unit; they do not show risk levels or probabilities.</p>
            <p>Synthetic test values are excluded. Missing information is shown as insufficient verified data, never as zero. Imported records have not been independently validated here.</p>
            <p>Check source dates, definitions and coverage before comparing municipalities. Crime counts are reported cases and are not adjusted for population.</p>
        </div></div>}
        <div className="profiler-explorer">
            <MapIndicatorControls value={selectedMetric} onChange={value => { setSelectedMetric(value); setSelectedPeriod(""); }} metric={metricData?.metric} period={selectedPeriod} onPeriodChange={setSelectedPeriod} />
            <section className="sarva-muniProfiler__mapPanel" aria-label="Municipality map"><div ref={mapContainerRef} className="sarva-muniProfiler__map" />
                <div className="sarva-profilerMapHint"><strong>{selected?.municipality || "Select a municipality"}</strong><span>Click a boundary or search above to view its source values.</span></div>
                {metricError && <p role="alert">{metricError}</p>}
                <div className="profiler-rawLegend"><strong>{metricData?.metric?.label || "Selected indicator"}</strong><small>{mapRecords.length ? `${metricData.metric.unit} · ${metricData.metric.period}` : "Insufficient verified data for this layer."}</small>
                    <div className="profiler-legendClasses">{scale.map((item, index) => <div key={item.value}><i style={{ background: item.colour }} /><span>{formatNumber(item.value, 1)}{index < scale.length - 1 ? ` – <${formatNumber(scale[index + 1].value, 1)}` : ` – ${formatNumber(Math.max(...mapRecords.map(record => Number(record.rawValue))), 1)}`}</span></div>)}</div>
                    <small>{mapRecords.length} municipalities · grey: insufficient verified data or a different measurement basis. Colours show magnitude, not risk.</small>
                </div>
            </section>
        </div>
        {visibleProfile && <div className="sarva-muniProfiler__actions"><button type="button" onClick={downloadProfilePdf}>Download source profile PDF</button></div>}
        <RawMunicipalIndicators key={visibleProfile?.municipality?.gid || "empty"} profile={visibleProfile} loading={profileLoading} error={profileError} onSelect={gid => { const item = municipalities.find(m => Number(m.gid) === Number(gid)); if (item) setSelected(item); }} />
    </div>;
}
