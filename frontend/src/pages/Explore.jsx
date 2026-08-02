import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/explore.css";

const primaryPaths = [
    {
        label: "Explore by place",
        title: "Municipal profiles",
        detail: "Search or click a municipality to view risk scores, drivers, finance and governance indicators, source values and gaps.",
        to: "/municipal-risk-profiler",
        status: "Live",
    },
    {
        label: "Explore by map",
        title: "Atlas overview",
        detail: "Open the national map workspace for live highlights, forecast context and SARVA spatial layers.",
        to: "/#risk-map",
        status: "Live",
    },
    {
        label: "Explore by data",
        title: "SAEON catalogue search",
        detail: "Search mirrored SAEON records, providers, collections and essential-variable metadata.",
        to: "/search?ev=ecv",
        status: "Live",
    },
    {
        label: "Explore by learning",
        title: "Data Science Lab",
        detail: "Tutorials, prototype apps, learning pathways and practical SARVA data-science workflows.",
        to: "/resources?search=data%20science%20lab",
        status: "Starting point",
    },
];

const atlasTools = [
    {
        group: "Atlas gallery",
        title: "All SARVA atlas apps",
        detail: "Open the SARVA GIS applications gallery and choose from the available themed atlas tools.",
        href: "https://sarva.saeon.ac.za/atlas/",
    },
    {
        group: "Agriculture",
        title: "2017 Agriculture Census",
        detail: "Commercial agriculture census map with production, finance, land-use and operator context.",
        href: "https://sarvamaps.saeon.ac.za/agri-census/",
    },
    {
        group: "Climate",
        title: "Climate Risk Tool",
        detail: "Interactive climate risk decision-support mapping from the SARVA atlas collection.",
        href: "https://sarvamaps.saeon.ac.za/climate-tool/",
    },
    {
        group: "Vulnerability",
        title: "Environmental Vulnerability",
        detail: "Spatial environmental vulnerability layers for screening ecological and landscape risk.",
        href: "https://sarvamaps.saeon.ac.za/sanbi/",
    },
    {
        group: "Air quality",
        title: "Air Quality (PM2.5) Predictions",
        detail: "Daily PM2.5 prediction maps for African cities and regions.",
        href: "https://sarvamaps.saeon.ac.za/air-quality/",
    },
    {
        group: "Bioenergy",
        title: "BioEnergy Technology Decision Support Tool",
        detail: "Regional decision-support dashboard for feasible bioenergy options and contextual layers.",
        href: "https://nrf-saeon.maps.arcgis.com/apps/dashboards/55aab230007f4712b62100988d182d2c",
    },
    {
        group: "Disasters",
        title: "Global Disasters Risk Dashboard",
        detail: "Disaster risk dashboard from the SARVA atlas collection.",
        href: "https://sarvamaps.saeon.ac.za/global-disasters/map",
    },
    {
        group: "Health",
        title: "HST District Health Barometer",
        detail: "District health indicator dashboard for public-health context.",
        href: "https://dhb.hst.org.za/reproductive-maternal-child-health",
    },
    {
        group: "Climate data",
        title: "National Climate Change Information System",
        detail: "National climate change information and reporting portal.",
        href: "https://gisportal.saeon.ac.za/portal/apps/webappviewer/index.html?id=2d572dcf9c5f47c484540f8c934e03f4",
    },
    {
        group: "Ocean",
        title: "Ocean Data Explorer Tool",
        detail: "Ocean and coastal data explorer from the SAEON dashboard environment.",
        href: "https://dash.saeon.ac.za/apps/ocean/PELTER",
    },
];

const questionPaths = [
    {
        question: "What risks are highest in a municipality?",
        action: "Open municipal risk profiles",
        to: "/municipal-risk-profiler",
        state: "live",
    },
    {
        question: "What datasets and services are available?",
        action: "Search the catalogue",
        to: "/search?theme=risk",
        state: "live",
    },
    {
        question: "What reports and tools support this work?",
        action: "Browse resources",
        to: "/resources",
        state: "live",
    },
    {
        question: "What policies and legislation are relevant?",
        action: "Open policy library",
        to: "/national-policy-and-legislation",
        state: "live",
    },
    {
        question: "What does this term mean?",
        action: "Search glossary",
        to: "/glossary",
        state: "live",
    },
    {
        question: "Where are data gaps affecting the score?",
        action: "Gap dashboard coming soon",
        state: "planned",
    },
    {
        question: "How do scenarios change the risk picture?",
        action: "Scenario comparison coming soon",
        state: "planned",
    },
    {
        question: "How was an index built?",
        action: "Lab walkthroughs coming soon",
        to: "/resources?search=data%20science%20lab",
        state: "planned-link",
    },
];

