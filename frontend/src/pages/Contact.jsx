import {Link} from 'react-router-dom';
import '../styles/user-admin.css';
export default function Contact(){
 return <div className="user-admin"><header className="ua-heading"><div><span className="ua-eyebrow">SARVA / CONTACT</span><h1>Contact SARVA</h1><p>Questions, issues and feedback about SARVA.</p></div></header>
 <section className="ua-panel"><h2>Please use Issues &amp; feedback first</h2><p>Please register or sign in, then click your user icon in the header and choose <strong>Issues &amp; feedback</strong>. You can send a report or question and follow administrator replies in the same thread.</p><p><Link className="ua-primary" to="/testing">Open Issues &amp; feedback</Link></p><p>If you do not have an account, use <strong>Login</strong> in the header to register.</p></section>
 <section className="ua-panel"><h2>Email</h2><p>For enquiries that cannot be handled through the website, email <a href="mailto:datascience@saeon.nrf.ac.za">datascience@saeon.nrf.ac.za</a>.</p></section></div>;
}
