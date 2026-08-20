import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logo from "../assets/SARVA_final-logo-01a.png";
import AuthPanel from "./AuthPanel";
import { apiUrl } from "../config/api";
import { useJsonResource } from "../hooks/useJsonResource";
import "../styles/header.css";

const DATA_SCIENCE_LAB_URL = import.meta.env.VITE_DSLAB_URL || "/ds-lab/";

const fallbackNav = [
    { label: "Home", to: "/" },
    {
        label: "Explore",
        items: [
            { label: "Explore SARVA", to: "/explore" },
            { label: "Explore South Africa", to: "/#risk-map" },
            { label: "Environmental Themes", to: "/explore#themes" },
            { label: "Risk & Vulnerability Layers", to: "/municipal-risk-profiler?metric=governance&tab=drivers" },
            { label: "Dashboards & Indicators", to: "/municipal-risk-profiler?tab=indicators" },
        ],
    },
    {
        label: "Data",
        items: [
            { label: "Search SAEON Data", to: "/search" },
            { label: "Supporting Data", to: "/?supportingData=true" },
            { label: "Submit Data", href: "https://docs.google.com/forms/d/1bxnefRblVoQ8hpJJx_KL1nzeZHQfEK-QKVCxoPIXnAU/viewform?edit_requested=true", external: true },
            { label: "Terrestrial Observations Monitor", href: "https://observationsmonitor.saeon.ac.za", external: true },
        ],
    },
    {
        label: "Maps & Tools",
        items: [
            { label: "Municipal Risk Profiler", to: "/municipal-risk-profiler" },
            { label: "Rainfall Risk Layers", to: "/#risk-map" },
            { label: "SARVA Atlas Gallery", href: "https://sarva.saeon.ac.za/atlas/", external: true },
            { label: "2017 Agriculture Census", href: "https://sarvamaps.saeon.ac.za/agri-census/", external: true },
            { label: "Climate Risk Tool", href: "https://sarvamaps.saeon.ac.za/climate-tool/", external: true },
            { label: "Environmental Vulnerability", href: "https://sarvamaps.saeon.ac.za/sanbi/", external: true },
            { label: "Air Quality (PM2.5) Predictions", href: "https://sarvamaps.saeon.ac.za/air-quality/", external: true },
            { label: "BioEnergy Technology Decision Support Tool", href: "https://nrf-saeon.maps.arcgis.com/apps/dashboards/55aab230007f4712b62100988d182d2c", external: true },
            { label: "Global Disasters Risk Dashboard", href: "https://sarvamaps.saeon.ac.za/global-disasters/map", external: true },
            { label: "HST District Health Barometer", href: "https://dhb.hst.org.za/reproductive-maternal-child-health", external: true },
            { label: "National Climate Change Information System", href: "https://gisportal.saeon.ac.za/portal/apps/webappviewer/index.html?id=2d572dcf9c5f47c484540f8c934e03f4", external: true },
            { label: "Ocean Data Explorer Tool", href: "https://dash.saeon.ac.za/apps/ocean/PELTER", external: true },
        ],
    },
    {
        label: "Resources",
        items: [
            { label: "Search Glossary", to: "/glossary" },
            { label: "Relevant Documents", to: "/resources" },
            { label: "National Policy & Legislation", to: "/national-policy-and-legislation" },
            { label: "Reports & Stories", to: "/resources?resource_group=reports_stories" },
        ],
    },
    {
        label: "Community",
        items: [
            { label: "Help & Training", to: "/resources?search=training" },
            { label: "Data Science Lab", href: DATA_SCIENCE_LAB_URL, external: true },
            { label: "Contribute Data", href: "https://docs.google.com/forms/d/1bxnefRblVoQ8hpJJx_KL1nzeZHQfEK-QKVCxoPIXnAU/viewform?edit_requested=true", external: true },
            { label: "Communities of Practice", to: "/about" },
            { label: "Contact SARVA", to: "/about" },
        ],
    },
    {
        label: "About",
        items: [
            { label: "About SARVA", to: "/about" },
            { label: "Partners", to: "/about" },
            { label: "Governance", to: "/about" },
            { label: "API & Developers", href: "https://github.com/SAEON", external: true },
        ],
    },
];

