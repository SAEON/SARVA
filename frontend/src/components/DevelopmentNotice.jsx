import AutomaticUpdate from "./AutomaticUpdate";
import { Link } from "react-router-dom";
import '../styles/development-notice.css';

export default function DevelopmentNotice() {
  return <aside className="sarva-development-banner" aria-label="Experimental release warning">
    <div className="sarva-development-banner__text"><strong>SARVA 4 - experimental release.</strong>{' '}
    Under review and testing until mid-November. Some features are not yet implemented and may change; disruptions may occur.
    {' '}For questions or feedback, sign in and choose Issues &amp; feedback from your account menu.
    {" "}<Link to="/privacy">Privacy &amp; analytics choices</Link>.</div>
    <AutomaticUpdate />
  </aside>;
}
