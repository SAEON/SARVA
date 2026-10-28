import {useEffect, useState} from "react";
import {deploymentInProgress} from "../config/deploymentNotice";
import "../styles/deployment-ribbon.css";

export default function DeploymentRibbon() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        let stopped = false, controller;
        async function update() {
            controller?.abort();
            controller = new AbortController();
            try {
                const response = await fetch("/public/deployment-status.json", {cache:"no-store", credentials:"omit", signal:controller.signal});
                const status = response.ok ? await response.json() : null;
                if (!stopped) setVisible(deploymentInProgress(status));
            } catch {
                if (!stopped) setVisible(false);
            }
        }
        update();
        const timer = window.setInterval(update, 15000);
        const refresh = () => { if (!document.hidden) update(); };
        document.addEventListener("visibilitychange", refresh);
        return () => { stopped = true; window.clearInterval(timer); controller?.abort(); document.removeEventListener("visibilitychange", refresh); };
    }, []);
    return visible ? <aside className="sarva-deploymentRibbon" role="status" aria-live="polite"><strong>Update in progress</strong><span>SARVA is being updated. You can continue browsing; please save any work.</span></aside> : null;
}
