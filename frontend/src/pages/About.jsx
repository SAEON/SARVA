import { Link } from "react-router-dom";
import "../styles/about.css";

const pillars = [
    {
        title: "Findable data",
        body: "Search SAEON catalogue records, SARVA resources, observation feeds and supporting environmental products from a single place.",
    },
    {
        title: "Decision support",
        body: "Use maps, dashboards, indicators and briefings that connect hazards with exposure, vulnerability and response context.",
    },
    {
        title: "Open collaboration",
        body: "SARVA depends on shared data, open standards and partner knowledge across research, government and civil society.",
    },
];

const definitions = [
    {
        term: "Hazard",
        body: "A potentially damaging event, trend or physical condition such as drought, flood, heat, fire weather, biodiversity loss or disease outbreak.",
    },
    {
        term: "Exposure",
        body: "People, ecosystems, infrastructure, livelihoods, services and assets located where they may be affected.",
    },
    {
        term: "Vulnerability",
        body: "The sensitivity of exposed systems and their capacity to anticipate, cope, adapt and recover.",
    },
    {
        term: "Risk",
        body: "The likelihood of adverse impacts emerging from the interaction of hazards, exposure and vulnerability.",
    },
];

const frameworkLinks = [
    {
        group: "Risk frameworks",
        links: [
            {
                title: "Sendai Framework for Disaster Risk Reduction",
                href: "https://www.undrr.org/publication/sendai-framework-disaster-risk-reduction-2015-2030",
                detail: "UNDRR framework for understanding disaster risk, strengthening governance, investing in resilience and improving preparedness.",
            },
            {
                title: "IPCC AR6: Impacts, Adaptation and Vulnerability",
                href: "https://www.ipcc.ch/report/ar6/wg2/",
                detail: "Climate risk, vulnerability, adaptation limits and decision-making context, including the Africa chapter.",
            },
        ],
    },
    {
        group: "Data principles",
        links: [
            {
                title: "FAIR Principles",
                href: "https://www.go-fair.org/fair-principles/",
                detail: "Findable, accessible, interoperable and reusable data principles used across research data systems.",
            },
            {
                title: "CARE Principles for Indigenous Data Governance",
                href: "https://www.gida-global.org/care",
                detail: "Collective benefit, authority to control, responsibility and ethics for people- and community-centred data governance.",
            },
            {
                title: "Open Data Charter Principles",
                href: "https://opendatacharter.org/principles/",
                detail: "Open by default, timely, accessible, comparable, governance-focused and innovation-enabling public data.",
            },
        ],
    },
    {
        group: "Essential variables",
        links: [
            {
                title: "Essential Climate Variables",
                href: "https://gcos.wmo.int/site/global-climate-observing-system-gcos/essential-climate-variables",
                detail: "GCOS climate-observation variables across atmosphere, ocean and terrestrial domains.",
            },
            {
                title: "Essential Biodiversity Variables",
                href: "https://geobon.org/ebvs/what-are-ebvs/",
                detail: "GEO BON biological measurements for tracking biodiversity change across time, space and biological levels.",
            },
            {
                title: "Essential Ocean Variables",
                href: "https://goosocean.org/what-we-do/framework/essential-ocean-variables/",
                detail: "GOOS ocean observing variables for physics, biogeochemistry, biology and ecosystems.",
            },
        ],
    },
];

