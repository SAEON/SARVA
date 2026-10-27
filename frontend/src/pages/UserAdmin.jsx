import {useEffect,useRef,useState} from 'react';
import {useCurrentUser} from '../hooks/useCurrentUser';
import {apiUrl} from '../config/api';
import '../styles/user-admin.css';
import AdminSections from '../components/AdminSections';

const date=value=>value?new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'})+' SAST':'Never';
export default function UserAdmin(){
 const {token,user,isAdmin}=useCurrentUser();
 return <div className="user-admin"><header className="ua-heading"><div><span className="ua-eyebrow">SARVA / ADMINISTRATION</span><h1>Users &amp; roles</h1><p>Manage who can contribute and administer SARVA.</p></div><span className="ua-private">Administrator access</span></header>
 {isAdmin&&<AdminSections/>}
 {import.meta.env.VITE_ANALYTICS_DEMO==='true'&&<p className="ua-guidance"><strong>Local test environment.</strong> All accounts shown here are synthetic. Changes do not affect production users.</p>}
 {isAdmin?<Accounts token={token} currentId={user.id}/>:<section className="ua-panel"><h2>Administrator sign-in required</h2><p>Use the SARVA Login button to sign in with an active administrator account.</p></section>}</div>;
}
function Accounts({token,currentId}){
 const [data,setData]=useState(null),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1),[reload,setReload]=useState(0);
 const editorRef=useRef(null);
 const [selected,setSelected]=useState(null),[draft,setDraft]=useState(null),[history,setHistory]=useState([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 async function request(path,options={}){
  const response=await fetch(apiUrl('/api/admin/users'+path),{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token}});
  const body=await response.json();if(!response.ok)throw new Error(body.message || 'Request failed');return body;
 }
 useEffect(()=>{
  let alive=true;
  async function load(){
   setLoading(true);setError('');
   try{const response=await fetch(apiUrl('/api/admin/users?search='+encodeURIComponent(query)+'&page='+page),{headers:{Authorization:'Bearer '+token}});const body=await response.json();if(!response.ok)throw new Error(body.message || 'Could not load accounts');if(alive)setData(body.data);}
   catch(e){if(alive){setError(e.message);setData(null);}}finally{if(alive)setLoading(false);}
  }
  load();return()=>{alive=false;};
 },[token,query,page,reload]);
 useEffect(()=>{
  let alive=true;
  if(!selected)return;
  fetch(apiUrl('/api/admin/users/'+selected.id+'/history'),{headers:{Authorization:'Bearer '+token}})
   .then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.message);if(alive)setHistory(b.data);})
   .catch(e=>{if(alive)setError(e.message);});
  return()=>{alive=false;};
 },[selected,token]);
 useEffect(()=>{if(selected)editorRef.current?.scrollIntoView({behavior:'instant',block:'start'});},[selected]);
 function open(account){setHistory([]);setSelected(account);setDraft({roles:[...account.roles],isActive:account.is_active,revision:account.access_revision,reason:'',currentPassword:''});setError('');setNotice('');}
 async function save(e){
  e.preventDefault();setSaving(true);setError('');
  try{await request('/'+selected.id,{method:'PATCH',body:JSON.stringify(draft)});setNotice('Access updated for '+selected.display_name+'.');setSelected(null);setDraft(null);setReload(n=>n+1);}
  catch(e){setError(e.message);setDraft(d=>({...d,currentPassword:''}));}finally{setSaving(false);}
 }
 const self=selected && String(selected.id)===String(currentId);
 const changed=draft && (draft.isActive!==selected.is_active || [...draft.roles].sort().join(',')!==[...selected.roles].sort().join(','));
 return <>
 <div className="ua-guidance"><strong>Account access, with a record of every change.</strong><p>Role and status changes require your current SARVA password and a reason. You cannot remove your own administrator access. Existing accounts are retained when deactivated.</p></div>
 {notice&&<div role="status" className="ua-success">{notice}</div>}
 {error&&<div role="alert" className="ua-error">{error}</div>}
 <section className="ua-panel"><div className="ua-toolbar"><form onSubmit={e=>{e.preventDefault();setQuery(search.trim());setPage(1);setSelected(null);}}><label htmlFor="ua-search">Find an account</label><div className="ua-search"><input id="ua-search" placeholder="Search name or email" maxLength={150} value={search} onChange={e=>setSearch(e.target.value)}/><button>Search</button></div></form><button type="button" onClick={()=>{setSelected(null);setReload(n=>n+1);}}>Refresh accounts</button></div>
 <div className="ua-table-wrap" aria-busy={loading}><table><caption>{loading?'Loading accounts…':`${data?.total ?? 0} registered accounts`}</caption><thead><tr><th>Account</th><th>Status</th><th>Roles</th><th>Last sign-in</th><th><span className="ua-sr">Actions</span></th></tr></thead><tbody>{!loading&&data?.users.map(account=><tr key={account.id}><td><strong>{account.display_name}</strong><small>{account.email}</small>{String(account.id)===String(currentId)&&<span className="ua-you">You</span>}</td><td><span className={'ua-status '+(account.is_active?'active':'inactive')}>{account.is_active?'Active':'Inactive'}</span></td><td>{account.roles.map(role=><span key={role} className="ua-role">{data.roles.find(r=>r.name===role)?.label || role}</span>)}</td><td>{date(account.last_login_at)}</td><td><button type="button" onClick={()=>open(account)} aria-label={'Manage '+account.display_name}>Manage</button></td></tr>)}</tbody></table>{!loading&&data?.users.length===0&&<p>No accounts match your search.</p>}</div>
 <div className="ua-pagination"><button disabled={page===1||loading} onClick={()=>{setSelected(null);setPage(n=>n-1);}}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil((data?.total || 0)/25))}</span><button disabled={loading||page*25>=(data?.total || 0)} onClick={()=>{setSelected(null);setPage(n=>n+1);}}>Next</button></div></section>
 {selected&&draft&&<section ref={editorRef} className="ua-panel ua-editor" aria-label="Manage account"><div className="ua-editor-heading"><div><span className="ua-eyebrow">ACCOUNT ACCESS</span><h2>{selected.display_name}</h2><p>{selected.email}</p></div><button type="button" disabled={saving} onClick={()=>{setSelected(null);setDraft(null);}}>Close</button></div>
 <form onSubmit={save}><fieldset disabled={saving}><legend>Roles</legend>{data.roles.map(role=><label key={role.name} className="ua-choice"><input type="checkbox" checked={draft.roles.includes(role.name)} disabled={self&&role.name==='admin'} onChange={e=>setDraft(d=>({...d,roles:e.target.checked?[...d.roles,role.name]:d.roles.filter(r=>r!==role.name)}))}/><span><strong>{role.label}</strong><small>{role.name==='admin'?'Manage user access and administer platform content.':role.name==='contributor'?'Contributor designation; permissions depend on each feature.':role.description}</small></span></label>)}</fieldset>
 <label className="ua-choice"><input type="checkbox" checked={draft.isActive} disabled={saving||self} onChange={e=>setDraft(d=>({...d,isActive:e.target.checked}))}/><span><strong>Account is active</strong><small>Deactivation blocks sign-in and protected administrator operations.</small></span></label>
 {self&&<p className="ua-note">This is your account. Another administrator must change your administrator role or deactivate it.</p>}
 <label className="ua-field">Reason for this change<textarea minLength={5} maxLength={500} required disabled={saving} value={draft.reason} onChange={e=>setDraft(d=>({...d,reason:e.target.value}))} placeholder="Explain why access is changing"/></label>
 <label className="ua-field">Your current SARVA password<input type="password" autoComplete="current-password" required disabled={saving} value={draft.currentPassword} onChange={e=>setDraft(d=>({...d,currentPassword:e.target.value}))}/></label>
 <p className="ua-note">Saving applies the selected roles and account status immediately. The account holder may need to sign in again to refresh their menu.</p>
 <button className="ua-primary" disabled={saving||!changed||!draft.roles.length}>{saving?'Saving…':'Confirm access changes'}</button></form>
 <div className="ua-history"><h3>Access history</h3><p>Latest 50 changes recorded through this interface. Earlier database changes are not included.</p>{history.length===0?<p>No recorded changes.</p>:<ol>{history.map(item=><li key={item.id}><strong>{item.actor_name}</strong> · {date(item.created_at)}<p>{item.reason}</p><small>{item.before_access.roles.join(', ')} / {item.before_access.isActive?'active':'inactive'} → {item.after_access.roles.join(', ')} / {item.after_access.isActive?'active':'inactive'}</small></li>)}</ol>}</div></section>}
 </>;
}
