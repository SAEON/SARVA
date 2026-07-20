import { useEffect, useState } from "react";

const STATUS_OPTIONS = [
    ["unchecked", "Not checked"],
    ["active", "Active"],
    ["redirected", "Redirected"],
    ["broken", "Broken"],
    ["missing", "Missing URL"],
];

function keywordsToText(value) {
    return Array.isArray(value) ? value.join(", ") : "";
}

export default function LibraryEditModal({ kind, record, onClose, onSave }) {
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!record) {
            setForm(null);
            return;
        }

        setForm({
            title: record.title || "",
            url: record.url || "",
            author: record.author || "",
            publisher: record.publisher || "",
            publication_year: record.publication_year || "",
            resource_type: record.resource_type || "",
            abstract: record.abstract || "",
            keywords: keywordsToText(record.keywords),
            link_status: record.link_status || (record.url ? "unchecked" : "missing"),
            link_status_code: record.link_status_code || "",
            logo_url: record.logo_url || "",
            admin_notes: record.admin_notes || "",
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
            await onSave({
                ...form,
                keywords: form.keywords,
                link_status_code: form.link_status_code === "" ? null : form.link_status_code,
            });
            onClose();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="sarva-libraryEdit" role="dialog" aria-modal="true" aria-label="Edit library record">
            <form className="sarva-libraryEdit__panel" onSubmit={submit}>
                <div className="sarva-libraryEdit__head">
                    <div>
                        <span>{kind === "policy" ? "Policy record" : "Relevant document"}</span>
                        <h2>{record.id ? "Edit record" : "Add record"}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close edit panel">
                        x
                    </button>
                </div>

                <label>
                    <span>Title</span>
                    <input value={form.title} onChange={(event) => update("title", event.target.value)} required />
                </label>

                <label>
                    <span>URL</span>
                    <input value={form.url} onChange={(event) => update("url", event.target.value)} />
                </label>

                <div className="sarva-libraryEdit__grid">
                    {kind === "policy" ? (
                        <label>
                            <span>Publisher</span>
                            <input value={form.publisher} onChange={(event) => update("publisher", event.target.value)} />
                        </label>
                    ) : (
                        <label>
                            <span>Author</span>
                            <input value={form.author} onChange={(event) => update("author", event.target.value)} />
                        </label>
                    )}

                    <label>
                        <span>Year</span>
                        <input value={form.publication_year} onChange={(event) => update("publication_year", event.target.value)} />
                    </label>
                </div>

                {kind === "resource" && (
                    <label>
                        <span>Resource type</span>
                        <input value={form.resource_type} onChange={(event) => update("resource_type", event.target.value)} />
                    </label>
                )}

                {kind === "policy" && (
                    <label>
                        <span>Abstract</span>
                        <textarea value={form.abstract} onChange={(event) => update("abstract", event.target.value)} rows={4} />
                    </label>
                )}

                <label>
                    <span>Keywords</span>
                    <input value={form.keywords} onChange={(event) => update("keywords", event.target.value)} placeholder="Comma separated" />
                </label>

                {kind === "resource" && (
                    <label>
                        <span>Logo URL</span>
                        <input value={form.logo_url} onChange={(event) => update("logo_url", event.target.value)} placeholder="https://..." />
                    </label>
                )}

                <div className="sarva-libraryEdit__grid">
                    <label>
                        <span>Link status</span>
                        <select value={form.link_status} onChange={(event) => update("link_status", event.target.value)}>
                            {STATUS_OPTIONS.map(([value, label]) => (
                                <option value={value} key={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span>Status code</span>
                        <input value={form.link_status_code} onChange={(event) => update("link_status_code", event.target.value)} inputMode="numeric" />
                    </label>
                </div>

                <label>
                    <span>Admin notes</span>
                    <textarea value={form.admin_notes} onChange={(event) => update("admin_notes", event.target.value)} rows={3} />
                </label>

                {message && <p className="sarva-libraryEdit__message">{message}</p>}

                <div className="sarva-libraryEdit__actions">
                    <button type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
