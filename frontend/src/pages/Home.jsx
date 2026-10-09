import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import LibraryEditModal from "../components/LibraryEditModal";
import dstiLogo from "../assets/logos/DSTI.png";
import dataScienceLabLogo from "../assets/logos/lab_logo.png";
import saeonLogo from "../assets/logos/SAEON-NRF-LOGO-alpha.png";
import sarvaLogo from "../assets/logos/SARVA_final-logo-01b.png";
import { apiUrl } from "../config/api";
import { isExpiredForecast } from "../config/forecastFreshness";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useJsonResource } from "../hooks/useJsonResource";
import "../styles/home.css";
import "../styles/resources.css";

const SouthAfricaMap = lazy(() => import("../components/SouthAfricaMap"));
const DATA_SCIENCE_LAB_PATH = import.meta.env.VITE_DSLAB_URL || "/ds-lab/";
const EXPLORE_PATH = "/explore";

const portalCategories = [
    {
        icon: "◇",
        title: "Explore risk",
        detail: "Map current and forecast hazards against municipal exposure and vulnerability context.",
        to: "/overview",
        featured: true,
        layers: ["SAEON live observations", "Forecast rain", "Drought", "Flood", "Fire", "Heat"],
        links: [
            ["Open risk map", "/overview"],
            ["Browse risk layers", "/overview#risk-map"],
            ["Municipality profiles", "/municipal-risk-profiler"],
        ],
    },
    {
        icon: "▦",
        title: "Find data",
        detail: "Search SARVA-ready catalogue records and connect to live SAEON observation services.",
        to: "/search",
        theme: "data",
        layers: ["Catalogue", "Observations", "Metadata", "Live feeds"],
        links: [
            ["Search catalogue", "/search"],
            ["Live observations", "/overview#risk-map"],
            ["Data services", "/resources?search=data%20service"],
        ],
    },
    {
        icon: "◎",
        title: "Use tools",
        detail: "Open dashboards, indicators and partner tools that turn data into decision views.",
        to: "/overview",
        theme: "tools",
        layers: ["Dashboards", "Indicators", "Reports", "Exports"],
        links: [
            ["Open dashboards", "/overview"],
            ["View indicators", "/municipal-risk-profiler"],
            ["Tool catalogue", "/resources?search=tool"],
        ],
    },
    {
        icon: "□",
        title: "Read resources",
        detail: "Use the evidence library: documents, glossary terms, policy and legislation.",
        to: "/resources",
        theme: "resources",
        layers: ["Documents", "Glossary", "Policy", "Link health"],
        links: [
            ["Documents", "/resources"],
            ["Policy", "/national-policy-and-legislation"],
            ["Glossary", "/glossary"],
        ],
    },
    {
        icon: "♧",
        title: "Join in",
        detail: "Contribute knowledge, find training, and connect with SARVA communities of practice.",
        to: "/overview",
        theme: "community",
        layers: ["Training", "Data Science Lab", "Partners", "Contribute", "Support"],
        links: [
            ["Training", "/resources?search=training"],
            ["Data Science Lab", DATA_SCIENCE_LAB_PATH],
            ["Contribute data", "https://docs.google.com/forms/d/1bxnefRblVoQ8hpJJx_KL1nzeZHQfEK-QKVCxoPIXnAU/viewform?edit_requested=true"],
            ["Community", "/about"],
        ],
    },
];

const resourceEntryPoints = [
    {
        title: "Documents and reports",
        detail: "Evidence products, reports, briefs, stories and supporting reference links.",
        to: "/resources",
    },
    {
        title: "Policy and legislation",
        detail: "National policies, legislation and link-health checked public records.",
        to: "/national-policy-and-legislation",
    },
    {
        title: "Glossary",
        detail: "Definitions and terminology used across SARVA risk, data and indicator views.",
        to: "/glossary",
    },
    {
        title: "Search SAEON data",
        detail: "Local mirrored SAEON catalogue search with essential-variable filters.",
        to: "/search",
    },
    {
        title: "Municipal risk profiles",
        detail: "Municipal screening profiles, trends, drivers, indicators and downloadable PDFs.",
        to: "/municipal-risk-profiler",
    },
    {
        title: "Environmental Data Science Lab",
        detail: "Tutorials, learning pathways, prototype apps and SARVA data-science notes.",
        to: DATA_SCIENCE_LAB_PATH,
    },
    {
        title: "Submit data",
        detail: "Open the SARVA contribution form for datasets, tools and supporting evidence.",
        to: "https://docs.google.com/forms/d/1bxnefRblVoQ8hpJJx_KL1nzeZHQfEK-QKVCxoPIXnAU/viewform?edit_requested=true",
        external: true,
    },
];

const alertSources = {
    saws: "https://www.weathersa.co.za/",
    ndmc: "https://www.cogta.gov.za/index.php/national-disaster-management-centre/",
    dws: "https://www.dws.gov.za/Hydrology/",
    nicd: "https://www.nicd.ac.za/media/alerts/",
    sanparks: "https://www.sanparks.org/",
    gdacs: "https://www.gdacs.org/",
    reliefweb: "https://reliefweb.int/disasters",
    who: "https://www.who.int/emergencies/disease-outbreak-news",
    usgs: "https://earthquake.usgs.gov/earthquakes/map/",
    eonet: "https://eonet.gsfc.nasa.gov/",
    bbc: "https://www.bbc.com/news/science_and_environment",
    cnn: "https://edition.cnn.com/world",
    ap: "https://apnews.com/hub/climate-and-environment",
    guardian: "https://www.theguardian.com/environment",
    dw: "https://www.dw.com/en/environment/s-11798",
    aljazeera: "https://www.aljazeera.com/",
};

const alertSourceValidation = {
    saws: "Validated landing page; SAWS warning deep routes may change",
    ndmc: "Official source landing page",
    dws: "Official hydrology source",
    nicd: "Official alerts source",
    sanparks: "Official source landing page",
    gdacs: "Global disaster-alert source",
    reliefweb: "Global humanitarian disaster source",
    who: "Global outbreak-news source",
    usgs: "Global earthquake source",
    eonet: "NASA natural-events source",
    bbc: "Major public news RSS filtered for environmental risks and hazards",
    cnn: "Major public news RSS filtered for environmental risks and hazards",
    ap: "Major public news RSS filtered for environmental risks and hazards",
    guardian: "Major public news RSS filtered for environmental risks and hazards",
    dw: "Major public news RSS filtered for environmental risks and hazards",
    aljazeera: "Major public news RSS filtered for environmental risks and hazards",
};

function formatStat(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return new Intl.NumberFormat("en-ZA").format(number);
}

function formatSyncTime(value) {
    if (!value) return "Last synced: pending";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Last synced: pending";
    const ageMs = Date.now() - date.getTime();
    const staleSuffix = ageMs > 2 * 24 * 60 * 60 * 1000 ? " | refresh due" : "";
    return `Source synced: ${new Intl.DateTimeFormat("en-ZA", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short",
    }).format(date)}${staleSuffix}`;
}

function isExternalLink(to = "") {
    return /^https?:\/\//i.test(String(to));
}

function formatAlertDate(value) {
    if (!value) return "Date not supplied";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date not supplied";
    return new Intl.DateTimeFormat("en-ZA", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short",
    }).format(date);
}

