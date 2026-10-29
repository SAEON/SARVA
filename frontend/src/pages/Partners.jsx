import { Link } from "react-router-dom";
import "../styles/partners.css";
import saeonLogo from "../assets/logos/SAEON-NRF-LOGO-alpha.png";
import nwoLogo from "../assets/logos/NWO.svg";
import labLogo from "../assets/logos/lab_logo.png";
const wefUrl = import.meta.env.VITE_WEF_NEXUS_URL || "/wef-nexus/";
const dsLabUrl = import.meta.env.VITE_DSLAB_URL || "https://ds-lab.saeon.ac.za/";

export default function Partners() {
    return <main className="sarva-partners">
        <header className="sarva-partners__heading">
            <span>SARVA / WORKING TOGETHER</span>
            <h1>Partners &amp; Collaborators</h1>
            <p>Connecting research, shared knowledge and tools to understand risk and vulnerability in South Africa.</p>
        </header>
        <section className="sarva-partners__grid" aria-label="Collaborative projects and platforms">
            <article className="sarva-partners__card sarva-partners__card--wef">
                <div className="sarva-partners__logos" aria-label="WEF project organisations"><img src={saeonLogo} alt="NRF SAEON" /><img className="is-nwo" src={nwoLogo} alt="NWO" /></div>
                <span className="sarva-partners__tag">RESEARCH COLLABORATION</span>
                <h2>WEF+Health Nexus</h2>
                <p>Exploring spatial inequalities in water, energy and food security, their implications for public health, and the consequences of climate change in rural South Africa.</p>
                <p>Meet the team and explore the project’s work packages, articles, tools and resources.</p>
                {wefUrl ? <a className="sarva-partners__action" href={wefUrl} target="_blank" rel="noopener noreferrer">Open WEF Nexus <span aria-hidden="true">↗</span></a> : <p className="sarva-partners__pending">Project website link will be added when published.</p>}
            </article>
            <article className="sarva-partners__card">
                <div className="sarva-partners__labLogo"><img src={labLogo} alt="Environmental Data Science Lab" /></div>
                <span className="sarva-partners__tag">LEARNING &amp; TOOLS</span>
                <h2>Environmental Data Science Lab</h2>
                <p>Tutorials, prototype applications and practical environmental data science workflows from the SAEON uLwazi node.</p>
                <a className="sarva-partners__action" href={dsLabUrl} target="_blank" rel="noopener noreferrer">Open Data Science Lab <span aria-hidden="true">↗</span></a>
            </article>
        </section>
        <div className="sarva-partners__supporters" aria-label="Partner logos"><img src={saeonLogo} alt="NRF SAEON" /><img src={nwoLogo} alt="NWO" /><img src={labLogo} alt="Environmental Data Science Lab" /></div>
        <section className="sarva-partners__next"><h2>Growing our collaborations</h2><p>CGCs will be added as their project information becomes available. We are also reviewing where FDS best fits within SARVA.</p><Link to="/contact">Contact SARVA about a collaboration →</Link></section>
    </main>;
}