export default function About() {
    return (
        <div className="sarva-aboutPage">
            <section className="sarva-aboutPage__hero">
                <div>
                    <span>SARVA version 4</span>
                    <h1>South African Risk & Vulnerability Atlas</h1>
                    <p>
                        SARVA is an open science platform for discovering, connecting and using environmental risk and
                        vulnerability information for South Africa.
                    </p>
                    <div className="sarva-aboutPage__actions">
                        <Link to="/search">Search SAEON data</Link>
                        <Link to="/resources">Open resources</Link>
                    </div>
                </div>
                <aside aria-label="SARVA at a glance">
                    <strong>Open by design</strong>
                    <p>
                        Version 4 brings the atlas into a more integrated web platform: live map layers, smart catalogue
                        search, curated reports and stories, supporting data links, monitoring updates and admin tools
                        for keeping resources current.
                    </p>
                </aside>
            </section>

            <section className="sarva-aboutPage__section">
                <div className="sarva-aboutPage__eyebrow">Purpose</div>
                <div className="sarva-aboutPage__copy">
                    <h2>Built for risk-aware decisions</h2>
                    <p>
                        The South African Risk and Vulnerability Atlas provides access to decision-ready data,
                        dashboards, maps, indicators, reports and source links covering natural and human-driven hazards.
                        It helps municipalities, researchers, government departments, practitioners and communities
                        understand changing risk and vulnerability conditions.
                    </p>
                    <p>
                        SARVA combines spatial and non-spatial information from many organisations, including data on
                        climate, land cover, biodiversity, settlement patterns, infrastructure, health, poverty,
                        drought, water stress and disaster resilience. The atlas is a living product: records, links and
                        supporting data are updated as new information becomes available.
                    </p>
                </div>
            </section>

            <section className="sarva-aboutPage__pillars" aria-label="SARVA version 4 priorities">
                {pillars.map((pillar) => (
                    <article key={pillar.title}>
                        <h2>{pillar.title}</h2>
                        <p>{pillar.body}</p>
                    </article>
                ))}
            </section>

            <section className="sarva-aboutPage__section">
                <div className="sarva-aboutPage__eyebrow">Open access</div>
                <div className="sarva-aboutPage__copy">
                    <h2>FAIR data, maintained infrastructure</h2>
                    <p>
                        SARVA is implemented by the South African Environmental Observation Network, with data systems
                        and products supported through SAEON's uLwazi capability. The platform supports the publication,
                        discovery, dissemination and visualisation of global-change data using open access and FAIR data
                        principles: findable, accessible, interoperable and reusable.
                    </p>
                    <p>
                        The platform relies on collaboration and data sharing from institutions and organisations across
                        South Africa. Version 4 strengthens that model with clearer catalogue routes, resource link
                        checks, supporting data cards and routes for submitting or curating data.
                    </p>
                </div>
            </section>

            <section className="sarva-aboutPage__frameworks">
                <div>
                    <span>Frameworks and principles</span>
                    <h2>Reference points behind the atlas</h2>
                    <p>
                        SARVA v4 is organised around risk, open data and environmental observation frameworks that help
                        make catalogue records, live layers and resource links more comparable and easier to reuse.
                    </p>
                </div>
                <div className="sarva-aboutPage__frameworkGrid">
                    {frameworkLinks.map((group) => (
                        <article key={group.group}>
                            <h3>{group.group}</h3>
                            <div>
                                {group.links.map((item) => (
                                    <a href={item.href} key={item.title} target="_blank" rel="noopener noreferrer">
                                        <strong>{item.title}</strong>
                                        <small>{item.detail}</small>
                                        <em>Open framework</em>
                                    </a>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="sarva-aboutPage__risk">
                <div>
                    <span>Understanding risk and vulnerability</span>
                    <h2>Risk is produced by interaction, not one layer alone.</h2>
                    <p>
                        SARVA treats risk as a relationship between hazards, exposure and vulnerability. This makes the
                        atlas useful for adaptation planning, disaster risk reduction, environmental management and
                        public-interest decision support.
                    </p>
                </div>
                <div className="sarva-aboutPage__definitions">
                    {definitions.map((item) => (
                        <article key={item.term}>
                            <strong>{item.term}</strong>
                            <p>{item.body}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="sarva-aboutPage__section">
                <div className="sarva-aboutPage__eyebrow">Team</div>
                <div className="sarva-aboutPage__copy">
                    <h2>Implemented by SAEON</h2>
                    <p>
                        SAEON leads and implements SARVA with expertise in environmental observation, climate and global
                        change data, geospatial analysis, data curation, decision-support tools, systems development and
                        stakeholder engagement.
                    </p>
                    <p className="sarva-aboutPage__citation">
                        CITATION: Keebine, G., Pienaar, M., Mfopu, C., Jiyane, S., and Chilaone, L.
                        2026. South African Risk and Vulnerability Atlas. Version 4. Pretoria: SAEON.
                        Version 3 contributors: Davis-Reddy, C.L., Hilgart, A., Hlanane, K.,
                        Pienaar, M., Wilson, H., and Chiloane, L. 2020. Available at sarva.saeon.ac.za.
                    </p>
                </div>
            </section>
        </div>
    );
}
