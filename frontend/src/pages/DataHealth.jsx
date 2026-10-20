import { useEffect, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthPanel from '../components/AuthPanel';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiUrl } from '../config/api';
import '../styles/data-health.css';

const labels = { healthy: 'Available', attention: 'Needs attention', stale: 'Stale', unavailable: 'Unavailable', unconfigured: 'Not configured', unknown: 'Not checked', syncing: 'Sync in progress', empty: 'No stored data' };
const actionStates = ['attention', 'stale', 'unavailable', 'unconfigured', 'empty'];
const date = value => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' }) + ' SAST'
  : 'Not recorded';

function HealthDashboard({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl('/api/data-health'), { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Could not load data health');
        return body.data;
      }).then(body => { setData(body); setError(''); })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, revision]);
  const needsAction = data?.cards.filter(card => actionStates.includes(card.status)).length || 0;
  const unverified = data ? data.counts.unknown + data.counts.syncing : 0;
  const headline = !data
    ? error ? 'Health checks unavailable' : 'Checking your data services'
    : needsAction ? `${needsAction} ${needsAction === 1 ? 'check needs' : 'checks need'} attention`
      : unverified ? 'Some services remain unverified' : 'All checks are available';
  const cards = data?.cards.filter(card => filter === 'all' || actionStates.includes(card.status)) || [];
  return <div className="data-health">
    <header className="data-health__heading">
      <div><span className="data-health__eyebrow">SARVA · PLATFORM OPERATIONS</span><h1>Data health</h1><p>Know what is available, what is fresh, and what needs attention.</p></div>
      <div className="data-health__tools"><Link to="/analytics">View analytics <span aria-hidden="true">↗</span></Link><button type="button" disabled={loading} onClick={() => { setLoading(true); setRevision(value => value + 1); }}>{loading ? 'Checking…' : 'Refresh checks'}</button></div>
    </header>
    <section className="data-health__overview" aria-label="Health summary" aria-busy={loading}>
      <div className="data-health__overviewIntro"><span className="data-health__eyebrow">CURRENT SNAPSHOT</span><h2>{headline}</h2><p>{data ? `Checked ${date(data.checkedAt)}` : error ? 'No snapshot is available. Use Refresh checks to try again.' : 'Checking stored evidence and service connections. This can take a few seconds.'}</p></div>
      <div className="data-health__stat"><strong>{data?.counts.healthy ?? '—'}</strong><span>Available</span></div>
      <div className="data-health__stat"><strong>{data ? needsAction : '—'}</strong><span>Need attention</span></div>
      <div className="data-health__stat"><strong>{data ? data.counts.unknown + data.counts.syncing : '—'}</strong><span>Not checked / syncing</span></div>
    </section>
    {error && <div className="data-health__error" role="alert"><strong>Could not refresh health checks.</strong> {error}{data && ' The previous snapshot is still displayed; it may no longer reflect current conditions.'}</div>}
    {loading && <p className="data-health__loading" role="status">Checking services… Existing results remain visible until the new snapshot is ready.</p>}
    {data && <>
      <div className="data-health__toolbar"><div className="data-health__filters" aria-label="Filter health checks"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All checks <span>{data.cards.length}</span></button><button type="button" aria-pressed={filter === 'attention'} onClick={() => setFilter('attention')}>Needs attention <span>{needsAction}</span></button></div><small>Checks are reused for up to {data.cacheSeconds} seconds. No automatic polling.</small></div>
      <div className="data-health__grid">
        {cards.map(card => <article key={card.id} className={`data-health__card is-${card.status}`}>
          <div className="data-health__cardTop"><span>{card.category}</span><span className="data-health__badge"><i aria-hidden="true" />{labels[card.status] || card.status}</span></div>
          <h2>{card.name}</h2><p className="data-health__summary">{card.summary}</p>
          <dl className="data-health__facts">{card.facts.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
          <div className="data-health__timestamps">
            {['catalogue', 'forecast', 'firms', 'gdacs'].includes(card.id) && <><p><span>Last successful refresh</span><time>{date(card.lastSuccessAt)}</time></p><p><span>Latest attempt started</span><time>{date(card.lastAttemptAt)}</time></p></>}
            {card.id === 'municipal' && <p><span>Last stored value update</span><time>{date(card.dataUpdatedAt)}</time></p>}
          </div>
          <div className="data-health__action"><strong>{actionStates.includes(card.status) ? 'Next step' : 'What this check means'}</strong><p>{card.action}</p></div>
          {card.href && <Link className="data-health__open" to={card.href}>Open {card.id === 'municipal' || card.id === 'boundaries' ? 'municipal profiler' : card.id === 'catalogue' ? 'catalogue search' : 'map'} <span aria-hidden="true">→</span></Link>}
        </article>)}
      </div>
      {cards.length === 0 && <p className="data-health__empty">No checks currently need attention. On-demand feeds may still be unverified.</p>}
    </>}
    <footer className="data-health__notes"><h2>Read the status in context</h2><p>“Available” describes the stated check, not complete national coverage or validated source accuracy. Historical municipal indicators retain their source years. Catalogue and forecast refreshes are stale after 26 hours; on-demand feed caches expire after 30 minutes.</p><p>FIRMS and GDACS checks read this API process’s cache only. Open their map layers to test an actual download. The panel never starts a sync, imports data, or changes configuration. Map tile checks run inside Docker; browser proxy access is a separate step.</p></footer>
  </div>;
}

export default function DataHealth() {
  const { token, user, isAdmin } = useCurrentUser();
  const [headerOffset, setHeaderOffset] = useState(0);
  useLayoutEffect(() => {
    const header = document.querySelector('.sarva-header');
    if (!header) return;
    const update = () => setHeaderOffset(Math.max(0, header.getBoundingClientRect().height - 72));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  let content;
  if (!token) content = <section className="data-health data-health__gate"><span className="data-health__eyebrow">SARVA · PLATFORM OPERATIONS</span><h1>Data health login</h1><p>Sign in with your SARVA administrator account to inspect data and service health.</p><AuthPanel /></section>;
  else if (!user) content = <p className="data-health" role="status">Checking your account…</p>;
  else if (!isAdmin) content = <section className="data-health data-health__gate"><h1>Administrator access required</h1><p>Your account does not have access to data health checks.</p></section>;
  else content = <HealthDashboard key={token} token={token} />;
  return <div style={{ paddingTop: headerOffset }}>{content}</div>;
}
