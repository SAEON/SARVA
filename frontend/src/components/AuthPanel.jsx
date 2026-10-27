import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

function AccountIcon({kind}) {
    const paths = {
        testing: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/></>,
        users: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/></>,
        analytics: <><path d="M4 3v17h17M9 16v-5M14 16V7M19 16V4"/></>,
        health: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
        exit: <><path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h13"/></>,
    };
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function AccountLink({to,kind,title,description,onClick}) {
    return <Link className="sarva-accountLink" to={to} onClick={onClick}>
        <span className="sarva-accountLink__icon"><AccountIcon kind={kind}/></span>
        <span className="sarva-accountLink__copy"><strong>{title}</strong><small>{description}</small></span>
        <span className="sarva-accountLink__arrow" aria-hidden="true">›</span>
    </Link>;
}

export default function AuthPanel() {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const accountRef = useRef(null);
    const triggerRef = useRef(null);
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

    useEffect(() => {
        if (!open) return undefined;
        function outside(event) {
            if (!accountRef.current?.contains(event.target)) setOpen(false);
        }
        function escape(event) {
            if (event.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        }
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

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
        <div className="sarva-auth" ref={accountRef}>
            {user ? (
                <button
                    className="sarva-auth__avatar"
                    type="button"
                    onClick={() => setOpen((current) => !current)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    ref={triggerRef}
                >
                    {initials(user.displayName, user.email)}
                </button>
            ) : (
                <button
                    className="sarva-auth__trigger"
                    type="button"
                    onClick={() => setOpen((current) => !current)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    ref={triggerRef}
                >
                    Login
                </button>
            )}

            {open && (
                <div id={panelId} className={"sarva-auth__panel" + (user ? " sarva-auth__panel--account" : "")}>
                    {user ? (
                        <div className="sarva-auth__account">
                            <div className="sarva-accountIdentity">
                                <span className="sarva-accountIdentity__avatar" aria-hidden="true">{initials(user.displayName, user.email)}</span>
                                <div><strong>{user.displayName}</strong><span>{user.email}</span></div>
                            </div>
                            {roleLabels && <div className="sarva-accountRoles" aria-label="Your roles">{user.roles.map(role => <span key={role.name}>{role.label || role.name}</span>)}</div>}
                            <nav aria-label="Account shortcuts">
                                <p className="sarva-accountGroup">Workspace</p>
                                <AccountLink to="/testing" kind="testing" title="Issues & feedback" description="Ask a question, report a problem or follow a reply" onClick={() => setOpen(false)}/>
                                {user.roles?.some(role => role.name === 'admin') && <>
                                    <p className="sarva-accountGroup">Administration</p>
                                    <AccountLink to="/admin/users" kind="users" title="Users & roles" description="Manage accounts and permissions" onClick={() => setOpen(false)}/>
                                    <AccountLink to="/analytics" kind="analytics" title="Analytics" description="Explore visits and platform activity" onClick={() => setOpen(false)}/>
                                    <AccountLink to="/data-health" kind="health" title="Data health" description="Check services and data updates" onClick={() => setOpen(false)}/>
                                </>}
                            </nav>
                            <div className="sarva-accountFooter"><button className="sarva-accountSignOut" type="button" onClick={signOut}><AccountIcon kind="exit"/>Sign out</button></div>
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