function formatResourceDate(resource) {
    if (resource?.publication_year) return String(resource.publication_year);
    const date = new Date(resource?.updated_at || resource?.created_at || "");
    if (Number.isNaN(date.getTime())) return "Date not supplied";
    return new Intl.DateTimeFormat("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date);
}

function statusForResource(resource) {
    if (!resource?.url) return "missing";
    return resource.link_status || "unchecked";
}

function statusLabel(status) {
    return {
        active: "Active",
        redirected: "Redirected",
        broken: "Broken",
        missing: "Missing URL",
        unchecked: "Not checked",
    }[status] || "Not checked";
}

function supportingProviderLabel(item = {}) {
    const text = `${item.title || ""} ${item.author || ""}`.toLowerCase();
    if (text.includes("earthdata") || text.includes("firms") || text.includes("nasa")) return "NASA";
    if (text.includes("usgs") || text.includes("earthexplorer")) return "USGS";
    if (text.includes("copernicus")) return text.includes("era5") ? "ERA5" : "COP";
    if (text.includes("worldcover") || text.includes("european space agency")) return "ESA";
    if (text.includes("gbif")) return "GBIF";
    if (text.includes("chirps") || text.includes("climate hazards")) return "CHIRPS";
    if (text.includes("earth engine") || text.includes("google")) return "GEE";
    if (text.includes("opentopography")) return "OPEN";

    const source = item.author || item.title || "DATA";
    return String(source)
        .replace(/[^a-z0-9 ]/gi, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.slice(0, 3).toUpperCase())
        .join(" ") || "DATA";
}

function resourceLogoLabel(item = {}, preferProvider = false) {
    if (preferProvider) return supportingProviderLabel(item);

    const type = String(item.resource_type || "").toLowerCase();
    if (type.includes("report") || type.includes("brief") || type.includes("case study")) return "REPORT";
    if (type.includes("website")) return "WEB";
    if (type.includes("research tool") || type.includes("tool")) return "TOOL";
    if (type.includes("database")) return "DB";
    if (type.includes("satellite")) return "SAT";
    if (type.includes("climate")) return "CLIMATE";
    if (type.includes("environmental") || type.includes("supporting")) return "DATA";
    return supportingProviderLabel(item);
}

function resourceLogoKind(item = {}, preferProvider = false) {
    const type = String(item.resource_type || "").toLowerCase();
    const text = `${item.title || ""} ${item.author || ""} ${type}`.toLowerCase();

    if (!preferProvider && (type.includes("report") || type.includes("brief") || type.includes("case study"))) return "report";
    if (type.includes("research tool") || type.includes("tool")) return "tool";
    if (type.includes("website") || text.includes("catalogue") || text.includes("search")) return "website";
    if (type.includes("research tool") || type.includes("tool") || text.includes("monitor")) return "tool";
    if (type.includes("database") || text.includes("data catalog")) return "database";
    if (type.includes("satellite") || text.includes("earthdata") || text.includes("sentinel") || text.includes("worldcover")) return "satellite";
    if (type.includes("climate") || text.includes("rainfall") || text.includes("era5") || text.includes("chirps")) return "climate";
    if (text.includes("fire") || text.includes("firms")) return "hazard";
    return "data";
}

function ResourceIcon({ kind }) {
    if (kind === "report") {
        return (
            <svg viewBox="0 0 24 24" focusable="false">
                <path d="M6 3h8l4 4v14H6z" />
                <path d="M14 3v5h5" />
                <path d="M8.5 12h7" />
                <path d="M8.5 16h7" />
            </svg>
        );
    }
    if (kind === "website") {
        return (
            <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M3.8 12h16.4" />
                <path d="M12 3.5c2 2.2 3.1 5 3.1 8.5S14 18.3 12 20.5" />
                <path d="M12 3.5C10 5.7 8.9 8.5 8.9 12S10 18.3 12 20.5" />
            </svg>
        );
    }
    if (kind === "tool") {
        return (
            <svg viewBox="0 0 24 24" focusable="false">
                <path d="M14.5 5.5a5 5 0 0 0 4 6.5l-6.7 6.7a2.4 2.4 0 0 1-3.4-3.4l6.7-6.7a5 5 0 0 0-.6-3.1z" />
                <path d="M6.5 17.5l-2 2" />
            </svg>
        );
    }
    if (kind === "database") {
        return (
            <svg viewBox="0 0 24 24" focusable="false">
                <ellipse cx="12" cy="6" rx="7" ry="3" />
                <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
                <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
            </svg>
        );
    }
    if (kind === "satellite") {
        return (
            <svg viewBox="0 0 24 24" focusable="false">
                <path d="M10 9l5 5" />
                <rect x="9" y="9" width="6" height="6" rx="1.2" transform="rotate(45 12 12)" />
                <path d="M5 5l4 2-2 2-4-2z" />
                <path d="M19 19l-4-2 2-2 4 2z" />
                <path d="M6 18a8 8 0 0 1 12-12" />
            </svg>
        );
    }
    if (kind === "climate") {
        return (
            <svg viewBox="0 0 24 24" focusable="false">
                <path d="M9 14.5V5.8a3 3 0 0 1 6 0v8.7a5 5 0 1 1-6 0z" />
                <path d="M12 7v7" />
                <path d="M17 9.5h2.5" />
            </svg>
        );
    }
    if (kind === "hazard") {
        return (
            <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 3.5c2.5 2.8 1 5.4 3.2 7.8.8.9 1.3 2 1.3 3.2a4.5 4.5 0 0 1-9 0c0-2.4 1.8-3.7 3.1-5.3.9-1.1 1.4-2.7 1.4-5.7z" />
                <path d="M12 20c1.5-1.5.2-3.1 1.5-4.7" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" focusable="false">
            <path d="M4 17.5c4.4.3 7.7-1.1 10-4.2 1.4-1.9 3.3-3 6-3.3-.5 6.8-4.2 10.5-10.7 10.5H4z" />
            <path d="M8 16c2.8-2 5.3-3.1 8.5-3.6" />
            <path d="M6 7.5h6" />
            <path d="M6 10.5h4" />
        </svg>
    );
}

function SectionIcon({ kind }) {
    return (
        <span className="sarva-panel__icon" aria-hidden="true">
            <ResourceIcon kind={kind} />
        </span>
    );
}

function ExternalLinkIcon() {
    return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M8 8h8v8" />
            <path d="M16 8l-9 9" />
            <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </svg>
    );
}

function logoImageUrl(item = {}, preferProvider = false) {
    if (item.logo_url) return item.logo_url;
    if (!preferProvider) return "";
    try {
        const url = new URL(item.url);
        return `${url.origin}/favicon.ico`;
    } catch {
        return "";
    }
}

function ResourceLogoMark({ item, preferProviderLogo = false }) {
    const [failed, setFailed] = useState(false);
    const imageUrl = logoImageUrl(item, preferProviderLogo);
    const label = resourceLogoLabel(item, preferProviderLogo);
    const kind = resourceLogoKind(item, preferProviderLogo);

    return (
        <span className={`sarva-reportCard__logoMark is-${kind}${imageUrl && !failed ? " has-image" : ""}`} aria-hidden="true">
            {imageUrl && !failed ? (
                <img src={imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
            ) : (
                <>
                    <ResourceIcon kind={kind} />
                    <b>{label}</b>
                </>
            )}
        </span>
    );
}

function ResourceCard({
    item,
    isAdmin,
    onEdit,
    onCheck,
    checking,
    onDelete,
    preferProviderLogo = false,
}) {
    const status = statusForResource(item);
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    const shownKeywords = keywords.slice(0, 5);

    return (
        <article className={`sarva-reportCard is-${resourceLogoKind(item, preferProviderLogo)}`}>
            <ResourceLogoMark item={item} preferProviderLogo={preferProviderLogo} />
            <div className="sarva-reportCard__body">
                <div className="sarva-reportCard__topline">
                    <span>{item.resource_type || "Resource"}</span>
                    <span>{formatResourceDate(item)}</span>
                    {item.author && <span>{item.author}</span>}
                </div>
                <strong>{item.title}</strong>
                <div className="sarva-reportCard__health">
                    <span className={`is-${status}`}>{statusLabel(status)}</span>
                    {item.link_checked_at ? (
                        <small>
                            Checked {new Date(item.link_checked_at).toLocaleDateString("en-ZA")}
                            {item.link_status_code ? ` | ${item.link_status_code}` : ""}
                        </small>
                    ) : (
                        <small>Link not checked yet</small>
                    )}
                </div>
                {shownKeywords.length > 0 && (
                    <div className="sarva-reportCard__tags">
                        {shownKeywords.map((keyword) => (
                            <em key={keyword}>{keyword}</em>
                        ))}
                        {keywords.length > shownKeywords.length && <em>+{keywords.length - shownKeywords.length}</em>}
                    </div>
                )}
                <div className="sarva-reportCard__actions">
                    {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                            Open source <ExternalLinkIcon />
                        </a>
                    )}
                    {isAdmin && (
                        <>
                            <button type="button" onClick={() => onEdit(item)}>
                                Edit
                            </button>
                            <button type="button" onClick={() => onCheck(item)} disabled={checking}>
                                {checking ? "Checking" : "Check link"}
                            </button>
                            <button type="button" className="is-danger" onClick={() => onDelete(item)}>
                                Delete
                            </button>
                        </>
                    )}
                </div>
            </div>
        </article>
    );
}

function withSarvaSource(url) {
    try {
        const nextUrl = new URL(url);
        nextUrl.searchParams.set("referrer", "sarva");
        return nextUrl.toString();
    } catch {
        return url;
    }
}

function isValidHttpUrl(url) {
    try {
        const parsed = new URL(url);
        return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
    } catch {
        return false;
    }
}

function externalAlertUrl(url) {
    return isValidHttpUrl(url) ? url : null;
}

function catalogueUrl(stat = {}) {
    const path = String(stat.cataloguePath || "records").trim();
    return withSarvaSource(`https://catalogue.saeon.ac.za/${path}`);
}

function homeCtaPath(hero) {
    const label = String(hero?.cta_label || "").trim().toLowerCase();
    const href = String(hero?.cta_href || "").trim();
    if (!href || label === "explore now" || href === "/maps/explore") return EXPLORE_PATH;
    return href;
}

function citationUrl(item = {}) {
    const doi = String(item.doi || "").trim();
    if (/^https?:\/\//i.test(doi)) return withSarvaSource(doi);
    if (/^10\.\d{4,9}\//.test(doi)) return withSarvaSource(`https://doi.org/${doi}`);
    return null;
}

function monitorUrl() {
    return withSarvaSource("https://observationsmonitor.saeon.ac.za/home");
}

function alertSeverityClass(severity = "") {
    const key = String(severity).toLowerCase().replace(/\s+/g, "-");
    if (["very-high", "high", "critical"].includes(key)) return "is-high";
    if (["moderate", "medium"].includes(key)) return "is-moderate";
    return "is-watch";
}

function isRecentUpdate(item, days = 5) {
    if (item?.kind !== "update" || !item.date) return false;
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) return false;
    const ageMs = Date.now() - date.getTime();
    return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

function buildMonitoringItems() {
    return [
        {
            id: "saws-impact-warnings",
            label: "Source watch",
            title: "SAWS impact-based warnings feed",
            detail: "Official severe weather watches, warnings and advisories should be checked before response decisions.",
            date: null,
            source: "South African Weather Service",
            href: alertSources.saws,
            severity: "high",
            kind: "source",
            validation: alertSourceValidation.saws,
        },
        {
            id: "ndmc-disaster-updates",
            label: "Source watch",
            title: "National disaster management updates",
            detail: "National coordination source for floods, fires, storms and declared disaster events.",
            date: null,
            source: "National Disaster Management Centre",
            href: alertSources.ndmc,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.ndmc,
        },
        {
            id: "dws-hydrology",
            label: "Source watch",
            title: "River, dam and hydrology monitoring",
            detail: "Track hydrological context during heavy rainfall, flooding, drought and water-supply stress.",
            date: null,
            source: "Department of Water and Sanitation",
            href: alertSources.dws,
            severity: "moderate",
            kind: "source",
            validation: alertSourceValidation.dws,
        },
        {
            id: "nicd-health-alerts",
            label: "Source watch",
            title: "Public health outbreak alerts",
            detail: "Monitor NICD alerts for climate-sensitive and disaster-linked public health risks.",
            date: null,
            source: "National Institute for Communicable Diseases",
            href: alertSources.nicd,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.nicd,
        },
        {
            id: "veld-fire-watch",
            label: "Source watch",
            title: "Veld fire and protected-area risk watch",
            detail: "Use forecast heat, wind and dryness signals alongside official fire-danger information.",
            date: null,
            source: "SARVA screening context",
            href: alertSources.sanparks,
            severity: "moderate",
            kind: "source",
            validation: alertSourceValidation.sanparks,
        },
        {
            id: "gdacs-global-alerts",
            label: "Global source",
            title: "GDACS global disaster alerts",
            detail: "Global multi-hazard disaster alerts for earthquakes, tropical cyclones, floods, volcanoes and other events.",
            date: null,
            source: "Global Disaster Alert and Coordination System",
            href: alertSources.gdacs,
            severity: "high",
            kind: "source",
            validation: alertSourceValidation.gdacs,
        },
        {
            id: "reliefweb-global-disasters",
            label: "Global source",
            title: "ReliefWeb disaster updates",
            detail: "Humanitarian situation reports and disaster updates, useful for regional and global risk context.",
            date: null,
            source: "ReliefWeb",
            href: alertSources.reliefweb,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.reliefweb,
        },
        {
            id: "who-outbreak-news",
            label: "Global source",
            title: "WHO disease outbreak news",
            detail: "International disease outbreak notices relevant to public health and disaster-risk context.",
            date: null,
            source: "World Health Organization",
            href: alertSources.who,
            severity: "moderate",
            kind: "source",
            validation: alertSourceValidation.who,
        },
        {
            id: "usgs-earthquakes",
            label: "Global source",
            title: "USGS earthquake monitoring",
            detail: "Global seismic monitoring and recent earthquake event information.",
            date: null,
            source: "USGS Earthquake Hazards Program",
            href: alertSources.usgs,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.usgs,
        },
        {
            id: "bbc-environment-news",
            label: "News source",
            title: "BBC environmental risk news",
            detail: "Major-news scan for environmental risks, hazards, climate impacts and disaster context.",
            date: null,
            source: "BBC News",
            href: alertSources.bbc,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.bbc,
        },
        {
            id: "cnn-world-risk-news",
            label: "News source",
            title: "CNN world risk news",
            detail: "Major-news scan for severe weather, climate impacts, disasters and environmental hazard context.",
            date: null,
            source: "CNN",
            href: alertSources.cnn,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.cnn,
        },
        {
            id: "ap-climate-environment",
            label: "News source",
            title: "AP climate and environment news",
            detail: "Major-news scan for climate, environmental hazard and disaster-risk context.",
            date: null,
            source: "Associated Press",
            href: alertSources.ap,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.ap,
        },
        {
            id: "guardian-environment-news",
            label: "News source",
            title: "Guardian environment news",
            detail: "Major-news scan for environmental risks, hazards and climate resilience context.",
            date: null,
            source: "The Guardian",
            href: alertSources.guardian,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.guardian,
        },
        {
            id: "dw-environment-news",
            label: "News source",
            title: "DW environment news",
            detail: "Major-news scan for environmental risks, hazards and climate impacts.",
            date: null,
            source: "DW",
            href: alertSources.dw,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.dw,
        },
        {
            id: "aljazeera-risk-news",
            label: "News source",
            title: "Al Jazeera risk news",
            detail: "Major-news scan for disasters, severe weather and environmental hazard context.",
            date: null,
            source: "Al Jazeera",
            href: alertSources.aljazeera,
            severity: "watch",
            kind: "source",
            validation: alertSourceValidation.aljazeera,
        },
    ].slice(0, 16);
}

function buildUpdateItems(alertsResponse = null) {
    const records = Array.isArray(alertsResponse?.records) ? alertsResponse.records : [];

    return records.map((record, index) => ({
        id: record.id || `public-update-${index}`,
        label: record.scope || record.category || "Update",
        title: record.title || "Public risk update",
        detail: record.summary || record.validation || "Publicly available update.",
        date: record.published_at || record.updated_at,
        updatedAt: record.updated_at,
        category: record.relevance_category || record.category || "Update",
        feedCategory: record.feed_category,
        scope: record.scope || "Public source",
        relevanceReason: record.relevance_reason,
        sourceTier: record.source_tier,
        source: record.source || "Public source",
        tags: Array.isArray(record.tags) ? record.tags : [],
        href: record.event_url || record.source_url,
        severity: record.severity || "watch",
        kind: "update",
        validation: record.validation,
    }));
}

function isMajorNewsUpdate(item = {}) {
    return item.sourceTier === "major_news" || /major public news rss/i.test(item.validation || "");
}

function buildHighlightItems(items = [], limit = 5) {
    const updates = items.filter((item) => item.kind === "update");
    const majorNews = updates.filter(isMajorNewsUpdate).slice(0, 2);
    const selected = [...majorNews];

    for (const item of items) {
        if (selected.length >= limit) break;
        if (!selected.some((selectedItem) => selectedItem.id === item.id)) selected.push(item);
    }

    return selected.slice(0, limit);
}

export default function Home() {
    const location = useLocation();
    const [mapMode, setMapMode] = useState("forecast-risk");
    const [mapFocusHighlight, setMapFocusHighlight] = useState(null);
    const [showAtAGlance, setShowAtAGlance] = useState(false);
    const [showMetricInfo, setShowMetricInfo] = useState(false);
    const [showResourceMenu, setShowResourceMenu] = useState(false);
    const [selectedStat, setSelectedStat] = useState(null);
    const [activeUpdateIndex, setActiveUpdateIndex] = useState(0);
    const [reportOverrides, setReportOverrides] = useState({});
    const [createdReports, setCreatedReports] = useState([]);
    const [deletedReportIds, setDeletedReportIds] = useState(new Set());
    const [editingReport, setEditingReport] = useState(null);
    const [checkingReportId, setCheckingReportId] = useState(null);
    const [reportSearch,setReportSearch]=useState("");
    const [spotlightSearch,setSpotlightSearch]=useState("");
    const [reportLimit,setReportLimit]=useState(6);
    const [spotlightLimit,setSpotlightLimit]=useState(6);
    const [reportCategory, setReportCategory] = useState("");
    const [reportInstitute, setReportInstitute] = useState("");
    const [reportKeyword, setReportKeyword] = useState("");
    const [spotlightOverrides, setSpotlightOverrides] = useState({});
    const [createdSpotlights, setCreatedSpotlights] = useState([]);
    const [deletedSpotlightIds, setDeletedSpotlightIds] = useState(new Set());
    const [editingSpotlight, setEditingSpotlight] = useState(null);
    const [checkingSpotlightId, setCheckingSpotlightId] = useState(null);
    const [spotlightCategory, setSpotlightCategory] = useState("");
    const [spotlightInstitute, setSpotlightInstitute] = useState("");
    const [spotlightKeyword, setSpotlightKeyword] = useState("");
    const [showSupportingData, setShowSupportingData] = useState(() => (
        new URLSearchParams(window.location.search).get("supportingData") === "true"
    ));
    const [supportingOverrides, setSupportingOverrides] = useState({});
    const [createdSupporting, setCreatedSupporting] = useState([]);
    const [deletedSupportingIds, setDeletedSupportingIds] = useState(new Set());
    const [editingSupporting, setEditingSupporting] = useState(null);
    const [checkingSupportingId, setCheckingSupportingId] = useState(null);
    const [supportingCategory, setSupportingCategory] = useState("");
    const [supportingInstitute, setSupportingInstitute] = useState("");
    const [supportingKeyword, setSupportingKeyword] = useState("");
    const mapSectionRef = useRef(null);
    const mapFocusCounterRef = useRef(0);
    const { isAdmin, token } = useCurrentUser();
    const reportsPath = useMemo(() => {
        const params = new URLSearchParams({
            resource_group: "reports_stories",
            page: "1",
            limit: "100",
            sort: "publication_year",
            order: "desc",
        });
        if (reportSearch) params.set("search",reportSearch);
        if (reportCategory) params.set("resource_type", reportCategory);
        if (reportInstitute) params.set("author", reportInstitute);
        if (reportKeyword) params.set("keyword", reportKeyword);
        return `/api/resources?${params.toString()}`;
    }, [reportCategory, reportInstitute, reportKeyword, reportSearch]);
    const spotlightPath = useMemo(() => {
        const params = new URLSearchParams({
            resource_group: "data_spotlight",
            page: "1",
            limit: "100",
            sort: "publication_year",
            order: "desc",
        });
        if (spotlightSearch) params.set("search",spotlightSearch);
        if (spotlightCategory) params.set("resource_type", spotlightCategory);
        if (spotlightInstitute) params.set("author", spotlightInstitute);
        if (spotlightKeyword) params.set("keyword", spotlightKeyword);
        return `/api/resources?${params.toString()}`;
    }, [spotlightCategory, spotlightInstitute, spotlightKeyword, spotlightSearch]);
    const supportingPath = useMemo(() => {
        const params = new URLSearchParams({
            resource_group: "supporting_data",
            page: "1",
            limit: "100",
            sort: "publication_year",
            order: "desc",
        });
        if (supportingCategory) params.set("resource_type", supportingCategory);
        if (supportingInstitute) params.set("author", supportingInstitute);
        if (supportingKeyword) params.set("keyword", supportingKeyword);
        return `/api/resources?${params.toString()}`;
    }, [supportingCategory, supportingInstitute, supportingKeyword]);
    const { data: heroResponse } = useJsonResource("/api/site/hero", { cache: true });
    const { data: siteStatsResponse } = useJsonResource("/api/site/stats?schema=focus-v1");
    const { data: alertsResponse } = useJsonResource("/api/alerts/recent?days=5");
    const { data: reportsResponse, loading: reportsLoading, error: reportsError } = useJsonResource(reportsPath);
    const { data: spotlightResponse, loading: spotlightLoading, error: spotlightError } = useJsonResource(spotlightPath);
    const { data: supportingResponse, loading: supportingLoading, error: supportingError } = useJsonResource(
        showSupportingData ? supportingPath : null
    );

    const hero = heroResponse?.status === "ok" ? heroResponse.data : null;
    const heroImage = hero?.image_path ? apiUrl(hero.image_path) : null;
    const heroHighlights =
        siteStatsResponse?.status === "ok" && Array.isArray(siteStatsResponse.data?.highlights)
            ? siteStatsResponse.data.highlights
            : [];
    const atAGlanceFacts =
        siteStatsResponse?.status === "ok" && Array.isArray(siteStatsResponse.data?.atAGlance)
            ? siteStatsResponse.data.atAGlance
            : [];
    const portalStats = siteStatsResponse?.status === "ok" ? siteStatsResponse.data?.portalStats || {} : {};
    const updateItems = buildUpdateItems(alertsResponse);
    const monitoringItems = buildMonitoringItems();
    const alertItems = [...updateItems, ...monitoringItems];
    const highlightItems = buildHighlightItems(alertItems);
    const recentUpdates = updateItems.filter((item) => isRecentUpdate(item, 5));
    const updatePanelItems = recentUpdates.length > 0 ? recentUpdates : monitoringItems;
    const reportFilters = reportsResponse?.filters || { resourceTypes: [], authors: [], keywords: [] };
    const reportHasFilters = reportSearch || reportCategory || reportInstitute || reportKeyword;
    const createdReportsForFilters = createdReports.filter((report) => (
        (!reportCategory || report.resource_type === reportCategory)
        && (!reportInstitute || report.author === reportInstitute)
        && (!reportKeyword || (Array.isArray(report.keywords) && report.keywords.includes(reportKeyword)))
    ));
    const reportsAndStories =
        reportsResponse?.status === "ok" && Array.isArray(reportsResponse.data)
            ? [
                    ...createdReportsForFilters,
                    ...reportsResponse.data
                        .filter((row) => !deletedReportIds.has(row.id))
                        .map((row) => reportOverrides[row.id] || row),
                ]
            : createdReportsForFilters;
    const spotlightFilters = spotlightResponse?.filters || { resourceTypes: [], authors: [], keywords: [] };
    const spotlightHasFilters = spotlightSearch || spotlightCategory || spotlightInstitute || spotlightKeyword;
    const createdSpotlightsForFilters = createdSpotlights.filter((item) => (
        (!spotlightCategory || item.resource_type === spotlightCategory)
        && (!spotlightInstitute || item.author === spotlightInstitute)
        && (!spotlightKeyword || (Array.isArray(item.keywords) && item.keywords.includes(spotlightKeyword)))
    ));
    const dataSpotlights =
        spotlightResponse?.status === "ok" && Array.isArray(spotlightResponse.data)
            ? [
                    ...createdSpotlightsForFilters,
                    ...spotlightResponse.data
                        .filter((row) => !deletedSpotlightIds.has(row.id))
                        .map((row) => spotlightOverrides[row.id] || row),
                ]
            : createdSpotlightsForFilters;
    const supportingFilters = supportingResponse?.filters || { resourceTypes: [], authors: [], keywords: [] };
    const supportingHasFilters = supportingCategory || supportingInstitute || supportingKeyword;
    const createdSupportingForFilters = createdSupporting.filter((item) => (
        (!supportingCategory || item.resource_type === supportingCategory)
        && (!supportingInstitute || item.author === supportingInstitute)
        && (!supportingKeyword || (Array.isArray(item.keywords) && item.keywords.includes(supportingKeyword)))
    ));
    const supportingData =
        supportingResponse?.status === "ok" && Array.isArray(supportingResponse.data)
            ? [
                    ...createdSupportingForFilters,
                    ...supportingResponse.data
                        .filter((row) => !deletedSupportingIds.has(row.id))
                        .map((row) => supportingOverrides[row.id] || row),
                ]
            : createdSupportingForFilters;
    const activeUpdateDisplayIndex = updatePanelItems.length > 0
        ? Math.min(activeUpdateIndex, updatePanelItems.length - 1)
        : 0;
    const activeUpdate = updatePanelItems[activeUpdateDisplayIndex] || null;
    const canPageUpdates = updatePanelItems.length > 1;
    const heroStats = [
        {
            label: "Institutions",
            value: portalStats.catalogueInstitutions,
            detail: "Catalogue institutions represented in the SAEON mirror",
            syncedAt: portalStats.catalogueSyncedAt,
            items: portalStats.institutions,
            linkType: "catalogue",
            catalogueFilterType: "institution",
            cataloguePath: "records",
        },
        {
            label: "Providers",
            value: portalStats.catalogueProviders,
            detail: "Catalogue publishers and data providers represented in the mirror",
            syncedAt: portalStats.catalogueSyncedAt,
            items: portalStats.providers,
            linkType: "catalogue",
            catalogueFilterType: "provider",
            cataloguePath: "records",
        },
        {
            label: "Collections",
            value: portalStats.catalogueCollections,
            detail: "SAEON catalogue collections mirrored for SARVA search",
            syncedAt: portalStats.catalogueSyncedAt,
            items: portalStats.collections,
            linkType: "catalogue",
            catalogueFilterType: "collection",
            cataloguePath: "records",
        },
        {
            label: "Catalogue records",
            value: portalStats.catalogueRecords,
            detail: "Total SAEON catalogue records mirrored for SARVA search",
            syncedAt: portalStats.catalogueSyncedAt,
            items: [
                { label: "Mirrored records", count: portalStats.catalogueRecords },
                { label: "Institutions", count: portalStats.catalogueInstitutions },
                { label: "Providers", count: portalStats.catalogueProviders },
                { label: "Collections", count: portalStats.catalogueCollections },
            ],
            linkType: "catalogue",
            cataloguePath: "records",
        },
        {
            label: "Observation sites",
            value: portalStats.observationSites,
            detail: "Mapped SAEON live observation sites",
            syncedAt: portalStats.observationSitesSyncedAt,
            items: portalStats.observationSiteList,
            linkType: "monitor",
        },
    ];
    const openHighlightLayer = (highlight) => {
        const scrollMapIntoView = () => {
            mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        };

        if (highlight?.mapMode) {
            setMapMode(highlight.mapMode);
        }
        if (Number.isFinite(Number(highlight?.longitude)) && Number.isFinite(Number(highlight?.latitude))) {
            mapFocusCounterRef.current += 1;
            setMapFocusHighlight({
                id: `${highlight.label}-${mapFocusCounterRef.current}`,
                label: highlight.label,
                value: highlight.value,
                detail: highlight.detail,
                location: highlight.location,
                forecastDate: highlight.forecastDate,
                updatedAtLabel: highlight.updatedAtLabel,
                severityKey: highlight.severityKey,
                longitude: Number(highlight.longitude),
                latitude: Number(highlight.latitude),
            });
        }
        scrollMapIntoView();
        window.setTimeout(scrollMapIntoView, 180);
    };

    async function saveReport(payload) {
        const isCreate = !editingReport.id;
        const bodyPayload = {
            ...payload,
            resource_type: payload.resource_type || "Report",
        };
        const response = await fetch(apiUrl(isCreate ? "/api/resources" : `/api/resources/${editingReport.id}`), {
            method: isCreate ? "POST" : "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(bodyPayload),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            throw new Error(body?.message || "Report or story could not be saved");
        }
        if (isCreate) {
            setCreatedReports((current) => [body.data, ...current]);
        } else {
            setReportOverrides((current) => ({ ...current, [body.data.id]: body.data }));
        }
    }

    async function deleteReport(record) {
        if (!window.confirm(`Delete "${record.title}" from reports and stories?`)) return;

        const response = await fetch(apiUrl(`/api/resources/${record.id}`), {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            window.alert(body?.message || "Report or story could not be deleted");
            return;
        }

        setCreatedReports((current) => current.filter((row) => row.id !== record.id));
        setDeletedReportIds((current) => new Set(current).add(record.id));
    }

    async function checkReportLink(record) {
        setCheckingReportId(record.id);
        try {
            const response = await fetch(apiUrl(`/api/resources/${record.id}/check-link`), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || body?.status !== "ok") {
                throw new Error(body?.message || "Link could not be checked");
            }
            setReportOverrides((current) => ({ ...current, [body.data.id]: body.data }));
        } catch (error) {
            window.alert(error.message);
        } finally {
            setCheckingReportId(null);
        }
    }

    async function saveSpotlight(payload) {
        const isCreate = !editingSpotlight.id;
        const bodyPayload = {
            ...payload,
            resource_type: payload.resource_type || "Database",
        };
        const response = await fetch(apiUrl(isCreate ? "/api/resources" : `/api/resources/${editingSpotlight.id}`), {
            method: isCreate ? "POST" : "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(bodyPayload),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            throw new Error(body?.message || "Data spotlight item could not be saved");
        }
        if (isCreate) {
            setCreatedSpotlights((current) => [body.data, ...current]);
        } else {
            setSpotlightOverrides((current) => ({ ...current, [body.data.id]: body.data }));
        }
    }

    async function deleteSpotlight(record) {
        if (!window.confirm(`Delete "${record.title}" from data spotlight?`)) return;

        const response = await fetch(apiUrl(`/api/resources/${record.id}`), {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            window.alert(body?.message || "Data spotlight item could not be deleted");
            return;
        }

        setCreatedSpotlights((current) => current.filter((row) => row.id !== record.id));
        setDeletedSpotlightIds((current) => new Set(current).add(record.id));
    }

    async function checkSpotlightLink(record) {
        setCheckingSpotlightId(record.id);
        try {
            const response = await fetch(apiUrl(`/api/resources/${record.id}/check-link`), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || body?.status !== "ok") {
                throw new Error(body?.message || "Link could not be checked");
            }
            setSpotlightOverrides((current) => ({ ...current, [body.data.id]: body.data }));
        } catch (error) {
            window.alert(error.message);
        } finally {
            setCheckingSpotlightId(null);
        }
    }

    async function saveSupporting(payload) {
        const isCreate = !editingSupporting.id;
        const bodyPayload = {
            ...payload,
            resource_type: payload.resource_type || "Supporting Data",
        };
        const response = await fetch(apiUrl(isCreate ? "/api/resources" : `/api/resources/${editingSupporting.id}`), {
            method: isCreate ? "POST" : "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(bodyPayload),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            throw new Error(body?.message || "Supporting data item could not be saved");
        }
        if (isCreate) {
            setCreatedSupporting((current) => [body.data, ...current]);
        } else {
            setSupportingOverrides((current) => ({ ...current, [body.data.id]: body.data }));
        }
    }

    async function deleteSupporting(record) {
        if (!window.confirm(`Delete "${record.title}" from supporting data?`)) return;

        const response = await fetch(apiUrl(`/api/resources/${record.id}`), {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            window.alert(body?.message || "Supporting data item could not be deleted");
            return;
        }

        setCreatedSupporting((current) => current.filter((row) => row.id !== record.id));
        setDeletedSupportingIds((current) => new Set(current).add(record.id));
    }

    async function checkSupportingLink(record) {
        setCheckingSupportingId(record.id);
        try {
            const response = await fetch(apiUrl(`/api/resources/${record.id}/check-link`), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || body?.status !== "ok") {
                throw new Error(body?.message || "Link could not be checked");
            }
            setSupportingOverrides((current) => ({ ...current, [body.data.id]: body.data }));
        } catch (error) {
            window.alert(error.message);
        } finally {
            setCheckingSupportingId(null);
        }
    }

    const openCatalogueLink = async (event, stat, item) => {
        if (!stat?.catalogueFilterType) return;
        event.preventDefault();

        const fallbackUrl = catalogueUrl(stat);
        const tab = window.open(fallbackUrl, "_blank");
        const value = String(item?.label || "").trim();

        if (!value || !tab) return;

        try {
            const response = await fetch(apiUrl(`/api/catalogue/share-link?type=${encodeURIComponent(stat.catalogueFilterType)}&value=${encodeURIComponent(value)}`));
            const payload = await response.json();
            tab.location.href = payload?.status === "ok" && payload.url ? payload.url : fallbackUrl;
        } catch {
            tab.location.href = fallbackUrl;
        }
    };

    const pageUpdate = (direction) => {
        if (!canPageUpdates) return;
        setActiveUpdateIndex((current) => (
            (current + direction + updatePanelItems.length) % updatePanelItems.length
        ));
    };

    useEffect(() => {
        setActiveUpdateIndex(0);
    }, [updatePanelItems.map((item) => item.id).join("|")]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get("supportingData") === "true") setShowSupportingData(true);
    }, [location.search]);

    function closeSupportingData() {
        setShowSupportingData(false);
        const url = new URL(window.location.href);
        url.searchParams.delete("supportingData");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }

    return (
        <div className="sarva-dash">
            <main className="sarva-dash__main">
                <section
                    className={`sarva-dash__hero sarva-dash__hero--lead${heroImage ? " has-image" : ""}`}
                    style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
                >
                    <div>
                        <span className="sarva-dash__versionBadge">SARVA version 4</span>
                        <span className="sarva-dash__heroKicker">
                            {hero?.subtitle || "Mapping the way to a resilient future"}
                        </span>
                        <h1>{hero?.title || "South African Risk & Vulnerability Atlas"}</h1>
                        <p>{hero?.description || "An open access platform linking datasets, indicators, and tools."}</p>
                        <a href={DATA_SCIENCE_LAB_PATH} className="sarva-dash__labCallout" aria-label="Open Environmental Data Science Lab">
                            <span className="sarva-dash__labLogo">
                                <img src={dataScienceLabLogo} alt="Environmental Data Science Lab" />
                            </span>
                            <span>
                                <em>Learning hub</em>
                                <strong>Environmental Data Science Lab</strong>
                                <small>Tutorials, prototype apps, blog notes and practical SARVA data-science workflows.</small>
                                <i>Open lab</i>
                            </span>
                        </a>
                        <div className="sarva-dash__heroActions">
                            <Link to={homeCtaPath(hero)}>
                                {hero?.cta_label || "Explore Now"}
                            </Link>
                            <Link to="/municipal-risk-profiler">Municipal risk profiles</Link>
                            <button type="button" onClick={() => setShowResourceMenu(true)}>
                                Open resources
                            </button>
                        </div>
                    </div>
                    {heroHighlights.length > 0 && (
                        <aside className="sarva-dash__heroHighlights" aria-label="SARVA live highlights">
                            <div className="sarva-dash__heroHighlightsHead">
                                <div>
                                    <span>{siteStatsResponse?.data?.title || "Environmental screening highlights"}</span>
                                    <small>Click a highlight to open its map layer. Click i for interesting facts about South Africa.</small>
                                </div>
                                <div>
                                    {atAGlanceFacts.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAtAGlance(true)}
                                            aria-label="Open interesting facts about South Africa"
                                            title="Interesting facts about South Africa"
                                        >
                                            i
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowMetricInfo(true)}
                                        aria-label="Open source and metric calculation notes"
                                        title="Sources and metric calculation"
                                    >
                                        fx
                                    </button>
                                </div>
                            </div>
                            <p className="sarva-screeningNotice"><a href="https://www.ecmwf.int/en/forecasts/datasets/open-data" target="_blank" rel="noreferrer">ECMWF Open Data ↗</a> interpreted by SARVA for environmental screening. These are not official forecasts or early warnings. <a href="https://www.weathersa.co.za/warnings" target="_blank" rel="noreferrer">Official forecasts and warnings: SAWS ↗</a></p>
                            <div className="sarva-dash__heroHighlightGrid">
                                {heroHighlights.slice(0, 5).map((highlight) => (
                                    <button
                                        type="button"
                                        key={highlight.label}
                                        onClick={() => openHighlightLayer(highlight)}
                                        aria-label={`Open ${highlight.label} on the map`}
                                    >
                                        <small>
                                            <b className={`is-${highlight.severityKey || "unknown"}`}>{highlight.tag || highlight.severity}</b>
                                            {highlight.label}
                                        </small>
                                        <strong>{highlight.value}</strong>
                                        {highlight.explainer && <i>{highlight.explainer}</i>}
                                        <p>{highlight.detail}</p>
                                        <span>{highlight.source}</span>
                                        <em>
                                            {isExpiredForecast(highlight.forecastDate)
                                                ? "Past forecast — historical context only"
                                                : highlight.freshness}
                                            {highlight.updatedAtLabel ? ` | ${highlight.updatedAtLabel}` : ""}
                                        </em>
                                        <span className="sarva-highlightAction">View on map <b aria-hidden="true">→</b></span>
                                    </button>
                                ))}
                            </div>
                        </aside>
                    )}
                </section>

                <section className="sarva-dash__workspace" id="risk-map" ref={mapSectionRef}>
                    <article className="sarva-panel sarva-panel--map sarva-panel--featured">
                        <div className="sarva-panel__head">
                            <div>
                                <h2>Explore South Africa</h2>
                                <p>ECMWF rainfall screening, environmental risk layers and SAEON live observations for national context.</p>
                            </div>
                            <div className="sarva-dash__tabs">
                                <button
                                    type="button"
                                    className={mapMode === "forecast-risk" ? "is-active" : ""}
                                    onClick={() => setMapMode("forecast-risk")}
                                >
                                    Forecast Rainfall Risk
                                </button>
                                <button
                                    type="button"
                                    className={mapMode === "rainfall-risk" ? "is-active" : ""}
                                    onClick={() => setMapMode("rainfall-risk")}
                                >
                                    SAEON Live Observations
                                </button>
                                <button
                                    type="button"
                                    className={mapMode === "environmental-risk" ? "is-active" : ""}
                                    onClick={() => setMapMode("environmental-risk")}
                                >
                                    Environmental Risk Index
                                </button>
                            </div>
                        </div>
                        <Suspense fallback={<div className="sarva-map sarva-map__loading">Loading map...</div>}>
                            <SouthAfricaMap
                                activeMode={mapMode}
                                onModeChange={setMapMode}
                                focusHighlight={mapFocusHighlight}
                            />
                        </Suspense>
                    </article>
                </section>

                <section className="sarva-dash__stats sarva-dash__heroStats" aria-label="SARVA data summary">
                    {heroStats.map((stat) => (
                        <button
                            type="button"
                            className="sarva-dash__stat"
                            key={stat.label}
                            onClick={() => setSelectedStat(stat)}
                            aria-label={`Open ${stat.label} details`}
                        >
                            <strong>{formatStat(stat.value)}</strong>
                            <span>{stat.label}</span>
                            <small>{stat.detail}</small>
                            <em>{formatSyncTime(stat.syncedAt)}</em>
                            <span className="sarva-statAction">View details <b aria-hidden="true">→</b></span>
                        </button>
                    ))}
                </section>
                <section
                    className="sarva-newsTicker"
                    aria-label="SARVA updates and monitoring notices"
                >
                    <div className="sarva-newsTicker__label">
                        <strong>Risk watch</strong>
                        <span>Curated public feeds</span>
                    </div>
                    <div className="sarva-newsTicker__controls" aria-label="Move through updates">
                        <button type="button" onClick={() => pageUpdate(-1)} disabled={!canPageUpdates} aria-label="Previous update">
                            &lt;
                        </button>
                        <span>{updatePanelItems.length > 0 ? `${activeUpdateDisplayIndex + 1} / ${updatePanelItems.length}` : "0 / 0"}</span>
                        <button type="button" onClick={() => pageUpdate(1)} disabled={!canPageUpdates} aria-label="Next update">
                            &gt;
                        </button>
                    </div>
                    {activeUpdate && (() => {
                        const isInternal = String(activeUpdate.href || "").startsWith("#");
                        const href = isInternal ? activeUpdate.href : externalAlertUrl(activeUpdate.href);
                        const content = (
                            <>
                                <span className="sarva-newsTicker__badge">{activeUpdate.label}</span>
                                <strong>{activeUpdate.title}</strong>
                                <small className="sarva-newsTicker__meta">
                                    {activeUpdate.kind === "update"
                                        ? `${activeUpdate.feedCategory || activeUpdate.category || "Update"} | ${activeUpdate.source} | Published: ${formatAlertDate(activeUpdate.date)}`
                                        : `Official source | ${activeUpdate.source}`}
                                    {activeUpdate.updatedAt ? ` | Updated: ${formatAlertDate(activeUpdate.updatedAt)}` : ""}
                                </small>
                                <em>{activeUpdate.detail}</em>
                                {activeUpdate.tags?.length > 0 && (
                                    <small className="sarva-newsTicker__tags">
                                        {activeUpdate.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ")}
                                    </small>
                                )}
                                {activeUpdate.relevanceReason && (
                                    <small className="sarva-newsTicker__reason">
                                        Why shown: {activeUpdate.relevanceReason.split(" | ").slice(0, 2).join(" | ")}
                                    </small>
                                )}
                            </>
                        );

                        return href ? (
                            <a
                                key={activeUpdate.id}
                                href={href}
                                target={isInternal ? undefined : "_blank"}
                                rel={isInternal ? undefined : "noopener noreferrer"}
                                className={`sarva-newsTicker__item ${alertSeverityClass(activeUpdate.severity)}`}
                            >
                                {content}
                            </a>
                        ) : (
                            <div className={`sarva-newsTicker__item ${alertSeverityClass(activeUpdate.severity)} is-disabled`}>
                                {content}
                            </div>
                        );
                    })()}
                </section>
                <aside className="sarva-publicDataNotice" aria-label="Public data notice">
                    <strong>Public data notice</strong>
                    <span>
                        Risk-watch items are drawn from public source pages, RSS/news feeds and open data endpoints, then filtered for SARVA environmental risk, hazard, disaster, public-health, service-delivery, governance and resilience relevance. General conflict or political news is excluded unless it has a clear humanitarian, infrastructure, health, water, food-security or disaster-risk signal. Feeds may be delayed, incomplete or unavailable and do not replace official warnings or emergency instructions.
                    </span>
                </aside>
                {showMetricInfo && (
                    <div
                        className="sarva-dash__glanceOverlay"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Sources and metric calculation"
                    >
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowMetricInfo(false)}
                                aria-label="Close source and metric calculation notes"
                            >
                                x
                            </button>
                            <span>Sources and metric calculation</span>
                            <h2>How the hero highlights are calculated</h2>
                            <p className="sarva-dash__glanceIntro">
                                These are SARVA development screening indicators from cached ECMWF Open Data IFS 0.25 degree forecast fields. They are for exploration and context, not formal warnings.
                            </p>
                            <div>
                                {heroHighlights.slice(0, 5).map((highlight) => (
                                    <article key={`metric-${highlight.label}`}>
                                        <small>{highlight.tag || highlight.label}</small>
                                        <strong>{highlight.label}</strong>
                                        <p>{highlight.explainer || highlight.detail}</p>
                                        <em>
                                            Source: {highlight.source}
                                            {highlight.updatedAtLabel ? ` | Updated: ${highlight.updatedAtLabel}` : ""}
                                        </em>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {showAtAGlance && (
                    <div
                        className="sarva-dash__glanceOverlay"
                        role="dialog"
                        aria-modal="true"
                        aria-label="South Africa at a glance"
                    >
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowAtAGlance(false)}
                                aria-label="Close South Africa at a glance"
                            >
                                x
                            </button>
                            <span>Interesting facts about South Africa</span>
                            <h2>Useful national context for risk and vulnerability</h2>
                            <div>
                                {atAGlanceFacts.map((fact) => (
                                    <article key={`${fact.section}-${fact.fact}`}>
                                        <small>{fact.section}</small>
                                        <strong>{fact.fact}</strong>
                                        <p>
                                            {fact.value}
                                            {fact.unit ? ` ${fact.unit}` : ""}
                                            {fact.place ? ` | ${fact.place}` : ""}
                                        </p>
                                        <em>Source: {fact.source}{fact.updated ? ` | Updated: ${fact.updated}` : ""}</em>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {showResourceMenu && (
                    <div
                        className="sarva-dash__glanceOverlay sarva-dash__resourceOverlay"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Open SARVA resources"
                    >
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowResourceMenu(false)}
                                aria-label="Close SARVA resources"
                            >
                                x
                            </button>
                            <span>Resources and tools</span>
                            <h2>Choose what you want to open</h2>
                            <p className="sarva-dash__glanceIntro">
                                Direct links to SARVA evidence products, policy records, glossary terms, SAEON data search and municipal risk profiles.
                            </p>
                            <div>
                                {resourceEntryPoints.map((entry) => (
                                    <article key={entry.title}>
                                        <small>{entry.external ? "External form" : "SARVA page"}</small>
                                        <strong>{entry.title}</strong>
                                        <p>{entry.detail}</p>
                                        {entry.external || isExternalLink(entry.to) ? (
                                            <a href={entry.to} target="_blank" rel="noreferrer">
                                                Open
                                            </a>
                                        ) : (
                                            <Link to={entry.to} onClick={() => setShowResourceMenu(false)}>
                                                Open
                                            </Link>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {selectedStat && (
                    <div
                        className="sarva-dash__glanceOverlay"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${selectedStat.label} details`}
                    >
                        <div>
                            <button
                                type="button"
                                onClick={() => setSelectedStat(null)}
                                aria-label={`Close ${selectedStat.label} details`}
                            >
                                x
                            </button>
                            <span>SAEON catalogue mirror</span>
                            <h2>{selectedStat.label}</h2>
                            <p className="sarva-dash__glanceIntro">
                                {selectedStat.detail}. {formatSyncTime(selectedStat.syncedAt)}.
                            </p>
                            <div>
                                {(Array.isArray(selectedStat.items) ? selectedStat.items : []).map((item) => {
                                    const itemCitationUrl = citationUrl(item);

                                    return (
                                        <article key={`${selectedStat.label}-${item.label || item.stationName}`}>
                                            <small>{item.stationName || selectedStat.label}</small>
                                            <strong>{item.label || item.stationName}</strong>
                                            {Number.isFinite(Number(item.count)) && <p>{formatStat(item.count)} records</p>}
                                            {selectedStat.linkType === "catalogue" && (
                                                <em>
                                                    <a
                                                        href={catalogueUrl(selectedStat)}
                                                        onClick={(event) => openCatalogueLink(event, selectedStat, item)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Open {selectedStat.label.toLowerCase()} in SAEON catalogue
                                                    </a>
                                                </em>
                                            )}
                                            {selectedStat.linkType === "monitor" && (
                                                <>
                                                    {itemCitationUrl && (
                                                        <em>
                                                            <a href={itemCitationUrl} target="_blank" rel="noreferrer">
                                                                Citation
                                                            </a>
                                                        </em>
                                                    )}
                                                    <em>
                                                        <a href={monitorUrl()} target="_blank" rel="noreferrer">
                                                            Open Terrestrial Observations Monitor
                                                        </a>
                                                    </em>
                                                </>
                                            )}
                                            {item.websiteUrl && (
                                                <em>
                                                    <a href={withSarvaSource(item.websiteUrl)} target="_blank" rel="noreferrer">Open live station page</a>
                                                </em>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                <section className="sarva-dash__portalIntro" aria-label="SARVA portal entry points">
                    <div>
                        <span>Start with what you need</span>
                        <h2>One portal for risk context, data, tools and evidence.</h2>
                    </div>
                    <div className="sarva-dash__portalGrid">
                        {portalCategories.map((category) => (
                            <article
                                key={category.title}
                                className={`sarva-dash__portalCard${category.featured ? " is-featured" : ""}${category.theme ? ` is-${category.theme}` : ""}`}
                            >
                                <Link to={category.to} className="sarva-dash__portalMain">
                                    <span>{category.icon}</span>
                                    <strong>{category.title}</strong>
                                    <small>{category.detail}</small>
                                </Link>
                                {Array.isArray(category.layers) && (
                                    <div className="sarva-dash__themeChips" aria-label={`${category.title} themes`}>
                                        {category.layers.map((layer) => (
                                            <span key={layer}>{layer}</span>
                                        ))}
                                    </div>
                                )}
                                <div>
                                    {category.links.map(([label, to]) => (
                                        isExternalLink(to) ? (
                                            <a href={to} key={label} target="_blank" rel="noreferrer">
                                                {label}
                                            </a>
                                        ) : (
                                            <Link to={to} key={label}>
                                                {label}
                                            </Link>
                                        )
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <div className="sarva-frameworkHeading"><h2>Essential Variable Frameworks</h2><p>International frameworks defining what to measure and monitor across climate, biodiversity, oceans and ecosystem services.</p></div>
                <section className="sarva-dash__referenceStrip" aria-label="Essential variable framework links">
                    <a href="https://gcos.wmo.int/en/essential-climate-variables" target="_blank" rel="noreferrer">
                        <span>ECV</span>
                        <strong>Essential Climate Variables</strong>
                        <small>GCOS / WMO framework</small>
                        <em className="sarva-frameworkAction">Explore framework ↗</em>
                    </a>
                    <a href="https://geobon.org/ebvs/what-are-ebvs/" target="_blank" rel="noreferrer">
                        <span>EBV</span>
                        <strong>Essential Biodiversity Variables</strong>
                        <small>GEO BON framework</small>
                        <em className="sarva-frameworkAction">Explore framework ↗</em>
                    </a>
                    <a href="https://goosocean.org/what-we-do/framework/essential-ocean-variables/" target="_blank" rel="noreferrer">
                        <span>EOV</span>
                        <strong>Essential Ocean Variables</strong>
                        <small>GOOS / UNESCO IOC framework</small>
                        <em className="sarva-frameworkAction">Explore framework ↗</em>
                    </a>
                    <a href="https://geobon.org/eesvs/what-are-eesvs/" target="_blank" rel="noreferrer">
                        <span>EESV</span>
                        <strong>Essential Ecosystem Service Variables</strong>
                        <small>GEO BON ecosystem-services framework</small>
                        <em className="sarva-frameworkAction">Explore framework ↗</em>
                    </a>
                </section>

                <section className="sarva-dash__libraryPair" aria-label="Featured reports and data spotlight">
                    <article className="sarva-panel sarva-panel--reports">
                        <div className="sarva-panel__head">
                            <div className="sarva-panel__titleGroup">
                                <SectionIcon kind="report" />
                                <div>
                                    <h2>Latest Reports & Stories</h2>
                                    <p>Featured SARVA evidence products, briefs and stories from the resource library.</p>
                                </div>
                            </div>
                            <div className="sarva-reports__headActions">
                                <Link to="/resources?resource_group=reports_stories">View all</Link>
                                {isAdmin && (
                                    <button type="button" onClick={() => setEditingReport({ resource_type: "Report" })}>
                                        Add report or story
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="sarva-reports__filters" aria-label="Filter reports and stories">
                            <label className="sarva-librarySearch"><span>Search reports</span><input type="search" placeholder="Title, topic or organisation" value={reportSearch} onChange={e=>{setReportSearch(e.target.value);setReportLimit(6);}} /></label>
                            <label>
                                <span>Category</span>
                                <select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}>
                                    <option value="">All categories</option>
                                    {(reportFilters.resourceTypes || []).map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>Institute</span>
                                <select value={reportInstitute} onChange={(event) => setReportInstitute(event.target.value)}>
                                    <option value="">All institutes</option>
                                    {(reportFilters.authors || []).map((author) => (
                                        <option key={author} value={author}>
                                            {author}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>Keyword</span>
                                <select value={reportKeyword} onChange={(event) => setReportKeyword(event.target.value)}>
                                    <option value="">All keywords</option>
                                    {(reportFilters.keywords || []).map((keyword) => (
                                        <option key={keyword} value={keyword}>
                                            {keyword}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {reportHasFilters && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReportSearch("");
                                        setReportCategory("");
                                        setReportInstitute("");
                                        setReportKeyword("");
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {reportsLoading && (
                            <div className="sarva-reports__state">Loading reports and stories...</div>
                        )}

                        {reportsError && (
                            <div className="sarva-reports__state">Reports and stories could not be loaded.</div>
                        )}

                        {!reportsLoading && !reportsError && reportsAndStories.length === 0 && (
                            <div className="sarva-reports__state">No reports or stories are available yet.</div>
                        )}

                        <div className="sarva-reports__grid">
                            {reportsAndStories.slice(0,reportLimit).map((report) => (
                                <ResourceCard
                                    key={report.id}
                                    item={report}
                                    isAdmin={isAdmin}
                                    onEdit={setEditingReport}
                                    onCheck={checkReportLink}
                                    checking={checkingReportId === report.id}
                                    onDelete={deleteReport}
                                />
                            ))}
                        </div>
                        {reportsAndStories.length>reportLimit&&<button className="sarva-libraryMore" onClick={()=>setReportLimit(n=>n+6)}>Show more reports ({reportsAndStories.length-reportLimit} remaining)</button>}
                    </article>

                    <article className="sarva-panel sarva-panel--reports">
                        <div className="sarva-panel__head">
                            <div className="sarva-panel__titleGroup">
                                <SectionIcon kind="database" />
                                <div>
                                    <h2>Data Spotlight</h2>
                                    <p>Featured datasets, tools and live resource links from the library.</p>
                                </div>
                            </div>
                            <div className="sarva-reports__headActions">
                                <Link to="/resources?resource_group=data_spotlight">View all</Link>
                                {isAdmin && (
                                    <button type="button" onClick={() => setEditingSpotlight({ resource_type: "Database" })}>
                                        Add spotlight
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="sarva-reports__filters" aria-label="Filter data spotlight items">
                            <label className="sarva-librarySearch"><span>Search datasets and tools</span><input type="search" placeholder="Title, topic or organisation" value={spotlightSearch} onChange={e=>{setSpotlightSearch(e.target.value);setSpotlightLimit(6);}} /></label>
                            <label>
                                <span>Category</span>
                                <select value={spotlightCategory} onChange={(event) => setSpotlightCategory(event.target.value)}>
                                    <option value="">All categories</option>
                                    {(spotlightFilters.resourceTypes || []).map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>Institute</span>
                                <select value={spotlightInstitute} onChange={(event) => setSpotlightInstitute(event.target.value)}>
                                    <option value="">All institutes</option>
                                    {(spotlightFilters.authors || []).map((author) => (
                                        <option key={author} value={author}>
                                            {author}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>Keyword</span>
                                <select value={spotlightKeyword} onChange={(event) => setSpotlightKeyword(event.target.value)}>
                                    <option value="">All keywords</option>
                                    {(spotlightFilters.keywords || []).map((keyword) => (
                                        <option key={keyword} value={keyword}>
                                            {keyword}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {spotlightHasFilters && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSpotlightSearch("");
                                        setSpotlightCategory("");
                                        setSpotlightInstitute("");
                                        setSpotlightKeyword("");
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {spotlightLoading && (
                            <div className="sarva-reports__state">Loading data spotlight...</div>
                        )}

                        {spotlightError && (
                            <div className="sarva-reports__state">Data spotlight could not be loaded.</div>
                        )}

                        {!spotlightLoading && !spotlightError && dataSpotlights.length === 0 && (
                            <div className="sarva-reports__state">No data spotlight items are available yet.</div>
                        )}

                        <div className="sarva-reports__grid">
                            {dataSpotlights.slice(0,spotlightLimit).map((item) => (
                                <ResourceCard
                                    key={item.id}
                                    item={item}
                                    isAdmin={isAdmin}
                                    onEdit={setEditingSpotlight}
                                    onCheck={checkSpotlightLink}
                                    checking={checkingSpotlightId === item.id}
                                    onDelete={deleteSpotlight}
                                />
                            ))}
                        </div>
                        {dataSpotlights.length>spotlightLimit&&<button className="sarva-libraryMore" onClick={()=>setSpotlightLimit(n=>n+6)}>Show more datasets and tools ({dataSpotlights.length-spotlightLimit} remaining)</button>}
                    </article>
                </section>

                <section className="sarva-dash__lower">
                    <article className="sarva-panel">
                        <div className="sarva-panel__head">
                            <h2>Updates & Monitoring</h2>
                            <Link to="/overview">View all</Link>
                        </div>
                        <ul className="sarva-alerts">
                            {highlightItems.map((alert) => (
                                <li key={alert.id}>
                                    <span className={alertSeverityClass(alert.severity)}>{alert.label.slice(0, 1)}</span>
                                    <strong>{alert.title}</strong>
                                    <small>
                                        {alert.kind === "update"
                                            ? `${alert.category || "Update"} | ${formatAlertDate(alert.date)} | ${alert.source}`
                                            : `Official source | ${alert.source}`}
                                    </small>
                                    <p>{alert.detail}</p>
                                </li>
                            ))}
                        </ul>
                    </article>

                    <article className="sarva-panel">
                        <div className="sarva-panel__head">
                            <h2>Get Involved</h2>
                        </div>
                        <div className="sarva-involved">
                            <a href="#help"><span>▤</span><strong>Contribute Data</strong><small>Share your data and knowledge</small></a>
                            <a href="#help"><span>◎</span><strong>Join a Community</strong><small>Participate in communities of practice</small></a>
                            <a href="#help"><span>◇</span><strong>Training & Capacity Building</strong><small>Grow skills and access resources</small></a>
                        </div>
                    </article>

                    <article className="sarva-panel sarva-about" id="about">
                        <div className="sarva-panel__head">
                            <h2>About SARVA</h2>
                        </div>
                        <p>
                            {hero?.description ||
                                "SARVA is a collaborative platform that integrates environmental data and tools to support decisions for a sustainable South Africa."}
                        </p>
                        <Link to="/about">Learn more about SARVA</Link>
                        <div
                            className={`sarva-about__image${heroImage ? " has-image" : ""}`}
                            style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
                        />
                    </article>
                </section>

                <footer className="sarva-dash__footer">
                    <div className="sarva-dash__footerFeatures">
                        <span><b>▤</b> API Driven <small>Open and well documented APIs</small></span>
                        <span><b>⚙</b> Integrated <small>Seamless data and service integration</small></span>
                        <span><b>◎</b> Collaborative <small>Many partners, one vision</small></span>
                        <span><b>□</b> Secure & Trusted <small>Quality data, governance and privacy</small></span>
                        <span><b>◌</b> Open by Design <small>Open data, open standards</small></span>
                    </div>
                    <div className="sarva-dash__footerBase">
                        <p>
                            Disclaimer: SARVA provides data, model outputs and public source links for exploration and
                            decision support. Content may be delayed, incomplete or unavailable and does not replace
                            official warnings, emergency instructions or source-system terms of use.
                        </p>
                        <div className="sarva-dash__footerLogos" aria-label="SARVA partner logos">
                            <Link to="/" aria-label="SARVA home">
                                <img src={sarvaLogo} alt="South African Risk and Vulnerability Atlas" />
                            </Link>
                            <a href="https://www.saeon.ac.za/" target="_blank" rel="noreferrer" aria-label="SAEON website">
                                <img src={saeonLogo} alt="NRF SAEON" />
                            </a>
                            <a href="https://www.dsti.gov.za/" target="_blank" rel="noreferrer" aria-label="DSTI website">
                                <img src={dstiLogo} alt="Department of Science, Technology and Innovation" />
                            </a>
                        </div>
                    </div>
                </footer>

                <LibraryEditModal
                    kind="resource"
                    record={editingReport}
                    onClose={() => setEditingReport(null)}
                    onSave={saveReport}
                />
                <LibraryEditModal
                    kind="resource"
                    record={editingSpotlight}
                    onClose={() => setEditingSpotlight(null)}
                    onSave={saveSpotlight}
                />
                {showSupportingData && (
                    <div className="sarva-supportingOverlay" role="dialog" aria-modal="true" aria-label="Supporting data">
                        <section className="sarva-supportingModal">
                            <div className="sarva-supportingModal__head">
                                <div>
                                    <span>Environmental supporting data</span>
                                    <h2>Supporting Data</h2>
                                    <p>Satellite products, climate datasets and environmental source systems that support SARVA workflows.</p>
                                </div>
                                <div>
                                    {isAdmin && (
                                        <button type="button" onClick={() => setEditingSupporting({ resource_type: "Supporting Data" })}>
                                            Add supporting data
                                        </button>
                                    )}
                                    <button type="button" onClick={closeSupportingData} aria-label="Close supporting data">
                                        x
                                    </button>
                                </div>
                            </div>

                            <div className="sarva-reports__filters" aria-label="Filter supporting data">
                                <label>
                                    <span>Category</span>
                                    <select value={supportingCategory} onChange={(event) => setSupportingCategory(event.target.value)}>
                                        <option value="">All categories</option>
                                        {(supportingFilters.resourceTypes || []).map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    <span>Institute</span>
                                    <select value={supportingInstitute} onChange={(event) => setSupportingInstitute(event.target.value)}>
                                        <option value="">All institutes</option>
                                        {(supportingFilters.authors || []).map((author) => (
                                            <option key={author} value={author}>{author}</option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    <span>Keyword</span>
                                    <select value={supportingKeyword} onChange={(event) => setSupportingKeyword(event.target.value)}>
                                        <option value="">All keywords</option>
                                        {(supportingFilters.keywords || []).map((keyword) => (
                                            <option key={keyword} value={keyword}>{keyword}</option>
                                        ))}
                                    </select>
                                </label>
                                {supportingHasFilters && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSupportingCategory("");
                                            setSupportingInstitute("");
                                            setSupportingKeyword("");
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {supportingLoading && <div className="sarva-reports__state">Loading supporting data...</div>}
                            {supportingError && <div className="sarva-reports__state">Supporting data could not be loaded.</div>}
                            {!supportingLoading && !supportingError && supportingData.length === 0 && (
                                <div className="sarva-reports__state">No supporting data links are available yet.</div>
                            )}

                            <div className="sarva-supportingModal__grid">
                                {supportingData.map((item) => {
                                    const status = statusForResource(item);
                                    return (
                                        <article className="sarva-reportCard sarva-reportCard--supporting" key={item.id}>
                                            <ResourceLogoMark item={item} preferProviderLogo />
                                            <div>
                                                <small>{item.resource_type || "Supporting Data"} | {formatResourceDate(item)}</small>
                                                <strong>{item.title}</strong>
                                                <div className="sarva-reportCard__health">
                                                    <span className={`is-${status}`}>{statusLabel(status)}</span>
                                                    {item.link_checked_at && (
                                                        <small>
                                                            Checked {new Date(item.link_checked_at).toLocaleDateString("en-ZA")}
                                                            {item.link_status_code ? ` | ${item.link_status_code}` : ""}
                                                        </small>
                                                    )}
                                                </div>
                                                {Array.isArray(item.keywords) && item.keywords.length > 0 && (
                                                    <div className="sarva-reportCard__tags">
                                                        {item.keywords.map((keyword) => (
                                                            <em key={keyword}>{keyword}</em>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="sarva-reportCard__actions">
                                                    {item.url && (
                                                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                                                            Open
                                                        </a>
                                                    )}
                                                    {isAdmin && (
                                                        <>
                                                            <button type="button" onClick={() => setEditingSupporting(item)}>
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => checkSupportingLink(item)}
                                                                disabled={checkingSupportingId === item.id}
                                                            >
                                                                {checkingSupportingId === item.id ? "Checking" : "Check link"}
                                                            </button>
                                                            <button type="button" className="is-danger" onClick={() => deleteSupporting(item)}>
                                                                Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                )}
                <LibraryEditModal
                    kind="resource"
                    record={editingSupporting}
                    onClose={() => setEditingSupporting(null)}
                    onSave={saveSupporting}
                />
            </main>
        </div>
    );
}
