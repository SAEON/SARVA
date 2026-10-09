import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import "../styles/page-status.css";

export default function RouteError() {
    const error = useRouteError();
    const notFound = isRouteErrorResponse(error) && error.status === 404;

    return (
        <main className="sarva-pageStatus" role="alert">
            <p className="sarva-pageStatus__label">SARVA · Risk and Vulnerability Atlas</p>
            <h1>{notFound ? "Page not found" : "This page could not be loaded"}</h1>
            <p>{notFound
                ? "The address may have changed. Return home to explore the atlas."
                : "Please try again. If the problem continues, return home and choose another tool."}</p>
            <div className="sarva-pageStatus__actions">
                {!notFound && <button type="button" onClick={() => window.location.reload()}>Try again</button>}
                <a href="/">Return to SARVA home</a>
            </div>
        </main>
    );
}
