import { useEffect, useState } from 'react';
import '../styles/preview-access.css';

export default function PreviewAccess() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/__preview/status', { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok && response.headers.get('content-type')?.includes('application/json') ? response.json() : null)
      .then(status => setActive(Boolean(status?.enabled && status.authenticated)))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return active ? <a className="sarva-preview-access" href="/__preview/login"><span>DEV PREVIEW</span>Access / sign out <span aria-hidden="true">↗</span></a> : null;
}
