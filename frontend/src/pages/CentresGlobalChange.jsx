import { Link } from "react-router-dom";
import "../styles/partners.css";
import spuLogo from "../assets/cgc/spu.png";
import ufsLogo from "../assets/cgc/ufs.svg";
import ufhLogo from "../assets/cgc/ufh.svg";
import ulLogo from "../assets/cgc/ul.png";
import wsuLogo from "../assets/cgc/wsu.png";

const centres = [
    {name:"Sol Plaatje University", location:"Kimberley · Northern Cape", logo:spuLogo, text:"Research on global-change risks and vulnerabilities in arid landscapes, with postgraduate training and locally relevant research.", href:"https://www.spu.ac.za/index.php/centre-for-global-change/", action:"Visit the centre"},
    {name:"University of the Free State", location:"Qwaqwa Campus · Free State", logo:ufsLogo, text:"Research and community engagement connecting science and society, sustainable resource use and climate adaptation around Qwaqwa.", href:"https://www.ufs.ac.za/research/research/research-collaboration-and-services/centre-for-global-change", action:"Visit the centre"},
    {name:"University of Fort Hare", location:"Eastern Cape", logo:ufhLogo, text:"Global-change research and postgraduate development, supporting students to contribute knowledge and solutions for society.", href:"https://www.ufh.ac.za/news/ufhs-centre-for-global-change-champions-student-development-in-dsti-nrf-global-change-grand-challenge-research-programme", action:"Read about the centre"},
    {name:"University of Limpopo", location:"Limpopo", logo:ulLogo, text:"Global-change research and capacity building, including climate-change training through the School of Agriculture and Environmental Sciences.", href:"https://www.ul.ac.za/first-cohort-of-graduates-equipped-to-tackle-climate-change-challenges/", action:"Read about the centre"},
    {name:"Walter Sisulu University", location:"Eastern Cape", logo:wsuLogo, text:"Research and knowledge sharing on food and water security, climate change, environmental management and biodiversity for communities and municipalities.", href:"https://wsu.ac.za/en/risk-vulnerability-science-centre", action:"Visit the centre", note:"The university page retains the earlier Risk & Vulnerability Science Centre heading."},
];

export default function CentresGlobalChange() {
    return <div className="sarva-partners sarva-cgc">
        <Link className="sarva-cgc__back" to="/partners">← Partners &amp; Collaborators</Link>
        <header className="sarva-partners__heading"><span>SARVA / RESEARCH NETWORK</span><h1>Centres for Global Change</h1></header>

        <section className="sarva-cgc__intro"><h2>Research with local relevance</h2><p>The Centres for Global Change are supported through the DSTI–NRF Global Change programme. They bring together research, postgraduate training and knowledge sharing to help communities respond to environmental change.</p></section>
        <section className="sarva-cgc__grid" aria-label="The five Centres for Global Change">{centres.map(centre => <article className="sarva-partners__card sarva-cgc__centre" key={centre.name}>
            <div className="sarva-cgc__logo"><img src={centre.logo} alt={centre.name + " logo"} /></div><span className="sarva-partners__tag">{centre.location}</span><h2>{centre.name}</h2><p>{centre.text}</p>{centre.note && <p className="sarva-cgc__note">{centre.note}</p>}<a className="sarva-partners__action" href={centre.href} target="_blank" rel="noopener noreferrer">{centre.action} <span aria-hidden="true">↗</span></a>
        </article>)}</section>
        <section className="sarva-partners__next"><h2>Sources and updates</h2><p>Descriptions and university logos were checked against official university pages on 29 October 2026. This page introduces the network; it is not a complete directory of projects or staff.</p><p><a href="https://www.nrf.ac.za/core-mandate-business-divisions/riisa-directorates/strategic-science-missions-ssm/" target="_blank" rel="noopener noreferrer">NRF programme information ↗</a></p><Link to="/contact">Suggest an update or share centre information →</Link></section>
    </div>;
}
