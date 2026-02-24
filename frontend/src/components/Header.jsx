import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import logo from "../assets/SARVA_final-logo-01a.png";
import "../styles/header.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export default function Header() {
    const [openKey, setOpenKey] = useState(null);
    const [nav, setNav] = useState([]);
    const [loading, setLoading] = useState(true);

    const rootRef = useRef(null);
    const location = useLocation();

    // Fetch nav from API
    useEffect(() => {
        let isMounted = true;

        async function loadNav() {
            try {
                setLoading(true);
                const r = await fetch(`${API_BASE}/api/nav`);
                const j = await r.json();
                if (!isMounted) return;

                if (j?.status === "ok" && Array.isArray(j.data)) {
                    setNav(j.data);
                } else {
                    console.warn("Unexpected /api/nav response:", j);
                    setNav([]);
                }
            } catch (e) {
                console.error("Failed to load nav:", e);
                if (isMounted) setNav([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadNav();
        return () => {
            isMounted = false;
        };
    }, []);

    // Close dropdown on route change
    useEffect(() => {
        setOpenKey(null);
    }, [location.pathname]);

    // Close on outside click
    useEffect(() => {
        function onDocMouseDown(e) {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target)) setOpenKey(null);
        }
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    // Close on ESC
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === "Escape") setOpenKey(null);
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <header className="sarva-header" ref={rootRef}>
            <div className="sarva-header__inner">
                <div className="sarva-brand">
                    <NavLink to="/" className="sarva-logoLink" aria-label="SARVA Home">
                        <div className="sarva-logoCircle">
                            <img src={logo} alt="SARVA" className="sarva-logoImg" />
                        </div>
                    </NavLink>
                </div>

                <nav className="sarva-nav" aria-label="Primary">
                    {loading && nav.length === 0 ? (
                        <span className="sarva-nav__loading">Loading…</span>
                    ) : (
                        nav.map((item) => {
                            const hasDropdown = Array.isArray(item.items) && item.items.length > 0;

                            if (!hasDropdown) {
                                // Simple top-level link (e.g., Home)
                                const to = item.to || "/";
                                return (
                                    <NavLink
                                        key={item.label}
                                        to={to}
                                        end={to === "/"}
                                        className={({ isActive }) =>
                                            "sarva-nav__link" + (isActive ? " is-active" : "")
                                        }
                                    >
                                        {item.label}
                                    </NavLink>
                                );
                            }

                            // Dropdown
                            return (
                                <div key={item.label} className="sarva-nav__dropdown">
                                    <button
                                        className={
                                            "sarva-nav__link sarva-nav__button" +
                                            (openKey === item.label ? " is-open" : "")
                                        }
                                        type="button"
                                        aria-haspopup="menu"
                                        aria-expanded={openKey === item.label}
                                        onClick={() =>
                                            setOpenKey((cur) => (cur === item.label ? null : item.label))
                                        }
                                    >
                                        {item.label}
                                        <span className="sarva-nav__chev" aria-hidden="true">
                      ▾
                    </span>
                                    </button>

                                    <div
                                        className={
                                            "sarva-nav__menu" + (openKey === item.label ? " is-open" : "")
                                        }
                                        role="menu"
                                    >
                                        {item.items.map((sub) => {
                                            // Normalise accidental whitespace in DB values
                                            const href = sub.href ? String(sub.href).trim() : null;
                                            const to = sub.to ? String(sub.to).trim() : null;

                                            return sub.external ? (
                                                <a
                                                    key={href || sub.label}
                                                    href={href || "#"}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="sarva-nav__item"
                                                    role="menuitem"
                                                >
                                                    {sub.label}
                                                </a>
                                            ) : (
                                                <NavLink
                                                    key={to || sub.label}
                                                    to={to || "/"}
                                                    className="sarva-nav__item"
                                                    role="menuitem"
                                                >
                                                    {sub.label}
                                                </NavLink>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </nav>

                <button className="sarva-search" type="button" aria-label="Search">
                    ⌕
                </button>
            </div>
        </header>
    );
}