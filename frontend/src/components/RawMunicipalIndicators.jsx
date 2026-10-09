import MunicipalComparison from './MunicipalComparison';
import {useState} from 'react';
import {categoryFor,hasRawEvidence} from '../config/rawIndicatorTotals';
import '../styles/raw-municipal-indicators.css';
export default function RawMunicipalIndicators({profile,loading,error,onSelect}) {
 const [category,setCategory]=useState(''),[search,setSearch]=useState(''),[view,setView]=useState('values');
 if(loading)return <section className="raw-municipal" role="status">Loading municipal source values…</section>;
 if(error)return <section className="raw-municipal" role="alert">{error}</section>;
 if(!profile)return <section className="raw-municipal"><h2>Start with a municipality</h2><p>Click a municipality on the map or search above to view its values and sources.</p></section>;
 const all=profile.indicators?.records || [];
 const rows=all.filter(hasRawEvidence);
 const categories=[...new Set(rows.map(categoryFor))].sort();
 const active=category || (categories.includes('Crime')?'Crime':categories[0]);
 const visible=rows.filter(r=>categoryFor(r)===active && `${r.label} ${r.period}`.toLowerCase().includes(search.toLowerCase()));
 const format=v=>Number(v).toLocaleString('en-ZA',{maximumFractionDigits:3});
 return <section className="raw-municipal"><header><h2>{profile.municipality.municipality}</h2><p>Source values by category. Counts, percentages and other units stay in their original form.</p></header><nav aria-label="Indicator categories">{categories.map(c=><button key={c} aria-pressed={active===c} onClick={()=>{setCategory(c);setSearch('');}}>{c}</button>)}</nav>
 <div className="raw-municipal__views"><button aria-pressed={view==='values'} onClick={()=>setView('values')}>Selected municipality</button><button aria-pressed={view==='compare'} onClick={()=>setView('compare')}>Compare municipalities</button></div>
 {view==='compare' ? <MunicipalComparison indicators={rows.filter(r=>categoryFor(r)===active)} municipality={profile.municipality} onSelect={onSelect} /> : <>
 <label>Find an indicator<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search within this category"/></label>
 {active==='Crime'&&<p>Crime counts are reported cases, not population-adjusted rates.</p>}
 <div className="raw-municipal__table"><table><thead><tr><th>Indicator</th><th>Source value</th><th>Period / scenario</th><th>Source</th></tr></thead><tbody>{visible.map(r=><tr key={r.key}><th scope="row">{r.label}</th><td><strong>{format(r.rawValue)}</strong><small>{r.displayUnit || r.unit}</small></td><td>{r.period || 'Unknown'}<small>{r.scenario || ''}</small></td><td>{r.sourceName || 'Unknown'}{r.sourceUrl&&<a href={r.sourceUrl} target="_blank" rel="noreferrer">Source</a>}</td></tr>)}</tbody></table></div>
 {!visible.length&&<p>No matching raw source values available.</p>}</> }<p>{all.length-rows.length} placeholder, score-only or missing-value records excluded. Source data has not been independently validated here. Different source years are shown explicitly.</p></section>;
}
