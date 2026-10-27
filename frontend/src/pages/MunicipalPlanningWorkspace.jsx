import ForecastNotice from "../components/ForecastNotice";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AccessibilityWorkspace from "./AccessibilityWorkspace";
import StormwaterReadiness from "../components/StormwaterReadiness";
import { normalizeDraft } from "../config/planningDraft";
import { Link } from "react-router-dom";
import { MdbBoundaryMap } from "./MdbBoundaryPreview.jsx";
import "../styles/municipal-planning-workspace.css";

let draftReadError = "";

const STORAGE_KEY = "sarva:municipal-planning-workspace:v1";

const categories = [
    "Water",
    "Sanitation",
    "Electricity",
    "Roads and stormwater",
    "Waste",
    "Human settlements",
    "Disaster management",
    "Finance and governance",
    "Health and social support",
    "Environment",
];

const confidenceLevels = ["High", "Medium", "Low"];
const urgencyLevels = ["Immediate", "This year", "Medium term", "Long term"];
const statuses = ["Draft", "In review", "Approved", "In progress", "Complete"];

const forecastSignalOptions = [
    {
        key: "rainfall",
        label: "Rainfall",
        category: "Water",
        title: "Experimental model rainfall estimate",
        source: "SARVA experimental rainfall estimates from cached ECMWF model data",
        detail: "Cached model rainfall for exploration. Not a flood assessment or warning; check source dates and local conditions.",
    },
    {
        key: "heat",
        label: "Heat",
        category: "Health and social support",
        title: "Experimental model temperature estimate",
        source: "SARVA experimental temperature estimates from cached ECMWF model data",
        detail: "Cached model temperature for exploration. Not a heat warning or assessment of exposed people.",
    },
    {
        key: "wind",
        label: "Wind",
        category: "Disaster management",
        title: "Experimental model wind estimate",
        source: "SARVA experimental wind estimates from cached ECMWF model data",
        detail: "Cached model wind speed for exploration. Not a wind warning or infrastructure-impact assessment.",
    },
    {
        key: "fire",
        label: "Fire-weather",
        category: "Environment",
        title: "Experimental fire-weather indicator",
        source: "SARVA experimental fire-weather indicator from cached ECMWF model data",
        detail: "Experimental heat, wind and dryness indicator. Not an official fire-danger rating or fire prediction.",
    },
    {
        key: "overall",
        label: "Combined",
        category: "Disaster management",
        title: "Experimental combined model index",
        source: "SARVA experimental combined index from cached ECMWF model data",
        detail: "Experimental combination of cached model fields. Not a probability of harm, warning or emergency instruction.",
    },
];

