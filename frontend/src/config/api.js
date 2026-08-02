export const API_BASE = (
    import.meta.env.VITE_API_BASE || "/api"
).replace(/\/+$/, "");

export const MARTIN_BASE = (
    import.meta.env.VITE_MARTIN_BASE || "/tiles"
).replace(/\/+$/, "");

function absoluteBrowserBase(base) {
    if (/^https?:\/\//i.test(base)) {
        return base;
    }

    if (typeof window !== "undefined") {
        const cleanBase = base.startsWith("/") ? base : `/${base}`;
        return `${window.location.origin}${cleanBase}`;
    }

    return base;
}

export function apiUrl(path = "") {
    const cleanPath = String(path).startsWith("/")
        ? String(path)
        : `/${path}`;

    // Static files are served separately by Express/Nginx.
    if (cleanPath.startsWith("/public/")) {
        return cleanPath;
    }

    // Callers already include /api in many paths.
    if (API_BASE === "/api" && cleanPath.startsWith("/api/")) {
        return cleanPath;
    }

    return `${API_BASE}${cleanPath}`;
}

export function martinUrl(path = "") {
    const cleanPath = String(path).startsWith("/")
        ? String(path)
        : `/${path}`;

    return `${absoluteBrowserBase(MARTIN_BASE)}${cleanPath}`;
}