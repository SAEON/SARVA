import { useEffect, useMemo, useState } from "react";
import { useJsonResource } from "../hooks/useJsonResource";
import "../styles/search.css";

const EMPTY = [];
const PAGE_SIZE = 12;

const THEMES = [
    ["", "All themes"],
    ["climate", "Climate"],
    ["hydrology", "Water"],
    ["precipitation", "Rainfall"],
    ["ocean", "Coastal and marine"],
    ["ecology", "Ecology"],
    ["biodiversity", "Biodiversity"],
    ["geospatial", "Geospatial"],
    ["modelling", "Models"],
    ["timeseries", "Time series"],
    ["risk", "Risk and vulnerability"],
];

const ESSENTIAL_FRAMEWORKS = [
    {
        id: "ev",
        acronym: "EV",
        title: "Essential Variables",
        owner: "Earth observation communities",
        framework_type: "Umbrella concept",
        url: "https://geobon.org/ebvs/what-are-ebvs/",
        summary: "Minimum observation sets used across climate, ocean, biodiversity and ecosystem-services monitoring.",
        related_terms: ["essential variables", "environmental variables", "monitoring framework", "indicator framework"],
    },
    {
        id: "ecv",
        acronym: "ECV",
        title: "Essential Climate Variables",
        owner: "GCOS / WMO",
        framework_type: "Climate framework",
        url: "https://gcos.wmo.int/en/essential-climate-variables",
        summary: "Climate observations across atmospheric, oceanic and terrestrial domains.",
        related_terms: ["ECV", "essential climate variables", "GCOS", "precipitation", "temperature"],
    },
    {
        id: "ebv",
        acronym: "EBV",
        title: "Essential Biodiversity Variables",
        owner: "GEO BON",
        framework_type: "Biodiversity framework",
        url: "https://geobon.org/ebvs/what-are-ebvs/",
        summary: "Standard biodiversity measurements for monitoring change from genes to ecosystems.",
        related_terms: ["EBV", "essential biodiversity variables", "species populations", "ecosystem structure"],
    },
    {
        id: "eov",
        acronym: "EOV",
        title: "Essential Ocean Variables",
        owner: "GOOS / UNESCO IOC",
        framework_type: "Ocean framework",
        url: "https://goosocean.org/what-we-do/framework/essential-ocean-variables/",
        summary: "Priority ocean observations across physics, biogeochemistry, biology and ecosystems.",
        related_terms: ["EOV", "essential ocean variables", "sea surface temperature", "ocean colour"],
    },
    {
        id: "eesv",
        acronym: "EESV",
        title: "Essential Ecosystem Service Variables",
        owner: "GEO BON",
        framework_type: "Ecosystem services framework",
        url: "https://geobon.org/eesvs/what-are-eesvs/",
        summary: "Variables for monitoring ecosystem services and links between biodiversity, people and sustainability.",
        related_terms: ["EESV", "essential ecosystem service variables", "ecosystem services", "sustainability"],
    },
];

function useDebouncedValue(value, delay = 250) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
    }, [delay, value]);

    return debounced;
}

function buildPath(filters) {
    const params = new URLSearchParams();
    if (filters.text) params.set("text", filters.text);
    if (filters.collection) params.set("collections", filters.collection);
    if (filters.provider) params.set("providers", filters.provider);
    if (filters.format) params.set("formats", filters.format);
    if (filters.licence) params.set("licences", filters.licence);
    if (filters.theme) params.set("theme", filters.theme);
    if (filters.essentialVariable) params.set("ev", filters.essentialVariable);
    if (filters.singleSitesOnly) params.set("singleSitesOnly", "true");
    params.set("page", String(filters.page));
    params.set("pageSize", String(PAGE_SIZE));
    return `/api/catalogue/search?${params.toString()}`;
}