const themeLinks = [
    ["Governance and finance", "/municipal-risk-profiler?metric=governance&tab=indicators&theme=Governance"],
    ["Audit and compliance", "/municipal-risk-profiler?metric=governance_audit&tab=indicators&theme=Governance%20-%20audit%20and%20compliance"],
    ["Safety and crime", "/municipal-risk-profiler?metric=safety&tab=indicators&theme=Safety"],
    ["Basic services", "/municipal-risk-profiler?metric=services&tab=indicators&theme=Basic%20services"],
    ["Exposure and vulnerability", "/municipal-risk-profiler?metric=people&tab=indicators&theme=Social%20vulnerability"],
    ["Climate and hazards", "/#risk-map"],
    ["Observation data", "/search?singleSitesOnly=true"],
    ["Essential climate variables", "/search?ev=ecv"],
    ["Essential biodiversity variables", "/search?ev=ebv"],
    ["Reports and evidence", "/resources?resource_group=reports_stories"],
    ["Training and methods", "/resources?search=training"],
];

function ActionLink({ item, className = "" }) {
    if (item.state === "planned") {
        return (
            <span className={`sarva-explore__disabled ${className}`.trim()} aria-disabled="true">
                {item.action}
            </span>
        );
    }
    return (
        <Link className={className} to={item.to}>
            {item.action || item.title}
        </Link>
    );
}

export default function Explore() {
    const location = useLocation();

    useEffect(() => {
        if (!location.hash) return;
        const target = document.getElementById(location.hash.slice(1));
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [location.hash]);

    return (
        <div className="sarva-explore">
            <section className="sarva-explore__intro">
                <div>
                    <span>Explore SARVA</span>
                    <h1>Find the right place, layer, dataset or tool.</h1>
                    <p>
                        A guided entry point for moving between maps, municipal risk profiles,
                        catalogue records, resources and learning material.
                    </p>
                </div>
                <div className="sarva-explore__quickSearch">
                    <strong>Start with search</strong>
                    <p>Use the global search for catalogue records, or jump straight to the municipal profiler for place-based risk.</p>
                    <div>
                        <Link to="/search">Search catalogue</Link>
                        <Link to="/municipal-risk-profiler">Find municipality</Link>
                    </div>
                </div>
            </section>

            <section className="sarva-explore__pathGrid" aria-label="Explore pathways">
                {primaryPaths.map((path) => (
                    <article key={path.title}>
                        <small>{path.label}</small>
                        <h2>{path.title}</h2>
                        <p>{path.detail}</p>
                        <div>
                            <span>{path.status}</span>
                            <Link to={path.to}>Open</Link>
                        </div>
                    </article>
                ))}
            </section>

            <section className="sarva-explore__section" id="atlas-tools">
                <div className="sarva-explore__sectionHead">
                    <h2>Interactive Atlas Tools</h2>
                    <span>direct map apps</span>
                </div>
                <div className="sarva-explore__atlasGrid">
                    {atlasTools.map((tool) => (
                        <a key={tool.title} href={tool.href} target="_blank" rel="noopener noreferrer">
                            <small>{tool.group}</small>
                            <strong>{tool.title}</strong>
                            <span>{tool.detail}</span>
                        </a>
                    ))}
                </div>
            </section>

            <section className="sarva-explore__section" id="themes">
                <div className="sarva-explore__sectionHead">
                    <h2>Explore By Question</h2>
                    <span>live links and planned tools</span>
                </div>
                <div className="sarva-explore__questionGrid">
                    {questionPaths.map((item) => (
                        <article key={item.question} className={`is-${item.state}`}>
                            <strong>{item.question}</strong>
                            <ActionLink item={item} />
                        </article>
                    ))}
                </div>
            </section>

            <section className="sarva-explore__section">
                <div className="sarva-explore__sectionHead">
                    <h2>Explore By Theme</h2>
                    <span>starting points</span>
                </div>
                <div className="sarva-explore__themeGrid">
                    {themeLinks.map(([label, to]) => (
                        <Link key={label} to={to}>
                            {label}
                        </Link>
                    ))}
                </div>
            </section>

            <section className="sarva-explore__labBand">
                <div>
                    <small>Learning hub</small>
                    <h2>Environmental Data Science Lab</h2>
                    <p>
                        SARVA tutorials, prototype apps, reproducible workflows and short notes will live here as the lab grows.
                    </p>
                </div>
                <Link to="/resources?search=data%20science%20lab">Open lab resources</Link>
            </section>
        </div>
    );
}
