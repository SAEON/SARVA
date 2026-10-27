import {Link,useLocation} from 'react-router-dom';
import '../styles/development-notice.css';

export default function SiteDisclaimer() {
  const location=useLocation();
  return <p className="sarva-siteDisclaimer">SARVA provides data, maps and model outputs for exploration and decision support. Information may be incomplete, delayed or contain errors. Screening results are not official forecasts or warnings. Verify information with the original source and follow guidance from the relevant authorities. SAEON accepts no responsibility for errors, omissions, or loss or damage arising from use of this platform or its outputs.<span className="sarva-reportIssue"><Link to="/testing" state={{reportPage:location.pathname}}>Send an issue, question or feedback about this page</Link></span></p>;
}