function searchUrl(params) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/search?${query}` : "/search";
}

function formatDateRange(record) {
    const start = record.temporal_start ? String(record.temporal_start).slice(0, 10) : "";
    const end = record.temporal_end ? String(record.temporal_end).slice(0, 10) : "";
    if (start && end) return `${start} to ${end}`;
    return start || end || "No temporal range";
}

function hasSpatial(record) {
    return record.spatial && record.spatial.north !== null && record.spatial.east !== null;
}

function compactText(value, length = 320) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= length) return text;
    return `${text.slice(0, length - 1).trim()}...`;
}

function displayFacetValue(value) {
    return value === null || value === undefined || value === "" ? "Unknown" : value;
}

function normalise(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function frameworkScore(framework, query) {
    const q = normalise(query);
    if (!q) return 0.25;
    const terms = [
        framework.id,
        framework.acronym,
        framework.title,
        framework.owner,
        framework.framework_type,
        ...(framework.related_terms || EMPTY),
    ].map(normalise).filter(Boolean);
    if (terms.some((term) => term === q)) return 1;
    if (terms.some((term) => term.includes(q) || q.includes(term))) return 0.8;
    return 0;
}

function frameworkForTerm(value) {
    const query = normalise(value);
    if (!query) return null;

    return ESSENTIAL_FRAMEWORKS.find((framework) => {
        const terms = [
            framework.id,
            framework.acronym,
            framework.title,
            ...(framework.related_terms || EMPTY),
        ].map(normalise).filter(Boolean);
        return terms.some((term) => term === query);
    }) || null;
}

function isFrameworkOnlyQuery(value, frameworkId) {
    const framework = frameworkForTerm(value);
    return Boolean(framework && (!frameworkId || framework.id === frameworkId));
}

export default function Search() {
    const urlParams = new URLSearchParams(window.location.search);
    const [text, setText] = useState(urlParams.get("q") || urlParams.get("text") || "");
    const [collection, setCollection] = useState(urlParams.get("collection") || "");
    const [provider, setProvider] = useState(urlParams.get("provider") || "");
    const [format, setFormat] = useState(urlParams.get("format") || "");
    const [licence, setLicence] = useState(urlParams.get("licence") || "");
    const [theme, setTheme] = useState(urlParams.get("theme") || "");
    const [essentialVariable, setEssentialVariable] = useState(urlParams.get("ev") || "");
    const [singleSitesOnly, setSingleSitesOnly] = useState(urlParams.get("singleSitesOnly") === "true");
    const [page, setPage] = useState(1);
    const debouncedText = useDebouncedValue(text);
    const effectiveText = useMemo(
        () => (essentialVariable && isFrameworkOnlyQuery(debouncedText, essentialVariable) ? "" : debouncedText.trim()),
        [debouncedText, essentialVariable]
    );

    const path = useMemo(
        () =>
            buildPath({
                text: effectiveText,
                collection,
                provider,
                format,
                licence,
                theme,
                essentialVariable,
                singleSitesOnly,
                page,
            }),
        [collection, effectiveText, essentialVariable, format, licence, page, provider, singleSitesOnly, theme]
    );

    const { data: response, error, loading } = useJsonResource(path);
    const records = response?.status === "ok" && Array.isArray(response.records) ? response.records : EMPTY;
    const apiFrameworks = response?.status === "ok" && Array.isArray(response.frameworks) ? response.frameworks : EMPTY;
    const frameworks = useMemo(() => {
        const byId = new Map();
        for (const item of [...ESSENTIAL_FRAMEWORKS, ...apiFrameworks]) {
            byId.set(item.id, { ...byId.get(item.id), ...item });
        }
        return [...byId.values()]
            .map((item) => ({
                ...item,
                score: Math.max(Number(item.score || 0), frameworkScore(item, debouncedText)),
                matched: Boolean(item.matched) || frameworkScore(item, debouncedText) > 0,
            }))
            .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    }, [apiFrameworks, debouncedText]);
    const visibleFrameworks = frameworks
        .filter((item) => item.matched || !debouncedText.trim())
        .slice(0, debouncedText.trim() ? 4 : 5);
    const facets = response?.facets || {};
    const essentialVariableFacets = facets.essential_variables || EMPTY;
    const essentialVariableFacetCounts = useMemo(
        () => new Map(essentialVariableFacets.map((item) => [item.value, item.count])),
        [essentialVariableFacets]
    );
    const total = Number(response?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const hasFilters = text || collection || provider || format || licence || theme || essentialVariable || singleSitesOnly;

    useEffect(() => {
        const next = searchUrl({
            q: debouncedText.trim(),
            collection,
            provider,
            format,
            licence,
            theme,
            ev: essentialVariable,
            singleSitesOnly: singleSitesOnly ? "true" : "",
        });
        window.history.replaceState(null, "", next);
    }, [collection, debouncedText, essentialVariable, format, licence, provider, singleSitesOnly, theme]);

    function resetPage(callback) {
        setPage(1);
        callback();
    }

    function selectEssentialVariable(value) {
        setEssentialVariable(value);
        if (value && isFrameworkOnlyQuery(text, value)) {
            setText("");
        }
    }

    function applyFrameworkTerm(term, frameworkId) {
        const framework = frameworkForTerm(term);
        if (framework && framework.id !== "ev") {
            setEssentialVariable(framework.id);
            setText("");
            return;
        }

        if (frameworkId && frameworkId !== "ev") {
            setEssentialVariable(frameworkId);
        }
        setText(term);
    }

    function clearFilters() {
        setText("");
        setCollection("");
        setProvider("");
        setFormat("");
        setLicence("");
        setTheme("");
        setEssentialVariable("");
        setSingleSitesOnly(false);
        setPage(1);
    }

    return (
        <div className="sarva-search">
            <header className="sarva-search__header">
                <p>SARVA smart search</p>
                <h1>Search mirrored SAEON catalogue records</h1>
                <span>
                    Fast local search across datasets, observation records, providers, collections, keywords and
                    spatial-temporal metadata, with direct links to essential-variable frameworks such as ECV,
                    EBV, EOV and EESV. Official records still open in the SAEON catalogue.
                </span>
            </header>

            <section className="sarva-search__controls" aria-label="Catalogue search controls">
                <label className="sarva-search__field sarva-search__field--wide">
                    <span>Search catalogue mirror</span>
                    <input
                        value={text}
                        onChange={(event) => resetPage(() => setText(event.target.value))}
                        placeholder="Try ECV, EBV, rainfall, Jonkershoek, estuaries, climate forecasts..."
                        type="search"
                    />
                </label>

                <label className="sarva-search__field">
                    <span>Theme</span>
                    <select value={theme} onChange={(event) => resetPage(() => setTheme(event.target.value))}>
                        {THEMES.map(([value, label]) => (
                            <option key={value || "all"} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="sarva-search__field">
                    <span>Essential variables</span>
                    <select
                        value={essentialVariable}
                        onChange={(event) => resetPage(() => selectEssentialVariable(event.target.value))}
                    >
                        <option value="">All EV frameworks</option>
                        {ESSENTIAL_FRAMEWORKS.filter((item) => item.id !== "ev").map((item) => {
                            const count = essentialVariableFacetCounts.get(item.id);
                            return (
                                <option key={item.id} value={item.id}>
                                    {item.acronym}
                                    {Number.isFinite(count) ? ` (${count})` : ""}
                                </option>
                            );
                        })}
                    </select>
                </label>

                <label className="sarva-search__field">
                    <span>Collection</span>
                    <select value={collection} onChange={(event) => resetPage(() => setCollection(event.target.value))}>
                        <option value="">All collections</option>
                        {(facets.collections || EMPTY).map((item) => (
                            <option key={displayFacetValue(item.value)} value={item.value || ""}>
                                {displayFacetValue(item.value)} ({item.count})
                            </option>
                        ))}
                    </select>
                </label>

                <label className="sarva-search__field">
                    <span>Provider</span>
                    <select value={provider} onChange={(event) => resetPage(() => setProvider(event.target.value))}>
                        <option value="">All providers</option>
                        {(facets.providers || EMPTY).map((item) => (
                            <option key={displayFacetValue(item.value)} value={item.value || ""}>
                                {displayFacetValue(item.value)} ({item.count})
                            </option>
                        ))}
                    </select>
                </label>

                <label className="sarva-search__field">
                    <span>Format</span>
                    <select value={format} onChange={(event) => resetPage(() => setFormat(event.target.value))}>
                        <option value="">All formats</option>
                        {(facets.formats || EMPTY).map((item) => (
                            <option key={displayFacetValue(item.value)} value={item.value || ""}>
                                {displayFacetValue(item.value)} ({item.count})
                            </option>
                        ))}
                    </select>
                </label>

                <label className="sarva-search__toggle">
                    <input
                        type="checkbox"
                        checked={singleSitesOnly}
                        onChange={(event) => resetPage(() => setSingleSitesOnly(event.target.checked))}
                    />
                    <span>Single-site observation records</span>
                </label>

                <button
                    type="button"
                    className="sarva-search__clear"
                    onClick={clearFilters}
                    disabled={!hasFilters}
                    aria-disabled={!hasFilters}
                >
                    Clear filters
                </button>
            </section>

            <div
                className={`sarva-search__summary${loading ? " is-loading" : ""}`}
                aria-live="polite"
                aria-busy={loading}
            >
                {loading ? (
                    <>
                        <span>Searching the local mirror and applying filters...</span>
                        <i aria-hidden="true" />
                    </>
                ) : (
                    `${total.toLocaleString("en-ZA")} mirrored records found`
                )}
            </div>

            {visibleFrameworks.length > 0 && (
                <section className="sarva-search__frameworks" aria-label="Essential variable frameworks">
                    <div>
                        <small>Framework links</small>
                        <h2>Essential variable frameworks</h2>
                    </div>
                    <div>
                        {visibleFrameworks.map((framework) => (
                            <article key={framework.id} className={framework.matched ? "is-match" : ""}>
                                <span>{framework.acronym}</span>
                                <strong>{framework.title}</strong>
                                <small>{framework.owner} | {framework.framework_type}</small>
                                <p>{framework.summary}</p>
                                <div>
                                    {framework.id !== "ev" && (
                                        <button
                                            type="button"
                                            onClick={() => resetPage(() => selectEssentialVariable(framework.id))}
                                        >
                                            filter {framework.acronym} records
                                        </button>
                                    )}
                                    {(framework.related_terms || EMPTY).slice(0, 5).map((term) => (
                                        <button
                                            key={`${framework.id}-${term}`}
                                            type="button"
                                            onClick={() => resetPage(() => applyFrameworkTerm(term, framework.id))}
                                        >
                                            {term}
                                        </button>
                                    ))}
                                </div>
                                <a href={framework.url} target="_blank" rel="noopener noreferrer">
                                    Open framework
                                </a>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {error && (
                <div className="sarva-search__state" role="alert">
                    Catalogue search could not be loaded.
                </div>
            )}

            {!loading && !error && records.length === 0 && (
                <div className="sarva-search__state">
                    No mirrored records match this search yet. Try a broader term or clear one filter.
                </div>
            )}

            {loading && (
                <section className="sarva-search__loadingResults" aria-label="Search results loading">
                    {[0, 1, 2].map((item) => (
                        <article key={item}>
                            <span />
                            <strong />
                            <p />
                            <p />
                            <div />
                        </article>
                    ))}
                </section>
            )}

            <section className="sarva-search__results" aria-label="Catalogue results">
                {records.map((record) => (
                    <article className="sarva-search__card" key={record.saeon_id || record.id}>
                        <div className="sarva-search__cardTop">
                            <span>{record.record_type || "Dataset"}</span>
                            {Number(record.score) > 0 && <small>{Math.round(Number(record.score) * 100)} relevance</small>}
                        </div>

                        <h2>{record.title}</h2>

                        <div className="sarva-search__meta">
                            {record.publication_year && <span>{record.publication_year}</span>}
                            {record.collection_name && <span>{record.collection_name}</span>}
                            {record.provider_name && <span>{record.provider_name}</span>}
                        </div>

                        {record.abstract && <p>{compactText(record.abstract)}</p>}

                        <div className="sarva-search__badges">
                            {(record.badges || EMPTY).map((badge) => (
                                <span key={badge}>{badge}</span>
                            ))}
                            {hasSpatial(record) && <span>Map-ready</span>}
                            <span>{formatDateRange(record)}</span>
                        </div>

                        {(record.themes || EMPTY).length > 0 && (
                            <div className="sarva-search__themes">
                                {record.themes.map((item) => (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => resetPage(() => setTheme(item.key === "water" ? "hydrology" : item.key))}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {(record.essential_variables || EMPTY).length > 0 && (
                            <div className="sarva-search__evCoverage" aria-label="Essential variable coverage">
                                <strong>Essential variable coverage</strong>
                                <div>
                                    {record.essential_variables.map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => resetPage(() => selectEssentialVariable(item.framework_id))}
                                            title={(item.matched_terms || EMPTY).join(", ")}
                                        >
                                            <span>{item.framework}</span>
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="sarva-search__actions">
                            <a href={record.catalogue_url} target="_blank" rel="noopener noreferrer">
                                Open official record
                            </a>
                            {record.download_url && (
                                <a href={record.download_url} target="_blank" rel="noopener noreferrer">
                                    Open data link
                                </a>
                            )}
                            {record.doi_url && (
                                <a href={record.doi_url} target="_blank" rel="noopener noreferrer">
                                    Citation
                                </a>
                            )}
                        </div>
                    </article>
                ))}
            </section>

            {totalPages > 1 && (
                <nav className="sarva-search__pagination" aria-label="Search results pages">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                        Previous
                    </button>
                    <span>
                        Page {page} of {totalPages}
                    </span>
                    <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                        Next
                    </button>
                </nav>
            )}
        </div>
    );
}
