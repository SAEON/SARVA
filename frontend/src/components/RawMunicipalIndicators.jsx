import MunicipalComparison from './MunicipalComparison';
import {useState} from 'react';
import {categoryFor,hasRawEvidence,countIsAdditive,rawTotal} from '../config/rawIndicatorTotals';
import '../styles/raw-municipal-indicators.css';
export default function RawMunicipalIndicators({profile,loading,error,onSelect}) {
 const [category,setCategory]=useState(''),[selected,setSelected]=useState([]),[search,setSearch]=useState(''),[view,setView]=useState('values');
 if(loading)return <section className="raw-municipal" role="status">Loading municipal source values…</section>;
 if(error)return <section className="raw-municipal" role="alert">{error}</section>;
 if(!profile)return <section className="raw-municipal"><h2>Start with a municipality</h2><p>Search above, then choose a category to see actual source values. Select compatible counts to build your own total.</p></section>;
 const all=profile.indicators?.records || [];
 const rows=all.filter(hasRawEvidence);
 const categories=[...new Set(rows.map(categoryFor))].sort();
 const active=category || (categories.includes('Crime')?'Crime':categories[0]);
 const visible=rows.filter(r=>categoryFor(r)===active && `${r.label} ${r.period}`.toLowerCase().includes(search.toLowerCase()));
 const chosen=rows.filter(r=>selected.includes(r.key));
 const result=rawTotal(chosen);
 const format=v=>Number(v).toLocaleString('en-ZA',{maximumFractionDigits:3});
 function download(){const text=[`Municipality: ${profile.municipality.municipality}`,`Category: ${active}`,`Custom total: ${result.total==null?'Not calculated':format(result.total)}`,result.reason,...chosen.map(r=>`${r.label}: ${r.rawValue} ${r.displayUnit || r.unit} | ${r.period} | ${r.sourceName} | ${r.sourceUrl || ''}`),'Counts describe reported records, not individual people affected or a risk probability.'].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='municipal-selected-counts.txt';a.click();URL.revokeObjectURL(url);}
 return <section className="raw-municipal"><header><h2>{profile.municipality.municipality}</h2><p>Source values by category. Counts, percentages and other units stay in their original form.</p></header><nav aria-label="Indicator categories">{categories.map(c=><button key={c} aria-pressed={active===c} onClick={()=>{setCategory(c);setSelected([]);setSearch('');}}>{c}</button>)}</nav>
 <div className="raw-municipal__views"><button aria-pressed={view==='values'} onClick={()=>setView('values')}>Selected municipality</button><button aria-pressed={view==='compare'} onClick={()=>setView('compare')}>Compare municipalities</button></div>
 {view==='compare' ? <MunicipalComparison indicators={rows.filter(r=>categoryFor(r)===active)} municipality={profile.municipality} onSelect={onSelect} /> : <>
 <label>Find an indicator<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search within this category"/></label>
 <div className="raw-municipal__total"><h3>Your selected total</h3><strong>{result.total==null?'No compatible total selected':`${format(result.total)} ${chosen[0]?.displayUnit || chosen[0]?.unit}`}</strong><p>{result.reason}</p>{chosen.length>0&&<p>{chosen.map(r=>r.label).join(' + ')} · {chosen[0].period}</p>}<button onClick={()=>setSelected([])}>Clear selection</button><button disabled={!chosen.length} onClick={download}>Download selected values</button></div>
 <p>Choose individual counts to add together. Aggregate totals are excluded to reduce double counting. Crime counts are reported cases, not population-adjusted rates; larger municipalities may have larger counts.</p>
 <div className="raw-municipal__table"><table><thead><tr><th>Add</th><th>Indicator</th><th>Source value</th><th>Period / scenario</th><th>Source</th></tr></thead><tbody>{visible.map(r=><tr key={r.key}><td><input type="checkbox" aria-label={`Add ${r.label}`} disabled={!countIsAdditive(r)} checked={selected.includes(r.key)} onChange={e=>setSelected(current=>e.target.checked?[...current,r.key]:current.filter(k=>k!==r.key))}/></td><th scope="row">{r.label}{!countIsAdditive(r)&&<small>Shown individually; excluded from sums</small>}</th><td><strong>{format(r.rawValue)}</strong><small>{r.displayUnit || r.unit}</small></td><td>{r.period || 'Unknown'}<small>{r.scenario || ''}</small></td><td>{r.sourceName || 'Unknown'}{r.sourceUrl&&<a href={r.sourceUrl} target="_blank" rel="noreferrer">Source</a>}</td></tr>)}</tbody></table></div>
 {!visible.length&&<p>No matching raw source values available.</p>}</> }<p>{all.length-rows.length} placeholder, score-only or missing-value records excluded. Source data has not been independently validated here. Different source years are shown explicitly.</p></section>;
}
