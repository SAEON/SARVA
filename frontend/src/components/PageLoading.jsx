import "../styles/page-status.css";

export default function PageLoading() {
    return (
        <div className="sarva-pageStatus" role="status" aria-live="polite">
            <span className="sarva-pageStatus__spinner" aria-hidden="true" />
            <h1>Loading your workspace</h1>
            <p>Preparing SARVA maps, data and tools…</p>
        </div>
    );
}
