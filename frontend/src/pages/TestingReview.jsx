import {useEffect,useRef,useState} from 'react';
import {useCurrentUser} from '../hooks/useCurrentUser';
import {apiUrl} from '../config/api';
import AdminSections from '../components/AdminSections';
import '../styles/user-admin.css';
import '../styles/testing-review.css';

const kinds={bug:'Bug',update:'Needs updating',comment:'Comment / suggestion'};
const statuses={open:'Open','in-review':'In review',resolved:'Resolved'};
const priorities={low:'Low',normal:'Normal',high:'High'};
const date=value=>new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'})+' SAST';
async function request(path,token,options={}){
 const response=await fetch(apiUrl('/api/review/issues'+path),{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token}});
 const body=await response.json();if(!response.ok)throw new Error(body.message || 'Unable to complete request');return body;
}
function Pick({label,value,onChange,options,disabled=false}){return <label className="ua-field">{label}<select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}>{Object.entries(options).map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></label>;}
export default function TestingReview(){
 const {user,token,isAdmin}=useCurrentUser();
 return <div className="user-admin testing-review"><header className="ua-heading"><div><span className="ua-eyebrow">SARVA / TESTING &amp; REVIEW</span><h1>Testing &amp; issues</h1><p>Report a problem, discuss improvements and keep a record of fixes.</p></div><span className="ua-private">{isAdmin?'Administrator review':'Signed-in testing'}</span></header>
 {isAdmin&&<AdminSections/>}
 {import.meta.env.VITE_ANALYTICS_DEMO==='true'&&<p className="ua-guidance"><strong>Local test environment.</strong> Reports and accounts are synthetic. Production is unchanged.</p>}
 {user&&token?<Tracker token={token} isAdmin={isAdmin}/>:<section className="ua-panel"><h2>Sign in to report an issue</h2><p>Use SARVA’s Login button. Registered users can report issues and comment on their own reports. Administrators can review every report.</p></section>}</div>;
}
function Tracker({token,isAdmin}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState(''),[kind,setKind]=useState(''),[page,setPage]=useState(1),[reload,setReload]=useState(0);
 const [selected,setSelected]=useState(null),[showNew,setShowNew]=useState(false);
 const formRef=useRef(null);
 useEffect(()=>{if(showNew)formRef.current?.scrollIntoView({block:'start'});},[showNew]);
 useEffect(()=>{
  let alive=true;
  async function load(){
   setLoading(true);setError('');
   try{const result=await request('?'+new URLSearchParams({search:query,status,kind,page}),token);if(alive)setData(result.data);}
   catch(e){if(alive){setError(e.message);setData(null);}}finally{if(alive)setLoading(false);}
  }
  load();return()=>{alive=false;};
 },[token,query,status,kind,page,reload]);
 const count=key=>data?.counts.find(row=>row.status===key)?.count || 0;
 return <>
 <div className="ua-guidance"><strong>{isAdmin?'Review all reports and record the outcome.':'Your testing reports.'}</strong><p>{isAdmin?'Use Bug, Needs updating or Comment / suggestion to classify a report. Add review notes and mark it resolved when the fix has been checked.':'You can see your own reports and discuss them with administrators. Only administrators can change review status.'} Do not include passwords, API keys or private personal information.</p></div>
 <div className="tr-stats">{Object.entries(statuses).map(([key,label])=><div key={key}><strong>{count(key)}</strong><span>{label}</span></div>)}</div>
 <div className="tr-actions"><button className="ua-primary" onClick={()=>{setShowNew(true);setSelected(null);}}>Report an issue</button><button onClick={()=>setReload(n=>n+1)}>Refresh issues</button></div>
 {notice&&<div role="status" className="ua-success">{notice}</div>}{error&&<div role="alert" className="ua-error">{error}</div>}
 {showNew&&<section ref={formRef} className="ua-panel tr-new"><NewIssue token={token} onCancel={()=>setShowNew(false)} onCreated={id=>{setShowNew(false);setSelected(id);setNotice('Issue #'+id+' reported.');setReload(n=>n+1);}}/></section>}
 <section className="ua-panel"><div className="tr-filters"><form onSubmit={e=>{e.preventDefault();setPage(1);setQuery(search.trim());}}><label className="ua-field">Find an issue<div className="ua-search"><input value={search} maxLength={150} onChange={e=>setSearch(e.target.value)} placeholder="Search title or description"/><button>Search</button></div></label></form><Pick label="Status" value={status} onChange={value=>{setPage(1);setStatus(value);}} options={{'':'All statuses',...statuses}}/><Pick label="Type" value={kind} onChange={value=>{setPage(1);setKind(value);}} options={{'':'All types',...kinds}}/></div>
 <h2 className="tr-list-heading">{isAdmin?'All reports':'My reports'} <small>{loading?'Loading…':`${data?.total ?? 0} matching`}</small></h2>
 <div className="tr-list" aria-busy={loading}>{!loading&&data?.issues.map(issue=><button className={'tr-issue '+(selected===issue.id?'selected':'')} key={issue.id} onClick={()=>{setSelected(issue.id);setShowNew(false);}}><span className="tr-issue-top"><span>#{issue.id} · {kinds[issue.kind]}</span><span className={'tr-badge '+issue.status}>{statuses[issue.status]}</span></span><strong>{issue.title}</strong><span className="tr-issue-meta">{priorities[issue.priority]} priority · {issue.reporter_name} · {date(issue.updated_at)}</span></button>)}</div>
 {!loading&&data?.issues.length===0&&<p>No issues match these filters. Use “Report an issue” to start a review.</p>}
 <div className="ua-pagination"><button disabled={page===1||loading} onClick={()=>setPage(n=>n-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil((data?.total || 0)/25))}</span><button disabled={loading||page*25>=(data?.total || 0)} onClick={()=>setPage(n=>n+1)}>Next</button></div></section>
 {selected&&<IssueDetail key={selected} id={selected} token={token} onClose={()=>setSelected(null)} onChanged={()=>setReload(n=>n+1)}/>}
 </>;
}
function NewIssue({token,onCancel,onCreated}){
 const [draft,setDraft]=useState({title:'',description:'',kind:'bug',priority:'normal',pagePath:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const field=(key,value)=>setDraft(d=>({...d,[key]:value}));
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{const result=await request('',token,{method:'POST',body:JSON.stringify(draft)});onCreated(result.data.id);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <form onSubmit={submit}><div className="ua-editor-heading"><h2>Report an issue</h2><button type="button" disabled={busy} onClick={onCancel}>Cancel report</button></div>{error&&<p role="alert" className="ua-error">{error}</p>}<fieldset disabled={busy} className="tr-fieldset"><label className="ua-field">Title<input required minLength={3} maxLength={180} value={draft.title} onChange={e=>field('title',e.target.value)} placeholder="Briefly describe the issue"/></label><div className="tr-form-row"><Pick label="Issue type" value={draft.kind} onChange={value=>field('kind',value)} options={kinds}/><Pick label="Priority" value={draft.priority} onChange={value=>field('priority',value)} options={priorities}/></div><label className="ua-field">Affected page (optional)<input value={draft.pagePath} maxLength={201} onChange={e=>field('pagePath',e.target.value)} placeholder="For example /municipal-risk-profiler"/></label><label className="ua-field">Description and steps to reproduce<textarea required minLength={10} maxLength={10000} value={draft.description} onChange={e=>field('description',e.target.value)} placeholder="What did you try? What happened, and what did you expect?"/></label><p className="ua-note">Reports are stored in SARVA’s database. You and platform administrators can read this report.</p><button className="ua-primary">{busy?'Submitting…':'Submit issue'}</button></fieldset></form>;
}
function IssueDetail({id,token,onClose,onChanged}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0),[historyPage,setHistoryPage]=useState(1);
 const [comment,setComment]=useState(''),[review,setReview]=useState(null),[busy,setBusy]=useState(false);const ref=useRef(null);
 useEffect(()=>{ref.current?.scrollIntoView({block:'start'});},[]);
 useEffect(()=>{
  let alive=true;
  async function load(){setLoading(true);setError('');try{const result=await request('/'+id+'?page='+historyPage,token);if(alive){setData(result.data);setReview({status:result.data.issue.status,kind:result.data.issue.kind,priority:result.data.issue.priority,revision:result.data.issue.revision,note:''});}}catch(e){if(alive)setError(e.message);}finally{if(alive)setLoading(false);}}
  load();return()=>{alive=false;};
 },[token,id,reload,historyPage]);
 async function submit(e,mode){e.preventDefault();setBusy(true);setError('');setNotice('');try{await request('/'+id+(mode==='comment'?'/comments':''),token,{method:mode==='comment'?'POST':'PATCH',body:JSON.stringify(mode==='comment'?{note:comment}:review)});setComment('');setNotice(mode==='comment'?'Comment added.':'Review saved.');setHistoryPage(1);setReload(n=>n+1);onChanged();}catch(e){setError(e.message);}finally{setBusy(false);}}
 const issue=data?.issue;
 return <section ref={ref} className="ua-panel tr-detail" aria-label="Issue detail"><div className="ua-editor-heading"><h2>{issue?'#'+issue.id+' '+issue.title:'Issue #'+id}</h2><button onClick={onClose} disabled={busy}>Close issue</button></div><button onClick={()=>setReload(n=>n+1)} disabled={busy||loading}>Refresh detail</button>{error&&<p role="alert" className="ua-error">{error}</p>}{notice&&<p role="status" className="ua-success">{notice}</p>}{loading?<p>Loading issue…</p>:issue&&<>
 <p><span className={'tr-badge '+issue.status}>{statuses[issue.status]}</span> · {kinds[issue.kind]} · {priorities[issue.priority]} priority</p><p className="ua-note">Reported by {issue.reporter_name} · {date(issue.created_at)}</p>{issue.page_path&&<p className="tr-path">Affected page: <code>{issue.page_path}</code></p>}<p className="tr-description">{issue.description}</p>
 {issue.status==='resolved'&&<div className="tr-resolution"><h3>Resolution / fix</h3><p>{issue.resolution}</p><small>{date(issue.resolved_at)}</small></div>}
 {data.isAdmin&&review&&<form className="tr-review" onSubmit={e=>submit(e,'review')}><h3>Administrator review</h3><div className="tr-form-row"><Pick label="Review status" value={review.status} onChange={value=>setReview(d=>({...d,status:value}))} options={statuses} disabled={busy}/><Pick label="Review type" value={review.kind} onChange={value=>setReview(d=>({...d,kind:value}))} options={kinds} disabled={busy}/><Pick label="Review priority" value={review.priority} onChange={value=>setReview(d=>({...d,priority:value}))} options={priorities} disabled={busy}/></div><label className="ua-field">Review / fix notes<textarea required minLength={5} maxLength={5000} disabled={busy} value={review.note} onChange={e=>setReview(d=>({...d,note:e.target.value}))} placeholder="Record the review decision or the fix and how it was checked"/></label><p className="ua-note">Resolving requires fix or outcome notes. Reopening preserves the previous resolution in the history.</p><button className="ua-primary" disabled={busy}>Save review</button></form>}
 <div className="tr-history"><h3>Comments &amp; review history</h3><p className="ua-note">Showing up to 50 events, oldest first within this history page. Page 1 contains the latest events.</p><ol>{data.events.map(event=><li key={event.id}><div><strong>{!data.isAdmin&&event.actor_name==='Admin'&&event.event_type==='reply'?'Reply from Admin':event.actor_name}</strong><span>{event.event_type==='review'?'Review':event.event_type==='reply'?(data.isAdmin?'Admin reply':'Reply'):event.event_type==='comment'?'Comment':'Reported'} · {date(event.created_at)}</span></div><p>{event.note}</p>{event.changes.before&&<small>{statuses[event.changes.before.status]} → {statuses[event.changes.after.status]} · {kinds[event.changes.after.kind]} · {priorities[event.changes.after.priority]} priority</small>}</li>)}</ol><div className="ua-pagination"><button disabled={historyPage===1||busy} onClick={()=>setHistoryPage(n=>n-1)}>Newer history</button><span>History page {historyPage}</span><button disabled={historyPage*50>=data.historyTotal||busy} onClick={()=>setHistoryPage(n=>n+1)}>Older history</button></div></div>
 <form onSubmit={e=>submit(e,'comment')}><label className="ua-field">{data.isAdmin?'Reply as administrator':'Add a comment'}<textarea required maxLength={10000} disabled={busy} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add test results, a clarification or follow-up"/></label><button disabled={busy||!comment.trim()}>{data.isAdmin?'Post reply':'Post comment'}</button></form>
 </>}</section>;
}
