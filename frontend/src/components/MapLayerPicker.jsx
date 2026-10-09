import {useRef} from 'react';
const groups=[
 {label:'Ground observations',icon:'◉',layers:[['rainfall-risk','SAEON live observations','Weather stations and ecosystem monitoring sites.']]},
 {label:'Regional disaster reports',icon:'⚑',layers:[['disaster-events','Regional disaster events','GDACS floods, cyclones, earthquakes and other reported events.']]},
 {label:'Satellite observations',icon:'✦',layers:[['satellite-fires','Satellite fire detections','NASA FIRMS thermal hotspots · 24 hours or 7 days.']]},
 {label:'Model-based environmental screening',icon:'▧',layers:[
  ['forecast-risk','Rainfall','ECMWF daily rainfall estimates.'],
  ['heat-risk','Temperature','ECMWF maximum temperature estimates.'],
  ['wind-risk','Wind','ECMWF maximum wind-speed estimates.'],
  ['fire-risk','Fire-weather indicator','SARVA indicator combining heat, wind and dryness.'],
  ['environmental-risk','Combined screening index','SARVA summary across the model-based components.']
 ]}
];
export default function MapLayerPicker({value,onChange}){
 const ref=useRef(null);
 const selected=groups.flatMap(g=>g.layers).find(r=>r[0]===value);
 return <details className="sarva-layerPicker" ref={ref} onKeyDown={e=>{if(e.key==='Escape'){ref.current.open=false;ref.current.querySelector('summary').focus();}}}>
 <summary aria-label="Choose map layer"><span><small>MAP LAYER</small><strong>{selected?.[1] || 'Choose a layer'}</strong></span><b aria-hidden="true">⌄</b></summary>
 <div className="sarva-layerPicker__panel" aria-label="Map layer categories"><div className="sarva-layerPicker__intro">Choose one layer to explore</div>{groups.map(g=><section key={g.label}><h3><span aria-hidden="true">{g.icon}</span> {g.label}</h3>{g.layers.map(([key,label,description])=><button key={key} type="button" aria-pressed={value===key} onClick={()=>{onChange(key);ref.current.open=false;ref.current.querySelector('summary').focus();}}><span><strong>{label}</strong><small>{description}</small></span><b aria-hidden="true">{value===key?'✓':'→'}</b></button>)}</section>)}<p>Model screening supports exploration. Official forecasts and warnings are provided by SAWS.</p></div>
 </details>;
}
