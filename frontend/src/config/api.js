export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";
export const MARTIN_BASE = import.meta.env.VITE_MARTIN_BASE || "http://localhost:3000";

export function apiUrl(path) {
    return `${API_BASE}${path}`;
}

export function martinUrl(path) {
    return `${MARTIN_BASE}${path}`;
}
