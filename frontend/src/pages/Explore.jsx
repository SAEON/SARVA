import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/explore.css";

const DATA_SCIENCE_LAB_URL = import.meta.env.VITE_DSLAB_URL || "https://ds-lab.saeon.ac.za/";

const primaryPaths = [
    {
        label: "Explore by place",
        title: "Municipal profiles",
        detail: "Search or click a municipality to view risk scores, drivers, finance and governance indicators, source values and gaps.",
        to: "/municipal-risk-profiler",
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
        href: DATA_SCIENCE_LAB_URL,
        status: "Live",
    },
];

const atlasTools = [
    {
        group: "Climate data",
        title: "National Climate Change Information System",
        detail: "National climate change information and reporting portal.",
        href: "https://nccis.saeon.ac.za/",
    },
    {
        group: "Climate data",
        title: "Free State Climate Information System",
        detail: "Climate information portal for the Free State.",
        href: "https://fsccis.saeon.ac.za/",
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
        group: "Bioenergy",
        title: "BioEnergy Atlas",
        detail: "Explore South African bioenergy information and spatial resources.",
        href: "https://bea.saeon.ac.za/",
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
        group: "Observations",
        title: "SAEON Observations Monitor",
        detail: "Explore SAEON observation sites and monitoring information.",
        href: "https://observationsmonitor.saeon.ac.za/home",
    },
    {
        group: "Observations",
        title: "SAEON Observations Database",
        detail: "Access the SAEON observations database.",
        href: "https://observations.saeon.ac.za/",
    },
    {
        group: "SAEON services",
        title: "SAEON uLwazi",
        detail: "Visit the SAEON uLwazi website for information about its work and services.",
        href: "https://ulwazi.saeon.ac.za/",
    },
    {
        group: "About SAEON",
        title: "SAEON website",
        detail: "Learn about SAEON, its observation network, research and activities.",
        href: "https://www.saeon.ac.za/",
    },
];

const questionPaths = [
    { question: "What source data are available for a municipality?", action: "Browse municipal profiles", to: "/municipal-risk-profiler?metric=indicator:population_total", state: "live" },
    { question: "How do municipal finances compare?", action: "Compare operating margins", to: "/municipal-risk-profiler?metric=indicator:finance_operating_margin_pressure", state: "live" },
    { question: "Where can I compare audit-related expenditure?", action: "View UIFW expenditure to revenue", to: "/municipal-risk-profiler?metric=indicator:governance_uifw_to_revenue", state: "live" },
    { question: "Where can I compare recorded crime?", action: "View recorded murder counts", to: "/municipal-risk-profiler?metric=indicator:crime_murder", state: "live" },
    { question: "How does access to basic services compare?", action: "View piped-water access", to: "/municipal-risk-profiler?metric=indicator:pct_piped_water_dwelling", state: "live" },
    { question: "What is the population and household context?", action: "View population data", to: "/municipal-risk-profiler?metric=indicator:population_total", state: "live" },
    { question: "What datasets and services are available?", action: "Search the catalogue", to: "/search", state: "live" },
    { question: "Where can I find observation data?", action: "Find observation datasets", to: "/search?singleSitesOnly=true", state: "live" },
    { question: "Where can I find essential climate variables?", action: "Search climate variables", to: "/search?ev=ecv", state: "live" },
    { question: "Where can I find essential biodiversity variables?", action: "Search biodiversity variables", to: "/search?ev=ebv", state: "live" },
    { question: "What reports and tools support this work?", action: "Browse resources and evidence", to: "/resources", state: "live" },
    { question: "Where can I find tutorials and practical methods?", action: "Open Data Science Lab", href: DATA_SCIENCE_LAB_URL, state: "live" },
    { question: "What policies and legislation are relevant?", action: "Open policy library", to: "/national-policy-and-legislation", state: "live" },
    { question: "What does this term mean?", action: "Search glossary", to: "/glossary", state: "live" },
];

function ActionLink({ item, className = "" }) {
    if (item.state === "planned") {
        return (
            <span className={`sarva-explore__disabled ${className}`.trim()} aria-disabled="true">
                {item.action}
            </span>
        );
    }
    if (item.href) return <a className={className} href={item.href} target="_blank" rel="noopener noreferrer">{item.action} ↗</a>;
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
                            {path.href ? <a href={path.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${path.title} (new tab)`}>Open ↗</a> : <Link to={path.to}>Open</Link>}
                        </div>
                    </article>
                ))}
            </section>

            <section className="sarva-explore__section" id="atlas-tools">
                <div className="sarva-explore__sectionHead">
                    <h2>Interactive atlases, tools and links</h2>
                    <span>Maps, applications and information portals</span>
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
                    <span>Choose a question to open the relevant data or tool</span>
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


        </div>
    );
}
