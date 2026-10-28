import {Navigate} from 'react-router-dom';

// Preserve older bookmarks without displaying an internal health-check payload.
export default function Overview() {
    return <Navigate to="/#risk-map" replace />;
}
