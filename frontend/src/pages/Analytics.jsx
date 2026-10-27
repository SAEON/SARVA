import AnalyticsAudience from '../components/AnalyticsAudience';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import AuthPanel from '../components/AuthPanel';
import { apiUrl } from '../config/api';
import { reportCsv, downloadCsv } from '../config/analyticsCsv';
import '../styles/analytics.css';

const number = (value) => value == null ? 'Unavailable' : Number(value).toLocaleString('en-ZA');
const date = (value) => value ? new Date(value).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) : 'No data';
const country = (value) => {
  if (!value) return 'Unknown / local';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(value); } catch { return value; }
};
function Table({ title, rows, columns }) {
  return <section className="analytics-panel"><h2>{title}</h2>{rows == null ? <p>Data unavailable. Check the local database and migrations.</p> : rows.length === 0 ? <p>No activity recorded yet.</p> : <div className="analytics-scroll"><table><thead><tr>{columns.map(([label]) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{columns.map(([label, field, format]) => <td key={label}>{format ? format(row[field]) : row[field]}</td>)}</tr>)}</tbody></table></div>}</section>;
}

function Dashboard({ token }) {
  const [days, setDays] = useState(30);
  const [query, setQuery] = useState('days=30');
  const [range, setRange] = useState({ from: '', to: '' });
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl(`/api/analytics/summary?${query}`), { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Could not load analytics');
        return body;
      }).then(body => { setResult(body); setError(''); })
      .catch(err => { if (err.name !== 'AbortError') { setError(err.message); setResult(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, query, revision]);
  const data = result?.data;
  const usage = data?.usage?.[0];
  const searches = data?.searches?.[0];
  const catalogue = data?.catalogue?.[0];
  const max = Math.max(1, ...(data?.daily || []).map(row => row.count));
  return <div className="analytics">
    <div className="analytics-heading"><div><span className="analytics-eyebrow">SARVA · ANALYTICS & REPORTING</span><h1>Platform insights</h1><p>Understand your audience, the sections they use, and the evidence they discover.</p></div><div className="analytics-controls"><label>Activity period<select value={days} onChange={e => { const next = e.target.value; setDays(next); if (next !== 'custom') { setLoading(true); setResult(null); setQuery(`days=${next}`); } }}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value="custom">Custom dates</option></select></label><button disabled={loading} onClick={() => { setLoading(true); setRevision(n => n + 1); }}>Refresh</button></div></div>
    {days === 'custom' && <form className="analytics-date-range" onSubmit={event => { event.preventDefault(); setLoading(true); setResult(null); setQuery(new URLSearchParams(range).toString()); }}><label>From<input type="date" required value={range.from} onChange={e => setRange(current => ({ ...current, from: e.target.value }))}/></label><label>Through<input type="date" required min={range.from} value={range.to} onChange={e => setRange(current => ({ ...current, to: e.target.value }))}/></label><button disabled={loading} type="submit">Apply dates</button><small>Up to 366 days, inclusive, in South African time.</small></form>}
    {loading && <p role="status">Loading local analytics…</p>}
    {error && <p role="alert" className="analytics-notice">{error}. Check your login and local backend, then refresh.</p>}
    {data && <>
      <div className="analytics-report-actions"><button type="button" onClick={() => downloadCsv(reportCsv(result), `sarva-analytics-${result.from}-${result.to}.csv`)}>Export report CSV</button><button type="button" onClick={() => window.print()}>Print / save PDF</button></div>
      <p className="analytics-meta">Reporting period: {result.from} to {result.to}, inclusive ({result.days} days, SAST). Generated {date(result.generatedAt)}. Coverage shows the current database snapshot.</p>
      {result.unavailable.length > 0 && <p role="status" className="analytics-notice">Some datasets are unavailable: {result.unavailable.join(', ')}. Missing data is not counted as zero.</p>}
      <div className="analytics-cards">{[['Page views', usage?.views], ['Unique IP addresses', usage?.unique_ips], ['Browser sessions', usage?.sessions], ['Catalogue searches', searches?.total], ['Zero-result searches', searches?.empty], ['API requests', usage?.requests], ['Server errors (5xx)', usage?.errors]].map(([label, value]) => <section key={label}><span>{label}</span><strong>{number(value)}</strong></section>)}</div>
      <div className="analytics-cards">{[['Link clicks', usage?.clicks], ['Outbound clicks', usage?.outbound], ['Download link clicks', usage?.downloads], ['Active viewing seconds', usage?.active_seconds]].map(([label,value]) => <section key={label}><span>{label}</span><strong>{number(value)}</strong></section>)}</div>
      <p className="analytics-meta">Unique IP addresses count distinct hashed network addresses with page views in the selected period, not people. Shared networks/VPNs can merge visitors, and changing addresses can count a person more than once. Counting starts with this update; older visits cannot be recovered. Earliest counted visit in this period: {date(usage?.ip_tracking_since)}. Page views without an IP identifier: {number(usage?.ip_unavailable_views)}. Rotating the authentication secret starts new identifiers.</p>
      <section className="analytics-panel"><h2>Daily page views</h2><p>South African calendar days. Sessions identify a browser tab, not unique people. Recording starts when this feature is enabled.</p>{data.daily == null ? <p>Data unavailable.</p> : <div className="analytics-chart" role="img" aria-label={`Daily page views: ${data.daily.map(r => `${r.label}: ${r.count}`).join('; ')}`}>{data.daily.map(row => <div className="analytics-bar" key={row.label} title={`${row.label}: ${row.count} views`}><span style={{ height: `${row.count / max * 100}%` }} /></div>)}</div>}<div className="analytics-chart-labels"><span>{data.daily?.[0]?.label}</span><span>{data.daily?.at(-1)?.label}</span></div></section>
      <div className="analytics-grid"><Table title="Popular pages" rows={data.pages} columns={ [['Page', 'label'], ['Views', 'count', number]] }/><Table title="Top catalogue searches" rows={data.terms} columns={ [['Search term', 'label'], ['Searches', 'count', number]] }/></div>
      <AnalyticsAudience token={token} from={result.from} to={result.to} revision={revision} />
      <h2 className="analytics-section-title">Original audience & engagement reports</h2>
      <p className="analytics-meta">These details are recorded from this update onward. Local/private-network visits have no geographic location. IP-based locations are approximate, may reflect VPNs or network providers, and are not the visitor’s precise position.</p>
      <Table title="Sections viewed & engagement" rows={data.sections} columns={ [['Section','label'],['Views','views',number],['Sessions','sessions',number],['Link clicks','clicks',number],['Mean active seconds / view','avg_seconds',number],['Mean document reached (%)','avg_scroll',number]] }/>
      <div className="analytics-grid"><Table title="Visitor locations · top 100" rows={data.locations} columns={ [['Country','country',country],['Region code','region'],['City (approx.)','city'],['Views','views',number],['Sessions','sessions',number],['Location basis','source']] }/><Table title="Countries × sections · top 100" rows={data.geographySections} columns={ [['Country','country',country],['Section','section'],['Views','views',number],['Sessions','sessions',number]] }/></div>
      <Table title="Links clicked · top 100" rows={data.links} columns={ [['From page','path'],['Link','label'],['Destination (no query string)','destination'],['Type','type'],['Clicks','clicks',number],['Sessions','sessions',number]] }/>
      <p className="analytics-meta">Download counts measure clicks on download links, not confirmed completed downloads. Active time is estimated while the tab is visible and recently used; missing engagement values are unavailable. Ranked reports show the row limits in their titles; CSV exports include the same ranked rows.</p>
      <div className="analytics-grid"><Table title="Arrival sources · top 50" rows={data.referrals} columns={ [['Referring domain','label'],['Session entries','entries',number],['Sessions','sessions',number]] }/><Table title="Devices & browsers" rows={data.devices} columns={ [['Device','device'],['Browser','browser'],['Views','views',number],['Sessions','sessions',number]] }/></div>
      <div className="analytics-grid"><Table title="Entry & last-viewed pages · top 50" rows={data.journeys} columns={ [['First page','entry'],['Last page in period','exit'],['Sessions','sessions',number]] }/><Table title="Page-to-page journeys · top 50" rows={data.transitions} columns={ [['From','origin'],['To','destination'],['Transitions','transitions',number]] }/></div>
      <p className="analytics-meta">Journeys show the first and last recorded pages inside the selected dates; the last page is not proof that a person left the site. Sessions are browser-tab visits, refreshed after 30 minutes without interaction; they are not unique people.</p>
      <Table title={`API performance · mean response ${number(usage?.latency)} ms`} rows={data.endpoints} columns={ [['Endpoint', 'label'], ['Requests', 'count', number], ['Mean ms', 'latency', number], ['Errors (4xx + 5xx)', 'errors', number]] }/>
      <h2 className="analytics-section-title">Environmental evidence & data coverage</h2>
      <div className="analytics-cards">{[['Catalogue records', catalogue?.records], ['Data providers', catalogue?.providers], ['Records with download links', catalogue?.downloadable], ['Records with spatial bounds', catalogue?.spatial]].map(([label, value]) => <section key={label}><span>{label}</span><strong>{number(value)}</strong></section>)}</div>
      <p className="analytics-meta">Catalogue last updated: {date(catalogue?.updated)}. Links and spatial bounds describe metadata completeness; availability is not independently checked.</p>
      <Table title="Municipal indicator coverage" rows={data.indicators} columns={ [['Theme', 'label'], ['Indicators', 'indicators', number], ['Proxy definitions', 'proxies', number], ['Municipalities represented', 'municipalities', number], ['Municipality–indicator pairs', 'pairs', number], ['Last updated', 'updated', date]] }/>
      <p className="analytics-meta">Coverage counts distinct municipalities and indicator pairs across all stored periods/scenarios. Proxy definitions are not direct observations; these counts do not imply complete national coverage.</p>
      <div className="analytics-grid"><Table title="Forecast coverage · latest dates" rows={data.forecast} columns={ [['Forecast date', 'label'], ['Points', 'points', number], ['Risk score ≥3', 'elevated', number], ['Loaded', 'updated', date]] }/><Table title="Recent data syncs" rows={data.syncs} columns={ [['Source', 'source'], ['Status', 'status'], ['Started', 'started_at', date], ['Finished', 'finished_at', date]] }/></div>
      <p className="analytics-meta">Events stay in this server’s database. Raw IPs, precise coordinates, URL queries and fragments are not stored by analytics. New events may include a keyed IP hash for aggregate counts, a verified SARVA account ID and coarse map grid; account activity is administrator-only. Browser privacy signals disable client tracking. Search terms come from the existing local catalogue search log. Automated traffic, blocked tracking and missing referrers affect counts.</p>
    </>}
  </div>;
}

export default function Analytics() {
  const { token, user, isAdmin } = useCurrentUser();
  if (!token) return <section className="analytics analytics-panel"><h1>Analytics login</h1><p>Sign in with your SARVA administrator account to view platform usage and data coverage.</p><AuthPanel /></section>;
  if (!user) return <p role="status">Checking your account…</p>;
  if (!isAdmin) return <section className="analytics analytics-panel"><h1>Administrator access required</h1><p>Your account does not have access to analytics.</p></section>;
  return <Dashboard key={token} token={token} />;
}