export default function Header() {
    const location = useLocation();
    const navigate = useNavigate();
    const [openDropdown, setOpenDropdown] = useState({
        key: null,
        pathname: location.pathname,
    });
    const [searchText, setSearchText] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const rootRef = useRef(null);
    const {
        data: navResponse,
        error: navError,
        loading,
    } = useJsonResource("/api/nav", { cache: true });

    const nav = useMemo(() => {
        if (navResponse?.status === "ok" && Array.isArray(navResponse.data)) {
            return navResponse.data;
        }

        return fallbackNav;
    }, [navResponse]);
    const openKey = openDropdown.pathname === location.pathname ? openDropdown.key : null;

    const setOpenKey = useCallback((nextKey) => {
        setOpenDropdown({ key: nextKey, pathname: location.pathname });
    }, [location.pathname]);

    const toggleOpenKey = useCallback((key) => {
        setOpenDropdown((current) => ({
            key:
                current.pathname === location.pathname && current.key === key
                    ? null
                    : key,
            pathname: location.pathname,
        }));
    }, [location.pathname]);

    useEffect(() => {
        if (navError) console.error("Failed to load nav:", navError);
    }, [navError]);

    useEffect(() => {
        const query = searchText.trim();
        if (query.length < 2) {
            return undefined;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(apiUrl(`/api/catalogue/suggest?q=${encodeURIComponent(query)}`), {
                    signal: controller.signal,
                });
                const body = await response.json();
                if (body?.status === "ok" && Array.isArray(body.suggestions)) {
                    setSuggestions(body.suggestions);
                    setSuggestionsOpen(true);
                }
            } catch (error) {
                if (error.name !== "AbortError") setSuggestions([]);
            }
        }, 180);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [searchText]);

    function submitSearch(event) {
        event.preventDefault();
        const query = searchText.trim();
        if (!query) {
            navigate("/search");
            return;
        }
        setSuggestionsOpen(false);
        navigate(`/search?q=${encodeURIComponent(query)}`);
    }

    function openSuggestion(suggestion) {
        const label = String(suggestion?.label || "").trim();
        if (!label) return;

        setSearchText(label);
        setSuggestionsOpen(false);

        const params = new URLSearchParams();
        if (suggestion.type === "collection") {
            params.set("collection", label);
        } else if (suggestion.type === "provider") {
            params.set("provider", label);
        } else if (suggestion.type === "framework" && suggestion.id) {
            params.set("q", String(suggestion.id).toUpperCase());
        } else {
            params.set("q", label);
        }
        navigate(`/search?${params.toString()}`);
    }

    // Close on outside click
    useEffect(() => {
        function onDocMouseDown(e) {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target)) {
                setOpenKey(null);
                setSuggestionsOpen(false);
            }
        }
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, [setOpenKey]);

    // Close on ESC
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === "Escape") {
                setOpenKey(null);
                setSuggestionsOpen(false);
            }
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [setOpenKey]);

    return (
        <header className="sarva-header" ref={rootRef}>
            <div className="sarva-header__inner">
                <div className="sarva-brand">
                    <NavLink to="/" className="sarva-logoLink" aria-label="SARVA Home">
                        <div className="sarva-logoCircle">
                            <img src={logo} alt="SARVA" className="sarva-logoImg" />
                        </div>
                        <span className="sarva-wordmark">
                            <strong>SARVA</strong>
                            <small>Risk & Vulnerability Atlas</small>
                        </span>
                    </NavLink>
                </div>

                <form className="sarva-headerSearch" onSubmit={submitSearch} role="search">
                    <input
                        type="search"
                        value={searchText}
                        onChange={(event) => {
                            const value = event.target.value;
                            setSearchText(value);
                            if (value.trim().length < 2) setSuggestionsOpen(false);
                        }}
                        onFocus={() => setSuggestionsOpen(suggestions.length > 0)}
                        placeholder="Search catalogue, maps, indicators..."
                        aria-label="Search SARVA"
                    />
                    <button type="submit" aria-label="Search">
                        ⌕
                    </button>
                    {suggestionsOpen && suggestions.length > 0 && (
                        <div className="sarva-headerSearch__suggestions">
                            {suggestions.map((suggestion) => (
                                <button
                                    key={`${suggestion.type}-${suggestion.label}`}
                                    type="button"
                                    onClick={() => openSuggestion(suggestion)}
                                >
                                    <strong>{suggestion.label}</strong>
                                    <span>{suggestion.detail || suggestion.type}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </form>

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
                                <div
                                    key={item.label}
                                    className="sarva-nav__dropdown"
                                >
                                    <button
                                        className={
                                            "sarva-nav__link sarva-nav__button" +
                                            (openKey === item.label ? " is-open" : "")
                                        }
                                        type="button"
                                        aria-haspopup="menu"
                                        aria-expanded={openKey === item.label}
                                        onClick={() => toggleOpenKey(item.label)}
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
                                        onClick={() => setOpenKey(null)}
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

                <AuthPanel />
            </div>
        </header>
    );
}
