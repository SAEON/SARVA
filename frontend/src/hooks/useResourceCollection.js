import { useEffect, useState } from "react";
import { apiUrl } from "../config/api";

export function useResourceCollection(path) {
    const [state, setState] = useState({ path: null, data: null, error: null });

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const url = new URL(path, window.location.origin);
                const rows = [];
                let first;
                let totalPages = 1;
                for (let page = 1; page <= totalPages; page += 1) {
                    url.searchParams.set("page", String(page));
                    const response = await fetch(apiUrl(`${url.pathname}${url.search}`), { signal: controller.signal });
                    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
                    const body = await response.json();
                    if (body.status !== "ok" || !Array.isArray(body.data)) throw new Error("Resources could not be loaded");
                    first ??= body;
                    rows.push(...body.data);
                    totalPages = Number(first.pagination?.totalPages) || 1;
                }
                if (!controller.signal.aborted) setState({ path, data: { ...first, data: rows }, error: null });
            } catch (error) {
                if (!controller.signal.aborted) setState({ path, data: null, error });
            }
        }
        load();
        return () => controller.abort();
    }, [path]);

    return {
        data: state.path === path ? state.data : null,
        error: state.path === path ? state.error : null,
        loading: state.path !== path,
    };
}
