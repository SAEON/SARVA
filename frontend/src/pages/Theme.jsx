import { useParams } from "react-router-dom";
import { sarva } from "../data/mockSarva";

export default function Theme() {
    const { slug } = useParams();
    const theme = sarva.sections.find((s) => s.slug === slug);

    if (!theme) return <div>Theme not found.</div>;

    return (
        <div>
            <h1 style={{ marginTop: 0 }}>{theme.title}</h1>
            {theme.summary && <p>{theme.summary}</p>}

            {theme.blocks.map((b, idx) => (
                <section key={idx} style={{ marginTop: 24 }}>
                    <h2>{b.title}</h2>

                    {b.type === "context" && <p>{b.content}</p>}

                    {(b.type === "data" || b.type === "tools") && (
                        <ul>
                            {(b.items || []).length === 0 ? (
                                <li style={{ color: "#777" }}>No items yet.</li>
                            ) : (
                                b.items.map((it, i) => (
                                    <li key={i}>
                                        <a href={it.href} target="_blank" rel="noreferrer">{it.label}</a>
                                    </li>
                                ))
                            )}
                        </ul>
                    )}
                </section>
            ))}
        </div>
    );
}