const riskSignalChannels = [
    {
        name: "SARVA experimental weather model outputs",
        status: "Live in SARVA",
        category: "Disaster management",
        source: "SARVA forecast rainfall, heat, wind and fire-weather risk layers",
        title: "SARVA experimental model context",
        detail: "Explore cached model estimates as research context. Check official SAWS warnings separately; model values do not establish hazard-specific exposure or impacts.",
        forecastLayer: "rainfall",
        options: forecastSignalOptions,
        to: "/#risk-map",
        action: "Prefill signal",
    },
    {
        name: "SAWS impact-based warnings",
        status: "API candidate",
        category: "Disaster management",
        source: "SAWS weather warnings via AfriGIS Weather Warnings API",
        title: "Official weather warning signal",
        detail: "Potential feed for flooding, heavy rain, severe thunderstorms, fire danger, extreme heat, damaging winds and other warnings at broad municipal areas.",
        href: "https://developers.afrigis.co.za/portfolio/weather-warnings/",
        action: "Prefill signal",
    },
    {
        name: "SAWS CAP/RSS alert feed",
        status: "Official alert feed",
        category: "Disaster management",
        source: "South African Weather Service CAP/RSS alert feed registered with WMO",
        title: "Official alert feed signal",
        detail: "A candidate machine-readable warning feed for severe weather. It should be parsed cautiously and cross-checked with SAWS guidance.",
        href: "http://caps.weathersa.co.za/Home/RssFeed",
        action: "Prefill signal",
    },
    {
        name: "DWS hydrology and flood information",
        status: "Public hydrology",
        category: "Water",
        source: "Department of Water and Sanitation hydrology, dams, floods and flows",
        title: "River, dam or flow risk signal",
        detail: "Useful for near-real-time stage, flows, rainfall, dam levels and routed hydrographs where available.",
        href: "https://www.dws.gov.za/Hydrology/Default.aspx",
        action: "Prefill signal",
    },
    {
        name: "Topography and slope",
        status: "Prepared layer",
        category: "Roads and stormwater",
        source: "Processed DEM-derived topography layers served from SARVA PostGIS via Martin",
        title: "Terrain exposure signal",
        detail: "Contours and slope zones help interpret where rainfall may concentrate, drain slowly or create access and infrastructure exposure.",
        topographyLayer: true,
        action: "Show on map",
    },
    {
        name: "Municipal FEWS telemetry",
        status: "Local API candidate",
        category: "Disaster management",
        source: "Municipal flood early-warning system telemetry",
        title: "Local rainfall, river or coastal telemetry",
        detail: "Some municipalities expose rainfall, river level, tide, wave and camera feeds. eThekwini FEWS is a good model for this kind of integration.",
        href: "https://data.ethekwinifews.durban/register",
        action: "Prefill signal",
    },
    {
        name: "Local vulnerability records",
        status: "Use now",
        category: "Finance and governance",
        source: "Municipal records, ward reports and local vulnerability evidence",
        title: "Local vulnerability or response constraint",
        detail: "Maintenance backlogs, blocked stormwater, poor drainage, informal settlement exposure, water interruptions, ageing infrastructure and response capacity gaps.",
        action: "Prefill evidence",
    },
    {
        name: "Public risk observation",
        status: "Use carefully",
        category: "Roads and stormwater",
        source: "Public observation for risk and vulnerability planning evidence",
        title: "Recurring public risk observation",
        detail: "For repeated flooding, heat exposure, dumping hotspots, unsafe public spaces, fire risk or prolonged service disruption patterns. Keep it general and non-personal.",
        action: "Prefill evidence",
    },
    {
        name: "Existing reporting channels",
        status: "Do not duplicate",
        category: "Finance and governance",
        source: "External municipal fault reporting channels",
        title: "Aggregated reporting-channel signal",
        detail: "Use call centres, GovChat, My Smart City, SeeClickFix, ESP or ward systems for ticketing. Bring only aggregate trends into SARVA planning.",
        action: "Prefill evidence",
    },
    {
        name: "SeeClickFix / Open311",
        status: "API candidate",
        category: "Roads and stormwater",
        source: "SeeClickFix / Open311 public service request API",
        title: "Open311 issue trend signal",
        detail: "Potential feed for potholes, illegal dumping, public-space maintenance and non-emergency requests where a municipality uses it.",
        href: "https://dev.seeclickfix.com/v2/issues/",
        action: "Prefill signal",
    },
    {
        name: "ESP community outage reports",
        status: "Licensed API",
        category: "Electricity",
        source: "ESP community outage and service disruption reports",
        title: "Community outage pressure signal",
        detail: "Potential live signal for electricity, water and internet disruptions if SARVA has licensed API access.",
        href: "https://eskom.sepush.co.za/",
        action: "Prefill signal",
    },
    {
        name: "iNaturalist / GBIF",
        status: "Open biodiversity API",
        category: "Environment",
        source: "iNaturalist / GBIF citizen science observations",
        title: "Ecological vulnerability signal",
        detail: "Useful for biodiversity, invasive species and ecological context around a municipality.",
        href: "https://www.inaturalist.org/api",
        action: "Prefill signal",
    },
    {
        name: "SAEON Observations API",
        status: "Verified observations",
        category: "Environment",
        source: "SAEON Observations Database WebAPI",
        title: "Verified environmental observation signal",
        detail: "Verified environmental observations that can support risk and vulnerability planning alongside community reports.",
        href: "https://observationsapi.saeon.ac.za/",
        action: "Prefill signal",
    },
];

const evidenceTemplate = [
    "municipality,category,risk_or_vulnerability,location,value,unit,source,source_date,confidence,notes",
    "City of Tshwane,Water,Repeated stormwater flooding,Ward 17,3,events,Disaster management incident log,2026-08-31,Medium,Replace this row with local risk evidence",
].join("\n");

const emptyEvidence = {
    category: categories[0],
    title: "",
    location: "",
    value: "",
    unit: "",
    source: "",
    sourceDate: "",
    confidence: "Medium",
    notes: "",
};

const emptyPriority = {
    evidenceIds: [],
    category: categories[0],
    title: "",
    why: "",
    urgency: "This year",
    impact: "High",
    owner: "",
    status: "Draft",
};

const emptyAction = {
    priorityId: "",
    priority: "",
    action: "",
    owner: "",
    timeframe: "",
    estimatedCost: "",
    fundingSource: "",
    status: "Draft",
    expectedChange: "",
};

function makeDraft() {
    return {
        municipality: "",
        municipalityCode: "",
        evidence: [],
        priorities: [],
        actions: [],
        updatedAt: new Date().toISOString(),
    };
}

