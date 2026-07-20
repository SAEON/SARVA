import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../config/api";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useJsonResource } from "../hooks/useJsonResource";
import "../styles/glossary.css";

const EMPTY_ROWS = [];

function GlossaryEditModal({ record, onClose, onSave }) {
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!record) {
            setForm(null);
            return;
        }

        setForm({
            term: record.term || "",
            definition: record.definition || "",
            category: record.category || "",
            source: record.source || "",
        });
        setMessage("");
    }, [record]);

    if (!record || !form) return null;

    function update(field, value) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    async function submit(event) {
        event.preventDefault();
        setSaving(true);
        setMessage("");

        try {
            await onSave(form);
            onClose();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="sarva-glossaryEdit" role="dialog" aria-modal="true" aria-label="Edit glossary term">
            <form className="sarva-glossaryEdit__panel" onSubmit={submit}>
                <div className="sarva-glossaryEdit__head">
                    <div>
                        <span>Glossary term</span>
                        <h2>{record.id ? "Edit term" : "Add term"}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close edit panel">
                        x
                    </button>
                </div>

                <label>
                    <span>Term</span>
                    <input value={form.term} onChange={(event) => update("term", event.target.value)} required />
                </label>

                <label>
                    <span>Definition</span>
                    <textarea value={form.definition} onChange={(event) => update("definition", event.target.value)} rows={5} required />
                </label>

                <div className="sarva-glossaryEdit__grid">
                    <label>
                        <span>Category</span>
                        <input value={form.category} onChange={(event) => update("category", event.target.value)} />
                    </label>
                    <label>
                        <span>Source</span>
                        <input value={form.source} onChange={(event) => update("source", event.target.value)} />
                    </label>
                </div>

                {message && <p className="sarva-glossaryEdit__message">{message}</p>}

                <div className="sarva-glossaryEdit__actions">
                    <button type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save term"}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function Glossary() {
    const [q, setQ] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const [editing, setEditing] = useState(null);
    const [createdRows, setCreatedRows] = useState([]);
    const [overrides, setOverrides] = useState({});
    const [deletedIds, setDeletedIds] = useState(new Set());
    const inputRef = useRef(null);
    const { data: glossaryResponse, error } = useJsonResource("/api/glossary", { cache: true });
    const { isAdmin, token } = useCurrentUser();

    const apiRows =
        glossaryResponse?.status === "ok" && Array.isArray(glossaryResponse.data)
            ? glossaryResponse.data
            : EMPTY_ROWS;
    const rows = [
        ...createdRows,
        ...apiRows
            .filter((row) => !deletedIds.has(row.id))
            .map((row) => overrides[row.id] || row),
    ];

    useEffect(() => {
        if (error) console.error(error);
    }, [error]);

    const qNorm = q.trim().toLowerCase();

    const searchableRows = useMemo(
        () =>
            rows.map((row) => ({
                ...row,
                searchTerm: row.term.toLowerCase(),
                searchText: `${row.term} ${row.definition} ${row.category || ""}`.toLowerCase(),
            })),
        [rows]
    );

    const suggestions = useMemo(() => {
        if (!qNorm) return [];
        const starts = [];
        const contains = [];

        for (const x of searchableRows) {
            if (x.searchTerm.startsWith(qNorm)) starts.push(x);
            else if (x.searchTerm.includes(qNorm)) contains.push(x);
        }
        return [...starts, ...contains].slice(0, 8);
    }, [searchableRows, qNorm]);

    const displayed = useMemo(() => {
        if (selectedId != null) {
            const one = searchableRows.find((r) => r.id === selectedId);
            return one ? [one] : [];
        }
        if (!qNorm) return searchableRows;
        return searchableRows.filter((x) => x.searchText.includes(qNorm));
    }, [searchableRows, qNorm, selectedId]);

    function selectSuggestion(s) {
        setSelectedId(s.id);
        setQ(s.term);
        setOpen(false);
        setActiveIdx(-1);
    }

    function clearAll() {
        setQ("");
        setSelectedId(null);
        setOpen(false);
        setActiveIdx(-1);
        inputRef.current?.focus();
    }

    function onKeyDown(e) {
        if (e.key === "Escape") {
            setOpen(false);
            setActiveIdx(-1);
            return;
        }

        if (!open) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            if (activeIdx >= 0 && suggestions[activeIdx]) {
                e.preventDefault();
                selectSuggestion(suggestions[activeIdx]);
            }
        }
    }

    async function saveTerm(payload) {
        const isCreate = !editing.id;
        const response = await fetch(apiUrl(isCreate ? "/api/glossary" : `/api/glossary/${editing.id}`), {
            method: isCreate ? "POST" : "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            throw new Error(body?.message || "Glossary term could not be saved");
        }

        if (isCreate) {
            setCreatedRows((current) => [body.data, ...current]);
        } else {
            setOverrides((current) => ({ ...current, [body.data.id]: body.data }));
        }
    }

    async function deleteTerm(term) {
        if (!window.confirm(`Delete "${term.term}" from the glossary?`)) return;

        const response = await fetch(apiUrl(`/api/glossary/${term.id}`), {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.status !== "ok") {
            window.alert(body?.message || "Glossary term could not be deleted");
            return;
        }

        setCreatedRows((current) => current.filter((row) => row.id !== term.id));
        setDeletedIds((current) => new Set(current).add(term.id));
    }

    return (
        <div className="sarva-glossary">
            <div className="sarva-glossary__header">
                <h1 className="sarva-glossary__title">Glossary</h1>
                <p className="sarva-glossary__intro">
                    Definitions of key environmental and risk-related terms used within SARVA.
                </p>
            </div>

            <div className="sarva-glossary__searchWrap">
                <div className="sarva-glossary__search">
                    <input
                        ref={inputRef}
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setSelectedId(null);
                            setOpen(true);
                            setActiveIdx(-1);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setTimeout(() => setOpen(false), 120)}
                        onKeyDown={onKeyDown}
                        placeholder="Search terms…"
                        autoComplete="off"
                        spellCheck={true}
                    />

                    {(q || selectedId != null) && (
                        <button
                            type="button"
                            className="sarva-glossary__clear"
                            onClick={clearAll}
                            aria-label="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {open && selectedId == null && suggestions.length > 0 && (
                    <div className="sarva-glossary__suggestions" role="listbox">
                        {suggestions.map((s, idx) => (
                            <button
                                key={s.id}
                                type="button"
                                className={
                                    "sarva-glossary__suggestion" +
                                    (idx === activeIdx ? " is-active" : "")
                                }
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectSuggestion(s)}
                                role="option"
                                aria-selected={idx === activeIdx}
                            >
                                <div className="sarva-glossary__suggestionTerm">{s.term}</div>
                                {s.category && (
                                    <div className="sarva-glossary__suggestionMeta">{s.category}</div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedId != null && (
                <div className="sarva-glossary__hint">
                    Showing 1 result. Clear (✕) to return to all terms.
                </div>
            )}

            {isAdmin && (
                <div className="sarva-glossary__adminBar">
                    <div>
                        <strong>Glossary maintenance</strong>
                        <span>Add, update or remove terms from the public glossary.</span>
                    </div>
                    <button type="button" onClick={() => setEditing({})}>
                        Add term
                    </button>
                </div>
            )}

            <div className="sarva-glossary__tableWrap">
                <table className="sarva-glossary__table">
                    <thead>
                        <tr>
                            <th>Term</th>
                            <th>Definition</th>
                            <th>Category</th>
                            <th>Source</th>
                            {isAdmin && <th>Admin</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {displayed.map((term) => (
                            <tr key={term.id}>
                                <td data-label="Term">
                                    <strong>{term.term}</strong>
                                </td>
                                <td data-label="Definition">{term.definition}</td>
                                <td data-label="Category">
                                    {term.category ? <span className="sarva-glossary__category">{term.category}</span> : "-"}
                                </td>
                                <td data-label="Source">{term.source || "-"}</td>
                                {isAdmin && (
                                    <td data-label="Admin">
                                        <div className="sarva-glossary__actions">
                                            <button type="button" onClick={() => setEditing(term)}>
                                                Edit
                                            </button>
                                            <button type="button" className="is-danger" onClick={() => deleteTerm(term)}>
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <GlossaryEditModal record={editing} onClose={() => setEditing(null)} onSave={saveTerm} />
        </div>
    );
}
