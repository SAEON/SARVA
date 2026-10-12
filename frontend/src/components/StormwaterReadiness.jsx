import { useState } from "react";
import "../styles/stormwater-readiness.css";

export default function StormwaterReadiness({workspace, setWorkspace, children, onDownload, onWeather, onTerrain}) {
    const [step, setStep] = useState(0);
    const [problem, setProblem] = useState({title:"",location:"",source:"",sourceDate:"",notes:""});
    const [action, setAction] = useState({action:"",owner:"",timeframe:"",estimatedCost:"",fundingSource:"",expectedChange:""});
    const [message, setMessage] = useState("");
    const problems = workspace.evidence.filter(e => e.category === "Roads and stormwater" && (!e.municipality || e.municipality === workspace.municipality));
    const [evidenceId, setEvidenceId] = useState("");
    const [warningChecked, setWarningChecked] = useState(false);
    const linkedPriorities = workspace.priorities.filter(p => p.evidenceIds?.some(id => problems.some(e => e.id === id)));
    const actions = workspace.actions.filter(a => linkedPriorities.some(p => p.id === a.priorityId));
    const id = () => crypto.randomUUID();
    function saveProblem(event) {
        event.preventDefault();
        const record = {...problem, id:id(),category:"Roads and stormwater",value:"",unit:"",confidence:"Low",municipality:workspace.municipality,municipalityCode:workspace.municipalityCode};
        setWorkspace(current => ({...current,evidence:[record,...current.evidence],updatedAt:new Date().toISOString()}));
        setEvidenceId(record.id); setProblem({title:"",location:"",source:"",sourceDate:"",notes:""}); setMessage("Problem saved. Add another location or continue to plan an action.");
    }
    function saveAction(event) {
        event.preventDefault();
        const evidence = problems.find(e => e.id === evidenceId);
        if (!evidence) {setMessage("Choose a saved problem first."); return;}
        const priorityId = id();
        const priority = {id:priorityId,title:evidence.title,category:"Roads and stormwater",evidenceIds:[evidence.id],urgency:"This year",impact:"Not assessed",owner:action.owner,status:"Draft",why:evidence.notes || "Local drainage issue requires verification."};
        setWorkspace(current => ({...current,priorities:[priority,...current.priorities],actions:[{...action,id:id(),priorityId,priority:"",status:"Draft"},...current.actions],updatedAt:new Date().toISOString()}));
        setAction({action:"",owner:"",timeframe:"",estimatedCost:"",fundingSource:"",expectedChange:""}); setMessage("Action saved and linked to its supporting problem.");
    }
    const gaps = [!workspace.municipality && "Choose a municipality",!problems.length && "Record a drainage problem",!actions.length && "Add an action",problems.some(p => !p.source || !p.sourceDate) && "Complete missing evidence sources or dates",actions.some(a => !a.owner || !a.timeframe) && "Assign action owners and timeframes",!warningChecked && "Check current official weather warnings before operational use"].filter(Boolean);
    return <section className="stormwater-guide" aria-label="Stormwater readiness task">
        <header><small>GUIDED PLANNING TASK</small><h1>Prepare a stormwater readiness brief</h1><p>Record known drainage problems, agree follow-up actions and prepare a brief for your roads, stormwater or disaster-management team.</p></header>
        <nav aria-label="Planning steps">{["1. Choose area","2. Record problem","3. Plan action","4. Review brief"].map((label,i) => <button key={label} aria-current={step === i ? "step" : undefined} onClick={() => {setStep(i);setMessage("");}}>{label}</button>)}</nav>
        <p><strong>Planning area:</strong> {workspace.municipality || "Not selected"} · {problems.length} drainage problems · {actions.length} linked actions</p>
        {message && <p role="status">{message}</p>}
        {step === 0 && <><h2>Where are you planning?</h2><p>Choose a municipality below. You can select a ward for a specific problem. The 2026 boundaries are a planning preview; verify the applicable operational geography.</p>{children}<button disabled={!workspace.municipality} onClick={() => setStep(1)}>Continue to record a problem</button></>}
        {step === 1 && <><h2>Where does drainage need attention?</h2><p>Use a known blocked drain, recurring flooding or stormwater maintenance issue. Describe what was observed; terrain alone does not establish flood risk.</p>
            <div className="stormwater-guide__context"><button onClick={() => {onTerrain();setStep(0);}}>Explore terrain on map</button><button onClick={() => {onWeather();setStep(0);}}>Explore cached rainfall on map</button><p>Optional context. Rainfall may be expired; check the layer dates. Showing an overlay does not save evidence.</p><a href="https://www.weathersa.co.za/" target="_blank" rel="noreferrer">Check current SAWS warnings</a></div>
            <form onSubmit={saveProblem}><label>What is the problem?<input required value={problem.title} onChange={e=>setProblem({...problem,title:e.target.value})} placeholder="Blocked culvert causes road flooding" /></label><label>Where is it?<input required value={problem.location} onChange={e=>setProblem({...problem,location:e.target.value})} placeholder="Ward, road, crossing or facility" /></label><label>What supports this observation?<input required value={problem.source} onChange={e=>setProblem({...problem,source:e.target.value})} placeholder="Site inspection, maintenance log, ward report" /></label><label>Observation or source date<input required type="date" value={problem.sourceDate} onChange={e=>setProblem({...problem,sourceDate:e.target.value})} /></label><label>Who or what is affected, and what needs verification?<textarea value={problem.notes} onChange={e=>setProblem({...problem,notes:e.target.value})} /></label><button disabled={!workspace.municipality}>Save problem</button></form>
            {!workspace.municipality && <p>Choose your planning area first.</p>}{problems.map(p=><p key={p.id}><strong>{p.title}</strong> · {p.location} · {p.sourceDate || "Date missing"}</p>)}<button disabled={!problems.length} onClick={()=>setStep(2)}>Continue to plan an action</button></>}
        {step === 2 && <><h2>What will the team do next?</h2><p>Start with a feasible inspection, maintenance or investigation action. Costs and funding may remain estimates, with gaps visible in the brief.</p><form onSubmit={saveAction}><label>Which problem does this address?<select required value={evidenceId} onChange={e=>setEvidenceId(e.target.value)}><option value="">Choose a saved problem</option>{problems.map(p=><option key={p.id} value={p.id}>{p.title} — {p.location}</option>)}</select></label>{[["action","Proposed action",true],["owner","Responsible team or person",true],["timeframe","By when?",true],["estimatedCost","Estimated cost",false],["fundingSource","Funding source or gap",false],["expectedChange","How will you know it helped?",true]].map(([key,label,required])=><label key={key}>{label}<input required={required} value={action[key]} onChange={e=>setAction({...action,[key]:e.target.value})} /></label>)}<button>Save linked action</button></form>{actions.map(a=><p key={a.id}><strong>{a.action}</strong> · {a.owner} · {a.timeframe}</p>)}<button onClick={()=>setStep(3)}>Review brief</button></>}
        {step === 3 && <><h2>Ready for team review?</h2><p>This is a draft for discussion, not an approved plan or flood-risk assessment. Use the advanced register below to edit saved records.</p><label><input type="checkbox" checked={warningChecked} onChange={e=>setWarningChecked(e.target.checked)} /> I have checked current official warnings for this review session.</label>{gaps.length ? <ul>{gaps.map(g=><li key={g}>{g}</li>)}</ul> : <p>The basic review checklist is complete. Local verification and approval are still required.</p>}<p>Warning checks are not saved as evidence. Record the source and date if the brief relies on a warning.</p><button onClick={onDownload}>Download draft review brief</button></>}
    </section>;
}