function readDraft() {
    if (typeof window === "undefined") return makeDraft();

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored ? normalizeDraft(JSON.parse(stored)) : makeDraft();
    } catch {
        draftReadError = "Existing draft could not be read. It has been preserved in browser storage. Export or restore a valid backup before replacing it.";
        return makeDraft();
    }
}

function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value) {
    if (!value) return "Not supplied";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-ZA");
}

function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function buildBrief(workspace) {
    const lines = [
        `# Municipal planning brief: ${workspace.municipality || "Unnamed municipality"}`,
        "",
        `Generated: ${new Date().toLocaleString("en-ZA")}`,
        `Municipality code: ${workspace.municipalityCode || "Not supplied"}`,
        "",
        "This draft is locally captured planning evidence. It is not submitted to SARVA until an official submission workflow is added.",
        "",
        "## Evidence register",
    ];

    if (workspace.evidence.length === 0) {
        lines.push("No local evidence has been captured yet.");
    } else {
        workspace.evidence.forEach((item, index) => {
            lines.push(
                `${index + 1}. ${item.title || "Untitled evidence"} | ${item.category} | ${item.location || "No location"} | ${item.value || "No value"} ${item.unit || ""}`.trim(),
                `   Source: ${item.source || "Not supplied"} | Date: ${formatDate(item.sourceDate)} | Confidence: ${item.confidence}`,
                `   Notes: ${item.notes || "None"}`
            );
        });
    }

    lines.push("", "## Priorities");
    if (workspace.priorities.length === 0) {
        lines.push("No priorities have been drafted yet.");
    } else {
        workspace.priorities.forEach((item, index) => {
            lines.push(
                `${index + 1}. ${item.title || "Untitled priority"} | ${item.category} | ${item.urgency} | ${item.status}`,
                `   Owner: ${item.owner || "Not assigned"}`,
                `   Supporting evidence: ${(item.evidenceIds || []).map(id => workspace.evidence.find(e => e.id === id)?.title || "Missing evidence").join("; ") || "Not linked"}`,
                `   Impact (user judgement): ${item.impact || "Not supplied"}`,
                `   Rationale: ${item.why || "Not supplied"}`
            );
        });
    }

    lines.push("", "## Action plan");
    if (workspace.actions.length === 0) {
        lines.push("No actions have been drafted yet.");
    } else {
        workspace.actions.forEach((item, index) => {
            lines.push(
                `${index + 1}. ${item.action || "Untitled action"} | ${item.status} | ${item.timeframe || "No timeframe"}`,
                `   Priority: ${workspace.priorities.find(p => p.id === item.priorityId)?.title || item.priority || "Not linked"}`,
                `   Owner: ${item.owner || "Not assigned"} | Cost: ${item.estimatedCost || "Not estimated"} | Funding: ${item.fundingSource || "Not supplied"}`,
                `   Expected change: ${item.expectedChange || "Not supplied"}`
            );
        });
    }

    lines.push("", "## Review gaps", `Priorities without evidence: ${workspace.priorities.filter(p => !p.evidenceIds?.length).length}`, `Actions without priority: ${workspace.actions.filter(a => !a.priorityId).length}`, `Actions without owner: ${workspace.actions.filter(a => !a.owner?.trim()).length}`, "Status, impact and confidence are user judgements, not formal approval or validated scientific assessments.");
    return lines.join("\n");
}

function Field({ label, children, required = false }) {
    return (
        <label className="planning-field">
            <span>
                {label}
                {required && <em>required</em>}
            </span>
            {children}
        </label>
    );
}

