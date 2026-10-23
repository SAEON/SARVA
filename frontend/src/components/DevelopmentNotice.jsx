import '../styles/development-notice.css';

export default function DevelopmentNotice() {
  return <aside className="sarva-development-banner" aria-label="Development notice">
    <strong>Development and testing in progress.</strong>{' '}
    Features and data may change or be temporarily unavailable. Please report any issues.
  </aside>;
}
