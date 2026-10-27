import { Link } from "react-router-dom";
import '../styles/development-notice.css';

export default function DevelopmentNotice() {
  return <aside className="sarva-development-banner" aria-label="Experimental release warning">
    <strong>SARVA 4 - experimental release.</strong>{' '}
    This platform is undergoing review and testing until mid-November before its final release.
    {' '}Some features are not yet implemented. Features may be added, changed or removed during this process.
    {' '}Expect disruptions as development continues.
    {' '}For issues, questions or feedback, please register or sign in, then click your account icon and choose Issues &amp; feedback.
    {" "}<Link to="/privacy">Privacy &amp; analytics choices</Link>.
  </aside>;
}
