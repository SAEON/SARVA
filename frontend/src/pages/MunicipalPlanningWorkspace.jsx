import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../config/api";
import "../styles/municipal-planning-workspace.css";

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

const audienceGuidance = {
    official: {
        label: "Municipal official",
        title: "Watch risk signals and turn them into municipal action.",
        detail: "Start with SARVA forecast and vulnerability layers, then add local exposure, service constraints, infrastructure backlogs, ward reports and response capacity. Export a brief for IDP, SDBIP, disaster management or grant planning discussions.",
    },
    resident: {
        label: "Resident or community member",
        title: "Add risk observations without replacing emergency or fault reporting.",
        detail: "Use official emergency and municipal channels for urgent incidents. Use SARVA to capture recurring flood, heat, fire, outage, dumping or access patterns that show where vulnerability is building up.",
    },
    researcher: {
        label: "Researcher",
        title: "Connect hazard signals, exposure and vulnerability evidence.",
        detail: "Use this workspace to assemble watch feeds, local observations, SARVA indicators and source metadata into a transparent planning brief with dates, confidence and data gaps.",
    },
    partner: {
        label: "Partner organisation",
        title: "Bring programme evidence into risk-informed planning.",
        detail: "Add monitoring findings, project records, community survey summaries or partner datasets as sourced vulnerability evidence. Use aggregate counts and avoid personal information unless there is a formal data-sharing process.",
    },
};

