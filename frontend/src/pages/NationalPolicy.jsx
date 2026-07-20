import { useEffect, useMemo, useState } from "react";
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
    if (filters.publisher) params.set("publisher", filters.publisher);
    if (filters.publicationYear) params.set("publication_year", filters.publicationYear);
    if (filters.keyword) params.set("keyword", filters.keyword);

    params.set("page", String(filters.page));
    params.set("limit", String(filters.limit));
    params.set("sort", "title");
    params.set("order", "asc");

    return `/api/national-policy-legislation?${params.toString()}`;
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

export default function NationalPolicy() {
    const [search, setSearch] = useState("");
    const [publisher, setPublisher] = useState("");
    const [publicationYear, setPublicationYear] = useState("");
    const [keyword, setKeyword] = useState("");
    const [page, setPage] = useState(1);
    const [overrides, setOverrides] = useState({});
    const [createdRows, setCreatedRows] = useState([]);
    const [deletedIds, setDeletedIds] = useState(new Set());
    const [editing, setEditing] = useState(null);
    const [checkingId, setCheckingId] = useState(null);
    const [bulkChecking, setBulkChecking] = useState(false);
    const [bulkMessage, setBulkMessage] = useState("");
    const limit = 10;
    const debouncedSearch = useDebouncedValue(search);
    const { isAdmin, token } = useCurrentUser();

    const path = useMemo(
        () =>
            buildPath({
                search: debouncedSearch.trim(),
                publisher,
                publicationYear,
                keyword,
                page,
                limit,
            }),
        [debouncedSearch, keyword, page, publicationYear, publisher]
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
        publicationYears: EMPTY,
        publishers: EMPTY,
        keywords: EMPTY,
    };
    const hasFilters = search || publisher || publicationYear || keyword;

    function clearFilters() {
        setSearch("");
        setPublisher("");
        setPublicationYear("");
        setKeyword("");
        setPage(1);
    }

    async function saveRecord(payload) {
        const isCreate = !editing.id;
        const response = await fetch(apiUrl(isCreate ? "/api/national-policy-legislation" : `/api/national-policy-legislation/${editing.id}`), {
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
        if (!window.confirm(`Delete "${record.title}" from policy and legislation?`)) return;

        const response = await fetch(apiUrl(`/api/national-policy-legislation/${record.id}`), {
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
            const response = await fetch(apiUrl(`/api/national-policy-legislation/${record.id}/check-link`), {
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
                    if (record.kind !== "policy") continue;
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
                <h1 className="sarva-resources__title">National Policy & Legislation</h1>
                <p className="sarva-resources__intro">
                    A searchable catalogue of national policy and legislation relevant to SARVA themes.
                </p>
            </div>

            <section className="sarva-resources__controls" aria-label="Policy filters">
                <label className="sarva-resources__field sarva-resources__field--search">
                    <span>Search policy</span>
                    <input
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Search title, publisher, abstract or keyword"
                        type="search"
                    />
                </label>

                <label className="sarva-resources__field">
                    <span>Publisher</span>
                    <select
                        value={publisher}
                        onChange={(event) => {
                            setPublisher(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">All publishers</option>
                        {filters.publishers.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="sarva-resources__field">
                    <span>Year</span>
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
                {loading ? "Loading policy records..." : `${pagination.total} policy records found`}
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
                        Add policy
                    </button>
                    {bulkMessage && <small>{bulkMessage}</small>}
                </div>
            )}

            {error && (
                <div className="sarva-resources__state" role="alert">
                    National policy and legislation could not be loaded. Please try again.
                </div>
            )}

            {!loading && !error && rows.length === 0 && (
                <div className="sarva-resources__state">No policy records match the current filters.</div>
            )}

            <div className="sarva-resources__tableWrap">
                <table className="sarva-resources__table">
                    <thead>
                        <tr>
                            <th>Policy / legislation</th>
                            <th>Year</th>
                            <th>Publisher</th>
                            <th>Keywords</th>
                            <th>Link</th>
                            {isAdmin && <th>Admin</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((record) => {
                            const status = statusFor(record);
                            return (
                                <tr key={record.id}>
                                    <td data-label="Policy / legislation">
                                        <strong className="sarva-resources__tableTitle">{record.title}</strong>
                                        {record.abstract && (
                                            <small className="sarva-resources__abstractLine">{record.abstract}</small>
                                        )}
                                        {record.admin_notes && isAdmin && (
                                            <small className="sarva-resources__note">{record.admin_notes}</small>
                                        )}
                                    </td>
                                    <td data-label="Year">{record.publication_year || "-"}</td>
                                    <td data-label="Publisher">{record.publisher || "-"}</td>
                                    <td data-label="Keywords">
                                        <div className="sarva-resources__tagRow">
                                            {compactTags(record.keywords).map((item) => (
                                                <span key={item} className="sarva-resources__tag">
                                                    {item}
                                                </span>
                                            ))}
                                            {Array.isArray(record.keywords) && record.keywords.length > 3 && (
                                                <span className="sarva-resources__tag">+{record.keywords.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td data-label="Link">
                                        <div className="sarva-resources__linkCell">
                                            <span className={`sarva-resources__status is-${status}`}>
                                                {statusLabel(status)}
                                            </span>
                                            {record.link_checked_at && (
                                                <small className="sarva-resources__checked">
                                                    Checked {new Date(record.link_checked_at).toLocaleDateString()}
                                                    {record.link_status_code ? ` | ${record.link_status_code}` : ""}
                                                </small>
                                            )}
                                            {record.url && (
                                                <a href={record.url} target="_blank" rel="noopener noreferrer">
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
                                                    onClick={() => setEditing(record)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sarva-resources__edit"
                                                    onClick={() => checkRecord(record)}
                                                    disabled={checkingId === record.id}
                                                >
                                                    {checkingId === record.id ? "Checking" : "Check link"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sarva-resources__edit is-danger"
                                                    onClick={() => deleteRecord(record)}
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
                <nav className="sarva-resources__pagination" aria-label="National policy pagination">
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
                kind="policy"
                record={editing}
                onClose={() => setEditing(null)}
                onSave={saveRecord}
            />
        </div>
    );
}
