import {apiUrl} from './api';
import {AUTH_TOKEN_KEY} from '../hooks/useCurrentUser';
export async function passkeyRequest(path,body){
 const token=localStorage.getItem(AUTH_TOKEN_KEY);
 const response=await fetch(apiUrl('/api/auth/passkeys'+path),{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(response.status===204)return null;
 const data=await response.json();if(!response.ok)throw Error(data.message||'Passkey request failed. Please try again.');return data;
}
export function passkeyError(error){return error.name==='NotAllowedError'||error.name==='AbortError'?'Passkey request cancelled or not completed. You can still use your password.':error.name==='InvalidStateError'?'That passkey is already registered.':error.message||'Passkey request could not be completed.';}
