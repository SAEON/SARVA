import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../config/api";
import { AUTH_CHANGED_EVENT, AUTH_TOKEN_KEY, notifyAuthChanged } from "../hooks/useCurrentUser";

async function requestJson(path, options = {}) {
    const response = await fetch(apiUrl(path), {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(payload?.message || `Request failed with ${response.status}`);
    }

    return payload;
}

function initials(name, email) {
    const source = name || email || "User";
    const parts = source.trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase()).join("") || "U";
}

export default function AuthPanel() {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState("login");
    const [user, setUser] = useState(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({
        displayName: "",
        email: "",
        password: "",
    });

    const roleLabels = useMemo(
        () => (user?.roles || []).map((role) => role.label || role.name).join(", "),
        [user]
    );

    useEffect(() => {
        let active = true;

        async function loadUser() {
            const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) {
                if (active) setUser(null);
                return;
            }

            try {
                const payload = await requestJson("/api/auth/me", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (active) setUser(payload.data.user);
            } catch {
                window.localStorage.removeItem(AUTH_TOKEN_KEY);
                if (active) setUser(null);
            }
        }

        loadUser();
        window.addEventListener(AUTH_CHANGED_EVENT, loadUser);
        window.addEventListener("storage", loadUser);

        return () => {
            active = false;
            window.removeEventListener(AUTH_CHANGED_EVENT, loadUser);
            window.removeEventListener("storage", loadUser);
        };
    }, []);

    function updateField(field, value) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    async function submit(event) {
        event.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            const payload =
                mode === "login"
                    ? await requestJson("/api/auth/login", {
                            method: "POST",
                            body: JSON.stringify({
                                email: form.email,
                                password: form.password,
                            }),
                        })
                    : await requestJson("/api/auth/register", {
                            method: "POST",
                            body: JSON.stringify(form),
                        });

            window.localStorage.setItem(AUTH_TOKEN_KEY, payload.data.token);
            setUser(payload.data.user);
            notifyAuthChanged();
            setOpen(false);
            setForm((current) => ({ ...current, password: "" }));
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }

    function signOut() {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        setUser(null);
        notifyAuthChanged();
        setOpen(false);
    }

    return (
        <div className="sarva-auth">
            {user ? (
                <button
                    className="sarva-auth__avatar"
                    type="button"
                    onClick={() => setOpen((current) => !current)}
                    aria-expanded={open}
                >
                    {initials(user.displayName, user.email)}
                </button>
            ) : (
                <button
                    className="sarva-auth__trigger"
                    type="button"
                    onClick={() => setOpen((current) => !current)}
                    aria-expanded={open}
                >
                    Login
                </button>
            )}

            {open && (
                <div className="sarva-auth__panel">
                    {user ? (
                        <div className="sarva-auth__account">
                            <strong>{user.displayName}</strong>
                            <span>{user.email}</span>
                            {roleLabels && <small>{roleLabels}</small>}
                            <button type="button" onClick={signOut}>
                                Sign out
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={submit}>
                            <div className="sarva-auth__tabs" role="tablist" aria-label="Account access">
                                <button
                                    type="button"
                                    className={mode === "login" ? "is-active" : ""}
                                    onClick={() => {
                                        setMode("login");
                                        setMessage("");
                                    }}
                                >
                                    Login
                                </button>
                                <button
                                    type="button"
                                    className={mode === "register" ? "is-active" : ""}
                                    onClick={() => {
                                        setMode("register");
                                        setMessage("");
                                    }}
                                >
                                    Register
                                </button>
                            </div>

                            {mode === "register" && (
                                <label>
                                    <span>Name</span>
                                    <input
                                        value={form.displayName}
                                        onChange={(event) => updateField("displayName", event.target.value)}
                                        autoComplete="name"
                                        required
                                    />
                                </label>
                            )}

                            <label>
                                <span>Email</span>
                                <input
                                    value={form.email}
                                    onChange={(event) => updateField("email", event.target.value)}
                                    autoComplete="email"
                                    type="email"
                                    required
                                />
                            </label>

                            <label>
                                <span>Password</span>
                                <div className="sarva-auth__password">
                                    <input
                                        value={form.password}
                                        onChange={(event) => updateField("password", event.target.value)}
                                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                                        minLength={4}
                                        type={showPassword ? "text" : "password"}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((current) => !current)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </label>

                            {message && <p className="sarva-auth__message">{message}</p>}

                            <button className="sarva-auth__submit" type="submit" disabled={loading}>
                                {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
