import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiUrl, martinUrl } from "../config/api";
import { isExpiredForecast } from "../config/forecastFreshness";
import MunicipalEvidenceSummary from "../components/MunicipalEvidenceSummary";
import { useCurrentUser } from "../hooks/useCurrentUser";
import "../styles/municipal-risk-profiler.css";

const MUNICIPAL_TILE_URL = martinUrl("/municipal_boundaries/{z}/{x}/{y}");
const SOUTH_AFRICA_BOUNDS = [
    [16.45, -34.84],
    [32.95, -22.13],
];
const SOUTH_AFRICA_CENTER = [24.7, -29.1];
const MAP_MAX_BOUNDS = [
    [8, -39],
    [41, -15],
];
const EMPTY = [];
const DEFAULT_METRIC = "index:imported_composite_risk";
const DEFAULT_METRIC_LABEL = "Relative indicator pressure";
const METRIC_DEEPLINKS = {
    governance: "index:imported_governance_risk",
    governance_audit: "index:governance_audit_compliance_imported",
    governance_finance: "index:governance_financial_resilience_imported",
    governance_infrastructure: "index:governance_infrastructure_investment_imported",
    governance_capacity: "index:governance_institutional_capacity_imported",
    safety: "index:crime_safety_imported",
    safety_violent: "index:safety_violent_contact_imported",
    safety_property: "index:safety_property_economic_imported",
    safety_gender: "index:safety_gender_violence_imported",
    safety_public_order: "index:safety_public_order_imported",
    services: "index:service_access_imported",
    people: "index:stats_sa_vulnerability_imported",
};
const LAYER_MODE_OPTIONS = [
    { key: "guided", label: "Start here", detail: "Best first layers" },
    { key: "indices", label: "Grouped scores", detail: "Combined inputs" },
    { key: "indicators", label: "Single indicators", detail: "Raw catalogue" },
];
const GUIDED_LAYER_KEYS = [
    {
        key: "imported_composite_risk",
        label: "Municipal risk overview",
        detail: "Balanced starting point",
    },
    {
        key: "imported_governance_risk",
        label: "Governance and finance",
        detail: "Audit, finance and delivery capacity",
    },
    {
        key: "crime_safety_imported",
        label: "Safety pressure",
        detail: "Combined SAPS safety context",
    },
    {
        key: "service_access_imported",
        label: "Basic service pressure",
        detail: "Water, sanitation, electricity and refuse",
    },
    {
        key: "stats_sa_vulnerability_imported",
        label: "People and vulnerability",
        detail: "Demographic and socio-economic context",
    },
];

const profilerStartCards = [
    {
        title: "1. Choose a layer",
        detail: "Start with the municipal risk overview, then switch to governance, safety, services or any individual indicator.",
    },
    {
        title: "2. Pick a municipality",
        detail: "Search by name/code or click the map. The side panel explains scores, raw values, sources and gaps.",
    },
    {
        title: "3. Read drivers first",
        detail: "Risk drivers show what is pushing the score up, so clients can see the practical story behind the map colour.",
    },
];

const plannedProfilerFeatures = [
    {
        title: "Client brief mode",
        detail: "A simplified one-page view for decision-makers with headline risks, confidence and recommended next questions.",
    },
    {
        title: "Scenario comparison",
        detail: "Compare baseline, forecast, climate-stress and intervention scenarios when scenario datasets are available.",
    },
    {
        title: "Layer gap audit",
        detail: "A national view showing which municipalities lack finance, governance, service, safety or vulnerability inputs.",
    },
    {
        title: "Lab tutorials",
        detail: "Data Science Lab walkthroughs explaining how each index is built and how to reproduce the analysis.",
    },
];

function formatNumber(value, digits = 1, fallback = "n/a") {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return number.toLocaleString("en-ZA", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
    });
}

function formatIndicatorValue(value, unit = "", fallback = "n/a") {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    const cleanUnit = String(unit || "").toLowerCase();
    const digits = /count|cases|people|household|persons/.test(cleanUnit) ? 0 : 1;
    const formatted = number.toLocaleString("en-ZA", {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
    });
    if (!unit || unit === "value") return formatted;
    if (/^%|percent/.test(cleanUnit)) return `${formatted}%`;
    return `${formatted} ${unit}`;
}

function formatDate(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return new Intl.DateTimeFormat("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date);
}

function trendDelta(records) {
    const values = records
        .map((record) => Number(record.rawValue ?? record.normalizedValue))
        .filter(Number.isFinite);
    if (values.length < 2) return null;
    return values[values.length - 1] - values[0];
}

function riskTone(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) return "unknown";
    if (value >= 80) return "very-high";
    if (value >= 60) return "high";
    if (value >= 40) return "moderate";
    if (value >= 20) return "low";
    return "very-low";
}

