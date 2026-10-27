import {useEffect,useState} from 'react';
import {startRegistration,browserSupportsWebAuthn} from '@simplewebauthn/browser';
import {passkeyRequest,passkeyError} from '../config/passkeys';

const date=value=>new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'})+' SAST';
export default function PasskeyManager(){
 const [keys,setKeys]=useState(null),[password,setPassword]=useState(''),[label,setLabel]=useState('This device'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[removeId,setRemoveId]=useState(null),[retry,setRetry]=useState(0);
 const supported=window.isSecureContext&&browserSupportsWebAuthn();
 useEffect(()=>{let active=true;passkeyRequest('').then(body=>{if(active)setKeys(body.data);}).catch(error=>{if(active)setMessage(error.message);});return()=>{active=false;};},[retry]);
 async function enable(event){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   const optionsJSON=await passkeyRequest('/register/options',{password});setPassword('');
   const credential=await startRegistration({optionsJSON});
   await passkeyRequest('/register/verify',{credential,label});
   setKeys((await passkeyRequest('')).data);setMessage('Passkey enabled. Sign out and choose Sign in with a passkey to test this device. Your password still works.');
  }catch(error){setMessage(passkeyError(error));}finally{setBusy(false);setPassword('');}
 }
 async function remove(event){
  event.preventDefault();setBusy(true);setMessage('');
  try{await passkeyRequest('/remove',{id:removeId,password});setKeys((await passkeyRequest('')).data);setRemoveId(null);setMessage('Passkey removed from SARVA. The saved entry can also be removed in your device settings. Your password still works.');}
  catch(error){setMessage(passkeyError(error));}finally{setBusy(false);setPassword('');}
 }
 return <section className="ua-panel sarva-passkeys" aria-label="Your SARVA passkeys">
 <div className="pk-intro"><span className="pk-device-icon" aria-hidden="true">✓</span><div><h2>Enable passkey on this device</h2><p>Use your device PIN, fingerprint or face recognition instead of typing your SARVA email and password each time.</p></div></div>
 <ol className="pk-steps"><li>Confirm your current SARVA password for this setup.</li><li>Choose Enable passkey and follow your device prompt to save it.</li><li>Next time, choose Sign in with a passkey and unlock your device.</li></ol>
 <p className="ua-note">This uses the passkey support built into your device or passkey manager. SARVA does not receive your PIN, fingerprint, face data or private key. Your normal password remains a backup.</p>
 {!supported&&<p role="status" className="ua-guidance">Passkey setup is unavailable in this browser or address. Use a supported browser at the secure SARVA address, or localhost for this local test. Password sign-in is still available.</p>}
 <form onSubmit={enable} className="pk-enable"><label className="ua-field">Device name<input value={label} maxLength={80} onChange={e=>setLabel(e.target.value)} disabled={busy} autoComplete="off" placeholder="For example: My laptop"/></label><label className="ua-field">Current SARVA password<input type="password" name="currentPassword" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} required/></label><button type="submit" className="ua-primary" disabled={busy||!password||!supported||keys===null||keys.length>=10}>{busy?'Please wait…':'Enable passkey'}</button></form>
 {message&&<p role="status" className="ua-guidance">{message}</p>}
 <h2>Your enabled passkeys</h2>
 {keys===null?<><p>Passkey list unavailable or still loading.</p><button type="button" onClick={()=>setRetry(n=>n+1)} disabled={busy}>Retry loading passkeys</button></>:keys.length===0?<p>No passkeys enabled yet. You can add one to your existing SARVA account here.</p>:<ul className="pk-list">{keys.map(key=><li key={key.id}><div><strong>{key.label}</strong><span>Enabled {date(key.created_at)}</span><span>{key.last_used_at?'Last used '+date(key.last_used_at):'Not used for sign-in yet'}</span></div><button type="button" disabled={busy} onClick={()=>{setRemoveId(key.id);setPassword('');setMessage('');}}>Remove {key.label}</button></li>)}</ul>}
 {removeId&&<form onSubmit={remove} className="pk-remove"><h3>Remove this passkey from SARVA?</h3><p>You will still be able to sign in with your password or another enabled passkey.</p><label className="ua-field">Confirm SARVA password<input type="password" name="removePassword" autoComplete="current-password" required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit" disabled={busy||!password}>Confirm removal</button><button type="button" disabled={busy} onClick={()=>{setRemoveId(null);setPassword('');}}>Cancel</button></form>}
 <details className="pk-help"><summary>Using another device or a QR code</summary><p>A passkey stays in the device or passkey manager where you save it. Some managers sync it across your devices. If you only use a phone to scan a sign-in QR code, that does not automatically save a passkey on this computer. To avoid repeating that step, enable a passkey on the computer or use a manager that syncs it.</p><p>SARVA requests setup on this device. Your browser and operating system control their own prompts and may offer other methods. If this device cannot save a passkey, keep using your password. Localhost passkeys are for local testing and cannot sign in to live SARVA.</p></details>
 </section>;
}