export default function MunicipalPlanningWorkspace() {
    const [workspace, setWorkspace] = useState(readDraft);
    const [evidenceForm, setEvidenceForm] = useState(emptyEvidence);
    const [priorityForm, setPriorityForm] = useState(emptyPriority);
    const [actionForm, setActionForm] = useState(emptyAction);
    const [clearArmed, setClearArmed] = useState(false);
    const [activeMapSignal, setActiveMapSignal] = useState(null);
    const [selectedForecastLayer, setSelectedForecastLayer] = useState("rainfall");
    const [selectedBoundary, setSelectedBoundary] = useState(null);
    const boundariesRef = useRef(null);
    const [saveStatus, setSaveStatus] = useState("Saving locally…");
    const [notice, setNotice] = useState("");
    const [editing, setEditing] = useState(null);
    const [undo, setUndo] = useState(null);
    const [pendingImport, setPendingImport] = useState(null);
    const importRef = useRef(null);


    useEffect(() => {
        let active = true;
        let status = draftReadError;
        if (!status) {
            try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); status = "Saved in this browser"; }
            catch { status = "Could not save locally — export JSON to keep your work"; }
        }
        queueMicrotask(() => { if (active) setSaveStatus(status); });
        return () => { active = false; };
    }, [workspace]);

    function saveRecord(collection, form, emptyForm, setter) {
        const record = {...form, ...(collection === "evidence" ? {municipality: form.municipality || workspace.municipality, municipalityCode: form.municipalityCode || workspace.municipalityCode} : {}), id: editing?.collection === collection ? editing.id : makeId(collection)};
        setWorkspace(current => ({...current, updatedAt: new Date().toISOString(),
            [collection]: editing?.collection === collection ? current[collection].map(row => row.id === editing.id ? record : row) : [record, ...current[collection]]}));
        setter(emptyForm);
        setEditing(null);
    }
    function editRecord(collection, item) {
        setEditing({collection, id: item.id});
        if (collection === "evidence") setEvidenceForm({...emptyEvidence, ...item});
        if (collection === "priorities") setPriorityForm({...emptyPriority, ...item});
        if (collection === "actions") setActionForm({...emptyAction, ...item});
        document.querySelector(`.planning-form--${collection === "priorities" ? "priority" : collection === "actions" ? "action" : "evidence"}`)?.scrollIntoView({behavior: "smooth", block: "start"});
    }
    function cancelEdit() {
        setEditing(null); setEvidenceForm(emptyEvidence); setPriorityForm(emptyPriority); setActionForm(emptyAction);
    }
    async function readImport(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            if (file.size > 5 * 1024 * 1024) throw new Error("Workspace backup must be smaller than 5 MB.");
            setPendingImport(normalizeDraft(JSON.parse(await file.text())));
            setNotice("Backup validated. Restore replaces the current draft; you can undo it.");
        } catch (error) { setNotice(`Backup not restored: ${error.message}`); }
        event.target.value = "";
    }

    const categoryCoverage = useMemo(() => (
        categories.map((category) => ({
            category,
            count: workspace.evidence.filter((item) => item.category === category).length,
            priorityCount: workspace.priorities.filter((item) => item.category === category).length,
        }))
    ), [workspace.evidence, workspace.priorities]);

    const missingSourceCount = useMemo(() => (
        workspace.evidence.filter((item) => !item.source || !item.sourceDate).length
    ), [workspace.evidence]);

    const brief = useMemo(() => buildBrief(workspace), [workspace]);

    const updateWorkspace = useCallback((patch) => {
        if (patch.municipality !== undefined && workspace.municipality && patch.municipality !== workspace.municipality && workspace.evidence.length) setNotice("Planning area changed. Existing evidence retains its recorded area; review it before use.");
        setWorkspace((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
    }, [workspace.municipality, workspace.evidence.length]);

    function addEvidence(event) {
        event.preventDefault();
        if (!evidenceForm.title.trim()) return;

        saveRecord("evidence", evidenceForm, emptyEvidence, setEvidenceForm);
    }

    function addPriority(event) {
        event.preventDefault();
        if (!priorityForm.title.trim()) return;

        saveRecord("priorities", priorityForm, emptyPriority, setPriorityForm);
    }

    function addAction(event) {
        event.preventDefault();
        if (!actionForm.action.trim()) return;

        saveRecord("actions", actionForm, emptyAction, setActionForm);
    }

    function removeItem(collection, id) {
        const linked = collection === "evidence" ? workspace.priorities.some(p => p.evidenceIds?.includes(id)) : collection === "priorities" ? workspace.actions.some(a => a.priorityId === id) : false;
        if (linked) { setNotice("This record has linked records. Edit those links before removing it."); return; }
        setUndo(workspace);
        setWorkspace(current => ({...current, updatedAt: new Date().toISOString(), [collection]: current[collection].filter(item => item.id !== id)}));
        if (editing?.id === id) cancelEdit();
        setNotice("Record removed. Undo is available.");
    }

    function resetDraft() {
        if (!clearArmed) {
            setClearArmed(true);
            return;
        }
        draftReadError = "";
        setUndo(workspace);
        cancelEdit();
        setWorkspace(makeDraft());
        setNotice("Draft cleared. Undo is available.");
        setClearArmed(false);
    }

    function applyCommunityFeed(feed) {
        const selectedOption = feed.options?.find((option) => option.key === selectedForecastLayer);
        const signal = {
            name: feed.name,
            detail: selectedOption?.detail || feed.detail,
            category: selectedOption?.category || feed.category,
            source: selectedOption?.source || feed.source,
            forecastLayer: selectedOption?.key || feed.forecastLayer,
            topographyLayer: feed.topographyLayer,
        };
        if (signal.forecastLayer || signal.topographyLayer) setActiveMapSignal(signal);
        else setNotice("Source added to the evidence form. This source has no connected map layer; verify and enter its observations before saving.");
        setEvidenceForm((current) => ({
            ...current,
            category: signal.category,
            title: current.title || selectedOption?.title || feed.title,
            source: signal.source,
            confidence: feed.status === "Use now" ? "Medium" : "Low",
            notes: current.notes || `${feed.name}: ${signal.detail}`,
        }));
        boundariesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const applyBoundarySelection = useCallback((boundary) => {
        setSelectedBoundary(boundary);
        const properties = boundary.properties || {};
        const municipalityName = properties.municname || properties.MUNICNAME || properties.municipali || properties.Municipali || properties.map_title || "";
        const municipalityCode = properties.cat_b || properties.CAT_B || "";
        const location = boundary.type === "wards"
            ? [boundary.label, municipalityName].filter(Boolean).join(", ")
            : boundary.label;

        setEvidenceForm((current) => ({
            ...current,
            location: editing?.collection === "evidence" ? current.location : location,
            notes: current.notes || `Planning geography selected from MDB 2026 boundaries: ${location}.`,
        }));

        if (municipalityName) {
            updateWorkspace({
                municipality: municipalityName,
                municipalityCode: municipalityCode || workspace.municipalityCode,
            });
        }
    }, [workspace.municipalityCode, editing, updateWorkspace]);

    return (
        <div className="planning-workspace">
            <section className="planning-workspace__topbar">
                <div>
                    <span>Municipal planning workspace</span>
                    <h2>Municipal planning workspace</h2>
                    <p>
                        Start with the guided stormwater task below. Your draft is saved in this browser; export a backup to keep a copy.
                    </p>
                </div>
                <details className="planning-workspace__actions"><summary>Backups and other tools</summary>
                    <Link to="/municipal-risk-profiler">Open risk profiler</Link>
                    <a href="#boundaries">View ward boundaries</a>
                    <button type="button" onClick={() => download("municipal-planning-brief.md", brief, "text/markdown")}>
                        Download brief
                    </button>
                    <button type="button" onClick={() => download("sarva-local-evidence-template.csv", evidenceTemplate, "text/csv")}>
                        CSV template
                    </button>
                    <button type="button" onClick={() => download("municipal-planning-workspace.json", JSON.stringify(workspace, null, 2), "application/json")}>
                        Export JSON
                    </button>
                    <button type="button" onClick={resetDraft}>
                        {clearArmed ? "Confirm clear draft" : "Clear draft"}
                    </button>
                </details>
            </section>

            <div className="planning-workspace__saveStatus" role="status">
                <strong>{saveStatus}</strong> · Draft: {workspace.municipality || "Choose a municipality"}
                {notice && <p>{notice}</p>}
                <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={readImport} />
                <button type="button" onClick={() => importRef.current?.click()}>Import backup</button>
                {pendingImport && <><button type="button" onClick={() => {draftReadError = ""; setUndo(workspace); setWorkspace(pendingImport); setPendingImport(null); cancelEdit(); setNotice("Backup restored.");}}>Restore {pendingImport.municipality || "unnamed draft"} ({pendingImport.evidence.length} evidence items)</button><button type="button" onClick={() => setPendingImport(null)}>Cancel restore</button></>}
                {undo && <button type="button" onClick={() => {setWorkspace(undo); setUndo(null); cancelEdit(); setNotice("Previous draft restored.");}}>Undo last removal / restore / clear</button>}
                {editing && <><p>Editing {editing.collection} record. Save the form below to apply changes.</p><button type="button" onClick={cancelEdit}>Cancel edit</button></>}
            </div>
            <AccessibilityWorkspace />
            <details className="planning-advanced"><summary>Optional: local evidence and stormwater brief</summary>
            <StormwaterReadiness workspace={workspace} setWorkspace={setWorkspace}
                onDownload={() => download("stormwater-readiness-brief.md", "# Stormwater readiness: draft for team review\n\nExperimental model outputs are not official warnings or emergency instructions. Check current SAWS warnings at https://www.weathersa.co.za/warnings before operational use. Hazard-specific exposure and flood risk are not assessed. The fire-weather indicator is not an official fire-danger rating.\n\n" + brief, "text/markdown")}
                onTerrain={() => {setActiveMapSignal({name:"Terrain context",topographyLayer:"topography",detail:"Explore slope and elevation where available."}); setNotice("Terrain selected. Return to Choose area to view the map.");}}
                onWeather={() => {setActiveMapSignal({name:"Cached rainfall",forecastLayer:"rainfall",detail:"Cached rainfall screening; verify dates before use."}); setNotice("Rainfall selected. Return to Choose area to view the map.");}}>
                    <section className="planning-panel planning-panel--boundaries" id="boundaries" ref={boundariesRef}>
                        <div className="planning-panel__head">
                            <div>
                                <span>Planning geography</span>
                                <h2>MDB 2026 ward and municipal boundaries</h2>
                            </div>
                            <small>Use for planning preview, not operational replacement yet</small>
                        </div>
                        <MdbBoundaryMap
                            embedded
                            activeSignal={activeMapSignal}
                            selectedBoundary={selectedBoundary}
                            onFeatureSelect={applyBoundarySelection}
                            onClearSignal={() => setActiveMapSignal(null)}
                        />
                    </section>

            </StormwaterReadiness>
            </details>
            <details className="planning-advanced"><summary>Advanced register, sources, editing and full brief</summary>
            <section className="planning-workspace__summary" aria-label="Workspace summary">
                <article>
                    <strong>{workspace.evidence.length}</strong>
                    <span>Evidence items</span>
                </article>
                <article className={missingSourceCount ? "is-warning" : ""}>
                    <strong>{missingSourceCount}</strong>
                    <span>Need source or date</span>
                </article>
                <article>
                    <strong>{workspace.priorities.length}</strong>
                    <span>Priorities</span>
                </article>
                <article>
                    <strong>{workspace.actions.length}</strong>
                    <span>Actions</span>
                </article>
            </section>

            <div className="planning-workspace__grid">
                <main className="planning-workspace__main">
                    <section className="planning-panel planning-panel--feeds">
                        <div className="planning-panel__head">
                            <div>
                                <span>Risk integrator</span>
                                <h2>Add map context</h2>
                            </div>
                            <small>One overlay at a time · showing a layer does not save evidence</small>
                        </div>
                        <ForecastNotice />
                        <div className="planning-feed-grid">
                            {riskSignalChannels.filter(feed => feed.forecastLayer || feed.topographyLayer).map((feed) => (
                                <article key={feed.name}>
                                    <div>
                                        <small>{feed.status}</small>
                                        <h3>{feed.name}</h3>
                                    </div>
                                    <p>{feed.detail}</p>
                                    {feed.options && (
                                        <label className="planning-signal-picker">
                                            <span>Weather variable</span>
                                            <select value={selectedForecastLayer} onChange={(event) => setSelectedForecastLayer(event.target.value)}>
                                                {feed.options.map((option) => (
                                                    <option key={option.key} value={option.key}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    <div className="planning-feed-card__actions">
                                        <button type="button" onClick={() => applyCommunityFeed(feed)}>
                                            Show on map
                                        </button>
                                        {feed.to && (
                                            <Link to={feed.to}>
                                                Open
                                            </Link>
                                        )}
                                        {feed.href && (
                                            <a href={feed.href} target="_blank" rel="noopener noreferrer">
                                                Source
                                            </a>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                        <details className="planning-sourceDirectory"><summary>Other evidence sources — no connected map layers</summary><p>These links can help you gather evidence. They do not load observations onto this map.</p>
                            {riskSignalChannels.filter(feed => !feed.forecastLayer && !feed.topographyLayer).map(feed => <article key={feed.name}><strong>{feed.name}</strong><p>{feed.detail}</p><button type="button" onClick={() => applyCommunityFeed(feed)}>Use source in evidence form</button>{feed.href && <a href={feed.href} target="_blank" rel="noreferrer">Visit source</a>}</article>)}
                        </details>
                    </section>

                    <section className="planning-panel">
                        <div className="planning-panel__head">
                            <div>
                                <span>Step 1</span>
                                <h2>Risk and vulnerability register</h2>
                            </div>
                            <small>Signal, exposure and source date stay visible</small>
                        </div>
                        <form className="planning-form planning-form--evidence" onSubmit={addEvidence}>
                            <Field label="Category">
                                <select value={evidenceForm.category} onChange={(event) => setEvidenceForm({ ...evidenceForm, category: event.target.value })}>
                                    {categories.map((category) => <option key={category}>{category}</option>)}
                                </select>
                            </Field>
                            <Field label="Evidence title" required>
                                <input value={evidenceForm.title} onChange={(event) => setEvidenceForm({ ...evidenceForm, title: event.target.value })} placeholder="Example: Ward 17 stormwater flooding" />
                            </Field>
                            <Field label="Location or ward">
                                <input value={evidenceForm.location} onChange={(event) => setEvidenceForm({ ...evidenceForm, location: event.target.value })} placeholder="Ward, town, facility or catchment" />
                            </Field>
                            <Field label="Value">
                                <input value={evidenceForm.value} onChange={(event) => setEvidenceForm({ ...evidenceForm, value: event.target.value })} placeholder="Example: 3" />
                            </Field>
                            <Field label="Unit">
                                <input value={evidenceForm.unit} onChange={(event) => setEvidenceForm({ ...evidenceForm, unit: event.target.value })} placeholder="events, households, mm, km, %" />
                            </Field>
                            <Field label="Source">
                                <input value={evidenceForm.source} onChange={(event) => setEvidenceForm({ ...evidenceForm, source: event.target.value })} placeholder="Warning feed, SARVA layer, log, survey, report" />
                            </Field>
                            <Field label="Source date">
                                <input type="date" value={evidenceForm.sourceDate} onChange={(event) => setEvidenceForm({ ...evidenceForm, sourceDate: event.target.value })} />
                            </Field>
                            <Field label="Confidence">
                                <select value={evidenceForm.confidence} onChange={(event) => setEvidenceForm({ ...evidenceForm, confidence: event.target.value })}>
                                    {confidenceLevels.map((level) => <option key={level}>{level}</option>)}
                                </select>
                            </Field>
                            <Field label="Notes">
                                <textarea value={evidenceForm.notes} onChange={(event) => setEvidenceForm({ ...evidenceForm, notes: event.target.value })} placeholder="Add context, uncertainty, affected groups or verification needs." />
                            </Field>
                            <button type="submit">{editing?.collection === "evidence" ? "Save evidence" : "Add evidence"}</button>
                        </form>
                    </section>

                    <section className="planning-panel planning-panel--compact">
                        <div className="planning-panel__head">
                            <div>
                                <span>Coverage</span>
                                <h2>What the draft covers</h2>
                            </div>
                        </div>
                        <div className="planning-coverage">
                            {categoryCoverage.map((item) => (
                                <div key={item.category} className={item.count ? "has-data" : ""}>
                                    <strong>{item.category}</strong>
                                    <span>{item.count} evidence | {item.priorityCount} priorities</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="planning-panel">
                        <div className="planning-panel__head">
                            <div>
                                <span>Step 2</span>
                                <h2>Priority builder</h2>
                            </div>
                        </div>
                        <form className="planning-form planning-form--priority" onSubmit={addPriority}>
                            <Field label="Category">
                                <select value={priorityForm.category} onChange={(event) => setPriorityForm({ ...priorityForm, category: event.target.value })}>
                                    {categories.map((category) => <option key={category}>{category}</option>)}
                                </select>
                            </Field>
                            <Field label="Priority" required>
                                <input value={priorityForm.title} onChange={(event) => setPriorityForm({ ...priorityForm, title: event.target.value })} placeholder="Example: Stabilise water supply in northern wards" />
                            </Field>
                            <Field label="Urgency">
                                <select value={priorityForm.urgency} onChange={(event) => setPriorityForm({ ...priorityForm, urgency: event.target.value })}>
                                    {urgencyLevels.map((level) => <option key={level}>{level}</option>)}
                                </select>
                            </Field>
                            <Field label="Impact">
                                <select value={priorityForm.impact} onChange={(event) => setPriorityForm({ ...priorityForm, impact: event.target.value })}>
                                    {["Very high", "High", "Medium", "Low"].map((level) => <option key={level}>{level}</option>)}
                                </select>
                            </Field>
                            <Field label="Owner">
                                <input value={priorityForm.owner} onChange={(event) => setPriorityForm({ ...priorityForm, owner: event.target.value })} placeholder="Department, unit or partner" />
                            </Field>
                            <Field label="Status">
                                <select value={priorityForm.status} onChange={(event) => setPriorityForm({ ...priorityForm, status: event.target.value })}>
                                    {statuses.map((status) => <option key={status}>{status}</option>)}
                                </select>
                            </Field>
                            <Field label="Supporting evidence">
                                <select multiple value={priorityForm.evidenceIds || []} onChange={event => setPriorityForm({...priorityForm, evidenceIds: Array.from(event.target.selectedOptions, option => option.value)})}>
                                    {workspace.evidence.map(item => <option key={item.id} value={item.id}>{item.title} — {item.location || "Location unknown"}</option>)}
                                </select>
                                <small>Select evidence supporting this priority. Use Ctrl / Command to select multiple items.</small>
                            </Field>
                            <Field label="Why this matters">
                                <textarea value={priorityForm.why} onChange={(event) => setPriorityForm({ ...priorityForm, why: event.target.value })} placeholder="Summarise the evidence, affected people and planning implication." />
                            </Field>
                            <button type="submit">{editing?.collection === "priorities" ? "Save priority" : "Add priority"}</button>
                        </form>
                    </section>

                    <section className="planning-panel">
                        <div className="planning-panel__head">
                            <div>
                                <span>Step 3</span>
                                <h2>Action planner</h2>
                            </div>
                        </div>
                        <form className="planning-form planning-form--action" onSubmit={addAction}>
                            <Field label="Linked priority">
                                <select value={actionForm.priorityId} onChange={(event) => setActionForm({ ...actionForm, priorityId: event.target.value, priority: "" })}>
                                    <option value="">Not linked yet</option>
                                    {workspace.priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.title}</option>)}
                                </select>
                            </Field>
                            <Field label="Action" required>
                                <input value={actionForm.action} onChange={(event) => setActionForm({ ...actionForm, action: event.target.value })} placeholder="Example: Verify borehole status and cost emergency repairs" />
                            </Field>
                            <Field label="Owner">
                                <input value={actionForm.owner} onChange={(event) => setActionForm({ ...actionForm, owner: event.target.value })} placeholder="Responsible person, unit or partner" />
                            </Field>
                            <Field label="Timeframe">
                                <input value={actionForm.timeframe} onChange={(event) => setActionForm({ ...actionForm, timeframe: event.target.value })} placeholder="Example: 0-3 months" />
                            </Field>
                            <Field label="Estimated cost">
                                <input value={actionForm.estimatedCost} onChange={(event) => setActionForm({ ...actionForm, estimatedCost: event.target.value })} placeholder="Example: R 750 000" />
                            </Field>
                            <Field label="Funding source">
                                <input value={actionForm.fundingSource} onChange={(event) => setActionForm({ ...actionForm, fundingSource: event.target.value })} placeholder="Grant, own revenue, partner, unfunded" />
                            </Field>
                            <Field label="Status">
                                <select value={actionForm.status} onChange={(event) => setActionForm({ ...actionForm, status: event.target.value })}>
                                    {statuses.map((status) => <option key={status}>{status}</option>)}
                                </select>
                            </Field>
                            <Field label="Expected change">
                                <textarea value={actionForm.expectedChange} onChange={(event) => setActionForm({ ...actionForm, expectedChange: event.target.value })} placeholder="Describe the risk, service or governance improvement expected." />
                            </Field>
                            <button type="submit">{editing?.collection === "actions" ? "Save action" : "Add action"}</button>
                        </form>
                    </section>

                    <section className="planning-panel planning-panel--lists">
                        <div className="planning-panel__head">
                            <div>
                                <span>Current draft</span>
                                <h2>Evidence, priorities and actions</h2>
                            </div>
                        </div>
                        <div className="planning-lists">
                            <div>
                                <h3>Evidence</h3>
                                {workspace.evidence.length === 0 && <p>No evidence captured yet.</p>}
                                {workspace.evidence.map((item) => (
                                    <article key={item.id} className={!item.source || !item.sourceDate ? "needs-source" : ""}>
                                        <strong>{item.title}</strong>
                                        {item.municipality && item.municipality !== workspace.municipality && <small>Area mismatch: recorded for {item.municipality}</small>}
                                        <span>{item.category} | {item.location || "No location"} | {item.value || "No value"} {item.unit}</span>
                                        <small>Source: {item.source || "missing"} | Date: {formatDate(item.sourceDate)} | Confidence: {item.confidence}</small>
                                        <button type="button" onClick={() => editRecord("evidence", item)}>Edit</button>
                                        <button type="button" onClick={() => removeItem("evidence", item.id)}>Remove</button>
                                    </article>
                                ))}
                            </div>
                            <div>
                                <h3>Priorities</h3>
                                {workspace.priorities.length === 0 && <p>No priorities drafted yet.</p>}
                                {workspace.priorities.map((item) => (
                                    <article key={item.id}>
                                        <strong>{item.title}</strong>
                                        <span>{item.category} | {item.urgency} | {item.impact}</span>
                                        <small>{item.owner || "No owner"} | {item.status} (user-entered)</small>
                                        <button type="button" onClick={() => editRecord("priorities", item)}>Edit</button>
                                        <button type="button" onClick={() => removeItem("priorities", item.id)}>Remove</button>
                                    </article>
                                ))}
                            </div>
                            <div>
                                <h3>Actions</h3>
                                {workspace.actions.length === 0 && <p>No actions drafted yet.</p>}
                                {workspace.actions.map((item) => (
                                    <article key={item.id}>
                                        <strong>{item.action}</strong>
                                        <span>{workspace.priorities.find(p => p.id === item.priorityId)?.title || item.priority || "No priority linked"} | {item.timeframe || "No timeframe"}</span>
                                        <small>{item.owner || "No owner"} | {item.status} (user-entered)</small>
                                        <button type="button" onClick={() => editRecord("actions", item)}>Edit</button>
                                        <button type="button" onClick={() => removeItem("actions", item.id)}>Remove</button>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="planning-panel planning-panel--brief">
                        <div className="planning-panel__head">
                            <div>
                                <span>Step 4</span>
                                <h2>Brief preview</h2>
                            </div>
                        </div>
                        <pre>{brief}</pre>
                    </section>
                </main>
            </div>
            </details>
        </div>
    );
}