const riskSignalChannels = [
    {
        name: "SARVA forecast risk layers",
        status: "Live in SARVA",
        category: "Disaster management",
        source: "SARVA forecast rainfall, heat, wind and fire-weather risk layers",
        title: "SARVA forecast risk signal",
        detail: "Use the existing SARVA 5-day signals as the first watch layer, then add local vulnerability and response constraints.",
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
    category: categories[0],
    title: "",
    why: "",
    urgency: "This year",
    impact: "High",
    owner: "",
    status: "Draft",
};

const emptyAction = {
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
        return stored ? { ...makeDraft(), ...JSON.parse(stored) } : makeDraft();
    } catch {
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
                `   Priority: ${item.priority || "Not linked"}`,
                `   Owner: ${item.owner || "Not assigned"} | Cost: ${item.estimatedCost || "Not estimated"} | Funding: ${item.fundingSource || "Not supplied"}`,
                `   Expected change: ${item.expectedChange || "Not supplied"}`
            );
        });
    }

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
    const [municipalities, setMunicipalities] = useState([]);
    const [evidenceForm, setEvidenceForm] = useState(emptyEvidence);
    const [priorityForm, setPriorityForm] = useState(emptyPriority);
    const [actionForm, setActionForm] = useState(emptyAction);
    const [clearArmed, setClearArmed] = useState(false);
    const [audience, setAudience] = useState("official");

    useEffect(() => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...workspace, updatedAt: new Date().toISOString() })
        );
    }, [workspace]);

    useEffect(() => {
        const controller = new AbortController();

        fetch(apiUrl("/api/municipalities?limit=260"), { signal: controller.signal })
            .then((response) => response.json())
            .then((body) => {
                if (body?.status === "ok") {
                    setMunicipalities(body.data?.records || []);
                }
            })
            .catch((error) => {
                if (error.name !== "AbortError") console.warn("Municipalities could not be loaded", error);
            });

        return () => controller.abort();
    }, []);

    const selectedMunicipality = useMemo(() => {
        const normalized = workspace.municipality.trim().toLowerCase();
        if (!normalized) return null;
        return municipalities.find((item) =>
            [item.municipality, item.code, item.district, item.province]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase() === normalized)
        );
    }, [municipalities, workspace.municipality]);

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
    const activeGuidance = audienceGuidance[audience];

    function updateWorkspace(patch) {
        setWorkspace((current) => ({ ...current, ...patch }));
    }

    function addEvidence(event) {
        event.preventDefault();
        if (!evidenceForm.title.trim()) return;

        setWorkspace((current) => ({
            ...current,
            evidence: [{ ...evidenceForm, id: makeId("evidence") }, ...current.evidence],
        }));
        setEvidenceForm(emptyEvidence);
    }

    function addPriority(event) {
        event.preventDefault();
        if (!priorityForm.title.trim()) return;

        setWorkspace((current) => ({
            ...current,
            priorities: [{ ...priorityForm, id: makeId("priority") }, ...current.priorities],
        }));
        setPriorityForm(emptyPriority);
    }

    function addAction(event) {
        event.preventDefault();
        if (!actionForm.action.trim()) return;

        setWorkspace((current) => ({
            ...current,
            actions: [{ ...actionForm, id: makeId("action") }, ...current.actions],
        }));
        setActionForm(emptyAction);
    }

    function removeItem(collection, id) {
        setWorkspace((current) => ({
            ...current,
            [collection]: current[collection].filter((item) => item.id !== id),
        }));
    }

    function resetDraft() {
        if (!clearArmed) {
            setClearArmed(true);
            return;
        }
        setWorkspace(makeDraft());
        setClearArmed(false);
    }

    function applyMunicipality(value) {
        const match = municipalities.find((item) => item.municipality === value || item.code === value);
        updateWorkspace({
            municipality: value,
            municipalityCode: match?.code || workspace.municipalityCode,
        });
    }

    function applyCommunityFeed(feed) {
        setEvidenceForm((current) => ({
            ...current,
            category: feed.category,
            title: current.title || feed.title,
            source: feed.source,
            confidence: feed.status === "Use now" ? "Medium" : "Low",
            notes: current.notes || `${feed.name}: ${feed.detail}`,
        }));
    }

    return (
        <div className="planning-workspace">
            <section className="planning-workspace__topbar">
                <div>
                    <span>Municipal planning workspace</span>
                    <h1>Turn risk signals into municipal action.</h1>
                    <p>
                        Combine hazard watches, vulnerability evidence, exposed assets and response constraints,
                        then rank priorities and export a planning brief.
                    </p>
                </div>
                <div className="planning-workspace__actions">
                    <Link to="/municipal-risk-profiler">Open risk profiler</Link>
                    <button type="button" onClick={() => download("municipal-planning-brief.md", brief, "text/markdown")}>
                        Download brief
                    </button>
                    <button type="button" onClick={() => download("municipal-planning-workspace.json", JSON.stringify(workspace, null, 2), "application/json")}>
                        Export JSON
                    </button>
                </div>
            </section>

            <section className="planning-workspace__municipality">
                <Field label="Municipality" required>
                    <input
                        list="planning-municipalities"
                        value={workspace.municipality}
                        onChange={(event) => applyMunicipality(event.target.value)}
                        placeholder="Type municipality name or code..."
                    />
                    <datalist id="planning-municipalities">
                        {municipalities.map((item) => (
                            <option key={item.gid} value={item.municipality}>
                                {item.code} | {item.district} | {item.province}
                            </option>
                        ))}
                    </datalist>
                </Field>
                <Field label="Municipality code">
                    <input
                        value={workspace.municipalityCode}
                        onChange={(event) => updateWorkspace({ municipalityCode: event.target.value })}
                        placeholder="Example: TSH"
                    />
                </Field>
                <div className="planning-workspace__selected">
                    <strong>{selectedMunicipality ? "Matched SARVA boundary" : "Local planning draft"}</strong>
                    <span>
                        {selectedMunicipality
                            ? `${selectedMunicipality.code || "No code"} | ${selectedMunicipality.district || "No district"} | ${selectedMunicipality.province || "No province"}`
                            : "Use the profiler link to compare this municipality with national SARVA indicators."}
                    </span>
                </div>
            </section>

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
                <aside className="planning-workspace__guide">
                    <h2>Planning flow</h2>
                    <ol>
                        <li><strong>1. Watch</strong><span>Start with forecast, warning, hydrology or observation signals.</span></li>
                        <li><strong>2. Expose</strong><span>Add where people, services, infrastructure or ecosystems are vulnerable.</span></li>
                        <li><strong>3. Act</strong><span>Assign owners, timeframes, funding ideas and expected changes.</span></li>
                        <li><strong>4. Brief</strong><span>Export a concise risk-planning note for review, workshops or future upload.</span></li>
                    </ol>
                    <div>
                        <strong>Risk rule</strong>
                        <p>A signal becomes useful when it is tied to exposure, vulnerability, source date and a clear action owner.</p>
                    </div>
                    <div>
                        <strong>Public-friendly</strong>
                        <p>Ask for what happened, where, when and who can verify it. Avoid names, ID numbers, phone numbers and private addresses.</p>
                    </div>
                    <button type="button" onClick={resetDraft}>
                        {clearArmed ? "Confirm clear draft" : "Clear local draft"}
                    </button>
                </aside>

                <main className="planning-workspace__main">
                    <section className="planning-panel planning-panel--feeds">
                        <div className="planning-panel__head">
                            <div>
                                <span>Risk integrator</span>
                                <h2>Watch risks and map vulnerability</h2>
                            </div>
                            <small>Watch feeds now, APIs later</small>
                        </div>
                        <div className="planning-audience">
                            <div>
                                <span>I am a</span>
                                <select value={audience} onChange={(event) => setAudience(event.target.value)}>
                                    {Object.entries(audienceGuidance).map(([key, item]) => (
                                        <option key={key} value={key}>{item.label}</option>
                                    ))}
                                </select>
                            </div>
                            <article>
                                <strong>{activeGuidance.title}</strong>
                                <p>{activeGuidance.detail}</p>
                            </article>
                        </div>
                        <div className="planning-feed-intro">
                            <p>
                                SARVA should not replace emergency, disaster or service-reporting systems. Use this workspace to pull together
                                risk signals, exposure context, vulnerability evidence and aggregate community patterns for planning.
                            </p>
                            <button type="button" onClick={() => download("sarva-local-evidence-template.csv", evidenceTemplate, "text/csv")}>
                                Download CSV template
                            </button>
                        </div>
                        <div className="planning-feed-grid">
                            {riskSignalChannels.map((feed) => (
                                <article key={feed.name}>
                                    <div>
                                        <small>{feed.status}</small>
                                        <h3>{feed.name}</h3>
                                    </div>
                                    <p>{feed.detail}</p>
                                    <div className="planning-feed-card__actions">
                                        <button type="button" onClick={() => applyCommunityFeed(feed)}>
                                            {feed.action}
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
                    </section>

                    <section className="planning-panel">
                        <div className="planning-panel__head">
                            <div>
                                <span>Step 1</span>
                                <h2>Risk and vulnerability register</h2>
                            </div>
                            <small>Signal, exposure and source date stay visible</small>
                        </div>
                        <form className="planning-form" onSubmit={addEvidence}>
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
                            <button type="submit">Add evidence</button>
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
                            <Field label="Why this matters">
                                <textarea value={priorityForm.why} onChange={(event) => setPriorityForm({ ...priorityForm, why: event.target.value })} placeholder="Summarise the evidence, affected people and planning implication." />
                            </Field>
                            <button type="submit">Add priority</button>
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
                                <select value={actionForm.priority} onChange={(event) => setActionForm({ ...actionForm, priority: event.target.value })}>
                                    <option value="">Not linked yet</option>
                                    {workspace.priorities.map((priority) => <option key={priority.id}>{priority.title}</option>)}
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
                            <button type="submit">Add action</button>
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
                                        <span>{item.category} | {item.location || "No location"} | {item.value || "No value"} {item.unit}</span>
                                        <small>Source: {item.source || "missing"} | Date: {formatDate(item.sourceDate)} | Confidence: {item.confidence}</small>
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
                                        <small>{item.owner || "No owner"} | {item.status}</small>
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
                                        <span>{item.priority || "No priority linked"} | {item.timeframe || "No timeframe"}</span>
                                        <small>{item.owner || "No owner"} | {item.status}</small>
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
        </div>
    );
}
