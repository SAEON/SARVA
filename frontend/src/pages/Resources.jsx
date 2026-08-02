import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import LibraryEditModal from "../components/LibraryEditModal";
import { apiUrl } from "../config/api";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useJsonResource } from "../hooks/useJsonResource";
import "../styles/resources.css";

const EMPTY = [];

function useDebouncedValue(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
    }, [delay, value]);

    return debounced;
}

function buildPath(filters) {
    const params = new URLSearchParams();

    if (filters.search) params.set("search", filters.search);
    if (filters.resourceType) params.set("resource_type", filters.resourceType);
    if (filters.publicationYear) params.set("publication_year", filters.publicationYear);
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.resourceGroup) params.set("resource_group", filters.resourceGroup);

    params.set("page", String(filters.page));
    params.set("limit", String(filters.limit));
    params.set("sort", "title");
    params.set("order", "asc");

    return `/api/resources?${params.toString()}`;
}

function statusFor(record) {
    if (!record.url) return "missing";
    return record.link_status || "unchecked";
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

function compactTags(tags) {
    return Array.isArray(tags) ? tags.slice(0, 3) : [];
}

function resourceContext({ search, resourceGroup }) {
    const normalisedSearch = String(search || "").trim().toLowerCase();
    if (resourceGroup === "reports_stories") {
        return {
            title: "Reports & Stories",
            intro: "Evidence products, reports, briefs, case studies and SARVA-linked stories from the resource library.",
        };
    }
    if (resourceGroup === "data_spotlight") {
        return {
            title: "Data Spotlight",
            intro: "Featured datasets, research tools, live services and data links from the SARVA resource library.",
        };
    }
    if (resourceGroup === "supporting_data") {
        return {
            title: "Supporting Data",
            intro: "Reference datasets and external services that support SARVA workflows and interpretation.",
        };
    }
    if (normalisedSearch.includes("data science lab")) {
        return {
            title: "Data Science Lab Resources",
            intro: "Tutorials, prototype apps, learning pathways and practical SARVA data-science workflows.",
        };
    }
    if (normalisedSearch.includes("training")) {
        return {
            title: "Help & Training",
            intro: "Training material, methods notes and learning resources for working with SARVA data.",
        };
    }
    return {
        title: "Relevant Documents",
        intro: "A searchable catalogue of SARVA-linked reports, guidelines, tools and reference websites.",
    };
}

export default function Resources() {
    const location = useLocation();
    const [search, setSearch] = useState("");
    const [resourceType, setResourceType] = useState("");
    const [publicationYear, setPublicationYear] = useState("");
    const [keyword, setKeyword] = useState("");
    const [resourceGroup, setResourceGroup] = useState("");
    const [page, setPage] = useState(1);
    const [overrides, setOverrides] = useState({});
    const [createdRows, setCreatedRows] = useState([]);
    const [deletedIds, setDeletedIds] = useState(new Set());
    const [editing, setEditing] = useState(null);
    const [checkingId, setCheckingId] = useState(null);
    const [bulkChecking, setBulkChecking] = useState(false);
    const [bulkMessage, setBulkMessage] = useState("");
    const limit = 12;
    const debouncedSearch = useDebouncedValue(search);
    const { isAdmin, token } = useCurrentUser();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setSearch(params.get("search") || params.get("q") || "");
        setResourceType(params.get("resource_type") || "");
        setPublicationYear(params.get("publication_year") || "");
        setKeyword(params.get("keyword") || "");
        setResourceGroup(params.get("resource_group") || params.get("group") || "");
        setPage(1);
    }, [location.search]);

    const path = useMemo(
        () =>
            buildPath({
                search: debouncedSearch.trim(),
                resourceType,
                publicationYear,
                keyword,
                resourceGroup,
                page,
                limit,
            }),
        [debouncedSearch, keyword, page, publicationYear, resourceGroup, resourceType]
    );

    const { data: response, error, loading } = useJsonResource(path);
    const rows = response?.status === "ok" && Array.isArray(response.data)
        ? [
                ...createdRows,
                ...response.data
                    .filter((row) => !deletedIds.has(row.id))
                    .map((row) => overrides[row.id] || row),
            ]
        : EMPTY;
    const pagination = response?.pagination || {
        page,
        limit,
        total: 0,
        totalPages: 0,
    };
    const filters = response?.filters || {
        resourceTypes: EMPTY,
        publicationYears: EMPTY,
        keywords: EMPTY,
    };
    const hasFilters = search || resourceType || publicationYear || keyword || resourceGroup;
    const context = resourceContext({ search, resourceGroup });

    function clearFilters() {
        setSearch("");
        setResourceType("");
        setPublicationYear("");
        setKeyword("");
        setResourceGroup("");
        setPage(1);
    }

    async function saveRecord(payload) {
        const isCreate = !editing.id;
        const response = await fetch(apiUrl(isCreate ? "/api/resources" : `/api/resources/${editing.id}`), {
            method: isCreate ? "POST" : "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            throw new Error(body?.message || "Record could not be saved");
        }
        if (isCreate) {
            setCreatedRows((current) => [body.data, ...current]);
        } else {
            setOverrides((current) => ({ ...current, [body.data.id]: body.data }));
        }
    }

    async function deleteRecord(record) {
        if (!window.confirm(`Delete "${record.title}" from relevant documents?`)) return;

        const response = await fetch(apiUrl(`/api/resources/${record.id}`), {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            window.alert(body?.message || "Record could not be deleted");
            return;
        }

        setCreatedRows((current) => current.filter((row) => row.id !== record.id));
        setDeletedIds((current) => new Set(current).add(record.id));
    }

    async function checkRecord(record) {
        setCheckingId(record.id);
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
            setOverrides((current) => ({ ...current, [body.data.id]: body.data }));
        } finally {
            setCheckingId(null);
        }
    }

    async function checkBulkLinks() {
        setBulkChecking(true);
        setBulkMessage("");
        try {
            const response = await fetch(apiUrl("/api/library/check-links"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ limit: 50, staleDays: 30 }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || body?.status !== "ok") {
                throw new Error(body?.message || "Links could not be checked");
            }

            const checked = body.data?.summary?.checked || 0;
            const broken = body.data?.summary?.broken || 0;
            const records = body.data?.records || [];
            setOverrides((current) => {
                const next = { ...current };
                for (const record of records) {
                    if (record.kind !== "resource") continue;
                    const existing = next[record.id] || rows.find((row) => row.id === record.id);
                    if (existing) next[record.id] = { ...existing, ...record };
                }
                return next;
            });
            setBulkMessage(`Checked ${checked} links. ${broken} broken.`);
        } catch (error) {
            setBulkMessage(error.message);
        } finally {
            setBulkChecking(false);
        }
    }

    return (
        <div className="sarva-resources">
            <div className="sarva-resources__header">
                <h1 className="sarva-resources__title">{context.title}</h1>
                <p className="sarva-resources__intro">
                    {context.intro}
                </p>
            </div>

            <section className="sarva-resources__controls" aria-label="Document filters">
                <label className="sarva-resources__field sarva-resources__field--search">
                    <span>Search documents</span>
                    <input
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Search title, author, type or keyword"
                        type="search"
                    />
                </label>

                <label className="sarva-resources__field">
                    <span>Resource type</span>
                    <select
                        value={resourceType}
                        onChange={(event) => {
                            setResourceType(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">All types</option>
                        {filters.resourceTypes.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="sarva-resources__field">
                    <span>Publication year</span>
                    <select
                        value={publicationYear}
                        onChange={(event) => {
                            setPublicationYear(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">All years</option>
                        {filters.publicationYears.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="sarva-resources__field">
                    <span>Keyword</span>
                    <select
                        value={keyword}
                        onChange={(event) => {
                            setKeyword(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">All keywords</option>
                        {filters.keywords.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </label>

                {hasFilters && (
                    <button type="button" className="sarva-resources__clear" onClick={clearFilters}>
                        Clear filters
                    </button>
                )}
            </section>

            <div className="sarva-resources__summary" aria-live="polite">
                {loading ? "Loading documents..." : `${pagination.total} documents found`}
            </div>

            {isAdmin && (
                <div className="sarva-resources__adminBar">
                    <div>
                        <strong>Library maintenance</strong>
                        <span>Check up to 50 stale or unchecked document and policy links.</span>
                    </div>
                    <button type="button" onClick={checkBulkLinks} disabled={bulkChecking}>
                        {bulkChecking ? "Checking links..." : "Bulk check links"}
                    </button>
                    <button type="button" onClick={() => setEditing({})}>
                        Add document
                    </button>
                    {bulkMessage && <small>{bulkMessage}</small>}
                </div>
            )}

            {error && (
                <div className="sarva-resources__state" role="alert">
                    Relevant documents could not be loaded. Please try again.
                </div>
            )}

            {!loading && !error && rows.length === 0 && (
                <div className="sarva-resources__state">No documents match the current filters.</div>
            )}

            <div className="sarva-resources__tableWrap">
                <table className="sarva-resources__table">
                    <thead>
                        <tr>
                            <th>Document</th>
                            <th>Type</th>
                            <th>Year</th>
                            <th>Author</th>
                            <th>Keywords</th>
                            <th>Link</th>
                            {isAdmin && <th>Admin</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((resource) => {
                            const status = statusFor(resource);
                            return (
                                <tr key={resource.id}>
                                    <td data-label="Document">
                                        <strong className="sarva-resources__tableTitle">{resource.title}</strong>
                                        {resource.admin_notes && isAdmin && (
                                            <small className="sarva-resources__note">{resource.admin_notes}</small>
                                        )}
                                    </td>
                                    <td data-label="Type">{resource.resource_type || "-"}</td>
                                    <td data-label="Year">{resource.publication_year || "-"}</td>
                                    <td data-label="Author">{resource.author || "-"}</td>
                                    <td data-label="Keywords">
                                        <div className="sarva-resources__tagRow">
                                            {compactTags(resource.keywords).map((item) => (
                                                <span key={item} className="sarva-resources__tag">
                                                    {item}
                                                </span>
                                            ))}
                                            {Array.isArray(resource.keywords) && resource.keywords.length > 3 && (
                                                <span className="sarva-resources__tag">+{resource.keywords.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td data-label="Link">
                                        <div className="sarva-resources__linkCell">
                                            <span className={`sarva-resources__status is-${status}`}>
                                                {statusLabel(status)}
                                            </span>
                                            {resource.link_checked_at && (
                                                <small className="sarva-resources__checked">
                                                    Checked {new Date(resource.link_checked_at).toLocaleDateString()}
                                                    {resource.link_status_code ? ` | ${resource.link_status_code}` : ""}
                                                </small>
                                            )}
                                            {resource.url && (
                                                <a href={resource.url} target="_blank" rel="noopener noreferrer">
                                                    Open
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    {isAdmin && (
                                        <td data-label="Admin">
                                            <div className="sarva-resources__adminActions">
                                                <button
                                                    type="button"
                                                    className="sarva-resources__edit"
                                                    onClick={() => setEditing(resource)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sarva-resources__edit"
                                                    onClick={() => checkRecord(resource)}
                                                    disabled={checkingId === resource.id}
                                                >
                                                    {checkingId === resource.id ? "Checking" : "Check link"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sarva-resources__edit is-danger"
                                                    onClick={() => deleteRecord(resource)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {pagination.totalPages > 1 && (
                <nav className="sarva-resources__pagination" aria-label="Relevant documents pagination">
                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1 || loading}
                    >
                        Previous
                    </button>
                    <span>
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                        disabled={page >= pagination.totalPages || loading}
                    >
                        Next
                    </button>
                </nav>
            )}

            <LibraryEditModal
                kind="resource"
                record={editing}
                onClose={() => setEditing(null)}
                onSave={saveRecord}
            />
        </div>
    );
}
