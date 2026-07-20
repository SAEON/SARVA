import { useEffect, useState } from "react";
import { apiUrl } from "../config/api";

const jsonCache = new Map();

async function fetchJson(path, signal) {
    const response = await fetch(apiUrl(path), { signal });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

function getCachedJson(path) {
    if (!jsonCache.has(path)) {
        const request = fetchJson(path).catch((error) => {
            jsonCache.delete(path);
            throw error;
        });

        jsonCache.set(path, request);
    }

    return jsonCache.get(path);
}

export function useJsonResource(path, { cache = false, initialData = null } = {}) {
    const [state, setState] = useState({
        path,
        data: initialData,
        error: null,
        loading: Boolean(path),
    });

    useEffect(() => {
        if (!path) return undefined;

        let active = true;
        const controller = cache ? null : new AbortController();
        const request = cache ? getCachedJson(path) : fetchJson(path, controller.signal);

        request
            .then((data) => {
                if (active) setState({ path, data, error: null, loading: false });
            })
            .catch((error) => {
                if (error.name === "AbortError") return;
                if (active) setState({ path, data: initialData, error, loading: false });
            });

        return () => {
            active = false;
            controller?.abort();
        };
    }, [cache, initialData, path]);

    return {
        data: state.path === path ? state.data : initialData,
        error: state.path === path ? state.error : null,
        loading: Boolean(path) && (state.path !== path || state.loading),
    };
}
