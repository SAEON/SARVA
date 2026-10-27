import {useEffect,useState} from 'react';
import {useCurrentUser} from '../hooks/useCurrentUser';
import {passkeyRequest} from '../config/passkeys';
import PasskeyManager from '../components/PasskeyManager';
import '../styles/user-admin.css';
import '../styles/passkeys.css';

export default function AccountPasskeys(){
 const {user,token}=useCurrentUser();const [status,setStatus]=useState(null);
 useEffect(()=>{let active=true;passkeyRequest('/status').then(body=>{if(active)setStatus(body.enabled);}).catch(()=>{if(active)setStatus(false);});return()=>{active=false;};},[]);
 return <div className="user-admin pk-page"><header className="ua-heading"><div><span className="ua-eyebrow">SARVA / YOUR ACCOUNT</span><h1>Passkey sign-in</h1><p>Keep your account. Make signing in easier.</p></div></header>
 {!token?<section className="ua-panel"><h2>Sign in to enable a passkey</h2><p>Use Login in the header to register or sign in with your existing SARVA account. Then return here to enable a passkey on this device. Existing users do not need to register again.</p></section>:!user?<p role="status">Checking your account…</p>:status===null?<p role="status">Checking passkey availability…</p>:status===false?<section className="ua-panel"><h2>Passkeys are not enabled on this instance</h2><p>Your normal SARVA password sign-in continues to work.</p></section>:<><p className="ua-guidance">Setting up passkeys for <strong>{user.displayName}</strong> ({user.email}). This is optional and does not change your roles or password.</p>{import.meta.env.VITE_ANALYTICS_DEMO==='true'&&<p className="ua-note">Local testing only. Enable a separate passkey on the live SARVA hostname after release.</p>}<PasskeyManager key={user.id}/></>}
 </div>;
}