function scoreWidth(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0%";
    return `${Math.max(0, Math.min(100, number))}%`;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalise(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function slugText(value) {
    return normalise(value)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function resolveMetricDeepLink(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.includes(":")) return raw;
    return METRIC_DEEPLINKS[raw] || METRIC_DEEPLINKS[slugText(raw).replace(/-/g, "_")] || "";
}

function resolveThemeDeepLink(value, themes) {
    const raw = String(value || "").trim();
    if (!raw || raw === "All themes") return "All themes";
    const target = slugText(raw);
    return themes.find((theme) => slugText(theme) === target)
        || themes.find((theme) => slugText(theme).startsWith(target))
        || themes.find((theme) => slugText(theme).includes(target))
        || "All themes";
}

function textMatchesQuery(query, ...values) {
    const q = normalise(query);
    if (!q) return true;
    return values.some((value) => normalise(value).includes(q));
}

function defaultAdminForm(municipalityCode = "") {
    return {
        municipalityCode,
        indicatorKey: "",
        label: "",
        theme: "",
        unit: "",
        direction: "higher_risk",
        period: "",
        scenario: "admin import",
        rawValue: "",
        value_0_100: "",
        sourceName: "",
        sourceUrl: "",
        notes: "",
    };
}

function directionLabel(direction) {
    if (direction === "higher_resilience") return "Higher values reduce risk pressure";
    if (direction === "context") return "Context only, not used in risk pressure";
    return "Higher values increase risk pressure";
}

function directionExplanation(direction) {
    if (direction === "higher_resilience") {
        return "This is a resilience indicator. A higher source value is generally better, so SARVA inverts the normalized score before using it in a risk index. In plain terms: low access, low capacity or low attainment becomes higher risk pressure.";
    }
    if (direction === "context") {
        return "This is a context indicator. It helps describe the municipality but is not included in the composite risk calculation.";
    }
    return "This is a pressure indicator. A higher source value is treated as higher risk pressure after normalization.";
}

function scenarioLabel(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text === "baseline_proxy") return "screening baseline";
    if (text === "admin import") return "admin-entered value";
    return text.replace(/_/g, " ");
}

function confidenceLabel(value) {
    if (value === "proxy") return "screening proxy";
    if (value === "imported") return "imported dataset";
    if (value === "admin") return "admin-entered";
    return value || "";
}

function scoreExplanation(score, riskLabel = "") {
    const formatted = Number.isFinite(Number(score)) ? `${formatNumber(score, 1)} out of 100` : "Not available";
    return `${formatted}${riskLabel ? `, classified here as ${riskLabel}` : ""}. This is a normalized comparison score for comparing municipalities, not a raw count and not a percentage unless the source indicator unit says percent.`;
}

function sourceValueExplanation(component) {
    const rawLooksLikePlaceholder = component?.confidence === "proxy" && Number(component?.rawValue) === 0 && /0-100/i.test(component?.displayUnit || component?.unit || "");
    if (rawLooksLikePlaceholder) return "This record currently has a screening comparison score only; no separate raw source value is loaded yet.";
    const raw = formatIndicatorValue(component?.displayValue ?? component?.rawValue, component?.displayUnit ?? component?.unit);
    if (!raw || raw === "n/a") return "The raw source value is not available for this record, so the visible 0-100 comparison score is the usable value.";
    return `The source value for this municipality is ${raw}.`;
}

function riskInputExplanation(component) {
    const normalizedSource = component?.normalizedValue ?? component?.value ?? component?.adjustedValue;
    const normalizedText = Number.isFinite(Number(normalizedSource)) ? `${formatNumber(normalizedSource, 1)} / 100` : "not available";
    const adjustedText = Number.isFinite(Number(component?.adjustedValue)) ? `${formatNumber(component.adjustedValue, 1)} / 100` : "not available";
    if (component?.direction === "higher_resilience") {
        return `${sourceValueExplanation(component)} SARVA first converts it to a ${normalizedText} comparison score, then flips it because higher values mean more resilience. The risk-pressure input used in the index is therefore ${adjustedText}.`;
    }
    if (component?.direction === "context") {
        return `${sourceValueExplanation(component)} It may have a ${normalizedText} comparison score for mapping, but it is not used as a risk-pressure input.`;
    }
    return `${sourceValueExplanation(component)} SARVA converts it to a ${normalizedText} comparison score. Because higher values mean more pressure, the risk-pressure input used in the index is ${adjustedText}.`;
}

function weightExplanation(component) {
    const weight = Number(component?.weight);
    if (!Number.isFinite(weight)) return "No explicit composite weight is listed for this indicator.";
    const contribution = componentContribution(component);
    return `This indicator has a ${formatNumber(weight * 100, 0)}% weight in the selected composite. Its weighted contribution is ${formatNumber(contribution, 1)} points before SARVA divides by the total available weight. Low-weight indicators can highlight an issue, but they move the final score less than higher-weight drivers.`;
}

function sourceExplanation(component) {
    const source = sourceLabel(component);
    if (!source) return "Source metadata is not listed for this record.";
    const url = component?.sourceUrl ? ` URL: ${component.sourceUrl}` : "";
    const proxyNote = component?.confidence === "proxy" || component?.isProxy ? " This is a screening/proxy value and should be replaced with official imported data where available." : "";
    return `${source}.${url}${proxyNote}`;
}

function rawValueLabel(component) {
    const raw = formatIndicatorValue(component?.rawValue, component?.displayUnit ?? component?.unit);
    return raw && raw !== "n/a" ? raw : "";
}

function metricCoverageLabel(coverage) {
    if (!coverage || coverage.total === 0) return "Coverage not available";
    const missing = coverage.total - coverage.available;
    const percent = coverage.total > 0 ? (coverage.available / coverage.total) * 100 : 0;
    return `${coverage.available}/${coverage.total} municipalities mapped (${formatNumber(percent, 0)}%)${missing > 0 ? ` | ${missing} missing` : ""}`;
}

function componentContribution(component) {
    const score = Number(component.adjustedValue);
    const weight = Number(component.weight);
    if (!Number.isFinite(score) || !Number.isFinite(weight)) return 0;
    return score * weight;
}

function sourceLabel(component) {
    return [component.sourceName, component.period, scenarioLabel(component.scenario), confidenceLabel(component.confidence)]
        .filter(Boolean)
        .join(" | ");
}

function componentSummary(component) {
    const score = Number.isFinite(Number(component.adjustedValue))
        ? `${formatNumber(component.adjustedValue, 1)} / 100`
        : "no score";
    const weight = Number.isFinite(Number(component.weight)) ? `${formatNumber(Number(component.weight) * 100, 0)}% weight` : "no weighting";
    const source = sourceLabel(component) || "source not listed";
    const rawLooksLikePlaceholder = component.confidence === "proxy" && Number(component.rawValue) === 0 && /0-100/i.test(component.displayUnit || "");
    const raw = rawLooksLikePlaceholder
        ? "screening score only"
        : `raw value ${formatIndicatorValue(component.rawValue, component.displayUnit)}`;
    return `${component.label}: ${score}, ${weight}, ${raw}. ${source}.`;
}

function sourceList(components = []) {
    const sources = Array.from(new Set(
        components
            .map((component) => {
                const label = sourceLabel(component);
                if (!label) return "";
                return component.sourceUrl ? `${label} (${component.sourceUrl})` : label;
            })
            .filter(Boolean)
    ));
    if (sources.length === 0) return "Underlying component sources are not listed for this index.";
    const shown = sources.slice(0, 6).join("; ");
    const more = sources.length > 6 ? `; plus ${sources.length - 6} more source groups` : "";
    return `${shown}${more}.`;
}

function forecastWindowLabel(forecast = {}) {
    const start = formatDate(forecast.forecastStart);
    const end = formatDate(forecast.forecastEnd);
    if (start === "Not available" && end === "Not available") return "Forecast dates not available";
    return `${start} to ${end}`;
}

function forecastSourceLabel(forecast = {}) {
    return [
        forecast.latestRun?.source || "SARVA cached forecast risk layer",
        forecastWindowLabel(forecast),
        forecast.latestRun?.finishedAt ? `updated ${formatDate(forecast.latestRun.finishedAt)}` : "",
    ].filter(Boolean).join(" | ");
}

function indexCoverageLabel(index = {}) {
    const available = Number(index.indicatorCount);
    const expected = Number(index.expectedIndicatorCount);
    if (!Number.isFinite(expected) || expected <= 0) return "Coverage not listed";
    const percent = Number.isFinite(Number(index.coveragePercent))
        ? `${formatNumber(index.coveragePercent, 0)}%`
        : `${formatNumber((available / expected) * 100, 0)}%`;
    return `${Number.isFinite(available) ? available : 0}/${expected} inputs available (${percent})`;
}

function missingInputSummary(index = {}) {
    const missing = Array.isArray(index.missingComponents) ? index.missingComponents : EMPTY;
    if (missing.length === 0) return "No missing inputs listed for this index in the current profile.";
    const shown = missing.slice(0, 4).map((component) => component.label || component.key).join(", ");
    const more = missing.length > 4 ? `, plus ${missing.length - 4} more` : "";
    return `${shown}${more}`;
}

function findIndicator(records = [], patterns = []) {
    return records.find((indicator) => {
        const text = `${indicator.key || ""} ${indicator.label || ""} ${indicator.theme || ""}`.toLowerCase();
        return patterns.some((pattern) => pattern.test(text));
    }) || null;
}

function indexFormula(index) {
    const components = Array.isArray(index.components) ? index.components : EMPTY;
    const valid = components.filter((component) => Number.isFinite(Number(component.adjustedValue)) && Number.isFinite(Number(component.weight)));
    if (valid.length === 0) {
        return "No component scores are available, so this index cannot be recalculated from visible inputs.";
    }
    const totalWeight = valid.reduce((sum, component) => sum + Number(component.weight), 0);
    const totalContribution = valid.reduce((sum, component) => sum + componentContribution(component), 0);
    const top = [...valid].sort((a, b) => componentContribution(b) - componentContribution(a)).slice(0, 3);
    return `The index combines ${valid.length} component indicators. Each component is converted to a 0-100 comparison score, adjusted so higher means more risk pressure, multiplied by its weight, then averaged. For this municipality the weighted total is ${formatNumber(totalContribution, 1)} divided by total weight ${formatNumber(totalWeight, 2)}, giving ${formatNumber(index.score, 1)} out of 100. Largest contributors: ${top.map((component) => `${component.label} (${formatNumber(componentContribution(component), 1)} weighted points)`).join(", ")}.`;
}

function indexInputSummary(index) {
    const components = Array.isArray(index.components) ? index.components : EMPTY;
    if (components.length === 0) return "Component details are not available.";
    const sorted = [...components].sort((a, b) => componentContribution(b) - componentContribution(a));
    const shown = sorted.slice(0, 6).map(componentSummary).join(" ");
    const more = sorted.length > 6 ? ` ${sorted.length - 6} further inputs are included in the full indicator catalogue and PDF export.` : "";
    return `${shown}${more}`;
}

function htmlList(items) {
    const cleanItems = items.filter(Boolean);
    if (cleanItems.length === 0) return "<p>Not available.</p>";
    return `<ul>${cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
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

    function line(x1, y1, x2, y2, color = colors.border, width = 1) {
        current.push({ type: "line", x1, y1, x2, y2, color, width });
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

    actions({ write, gap, newPage, rect, line, sectionTitle, statCard, scoreBar, colors, pageWidth, pageHeight, margin });
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
                        `/F1 7 Tf 1 0 0 1 ${margin.toFixed(2)} 20.00 Tm (${pdfEscape("SARVA v4 municipal risk screening profile - not an official warning")}) Tj`,
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
    const { token, isAdmin } = useCurrentUser();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const popupRef = useRef(null);
    const metricRecordsRef = useRef(new Map());
    const metricLabelRef = useRef("Selected layer");
    const mapViewModeRef = useRef("country");
    const municipalitiesRef = useRef([]);
    const [municipalities, setMunicipalities] = useState([]);
    const [municipalitiesLoading, setMunicipalitiesLoading] = useState(true);
    const [municipalitiesError, setMunicipalitiesError] = useState("");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(null);
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState("");
    const [selectedMetric, setSelectedMetric] = useState(DEFAULT_METRIC);
    const [metricData, setMetricData] = useState(null);
    const [metricLoading, setMetricLoading] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);
    const [detailInfo, setDetailInfo] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [adminStatus, setAdminStatus] = useState(null);
    const [adminMessage, setAdminMessage] = useState("");
    const [adminForm, setAdminForm] = useState(defaultAdminForm());
    const [adminValues, setAdminValues] = useState([]);
    const [adminValuesLoading, setAdminValuesLoading] = useState(false);
    const [adminRefreshKey, setAdminRefreshKey] = useState(0);
    const [trendIndicatorKey, setTrendIndicatorKey] = useState("");
    const [trendData, setTrendData] = useState(null);
    const [trendLoading, setTrendLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [indicatorThemeFilter, setIndicatorThemeFilter] = useState("All themes");
    const [layerMode, setLayerMode] = useState("guided");
    const [layerThemeFilter, setLayerThemeFilter] = useState("All themes");
    const [layerSearch, setLayerSearch] = useState("");
    const [layerBrowserOpen, setLayerBrowserOpen] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const metric = resolveMetricDeepLink(params.get("metric"));
        const tab = String(params.get("tab") || "").trim();

        if (metric) {
            setSelectedMetric(metric);
            setLayerMode(metric.startsWith("indicator:") ? "indicators" : "indices");
        }
        if (tab) setActiveTab(tab);
    }, [location.search]);

    const matchingMunicipalities = useMemo(() => {
        const q = normalise(query);
        if (!q) return EMPTY;
        return municipalities
            .filter((item) =>
                [item.municipality, item.province, item.district, item.code]
                    .map(normalise)
                    .some((value) => value.includes(q))
            )
            .slice(0, 8);
    }, [municipalities, query]);

    useEffect(() => {
        municipalitiesRef.current = municipalities;
    }, [municipalities]);

    function fitMapBounds(bounds, options = {}) {
        const map = mapRef.current;
        if (!map) return;
        const run = () => {
            if (!mapRef.current) return;
            map.stop();
            map.resize();
            map.fitBounds(bounds, {
                padding: options.padding ?? 28,
                duration: options.duration ?? 650,
                maxZoom: options.maxZoom ?? 5,
            });
        };
        if (!map.loaded()) {
            map.once("load", run);
            return;
        }
        run();
        requestAnimationFrame(run);
    }

    function fitCountryView(options = {}) {
        const map = mapRef.current;
        if (!map) return;
        const run = () => {
            if (!mapRef.current) return;
            const width = map.getContainer()?.clientWidth || 900;
            const zoom = width < 720 ? 3.45 : width < 1050 ? 3.75 : 3.95;
            map.stop();
            map.resize();
            map.easeTo({
                center: SOUTH_AFRICA_CENTER,
                zoom,
                bearing: 0,
                pitch: 0,
                duration: options.duration ?? 650,
            });
        };
        if (!map.loaded()) {
            map.once("load", run);
            return;
        }
        run();
        requestAnimationFrame(run);
    }

    function selectMunicipalityFromSearch(event) {
        event?.preventDefault();
        const q = normalise(query);
        if (!q) return;
        const exact = municipalities.find((item) =>
            normalise(item.municipality) === q ||
            normalise(item.code) === q ||
            normalise(`${item.municipality} | ${item.district} | ${item.province}`) === q
        );
        const match = exact || matchingMunicipalities[0];
        if (match) {
            mapViewModeRef.current = "municipality";
            setSelected(match);
        }
    }

    useEffect(() => {
        const controller = new AbortController();
        setMunicipalitiesLoading(true);
        fetch(apiUrl("/api/municipalities"), { signal: controller.signal })
            .then((response) => response.json())
            .then((body) => {
                if (body?.status !== "ok") throw new Error(body?.message || "Municipalities could not be loaded");
                const records = Array.isArray(body.data?.records) ? body.data.records : EMPTY;
                setMunicipalities(records);
            })
            .catch((error) => {
                if (error.name !== "AbortError") setMunicipalitiesError(error.message);
            })
            .finally(() => setMunicipalitiesLoading(false));
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return undefined;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            center: SOUTH_AFRICA_CENTER,
            zoom: 4.05,
            attributionControl: false,
            scrollZoom: true,
            minZoom: 3,
            maxBounds: MAP_MAX_BOUNDS,
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
                            "fill-color": [
                                "case",
                                ["boolean", ["feature-state", "hover"], false],
                                "#f3c66a",
                                ["!", ["boolean", ["feature-state", "hasMetric"], false]],
                                "#c7c7bf",
                                [
                                    "interpolate",
                                    ["linear"],
                                    ["coalesce", ["feature-state", "metricValue"], 0],
                                    0,
                                    "#d9ead7",
                                    25,
                                    "#a7c98b",
                                    50,
                                    "#e7c95f",
                                    75,
                                    "#d47a4d",
                                    100,
                                    "#9d3f32",
                                ],
                            ],
                            "fill-opacity": [
                                "case",
                                ["boolean", ["feature-state", "selected"], false],
                                0.82,
                                ["boolean", ["feature-state", "hover"], false],
                                0.68,
                                0.42,
                            ],
                        },
                    },
                    {
                        id: "municipal-profile-line",
                        type: "line",
                        source: "municipal_boundaries",
                        "source-layer": "municipalities",
                        paint: {
                            "line-color": "#203a31",
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
            map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
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

    function zoomToCountry() {
        mapViewModeRef.current = "country";
        fitCountryView({ duration: 650 });
    }

    useEffect(() => {
        if (!selected?.gid) return undefined;
        const controller = new AbortController();
        setProfileLoading(true);
        setProfileError("");
        fetch(apiUrl(`/api/municipalities/${selected.gid}/profile`), { signal: controller.signal })
            .then((response) => response.json())
            .then((body) => {
                if (body?.status !== "ok") throw new Error(body?.message || "Profile could not be loaded");
                setProfile(body.data);
                const bbox = body.data?.municipality?.bbox || selected.bbox;
                if (bbox && mapRef.current && mapViewModeRef.current !== "country") {
                    fitMapBounds(
                        [
                            [bbox[0], bbox[1]],
                            [bbox[2], bbox[3]],
                        ],
                        { padding: 52, duration: 650, maxZoom: 9 }
                    );
                }
            })
            .catch((error) => {
                if (error.name !== "AbortError") setProfileError(error.message);
            })
            .finally(() => setProfileLoading(false));
        return () => controller.abort();
    }, [selected]);

    useEffect(() => {
        const controller = new AbortController();
        setMetricLoading(true);
        fetch(apiUrl(`/api/municipalities/metric?metric=${encodeURIComponent(selectedMetric)}`), { signal: controller.signal })
            .then((response) => response.json())
            .then((body) => {
                if (body?.status !== "ok") throw new Error(body?.message || "Metric could not be loaded");
                setMetricData(body.data);
            })
            .catch((error) => {
                if (error.name !== "AbortError") setMetricData(null);
            })
            .finally(() => setMetricLoading(false));
        return () => controller.abort();
    }, [selectedMetric]);

    useEffect(() => {
        const controller = new AbortController();
        fetch(apiUrl("/api/municipalities/metadata"), { signal: controller.signal })
            .then((response) => response.json())
            .then((body) => {
                if (body?.status === "ok") setMetadata(body.data);
            })
            .catch(() => {});
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!isAdmin || !token) {
            setAdminStatus(null);
            return undefined;
        }
        const controller = new AbortController();
        fetch(apiUrl("/api/municipalities/admin/import-status"), {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((response) => response.json())
            .then((body) => {
                if (body?.status === "ok") setAdminStatus(body.data);
            })
            .catch(() => {});
        return () => controller.abort();
    }, [isAdmin, token]);

    useEffect(() => {
        if (!isAdmin || !token || !selected?.gid) {
            setAdminValues([]);
            return undefined;
        }
        const controller = new AbortController();
        setAdminValuesLoading(true);
        fetch(apiUrl(`/api/municipalities/${selected.gid}/admin/indicator-values`), {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((response) => response.json())
            .then((body) => {
                if (body?.status !== "ok") throw new Error(body?.message || "Admin values could not be loaded");
                setAdminValues(Array.isArray(body.data?.records) ? body.data.records : EMPTY);
            })
            .catch(() => setAdminValues([]))
            .finally(() => setAdminValuesLoading(false));
        return () => controller.abort();
    }, [isAdmin, token, selected?.gid, adminRefreshKey]);

    useEffect(() => {
        if (!selected?.code) return;
        setAdminForm((current) => {
            if (current.municipalityCode && current.municipalityCode !== selected.code) return current;
            return { ...current, municipalityCode: selected.code };
        });
    }, [selected?.code]);

    useEffect(() => {
        const map = mapRef.current;
        const records = Array.isArray(metricData?.records) ? metricData.records : EMPTY;
        if (!map || !mapReady) return;
        metricLabelRef.current = metricData?.metric?.label || "Selected layer";
        const recordsByGid = new Map(records.map((record) => [Number(record.gid), record]));
        metricRecordsRef.current = recordsByGid;
        const applyMetricState = () => {
            municipalities.forEach((municipality) => {
                const record = recordsByGid.get(Number(municipality.gid));
                const hasMetric = Number.isFinite(Number(record?.mapValue));
                map.setFeatureState(
                    { source: "municipal_boundaries", sourceLayer: "municipalities", id: Number(municipality.gid) },
                    {
                        hasMetric,
                        metricValue: hasMetric ? Number(record.mapValue) : null,
                        metricDisplay: hasMetric ? formatIndicatorValue(record.displayValue, record.displayUnit) : "No data",
                    }
                );
            });
        };
        if (map.isStyleLoaded()) applyMetricState();
        else map.once("load", applyMetricState);
    }, [metricData, mapReady, municipalities]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !selected?.gid) return;
        const applyState = () => {
            for (const item of municipalities) {
                map.setFeatureState(
                    { source: "municipal_boundaries", sourceLayer: "municipalities", id: Number(item.gid) },
                    { selected: Number(item.gid) === Number(selected.gid) }
                );
            }
        };
        if (map.isStyleLoaded()) applyState();
        else map.once("load", applyState);
    }, [municipalities, selected]);

    useEffect(() => {
        if (!selected?.gid || !trendIndicatorKey) {
            setTrendData(null);
            return undefined;
        }
        const controller = new AbortController();
        setTrendLoading(true);
        fetch(apiUrl(`/api/municipalities/${selected.gid}/indicators/${encodeURIComponent(trendIndicatorKey)}/trend`), {
            signal: controller.signal,
        })
            .then((response) => response.json())
            .then((body) => {
                if (body?.status !== "ok") throw new Error(body?.message || "Trend could not be loaded");
                setTrendData(body.data);
            })
            .catch((error) => {
                if (error.name !== "AbortError") setTrendData(null);
            })
            .finally(() => setTrendLoading(false));
        return () => controller.abort();
    }, [selected?.gid, trendIndicatorKey]);

    function updateAdminField(field, value) {
        setAdminForm((current) => ({ ...current, [field]: value }));
    }

    function showExplanation(title, rows) {
        setDetailInfo({
            title,
            rows: rows.filter((row) => row?.value),
        });
    }

    function infoButton(title, rows) {
        return (
            <button
                type="button"
                className="sarva-muniProfiler__miniInfo"
                onClick={() => showExplanation(title, rows)}
                aria-label={`Explain ${title}`}
                title={`Explain ${title}`}
            >
                i
            </button>
        );
    }

    function editAdminValue(record) {
        setActiveTab("admin");
        setAdminMessage("Editing admin-entered value. Save will update the selected period and scenario.");
        setAdminForm({
            municipalityCode: record.municipalityCode || selected?.code || "",
            indicatorKey: record.indicatorKey || "",
            label: record.label || "",
            theme: record.theme || "",
            unit: record.displayUnit || record.unit || "",
            direction: record.direction || "higher_risk",
            period: record.period || "",
            scenario: record.scenario || "admin import",
            rawValue: record.rawValue ?? "",
            value_0_100: record.normalizedValue ?? "",
            sourceName: record.sourceName || "",
            sourceUrl: record.sourceUrl || "",
            notes: record.notes || "",
        });
    }

    async function deleteAdminValue(record) {
        if (!token) return;
        const ok = window.confirm(`Delete admin value "${record.label || record.indicatorKey}" for ${record.period}? Imported and proxy data will not be touched.`);
        if (!ok) return;
        setAdminMessage("Deleting...");
        try {
            const response = await fetch(apiUrl("/api/municipalities/admin/indicator-values"), {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    municipalityCode: record.municipalityCode || selected?.code,
                    indicatorKey: record.indicatorKey,
                    period: record.period,
                    scenario: record.scenario,
                }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error(body?.message || "Could not delete admin value");
            setAdminMessage("Deleted. Refreshing profile data...");
            setAdminRefreshKey((value) => value + 1);
            setSelected((current) => (current ? { ...current } : current));
            setMetricData(null);
        } catch (error) {
            setAdminMessage(error.message);
        }
    }

    async function submitAdminIndicator(event) {
        event.preventDefault();
        if (!token) return;
        setAdminMessage("Saving...");
        try {
            const response = await fetch(apiUrl("/api/municipalities/admin/indicator-values"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(adminForm),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error(body?.message || "Could not save indicator value");
            setAdminMessage("Saved. Refreshing profile data...");
            setAdminRefreshKey((value) => value + 1);
            setSelected((current) => (current ? { ...current } : current));
            setMetricData(null);
        } catch (error) {
            setAdminMessage(error.message);
        }
    }

    function downloadMunicipalProfilePdf() {
        if (!profile) return;
        const municipality = profile.municipality || {};
        const title = `${municipality.municipality || "Municipal"} risk profile`;
        const allSources = new Set();
        indices.forEach((index) => (index.components || []).forEach((component) => {
            const source = sourceLabel(component);
            if (source) allSources.add(source);
        }));
        indicatorRecords.forEach((indicator) => {
            const source = [indicator.sourceName, indicator.period, scenarioLabel(indicator.scenario), confidenceLabel(indicator.confidence)].filter(Boolean).join(" | ");
            if (source) allSources.add(source);
        });
        if (forecast.latestRun?.source) allSources.add(forecastSourceLabel(forecast));

        const sortedIndices = [...indices].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
        const topDrivers = [...drivers].sort((a, b) => (Number(b.contribution) || 0) - (Number(a.contribution) || 0)).slice(0, 8);
        const highestIndicators = [...indicatorRecords]
            .filter((indicator) => !indicator.isProxy && indicator.confidence !== "proxy" && indicator.adjustedValue != null && Number.isFinite(Number(indicator.adjustedValue)))
            .sort((a, b) => Number(b.adjustedValue) - Number(a.adjustedValue))
            .slice(0, 10);

        const blob = buildPdf(({ write, gap, newPage, rect, line, sectionTitle, statCard, scoreBar, colors, pageWidth, margin }) => {
            rect(0, 841.89, pageWidth, 132, { fill: colors.primary });
            write("SARVA Municipal Risk Profile", { font: "F2", size: 20, maxChars: 48, after: 4, color: colors.surface });
            write(title, { font: "F2", size: 28, maxChars: 34, color: colors.surface });
            write([municipality.district, municipality.province, municipality.code].filter(Boolean).join(" | "), { size: 11, color: colors.pale, after: 8 });
            write(`Generated ${formatDate(new Date().toISOString())} | Screening profile for planning support`, { size: 9, color: colors.pale });
            write(`Forecast layer: ${forecastWindowLabel(forecast)} | ${forecast.latestRun?.source || "SARVA cached forecast risk layer"}`, { size: 8, color: colors.pale });
            write("Relative indicator comparisons; not probabilities of harm. Exposure and losses are not assessed.", { size: 8, color: colors.pale });
            write(isExpiredForecast(String(forecast.forecastEnd || "").slice(0, 10)) ? "Expired forecast: historical context only." : "Check forecast dates and official updates before use.", { size: 8, color: colors.pale });
            gap(22);

            const cardTop = 674;
            const cardGap = 8;
            const cardWidth = (pageWidth - margin * 2 - cardGap * 2) / 3;
            topStatCards.slice(0, 6).forEach((card, index) => {
                const row = Math.floor(index / 3);
                const col = index % 3;
                statCard(
                    margin + col * (cardWidth + cardGap),
                    cardTop - row * 66,
                    cardWidth,
                    card.label,
                    card.value,
                    card.note
                );
            });
            gap(118);

            sectionTitle("Executive snapshot", "key findings");
            write("Municipal risk scores and 5-day forecast risk are separate views. Municipal risk uses available static indicator data, while the forecast risk uses cached model points for the listed forecast window.", { size: 9, maxChars: 105 });
            write(`Municipal risk source: ${primaryIndex ? sourceList(primaryIndex.components) : "No municipal composite source available."}`, { size: 8, maxChars: 112 });
            write(`5-day forecast source: ${forecastSourceLabel(forecast)}.`, { size: 8, maxChars: 112 });
            gap(6);
            keyFindingCards.slice(0, 8).forEach((card) => {
                if (Number.isFinite(Number(card.score))) {
                    scoreBar(`${card.label}: ${card.value}`, card.score, card.detail, { indent: 4 });
                } else {
                    write(`${card.label}: ${card.value}. ${card.detail}`, { size: 9, indent: 4, maxChars: 105 });
                }
            });
            gap(4);

            sectionTitle("Municipal indices", "normalized 0-100 scores");
            sortedIndices.slice(0, 6).forEach((index) => {
                scoreBar(index.label, index.score, `${index.riskLabel}. ${index.description || ""}`, { indent: 4 });
            });
            gap(4);

            sectionTitle("Risk drivers", "largest contributors");
            if (topDrivers.length === 0) {
                write("No risk driver records are available for this municipality.", { size: 10 });
            } else {
                topDrivers.forEach((driver) => {
                    scoreBar(driver.label, driver.adjustedValue, `${driver.theme || "Indicator"} | weight ${formatNumber(driver.weight, 2)} | source ${driver.sourceName || "not listed"}`, { indent: 4, size: 8 });
                });
            }

            newPage();
            sectionTitle("5-day forecast screening", forecastWindowLabel(forecast));
            riskCards.forEach((card) => {
                scoreBar(`${card.label}: ${card.value || "n/a"}`, card.score, `${card.explanation} ${forecastSourceLabel(forecast)}.`, { indent: 4 });
            });
            gap(6);

            sectionTitle("Highest indicator pressures", "raw values and source context");
            highestIndicators.forEach((indicator) => {
                scoreBar(
                    `${indicator.label}: ${formatIndicatorValue(indicator.displayValue, indicator.displayUnit)}`,
                    indicator.adjustedValue,
                    `${directionLabel(indicator.direction)} | ${[indicator.sourceName, indicator.period, scenarioLabel(indicator.scenario), confidenceLabel(indicator.confidence)].filter(Boolean).join(" | ") || "source not listed"}`,
                    { indent: 4, size: 8 }
                );
            });

            newPage();
            sectionTitle("Municipal indices explained", "inputs and method");
            if (indices.length === 0) write("No municipal indices available.", { size: 10 });
            indices.forEach((index) => {
                write(index.label, { font: "F2", size: 12, after: 2 });
                scoreBar(`${index.riskLabel} index score`, index.score, index.description || "", { indent: 8, size: 8 });
                write(indexFormula(index), { size: 8, indent: 8, maxChars: 110 });
                write(`Main inputs: ${indexInputSummary(index)}`, { size: 8, indent: 8, maxChars: 110 });
                gap(6);
            });

            newPage();
            sectionTitle("Indicator catalogue", "grouped by category");
            themes.forEach((theme) => {
                write(theme.theme, { font: "F2", size: 12, after: 2 });
                theme.records.slice(0, 14).forEach((indicator) => {
                    const source = [indicator.sourceName, indicator.period, scenarioLabel(indicator.scenario), confidenceLabel(indicator.confidence)].filter(Boolean).join(" | ") || "source not listed";
                    write(`${indicator.label}: ${formatIndicatorValue(indicator.displayValue, indicator.displayUnit)} | score ${formatNumber(indicator.normalizedValue, 1)} / 100 | ${source}`, { size: 7.5, indent: 8, maxChars: 116 });
                });
                if (theme.records.length > 14) {
                    write(`${theme.records.length - 14} additional ${theme.theme} indicators are available in the live profiler.`, { size: 7.5, indent: 8 });
                }
                gap(6);
            });

            newPage();
            sectionTitle("Nearby SAEON observations", "within 120 km");
            if (profile.observationSites.length === 0) {
                write("No observation sites were found within 120 km of this municipality.", { size: 10 });
            } else {
                profile.observationSites.forEach((site) => {
                    write(`${site.displayName || site.stationName}: ${site.inside ? "inside municipality" : `${formatNumber(site.distanceKm)} km away`}`, { size: 9, indent: 8 });
                });
            }
            gap(8);
            sectionTitle("Footnotes and sources", "interpretation notes");
            (metadata?.calculationNotes || []).forEach((note, index) => {
                write(`${index + 1}. ${note.title}: ${note.body}`, { size: 8, indent: 6, maxChars: 112 });
            });
            write("Data source groups", { font: "F2", size: 10, after: 2 });
            Array.from(allSources).forEach((source, index) => write(`${index + 1}. ${source}`, { size: 8, indent: 6, maxChars: 112 }));
            gap(6);
            write(profile.description || "", { size: 8, maxChars: 112 });
        });

        const slug = pdfSafe(municipality.municipality || "municipal-profile").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "municipal-profile";
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${slug}-sarva-risk-profile.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    const forecast = profile?.forecast || {};
    const municipalIndicators = profile?.indicators || {};
    const indices = Array.isArray(municipalIndicators.indices) ? municipalIndicators.indices : EMPTY;
    const drivers = Array.isArray(municipalIndicators.drivers) ? municipalIndicators.drivers : EMPTY;
    const themes = Array.isArray(municipalIndicators.themes) ? municipalIndicators.themes : EMPTY;
    const indicatorRecords = Array.isArray(municipalIndicators.records) ? municipalIndicators.records : EMPTY;
    const indicatorThemes = ["All themes", ...Array.from(new Set(indicatorRecords.map((indicator) => indicator.theme || "Other"))).sort()];

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const theme = params.get("theme");
        if (!theme) return;
        setIndicatorThemeFilter(resolveThemeDeepLink(theme, indicatorThemes));
    }, [indicatorThemes, location.search]);

    const filteredThemes = themes
        .map((theme) => ({
            ...theme,
            records: indicatorThemeFilter === "All themes"
                ? theme.records
                : theme.records.filter((indicator) => (indicator.theme || "Other") === indicatorThemeFilter),
        }))
        .filter((theme) => theme.records.length > 0);
    const trendCandidates = indicatorRecords
        .filter((indicator) => /population|crime|household|unemployment|water|sanitation|electricity|subindex|income/i.test(`${indicator.key} ${indicator.label} ${indicator.theme}`))
        .slice(0, 8);
    const globalIndicators = Array.isArray(metadata?.indicators) ? metadata.indicators : EMPTY;
    const globalIndices = Array.isArray(metadata?.indices) ? metadata.indices : EMPTY;
    const mapLayerIndicators = indicatorRecords.length > 0 ? indicatorRecords : globalIndicators;
    const mapLayerIndices = indices.length > 0 ? indices : globalIndices;
    const mapLayerThemes = ["All themes", ...Array.from(new Set(mapLayerIndicators.map((indicator) => indicator.theme || "Other"))).sort()];
    const metricIndexOptions = mapLayerIndices.map((index) => ({
        value: `index:${index.key}`,
        label: index.key === "imported_composite_risk" ? DEFAULT_METRIC_LABEL : index.label,
        theme: index.theme || "Indices",
        description: index.description || "",
    }));
    const guidedLayerCards = GUIDED_LAYER_KEYS.map((layer) => {
        const option = metricIndexOptions.find((item) => item.value === `index:${layer.key}`);
        if (!option) return null;
        return {
            ...layer,
            value: option.value,
            label: layer.key === "imported_composite_risk" ? DEFAULT_METRIC_LABEL : layer.label,
            description: option.description,
        };
    }).filter(Boolean);
    const indexThemeOptions = [
        "All themes",
        ...Array.from(new Set(mapLayerIndices.map((index) => index.theme || "Other"))).sort(),
    ];
    const filteredMetricIndexOptions = metricIndexOptions.filter((option) => (
        (layerThemeFilter === "All themes" || option.theme === layerThemeFilter)
        && textMatchesQuery(layerSearch, option.label, option.theme, option.description)
    ));
    const metricIndicatorGroups = mapLayerThemes
        .filter((theme) => theme !== "All themes")
        .map((theme) => ({
            theme,
            options: mapLayerIndicators
                .filter((indicator) => (indicator.theme || "Other") === theme)
                .map((indicator) => ({
                    value: `indicator:${indicator.key}`,
                    label: indicator.label,
                    theme: indicator.theme || "Other",
                    description: indicator.description || "",
                })),
        }))
        .filter((group) => group.options.length > 0);
    const layerThemeOptions = layerMode === "indices" ? indexThemeOptions : mapLayerThemes;
    const filteredMetricIndicatorGroups = metricIndicatorGroups
        .filter((group) => layerThemeFilter === "All themes" || group.theme === layerThemeFilter)
        .map((group) => ({
            ...group,
            options: group.options.filter((option) => textMatchesQuery(layerSearch, option.label, option.theme, option.description)),
        }))
        .filter((group) => group.options.length > 0);
    const visibleLayerOptionCount = layerMode === "guided"
        ? guidedLayerCards.length
        : layerMode === "indices"
            ? filteredMetricIndexOptions.length
            : filteredMetricIndicatorGroups.reduce((total, group) => total + group.options.length, 0);
    const selectedMetricIsVisible = (() => {
        if (layerMode === "guided") return guidedLayerCards.some((option) => option.value === selectedMetric);
        if (layerMode === "indices") return filteredMetricIndexOptions.some((option) => option.value === selectedMetric);
        return filteredMetricIndicatorGroups.some((group) => group.options.some((option) => option.value === selectedMetric));
    })();
    const activeMetric = metricData?.metric || {};
    const activeMetricLabel = selectedMetric === DEFAULT_METRIC
        ? (activeMetric.label || DEFAULT_METRIC_LABEL)
        : (activeMetric.label || "Selected layer");
    const metricRecords = Array.isArray(metricData?.records) ? metricData.records : EMPTY;
    const metricCoverage = {
        total: municipalities.length,
        available: metricRecords.filter((record) => Number.isFinite(Number(record.mapValue))).length,
    };
    const missingProfileInputs = (() => {
        const byKey = new Map();
        indices.forEach((index) => {
            (Array.isArray(index.missingComponents) ? index.missingComponents : EMPTY).forEach((component) => {
                if (!component?.key || byKey.has(component.key)) return;
                byKey.set(component.key, component);
            });
        });
        return [...byKey.values()].sort((a, b) => `${a.theme || ""} ${a.label || a.key}`.localeCompare(`${b.theme || ""} ${b.label || b.key}`));
    })();
    const [selectedMetricKind, selectedMetricKey] = selectedMetric.includes(":")
        ? selectedMetric.split(":", 2)
        : ["index", selectedMetric];
    const selectedLayerProfileStatus = (() => {
        if (!profile) return null;
        if (selectedMetricKind === "indicator") {
            const indicator = indicatorRecords.find((item) => item.key === selectedMetricKey);
            if (!indicator) {
                return {
                    tone: "missing",
                    title: "Selected layer missing here",
                    detail: `${activeMetricLabel} has no loaded value for ${profile.municipality.municipality}. It is excluded from this municipality's local calculations until a source row is imported.`,
                };
            }
            return {
                tone: indicator.isProxy ? "partial" : "available",
                title: indicator.isProxy ? "Selected layer is proxy data" : "Selected layer available here",
                detail: `${rawValueLabel(indicator) ? `Raw value ${rawValueLabel(indicator)}. ` : ""}Comparison score ${formatNumber(indicator.normalizedValue, 1)} / 100. ${sourceLabel(indicator) || "Source metadata not listed."}`,
            };
        }
        const index = indices.find((item) => item.key === selectedMetricKey);
        if (!index) {
            return {
                tone: "missing",
                title: "Selected index missing here",
                detail: `${activeMetricLabel} cannot be calculated for this municipality because none of its component inputs are currently loaded.`,
            };
        }
        const missingCount = Array.isArray(index.missingComponents) ? index.missingComponents.length : 0;
        return {
            tone: missingCount > 0 ? "partial" : "available",
            title: missingCount > 0 ? "Selected index has data gaps" : "Selected index fully covered here",
            detail: `${indexCoverageLabel(index)}. ${missingCount > 0 ? `Missing: ${missingInputSummary(index)}.` : "No missing component inputs are listed for this municipality."}`,
        };
    })();
    const primaryIndex = indices.find((index) => index.key === "imported_composite_risk")
        || indices.find((index) => index.key === "composite_risk")
        || indices.find((index) => /overall/i.test(`${index.theme} ${index.label}`))
        || indices[0]
        || null;
    const serviceIndex = indices.find((index) => /service/i.test(`${index.key} ${index.label} ${index.theme}`)) || null;
    const crimeIndex = indices.find((index) => /crime|safety|security/i.test(`${index.key} ${index.label} ${index.theme}`)) || null;
    const populationIndicator = findIndicator(indicatorRecords, [/total.population/, /population.total/, /^population /]);
    const householdIndicator = findIndicator(indicatorRecords, [/households?/, /household.total/]);
    const unemploymentIndicator = findIndicator(indicatorRecords, [/unemployment/]);
    const crimeIndicator = findIndicator(indicatorRecords, [/crime/, /serious.total/, /safety/]);
    const leadingDrivers = [...drivers]
        .filter((driver) => Number.isFinite(Number(driver.adjustedValue)))
        .sort((a, b) => (Number(b.contribution) || 0) - (Number(a.contribution) || 0))
        .slice(0, 3);
    const topStatCards = [
        {
            label: "Area",
            value: formatNumber(profile?.municipality?.areaKm2, 0),
            note: "km2",
        },
        primaryIndex && {
            label: "Municipal risk",
            value: primaryIndex.riskLabel || "n/a",
            note: `${formatNumber(primaryIndex.score, 1)} / 100 | static indicators`,
        },
        {
            label: "5-day forecast risk",
            value: forecast.overallRiskLabel || "n/a",
            note: `${formatNumber(forecast.overallRiskScore, 0)} / 100 | ECMWF forecast`,
        },
        populationIndicator && {
            label: "Population",
            value: formatIndicatorValue(populationIndicator.displayValue, populationIndicator.displayUnit),
            note: [populationIndicator.period, populationIndicator.sourceName].filter(Boolean).join(" | "),
        },
        crimeIndex && {
            label: "Crime/safety risk",
            value: crimeIndex.riskLabel || "n/a",
            note: `${formatNumber(crimeIndex.score, 1)} / 100 | SAPS/static`,
        },
        !crimeIndex && crimeIndicator && {
            label: "Crime/safety risk",
            value: `${formatNumber(crimeIndicator.adjustedValue, 1)} / 100`,
            note: crimeIndicator.label,
        },
        serviceIndex && {
            label: "Service pressure",
            value: serviceIndex.riskLabel || "n/a",
            note: `${formatNumber(serviceIndex.score, 1)} / 100 | Stats SA/static`,
        },
        {
            label: "Forecast points",
            value: String(forecast.pointCount || 0),
            note: forecastWindowLabel(forecast),
        },
        {
            label: "Indicators",
            value: String(municipalIndicators.records?.length || 0),
            note: `${themes.length} categories`,
        },
    ].filter(Boolean);
    const keyFindingCards = [
        primaryIndex && {
            label: "Municipal risk",
            value: `${formatNumber(primaryIndex.score, 1)} / 100`,
            detail: `${primaryIndex.riskLabel}. Static municipal indicator composite, not the forecast layer. ${primaryIndex.description || "Composite screening score from available municipal indicators."} Source: ${sourceList(primaryIndex.components)}`,
            score: primaryIndex.score,
            info: [
                { label: "What this is", value: "A static municipal comparison score from available Stats SA, SAPS and municipal-context indicators. It is separate from the 5-day forecast layer." },
                { label: "Calculation", value: indexFormula(primaryIndex) },
                { label: "Sources", value: sourceList(primaryIndex.components) },
            ],
        },
        {
            label: "5-day forecast risk",
            value: forecast.overallRiskLabel || "n/a",
            detail: `${formatNumber(forecast.overallRiskScore, 0)} / 100 from cached forecast points. Source: ${forecastSourceLabel(forecast)}.`,
            score: forecast.overallRiskScore,
            info: [
                { label: "What this is", value: "A short-range forecast screening score only. It is based on forecast rain, heat, wind and fire-weather proxy values intersecting the municipality." },
                { label: "Forecast window", value: forecastWindowLabel(forecast) },
                { label: "Source", value: forecastSourceLabel(forecast) },
            ],
        },
        populationIndicator && {
            label: "Population",
            value: formatIndicatorValue(populationIndicator.displayValue, populationIndicator.displayUnit),
            detail: `Raw count used as context, not a risk score. Source: ${sourceLabel(populationIndicator) || "Source metadata not listed."}`,
            score: populationIndicator.adjustedValue,
            info: [
                { label: "What this is", value: populationIndicator.description || "Population indicator available for this municipality." },
                { label: "Raw value", value: formatIndicatorValue(populationIndicator.displayValue, populationIndicator.displayUnit) },
                { label: "Source", value: sourceLabel(populationIndicator) || "Source metadata not listed." },
            ],
        },
        householdIndicator && {
            label: "Households",
            value: formatIndicatorValue(householdIndicator.displayValue, householdIndicator.displayUnit),
            detail: `Raw household context. Source: ${sourceLabel(householdIndicator) || "Source metadata not listed."}`,
            score: householdIndicator.adjustedValue,
            info: [
                { label: "What this is", value: householdIndicator.description || "Household indicator available for this municipality." },
                { label: "Raw value", value: formatIndicatorValue(householdIndicator.displayValue, householdIndicator.displayUnit) },
                { label: "Source", value: sourceLabel(householdIndicator) || "Source metadata not listed." },
            ],
        },
        unemploymentIndicator && {
            label: "Unemployment pressure",
            value: `${formatNumber(unemploymentIndicator.adjustedValue, 1)} / 100`,
            detail: `${directionLabel(unemploymentIndicator.direction)}. Source: ${sourceLabel(unemploymentIndicator) || "Source metadata not listed."}`,
            score: unemploymentIndicator.adjustedValue,
            info: [
                { label: "What this is", value: unemploymentIndicator.description || "Relative labour-market stress indicator." },
                { label: "Score meaning", value: scoreExplanation(unemploymentIndicator.adjustedValue, unemploymentIndicator.riskLabel) },
                { label: "Source", value: sourceLabel(unemploymentIndicator) || "Source metadata not listed." },
            ],
        },
        (crimeIndex || crimeIndicator) && {
            label: "Crime and safety",
            value: crimeIndex ? `${formatNumber(crimeIndex.score, 1)} / 100` : `${formatNumber(crimeIndicator.adjustedValue, 1)} / 100`,
            detail: crimeIndex
                ? `${crimeIndex.riskLabel}. ${crimeIndex.description || "Crime and safety context from available SAPS indicators."} Source: ${sourceList(crimeIndex.components)}`
                : `${directionLabel(crimeIndicator.direction)}. Source: ${sourceLabel(crimeIndicator) || "Source metadata not listed."}`,
            score: crimeIndex?.score ?? crimeIndicator.adjustedValue,
            info: crimeIndex ? [
                { label: "What this is", value: crimeIndex.description || "Crime and safety context from available SAPS indicators." },
                { label: "Calculation", value: indexFormula(crimeIndex) },
                { label: "Sources", value: sourceList(crimeIndex.components) },
            ] : [
                { label: "What this is", value: crimeIndicator.description || "Crime and safety indicator." },
                { label: "Score meaning", value: scoreExplanation(crimeIndicator.adjustedValue, crimeIndicator.riskLabel) },
                { label: "Source", value: sourceLabel(crimeIndicator) || "Source metadata not listed." },
            ],
        },
        serviceIndex && {
            label: "Service pressure",
            value: `${formatNumber(serviceIndex.score, 1)} / 100`,
            detail: `Higher values mean higher service-related risk pressure. Access/resilience indicators are inverted before contributing. Source: ${sourceList(serviceIndex.components)}`,
            score: serviceIndex.score,
            info: [
                { label: "What this is", value: serviceIndex.description || "Basic-service access and resilience context." },
                { label: "Direction logic", value: "Indicators such as water, electricity and refuse access are treated as resilience inputs: higher access reduces risk pressure, so the risk input is calculated as 100 minus the normalized access score." },
                { label: "Sources", value: sourceList(serviceIndex.components) },
            ],
        },
        ...leadingDrivers.map((driver) => ({
            label: `Driver: ${driver.label}`,
            value: `${formatNumber(driver.adjustedValue, 1)} / 100`,
            detail: `${driver.theme || "Indicator"} driver. ${riskInputExplanation(driver)} ${weightExplanation(driver)} Source: ${sourceExplanation(driver)}`,
            score: driver.adjustedValue,
            info: [
                { label: "What this is", value: driver.description || "One of the largest contributors to the selected municipal composite risk score." },
                { label: "How to read the score", value: riskInputExplanation(driver) },
                { label: "Direction logic", value: directionExplanation(driver.direction) },
                { label: "Weight in the index", value: weightExplanation(driver) },
                { label: "Source and date", value: sourceExplanation(driver) },
            ],
        })),
    ].filter(Boolean);
    const trendRecords = Array.isArray(trendData?.records) ? trendData.records : EMPTY;
    const trendChange = trendDelta(trendRecords);
    const riskCards = [
        {
            label: "Overall",
            score: forecast.overallRiskScore,
            value: forecast.overallRiskLabel,
            detail: "0-100 screening index",
            explanation: "Highest overall screening signal from cached rain, heat, wind and fire-weather forecast points intersecting the municipality.",
        },
        {
            label: "Rain",
            score: forecast.rainRiskScore,
            value: `${formatNumber(forecast.maxRainfallMm)} mm/day`,
            detail: "highest forecast rainfall",
            explanation: "Maximum daily rainfall value found inside the municipality during the current forecast window.",
        },
        {
            label: "Heat",
            score: forecast.heatRiskScore,
            value: `${formatNumber(forecast.maxTemperatureC)} °C`,
            detail: "maximum temperature",
            explanation: "Maximum forecast daily temperature found inside the municipality during the current forecast window.",
        },
        {
            label: "Wind",
            score: forecast.windRiskScore,
            value: `${formatNumber(forecast.maxWindKmh)} km/h`,
            detail: "maximum wind speed",
            explanation: "Maximum forecast 10 m wind speed found inside the municipality during the current forecast window.",
        },
        {
            label: "Fire weather",
            score: forecast.fireRiskScore,
            value: forecast.dominantHazard || "proxy",
            detail: "screening layer",
            explanation: "Fire-weather screening combines cached heat, wind and dry-condition signals. It is an exploratory layer, not an official fire warning.",
        },
    ];

    useEffect(() => {
        if (trendIndicatorKey || indicatorRecords.length === 0) return;
        const preferred = indicatorRecords.find((indicator) =>
            ["population_total", "crime_17_serious_total", "hh_conditions_subindex"].includes(indicator.key)
        ) || indicatorRecords.find((indicator) => /population|crime|household|unemployment/i.test(`${indicator.key} ${indicator.label}`));
        if (preferred) setTrendIndicatorKey(preferred.key);
    }, [indicatorRecords, trendIndicatorKey]);

    useEffect(() => {
        const validTabs = new Set(["overview", "trends", "drivers", "indicators", "observations", ...(isAdmin ? ["admin"] : [])]);
        if (activeTab === "sources") {
            setActiveTab("observations");
        } else if (!validTabs.has(activeTab)) {
            setActiveTab("overview");
        }
    }, [activeTab, isAdmin]);

    return (
        <div className="sarva-muniProfiler">
            <section className="sarva-muniProfiler__tools" aria-label="Municipal risk profiler controls">
                <div className="sarva-muniProfiler__intro">
                    <span>SARVA municipal tool</span>
                    <h1>Municipal Risk Profiler</h1>
                    <p>
                        Start with a municipality, then read the summary before opening drivers, trends or the full indicator catalogue.
                    </p>
                </div>

                <form className="sarva-muniProfiler__search" onSubmit={selectMunicipalityFromSearch}>
                    <label>
                        <span>Search municipality</span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Type municipality, district, province or code..."
                            list="sarva-municipality-options"
                        />
                    </label>
                    <datalist id="sarva-municipality-options">
                        {matchingMunicipalities.map((item) => (
                            <option
                                key={item.gid}
                                value={item.municipality}
                                label={[item.district, item.province].filter(Boolean).join(" | ") || item.code}
                            />
                        ))}
                    </datalist>
                    <button type="submit">Search</button>
                    {municipalitiesLoading && <small>Loading municipalities...</small>}
                    {municipalitiesError && <small>{municipalitiesError}</small>}
                </form>

                <button type="button" className="sarva-muniProfiler__infoButton" onClick={() => setInfoOpen(true)}>
                    Indicator info
                </button>
                <button type="button" className="sarva-muniProfiler__infoButton" onClick={zoomToCountry}>
                    Fit country
                </button>
            </section>

            {infoOpen && (
                <div className="sarva-muniProfiler__modal" role="dialog" aria-modal="true" aria-labelledby="municipal-profiler-info">
                    <div>
                        <button type="button" onClick={() => setInfoOpen(false)} aria-label="Close">x</button>
                        <h2 id="municipal-profiler-info">How the municipal profiler works</h2>
                        {(metadata?.calculationNotes || []).map((note) => (
                            <section key={note.title}>
                                <h3>{note.title}</h3>
                                <p>{note.body}</p>
                            </section>
                        ))}
                        <section>
                            <h3>Adding new data</h3>
                            <p>
                                New municipal indicator rows should use municipal code, indicator key, period, scenario,
                                raw value and source metadata. Optional normalized 0-100 values can be supplied; otherwise
                                the importer should normalize within indicator, period and scenario.
                            </p>
                            <p>
                                Required columns: {(metadata?.importSchema?.requiredColumns || []).join(", ") || "municipality_code, indicator_key, period, scenario, raw_value"}.
                            </p>
                        </section>
                    </div>
                </div>
            )}
            {detailInfo && (
                <div className="sarva-muniProfiler__modal" role="dialog" aria-modal="true" aria-labelledby="municipal-profiler-detail-info">
                    <div>
                        <button type="button" onClick={() => setDetailInfo(null)} aria-label="Close">x</button>
                        <h2 id="municipal-profiler-detail-info">{detailInfo.title}</h2>
                        <dl className="sarva-muniProfiler__explainList">
                            {detailInfo.rows.map((row) => (
                                <div key={row.label}>
                                    <dt>{row.label}</dt>
                                    <dd>{row.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
            )}

            <section className="sarva-muniProfiler__mapPanel" aria-label="Municipality map">
                <div ref={mapContainerRef} className="sarva-muniProfiler__map" />
                <div className={`sarva-muniProfiler__mapNote${layerBrowserOpen ? " is-expanded" : ""}`}>
                    <label>
                        <span className="sarva-muniProfiler__inlineHead">
                            <strong>Map layer</strong>
                            {infoButton("Map layer", [
                                { label: "What the colours mean", value: "The map colours municipalities using a 0-100 comparison score for the selected layer. Green means lower relative pressure among South African municipalities in the available dataset; red means higher relative pressure." },
                                { label: "Comparison scope", value: "Scores are normalized against other South African municipalities for the same indicator, source period and scenario where available. They are not international standards, legal thresholds or official warning levels." },
                                { label: "0 and 100", value: "0 is the lowest relative pressure in the available South African municipal dataset for this layer. 100 is the highest relative pressure in that same comparison set. Missing values are shown separately as no data." },
                                { label: "Layer levels", value: "Start here shows the best client-facing layers. Grouped scores combine multiple inputs. Single indicators show one source variable at a time." },
                                { label: "Raw values", value: "Raw counts, percentages and units are kept in the profile panel. The map uses comparable scores so different municipalities can be viewed spatially." },
                                { label: "Selected layer", value: activeMetricLabel },
                                { label: "Source and period", value: [activeMetric.sourceName, activeMetric.period, activeMetric.scenario].filter(Boolean).join(" | ") || "Shown after the layer loads." },
                            ])}
                        </span>
                        <button
                            type="button"
                            className="sarva-muniProfiler__layerToggle"
                            onClick={() => setLayerBrowserOpen((open) => !open)}
                            aria-expanded={layerBrowserOpen}
                        >
                            <span>{layerBrowserOpen ? "Hide layer chooser" : "Change map layer"}</span>
                            <b>{activeMetricLabel}</b>
                        </button>
                        {layerBrowserOpen && (
                            <div className="sarva-muniProfiler__layerBrowser">
                                <div className="sarva-muniProfiler__layerModes" role="tablist" aria-label="Layer detail level">
                                    {LAYER_MODE_OPTIONS.map((mode) => (
                                        <button
                                            key={mode.key}
                                            type="button"
                                            className={layerMode === mode.key ? "is-active" : ""}
                                            onClick={() => {
                                                setLayerMode(mode.key);
                                                setLayerThemeFilter("All themes");
                                                setLayerSearch("");
                                            }}
                                        >
                                            <strong>{mode.label}</strong>
                                            <small>{mode.detail}</small>
                                        </button>
                                    ))}
                                </div>
                                {layerMode === "guided" && guidedLayerCards.length > 0 && (
                                    <div className="sarva-muniProfiler__guidedLayers" aria-label="Recommended map layers">
                                        {guidedLayerCards.map((layer) => (
                                            <button
                                                key={layer.value}
                                                type="button"
                                                className={selectedMetric === layer.value ? "is-active" : ""}
                                                onClick={() => setSelectedMetric(layer.value)}
                                            >
                                                <strong>{layer.label}</strong>
                                                <span>{layer.detail}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {layerMode !== "guided" && (
                                    <div className="sarva-muniProfiler__layerFilters">
                                        <select
                                            value={layerThemeFilter}
                                            onChange={(event) => setLayerThemeFilter(event.target.value)}
                                            aria-label="Filter map layers by category"
                                        >
                                            {layerThemeOptions.map((theme) => (
                                                <option key={theme} value={theme}>{theme}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="search"
                                            value={layerSearch}
                                            onChange={(event) => setLayerSearch(event.target.value)}
                                            placeholder={layerMode === "indices" ? "Search roll-ups..." : "Search indicators..."}
                                            aria-label="Search map layers"
                                        />
                                    </div>
                                )}
                                <select value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
                                    {metricIndexOptions.length === 0 && metricIndicatorGroups.length === 0 && (
                                        <option value={DEFAULT_METRIC}>{DEFAULT_METRIC_LABEL}</option>
                                    )}
                                    {!selectedMetricIsVisible && (
                                        <option value={selectedMetric}>{activeMetricLabel} (current selection)</option>
                                    )}
                                    {layerMode !== "indicators" && (
                                        <optgroup label={layerMode === "guided" ? "Recommended layers" : "Compound indices"}>
                                        {(layerMode === "guided" ? guidedLayerCards : filteredMetricIndexOptions).map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </optgroup>
                                    )}
                                    {layerMode === "indicators" && filteredMetricIndicatorGroups.map((group) => (
                                        <optgroup key={group.theme} label={group.theme}>
                                            {group.options.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        )}
                    </label>
                    <span>
                        {metricLoading ? "Loading layer..." : activeMetricLabel || "Click a municipality or use search."}
                        {activeMetric.unit ? ` | ${activeMetric.unit}` : ""}
                        {activeMetric.period || activeMetric.scenario ? ` | ${[activeMetric.period, activeMetric.scenario].filter(Boolean).join(" | ")}` : ""}
                        {activeMetric.sourceName ? ` | ${activeMetric.sourceName}` : ""}
                    </span>
                    {layerBrowserOpen && (
                        <small className="sarva-muniProfiler__mapCoverage">
                            {visibleLayerOptionCount} layer{visibleLayerOptionCount === 1 ? "" : "s"} in this view | {metricCoverageLabel(metricCoverage)}
                        </small>
                    )}
                        <small className="sarva-muniProfiler__scoreScope">
                        0-100 compares SA municipalities for this layer and period. It is not an international benchmark.
                    </small>
                    <div className="sarva-muniProfiler__legend" aria-hidden="true">
                        <i />
                        <small><b>Lower relative pressure</b><b>Higher relative pressure</b></small>
                        <span><em /> No data</span>
                    </div>
                </div>
            </section>

            <aside className="sarva-muniProfiler__profile" aria-label="Municipal risk profile">
                {profileLoading && <div className="sarva-muniProfiler__state">Loading municipal profile...</div>}
                {profileError && <div className="sarva-muniProfiler__state">{profileError}</div>}
                {!profileLoading && !profileError && !profile && (
                    <div className="sarva-muniProfiler__state sarva-muniProfiler__state--guide">
                        <strong>Start with a municipality</strong>
                        <p>Search by name/code or click the map. Start with municipal pressures, source dates and evidence gaps. Weather screening is shown separately.</p>
                        <div className="sarva-muniProfiler__startGrid">
                            {profilerStartCards.map((card) => (
                                <article key={card.title}>
                                    <span>{card.title}</span>
                                    <p>{card.detail}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                )}
                {!profileLoading && !profileError && profile && (
                    <>
                        <div className="sarva-muniProfiler__head">
                            <span>{profile.municipality.province || "South Africa"}</span>
                            <h2>{profile.municipality.municipality}</h2>
                            <p>{[profile.municipality.district, profile.municipality.code].filter(Boolean).join(" | ")}</p>
                            <button type="button" className="sarva-muniProfiler__download" onClick={downloadMunicipalProfilePdf}>
                                Download profile PDF
                            </button>
                        </div>

                        {activeTab === "overview" && <MunicipalEvidenceSummary profile={profile} onSection={setActiveTab} />}

                        {activeTab !== "overview" && <div className="sarva-muniProfiler__facts">
                            {topStatCards.slice(0, 4).map((card) => (
                                <span key={card.label}>
                                    <b>{card.value}</b>
                                    {card.label}
                                    {card.note && <small>{card.note}</small>}
                                </span>
                            ))}
                        </div>}

                        {selectedLayerProfileStatus && (
                            <div className={`sarva-muniProfiler__dataStatus is-${selectedLayerProfileStatus.tone}`}>
                                <strong>{selectedLayerProfileStatus.title}</strong>
                                <p>{selectedLayerProfileStatus.detail}</p>
                            </div>
                        )}

                        <div className="sarva-muniProfiler__profileNav">
                            <span>Profile sections</span>
                            <nav className="sarva-muniProfiler__tabs" aria-label="Profile sections">
                                {[
                                    ["overview", "Summary"],
                                    ["trends", "Trends"],
                                    ["drivers", "Index contributors"],
                                    ["indicators", "All indicators"],
                                    ["observations", "Nearby data"],
                                    ...(isAdmin ? [["admin", "Admin data"]] : []),
                                ].map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className={activeTab === key ? "is-active" : ""}
                                        onClick={() => setActiveTab(key)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {activeTab === "overview" && <details className="sarva-muniProfiler__section"><summary>Advanced: legacy indices and forecast scores</summary>
                        {activeTab === "overview" && indices.length > 0 && (
                            <section className="sarva-muniProfiler__section">
                                <div className="sarva-muniProfiler__sectionHead">
                                    <h3>Evidence cards</h3>
                                    <span>municipal + forecast detail</span>
                                </div>
                                <div className="sarva-muniProfiler__findingGrid">
                                    {keyFindingCards.slice(0, 8).map((card) => (
                                        <article key={card.label} className={`is-${riskTone(card.score)}`}>
                                            <div className="sarva-muniProfiler__cardTitle">
                                                <small>{card.label}</small>
                                                {infoButton(card.label, card.info)}
                                            </div>
                                            <strong>{card.value}</strong>
                                            <p>{card.detail}</p>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        )}

                        {activeTab === "overview" && indices.length > 0 && (
                            <section className="sarva-muniProfiler__section">
                                <div className="sarva-muniProfiler__sectionHead">
                                    <h3>Municipal indices</h3>
                                    <span>Stats SA / SAPS ready</span>
                                </div>
                                <div className="sarva-muniProfiler__indexGrid">
                                    {indices.map((index) => (
                                        <article key={index.key} className={`is-${riskTone(index.score)}`}>
                                            <small>{index.theme}</small>
                                            <div className="sarva-muniProfiler__cardTitle">
                                                <strong>{index.label}</strong>
                                                {infoButton(index.label, [
                                                    { label: "What it means", value: index.description },
                                                    { label: "Score meaning", value: scoreExplanation(index.score, index.riskLabel) },
                                                    { label: "Calculation", value: indexFormula(index) },
                                                    { label: "Data coverage", value: indexCoverageLabel(index) },
                                                    { label: "Missing inputs", value: missingInputSummary(index) },
                                                    { label: "Underlying sources", value: sourceList(index.components) },
                                                    { label: "Main inputs", value: indexInputSummary(index) },
                                                ])}
                                            </div>
                                            <div>
                                                <b>{formatNumber(index.score, 1)}</b>
                                                <span>{index.riskLabel}</span>
                                            </div>
                                            <p>{index.description}</p>
                                            <div className="sarva-muniProfiler__coverage">
                                                <span>{indexCoverageLabel(index)}</span>
                                                {Array.isArray(index.missingComponents) && index.missingComponents.length > 0 && (
                                                    <small>Gaps: {missingInputSummary(index)}</small>
                                                )}
                                            </div>
                                            <small>{index.sourceName || "SARVA municipal profiler"} | {index.indicatorCount} indicators used</small>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        )}
                        {activeTab === "overview" && indices.length === 0 && (
                            <section className="sarva-muniProfiler__section">
                                <div className="sarva-muniProfiler__sectionHead">
                                    <h3>Municipal indices</h3>
                                    <span>not available</span>
                                </div>
                                <p>No composite municipal indices are available for this municipality yet. Forecast screening and observation links are still shown below.</p>
                            </section>
                        )}

                        {activeTab === "overview" && (
                            <section className="sarva-muniProfiler__section">
                                <div className="sarva-muniProfiler__sectionHead">
                                    <h3>5-day forecast screening</h3>
                                    <span>{forecastWindowLabel(forecast)}</span>
                                </div>
                                <div className="sarva-muniProfiler__riskGrid">
                                    {riskCards.map((card) => (
                                        <article key={card.label} className={`is-${riskTone(card.score)}`}>
                                            <div className="sarva-muniProfiler__cardTitle">
                                                <small>{card.label === "Overall" ? "5-day forecast risk" : card.label}</small>
                                                {infoButton(card.label === "Overall" ? "5-day forecast risk" : card.label, [
                                                    { label: "What it means", value: card.explanation },
                                                    { label: "Current value", value: String(card.value || "n/a") },
                                                    { label: "Comparison score", value: scoreExplanation(card.score) },
                                                    { label: "Input layer", value: card.detail },
                                                    { label: "Source", value: forecastSourceLabel(forecast) },
                                                ])}
                                            </div>
                                            <strong>{card.value || "n/a"}</strong>
                                            <span>{card.detail}</span>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        )}

                        {activeTab === "overview" && <section className="sarva-muniProfiler__section">
                            <h3>Forecast window</h3>
                            <p>
                                {forecastWindowLabel(forecast)}
                                {forecast.latestRun?.finishedAt ? ` | Updated ${formatDate(forecast.latestRun.finishedAt)}` : ""}
                            </p>
                            <small>{profile.description}</small>
                        </section>}

                        {activeTab === "overview" && (
                            <section className="sarva-muniProfiler__section sarva-muniProfiler__roadmap">
                                <div className="sarva-muniProfiler__sectionHead">
                                    <h3>Coming next</h3>
                                    <span>planned enhancements</span>
                                </div>
                                <div className="sarva-muniProfiler__roadmapGrid">
                                    {plannedProfilerFeatures.map((item) => (
                                        <article key={item.title}>
                                            <small>Coming soon</small>
                                            <strong>{item.title}</strong>
                                            <p>{item.detail}</p>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        )}

                        </details>}

                        {activeTab === "trends" && (
                            <section className="sarva-muniProfiler__section">
                                <div className="sarva-muniProfiler__sectionHead">
                                    <h3>Trend analysis</h3>
                                    <span>{trendLoading ? "loading" : `${trendRecords.length} periods`}</span>
                                </div>
                                {indicatorRecords.length === 0 ? (
                                    <p>No indicator rows are available for trend analysis yet.</p>
                                ) : (
                                    <>
                                        <label className="sarva-muniProfiler__trendSelect">
                                            <span className="sarva-muniProfiler__inlineHead">
                                                <span>Indicator</span>
                                                {infoButton("Trend analysis", [
                                                    { label: "What is plotted", value: "Each row is one available period/scenario for the selected indicator and municipality." },
                                                    { label: "Raw values", value: "The number beside each bar is the source value in its original unit where available." },
                                                    { label: "Comparison score", value: "Bar length uses the normalized 0-100 comparison score. This is for comparison and is not the raw source value." },
                                                    { label: "Source", value: trendData?.indicator?.sourceName || "Shown after choosing an indicator." },
                                                ])}
                                            </span>
                                            <select
                                                value={trendIndicatorKey}
                                                onChange={(event) => setTrendIndicatorKey(event.target.value)}
                                            >
                                                <option value="">Choose an indicator</option>
                                                {indicatorRecords.map((indicator) => (
                                                    <option key={indicator.key} value={indicator.key}>
                                                        {indicator.theme} | {indicator.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        {trendCandidates.length > 0 && (
                                            <div className="sarva-muniProfiler__trendChips" aria-label="Common trend indicators">
                                                {trendCandidates.map((indicator) => (
                                                    <button
                                                        key={indicator.key}
                                                        type="button"
                                                        className={trendIndicatorKey === indicator.key ? "is-active" : ""}
                                                        onClick={() => setTrendIndicatorKey(indicator.key)}
                                                    >
                                                        {indicator.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {trendRecords.length > 0 ? (
                                            <div className="sarva-muniProfiler__trend">
                                                <div>
                                                    <strong>{trendData?.indicator?.label}</strong>
                                                    <span className="sarva-muniProfiler__inlineHead">
                                                        <span>
                                                            Change {trendChange == null ? "n/a" : formatIndicatorValue(trendChange, trendRecords[0]?.displayUnit || trendData?.indicator?.unit || "")}
                                                        </span>
                                                        {infoButton(`${trendData?.indicator?.label || "Indicator"} trend`, [
                                                        { label: "Calculation", value: "Latest raw value minus earliest raw value for this municipality and indicator." },
                                                        { label: "Score meaning", value: "Trend bars use the normalized comparison score, while the printed number is the raw source value where available." },
                                                        { label: "Direction", value: directionLabel(trendData?.indicator?.direction) },
                                                        { label: "Source", value: trendData?.indicator?.sourceName || "SARVA municipal profiler" },
                                                    ])}
                                                    </span>
                                                </div>
                                                <div className="sarva-muniProfiler__trendBars">
                                                    {trendRecords.map((record) => (
                                                        <article key={`${record.period}-${record.scenario}`}>
                                                            <span>{record.period}</span>
                                                            <i aria-hidden="true">
                                                                <b style={{ width: scoreWidth(record.normalizedValue) }} />
                                                            </i>
                                                            <strong>{formatIndicatorValue(record.displayValue, record.displayUnit)}</strong>
                                                            <small>{record.scenario} | score {formatNumber(record.normalizedValue, 1)} / 100</small>
                                                        </article>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p>Select an indicator to view available time periods. Some indicators only have one source period, so the trend may be limited.</p>
                                        )}
                                    </>
                                )}
                            </section>
                        )}

                        {activeTab === "admin" && isAdmin && (
                            <section className="sarva-muniProfiler__section">
                                <div className="sarva-muniProfiler__sectionHead">
                                    <h3>Admin data updates</h3>
                                    <span>{adminStatus?.lastUpdatedAt ? formatDate(adminStatus.lastUpdatedAt) : "admin"}</span>
                                </div>
                                <div className="sarva-muniProfiler__adminBox">
                                    <p>
                                        Imported values: <b>{formatNumber(adminStatus?.importedValues, 0)}</b> |
                                        Proxy values: <b>{formatNumber(adminStatus?.proxyValues, 0)}</b> |
                                        Indicators: <b>{formatNumber(adminStatus?.indicatorKeys, 0)}</b>
                                    </p>
                                    <code>{adminStatus?.importCommand || "cd backend && npm run import:sa-risk-indicators"}</code>
                                    <small>
                                        Use the form for one-off corrections or additions for the selected municipality. Use the importer for full datasets.
                                        Required bulk columns: {(metadata?.importSchema?.requiredColumns || []).join(", ")}.
                                    </small>
                                    <div className="sarva-muniProfiler__adminValues">
                                        <div className="sarva-muniProfiler__sectionHead">
                                            <h4>Admin-entered values for this municipality</h4>
                                            <span>{adminValuesLoading ? "loading" : `${adminValues.length} rows`}</span>
                                        </div>
                                        {adminValues.length === 0 ? (
                                            <p>No admin-entered values yet. Imported and proxy rows are managed through the database importer.</p>
                                        ) : (
                                            <div>
                                                {adminValues.map((record) => (
                                                    <article key={`${record.indicatorKey}-${record.period}-${record.scenario}`}>
                                                        <div>
                                                            <strong>{record.label || record.indicatorKey}</strong>
                                                            <span>{formatIndicatorValue(record.rawValue, record.displayUnit)}</span>
                                                        </div>
                                                        <small>
                                                            {record.theme} | {record.period}
                                                            {record.scenario ? ` | ${record.scenario}` : ""}
                                                            {record.sourceName ? ` | ${record.sourceName}` : ""}
                                                        </small>
                                                        <div className="sarva-muniProfiler__adminActions">
                                                            <button type="button" onClick={() => editAdminValue(record)}>Edit</button>
                                                            <button type="button" className="is-danger" onClick={() => deleteAdminValue(record)}>Delete</button>
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <form onSubmit={submitAdminIndicator}>
                                        <h4>Add or update one indicator value</h4>
                                        <label>
                                            <span>Municipality code or gid</span>
                                            <input value={adminForm.municipalityCode} onChange={(event) => updateAdminField("municipalityCode", event.target.value)} placeholder="WC032 or Overstrand (WC032)" required />
                                        </label>
                                        <label>
                                            <span>Indicator key</span>
                                            <input value={adminForm.indicatorKey} onChange={(event) => updateAdminField("indicatorKey", event.target.value)} placeholder="e.g. admin_water_stress" required />
                                        </label>
                                        <label>
                                            <span>Indicator label</span>
                                            <input value={adminForm.label} onChange={(event) => updateAdminField("label", event.target.value)} placeholder="Human-readable label" />
                                        </label>
                                        <label>
                                            <span>Theme/category</span>
                                            <input value={adminForm.theme} onChange={(event) => updateAdminField("theme", event.target.value)} placeholder="e.g. Water security" />
                                        </label>
                                        <label>
                                            <span>Unit</span>
                                            <input value={adminForm.unit} onChange={(event) => updateAdminField("unit", event.target.value)} placeholder="count, %, cases, households..." />
                                        </label>
                                        <label>
                                            <span>Risk direction</span>
                                            <select value={adminForm.direction} onChange={(event) => updateAdminField("direction", event.target.value)}>
                                                <option value="higher_risk">Higher value means higher risk</option>
                                                <option value="higher_resilience">Higher value means higher resilience</option>
                                                <option value="context">Context only</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span>Period</span>
                                            <input value={adminForm.period} onChange={(event) => updateAdminField("period", event.target.value)} placeholder="2024, 2022 Census, Q1 2026..." required />
                                        </label>
                                        <label>
                                            <span>Scenario</span>
                                            <input value={adminForm.scenario} onChange={(event) => updateAdminField("scenario", event.target.value)} placeholder="Observed, admin import, baseline..." />
                                        </label>
                                        <label>
                                            <span>Raw value</span>
                                            <input value={adminForm.rawValue} onChange={(event) => updateAdminField("rawValue", event.target.value)} type="number" step="any" required />
                                        </label>
                                        <label>
                                            <span>0-100 comparison score</span>
                                            <input value={adminForm.value_0_100} onChange={(event) => updateAdminField("value_0_100", event.target.value)} placeholder="Optional; defaults to 50" type="number" step="any" min="0" max="100" />
                                        </label>
                                        <label>
                                            <span>Source name</span>
                                            <input value={adminForm.sourceName} onChange={(event) => updateAdminField("sourceName", event.target.value)} placeholder="Stats SA, SAPS, municipal report..." />
                                        </label>
                                        <label>
                                            <span>Source URL</span>
                                            <input value={adminForm.sourceUrl} onChange={(event) => updateAdminField("sourceUrl", event.target.value)} placeholder="https://..." />
                                        </label>
                                        <label>
                                            <span>Calculation notes</span>
                                            <textarea value={adminForm.notes} onChange={(event) => updateAdminField("notes", event.target.value)} placeholder="How this value was calculated, caveats, data date..." />
                                        </label>
                                        <div className="sarva-muniProfiler__adminActions">
                                            <button type="submit">Save indicator value</button>
                                            <button type="button" onClick={() => setAdminForm(defaultAdminForm(selected?.code || ""))}>Clear form</button>
                                        </div>
                                    </form>
                                    {adminMessage && <small>{adminMessage}</small>}
                                </div>
                            </section>
                        )}

                        {activeTab === "drivers" && (
                            <section className="sarva-muniProfiler__section">
                                <div className="sarva-muniProfiler__sectionHead">
                                    <h3>Top risk drivers</h3>
                                    <span>Composite risk pressure</span>
                                </div>
                                {drivers.length === 0 ? (
                                    <p>No composite driver rows are available for this municipality yet.</p>
                                ) : (
                                    <>
                                        <p className="sarva-muniProfiler__driverNote">
                                            These are the largest weighted contributors for this municipality in the same composite index. They can differ between municipalities because each place has a different indicator profile.
                                        </p>
                                        <div className="sarva-muniProfiler__drivers">
                                            {drivers.slice(0, 6).map((driver) => (
                                                <article key={driver.key}>
                                                    <div>
                                                        <span className="sarva-muniProfiler__cardTitle">
                                                            <strong>{driver.label}</strong>
                                                            {infoButton(driver.label, [
                                                                { label: "What this is", value: driver.description || "Risk driver used in the selected municipal composite." },
                                                                { label: "How to read the score", value: riskInputExplanation(driver) },
                                                                { label: "Direction logic", value: directionExplanation(driver.direction) },
                                                                { label: "Weight in the index", value: weightExplanation(driver) },
                                                                { label: "Source and date", value: sourceExplanation(driver) },
                                                            ])}
                                                        </span>
                                                        <span>{formatNumber(driver.adjustedValue, 1)} / 100 risk pressure</span>
                                                    </div>
                                                    <i aria-hidden="true"><b style={{ width: scoreWidth(driver.adjustedValue) }} /></i>
                                                    <small>
                                                        {rawValueLabel(driver) ? `Raw value ${rawValueLabel(driver)} | ` : ""}
                                                        {driver.theme} | weight {formatNumber(driver.weight, 2)}
                                                        {driver.sourceName ? ` | ${driver.sourceName}` : ""}
                                                        {driver.period || driver.scenario ? ` | ${[driver.period, driver.scenario].filter(Boolean).join(" | ")}` : ""}
                                                    </small>
                                                </article>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </section>
                        )}

                        {activeTab === "indicators" && (
                            <section className="sarva-muniProfiler__section">
                                <div className="sarva-muniProfiler__sectionHead">
                                    <h3>Indicator catalogue</h3>
                                    <span>{municipalIndicators.status}</span>
                                </div>
                                {themes.length === 0 ? (
                                    <p>No municipal indicator records are available for this municipality yet.</p>
                                ) : (
                                    <>
                                        {missingProfileInputs.length > 0 && (
                                            <div className="sarva-muniProfiler__missingInputs">
                                                <strong>Missing local inputs</strong>
                                                <p>
                                                    {missingProfileInputs.length} expected indicator{missingProfileInputs.length === 1 ? "" : "s"} are not loaded for this municipality and are excluded from affected index calculations.
                                                </p>
                                                <div>
                                                    {missingProfileInputs.slice(0, 8).map((component) => (
                                                        <span key={component.key}>{component.label || component.key}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <label className="sarva-muniProfiler__trendSelect">
                                            <span className="sarva-muniProfiler__inlineHead">
                                                <span>Category</span>
                                                {infoButton("Indicator catalogue", [
                                                    { label: "Raw value", value: "The main number is the source value for this municipality in its original unit where available." },
                                                    { label: "Comparison score", value: "The 0-100 score is a normalized comparison score. It is used for spatial comparison and risk-index calculations, not as a raw measurement." },
                                                    { label: "Risk direction", value: "Higher-risk indicators contribute directly. Higher-resilience indicators are inverted before risk calculations. Context indicators are displayed only." },
                                                    { label: "Source", value: "Each indicator row lists its source name, period, scenario and proxy/imported status." },
                                                ])}
                                            </span>
                                            <select value={indicatorThemeFilter} onChange={(event) => setIndicatorThemeFilter(event.target.value)}>
                                                {indicatorThemes.map((theme) => (
                                                    <option key={theme} value={theme}>{theme}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <div className="sarva-muniProfiler__indicatorThemes">
                                            {filteredThemes.map((theme) => (
                                                <details key={theme.theme} open={["Exposure", "Social vulnerability", "Safety"].includes(theme.theme)}>
                                                    <summary>
                                                        <strong>{theme.theme}</strong>
                                                        <span>{theme.records.length}</span>
                                                    </summary>
                                                    <div>
                                                        {theme.records.map((indicator) => (
                                                            <article key={indicator.key}>
                                                                <div>
                                                                    <span className="sarva-muniProfiler__cardTitle">
                                                                        <strong>{indicator.label}</strong>
                                                                        {infoButton(indicator.label, [
                                                                            { label: "What this is", value: indicator.description || "Municipal indicator used for context, mapping or risk-index calculations." },
                                                                            { label: "Source value", value: sourceValueExplanation(indicator) },
                                                                            { label: "How SARVA scores it", value: riskInputExplanation(indicator) },
                                                                            { label: "Direction logic", value: directionExplanation(indicator.direction) },
                                                                            { label: "Source and date", value: sourceExplanation(indicator) },
                                                                            { label: "Notes", value: indicator.notes || (indicator.isProxy ? "Proxy placeholder value." : "") },
                                                                        ])}
                                                                    </span>
                                                                    <span>{formatIndicatorValue(indicator.displayValue, indicator.displayUnit)}</span>
                                                                </div>
                                                                <p>{indicator.description}</p>
                                                                <small>
                                                                    {indicator.sourceName}
                                                                    {indicator.period || indicator.scenario ? ` | ${[indicator.period, indicator.scenario].filter(Boolean).join(" | ")}` : ""}
                                                                    {indicator.isProxy ? " | proxy value" : ""}
                                                                    {Number.isFinite(Number(indicator.normalizedValue)) ? ` | comparison score ${formatNumber(indicator.normalizedValue, 1)} / 100` : ""}
                                                                </small>
                                                            </article>
                                                        ))}
                                                    </div>
                                                </details>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {municipalIndicators.caveat && <small>{municipalIndicators.caveat}</small>}
                            </section>
                        )}

                        {activeTab === "observations" && <section className="sarva-muniProfiler__section">
                            <div className="sarva-muniProfiler__sectionHead">
                                <h3>Nearby SAEON observations</h3>
                                {infoButton("Nearby SAEON observations", [
                                    { label: "What is shown", value: "LoggerNet observation sites with coordinates within 120 km of the selected municipality boundary." },
                                    { label: "Distance", value: "Distance is calculated from the municipality boundary to the observation-site point. Sites inside the municipality are marked as inside." },
                                    { label: "Use", value: "These are nearby observation feeds and station links that may support interpretation. They are not the source for every municipal indicator." },
                                ])}
                            </div>
                            {profile.observationSites.length === 0 ? (
                                <p>No observation sites were found within 120 km of this municipality.</p>
                            ) : (
                                <div className="sarva-muniProfiler__sites">
                                    {profile.observationSites.slice(0, 5).map((site) => (
                                        <a
                                            href={site.websiteUrl || site.doi || "#"}
                                            key={`${site.stationName}-${site.distanceKm}`}
                                            target={site.websiteUrl || site.doi ? "_blank" : undefined}
                                            rel={site.websiteUrl || site.doi ? "noopener noreferrer" : undefined}
                                        >
                                            <strong>{site.displayName || site.stationName}</strong>
                                            <small>{site.inside ? "Inside municipality" : `${formatNumber(site.distanceKm)} km away`}</small>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </section>}

                        {activeTab === "observations" && <div className="sarva-muniProfiler__actions">
                            <a href={profile.links.catalogueSearch}>Search SAEON data</a>
                            <a href={profile.links.resourcesSearch}>Relevant resources</a>
                        </div>}
                    </>
                )}
            </aside>
        </div>
    );
}
