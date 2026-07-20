import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../config/api";

export const AUTH_TOKEN_KEY = "sarva_auth_token";
export const AUTH_CHANGED_EVENT = "sarva-auth-changed";

export function notifyAuthChanged() {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function useCurrentUser() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => window.localStorage.getItem(AUTH_TOKEN_KEY));

    useEffect(() => {
        function refreshToken() {
            setToken(window.localStorage.getItem(AUTH_TOKEN_KEY));
        }

        window.addEventListener(AUTH_CHANGED_EVENT, refreshToken);
        window.addEventListener("storage", refreshToken);

        return () => {
            window.removeEventListener(AUTH_CHANGED_EVENT, refreshToken);
            window.removeEventListener("storage", refreshToken);
        };
    }, []);

    useEffect(() => {
        if (!token) return undefined;

        fetch(apiUrl("/api/auth/me"), {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((response) => {
                if (!response.ok) throw new Error("Not authenticated");
                return response.json();
            })
            .then((payload) => setUser(payload.data.user))
            .catch(() => {
                window.localStorage.removeItem(AUTH_TOKEN_KEY);
                setToken(null);
                setUser(null);
            });
    }, [token]);

    const isAdmin = useMemo(
        () => Boolean(token && user?.roles?.some((role) => role.name === "admin")),
        [token, user]
    );

    return { user: token ? user : null, token, isAdmin };
}
