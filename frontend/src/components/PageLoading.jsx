import "../styles/page-status.css";

export default function PageLoading() {
    return (
        <div className="sarva-pageStatus sarva-pageStatus--loading" role="status" aria-live="polite">
            <p>Preparing SARVA maps, data and tools…</p>
        </div>
    );
}
