import {useEffect,useState} from 'react';
import {apiUrl} from '../config/api';
import {categoryFor} from '../config/rawIndicatorTotals';
export default function MapIndicatorControls({value,onChange}){
 const [indicators,setIndicators]=useState([]),[category,setCategory]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();fetch(apiUrl('/api/municipalities/metadata'),{signal:c.signal}).then(r=>{if(!r.ok)throw Error('Indicator catalogue unavailable');return r.json();}).then(b=>{const rows=(b.data?.indicators || []).filter(r=>!r.isProxy&&!/index|composite|0.?100/i.test(r.unit || ''));setIndicators(rows);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[]);
 const categories=[...new Set(indicators.map(categoryFor))].sort();
 const selected=indicators.find(r=>`indicator:${r.key}`===value);
 const active=category || (selected?categoryFor(selected):categories.includes('Crime')?'Crime':categories[0]);
 const options=indicators.filter(r=>categoryFor(r)===active);
 return <div className="profiler-mapControls"><label>Category<select value={active || ''} onChange={e=>{setCategory(e.target.value);const row=indicators.find(r=>categoryFor(r)===e.target.value);if(row)onChange(`indicator:${row.key}`);}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Map indicator<select value={selected&&categoryFor(selected)===active?value:''} onChange={e=>onChange(e.target.value)}><option value="">Choose a raw-value indicator</option>{options.map(r=><option key={r.key} value={`indicator:${r.key}`}>{r.label} · {r.unit}</option>)}</select></label><p>Choose what to compare nationally, then click a municipality for its values. Grey means no usable value on the displayed comparison basis.</p>{error&&<p role="alert">{error}</p>}</div>;
}
