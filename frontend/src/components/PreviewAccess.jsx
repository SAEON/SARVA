import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  // Keep viewport-fixed controls outside the backdrop-filter header containing block.
  return active ? createPortal(<a className="sarva-preview-access" href="/__preview/login"><span>DEV PREVIEW</span>Access / sign out <span aria-hidden="true">↗</span></a>, document.body) : null;
}
