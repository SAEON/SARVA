import {test,before,after} from 'node:test';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {pool} from '../src/db/pool.js';
import {authRouter} from '../src/routes/auth.js';
import {createPasskeyRouter,passkeyConfig} from '../src/routes/passkeys.js';
if(process.env.PASSKEY_TEST!=='synthetic-only')throw Error('Use only the synthetic passkey database');
const origin=process.env.PASSKEY_ORIGIN;
const app=express();app.set('trust proxy',true);app.use(express.json());app.use('/api',authRouter);
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port+'/api/auth';
let actor,other,access,otherAccess,key,credentialId,handle;let ip=10;
const password=crypto.randomBytes(24).toString('base64url');
async function request(path,body,token,cookie,requestOrigin=origin){return fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','Origin':requestOrigin,'X-Forwarded-For':'198.51.100.'+(ip++),...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
const cookie=response=>{const header=response.headers.get('set-cookie');assert.match(header,/HttpOnly/i);assert.match(header,/SameSite=Strict/i);return header.split(';')[0];};
async function options(kind,token){const response=await request('/passkeys/'+kind+'/options',kind==='register'?{password}:{},token);assert.equal(response.status,200);return {options:await response.json(),cookie:cookie(response)};}
function cbor(value){
 const head=(major,n)=>n<24?Buffer.from([(major<<5)|n]):n<256?Buffer.from([(major<<5)|24,n]):Buffer.from([(major<<5)|25,n>>8,n&255]);
 if(Buffer.isBuffer(value)||value instanceof Uint8Array){const bytes=Buffer.from(value);return Buffer.concat([head(2,bytes.length),bytes]);}
 if(typeof value==='string'){const bytes=Buffer.from(value);return Buffer.concat([head(3,bytes.length),bytes]);}
 if(typeof value==='number')return head(value<0?1:0,value<0?-1-value:value);
 if(value instanceof Map)return Buffer.concat([head(5,value.size),...[...value].flatMap(([k,v])=>[cbor(k),cbor(v)])]);
 throw Error('Unsupported test CBOR type');
}
const hash=value=>crypto.createHash('sha256').update(value).digest();
function registration(challenge,withUV=true,clientOrigin=origin){
 key=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const jwk=key.publicKey.export({format:'jwk'});
 const id=crypto.randomBytes(32);credentialId=id.toString('base64url');
 const publicKey=cbor(new Map([[1,2],[3,-7],[-1,1],[-2,Buffer.from(jwk.x,'base64url')],[-3,Buffer.from(jwk.y,'base64url')]]));
 const authData=Buffer.concat([hash('localhost'),Buffer.from([withUV?0x45:0x41]),Buffer.alloc(4),Buffer.alloc(16),Buffer.from([0,id.length]),id,publicKey]);
 return {id:credentialId,rawId:credentialId,type:'public-key',authenticatorAttachment:'platform',response:{clientDataJSON:Buffer.from(JSON.stringify({type:'webauthn.create',challenge,origin:clientOrigin,crossOrigin:false})).toString('base64url'),attestationObject:cbor(new Map([['fmt','none'],['attStmt',new Map()],['authData',authData]])).toString('base64url'),transports:['internal']},clientExtensionResults:{}};
}
function assertion(challenge,counter=1,clientOrigin=origin,withUV=true,rpID='localhost'){
 const client=Buffer.from(JSON.stringify({type:'webauthn.get',challenge,origin:clientOrigin,crossOrigin:false}));
 const number=Buffer.alloc(4);number.writeUInt32BE(counter);
 const authData=Buffer.concat([hash(rpID),Buffer.from([withUV?5:1]),number]);
 return {id:credentialId,rawId:credentialId,type:'public-key',response:{clientDataJSON:client.toString('base64url'),authenticatorData:authData.toString('base64url'),signature:crypto.sign('sha256',Buffer.concat([authData,hash(client)]),key.privateKey).toString('base64url'),userHandle:handle},clientExtensionResults:{}};
}
before(async()=>{
 for(let i=0;i<2;i++){
  const response=await request('/register',{email:crypto.randomUUID()+'@example.invalid',displayName:'Synthetic passkey user',password});assert.equal(response.status,201);const body=await response.json();
  if(i===0){actor=body.data.user;access=body.data.token;}else{other=body.data.user;otherAccess=body.data.token;}
 }
});
after(async()=>{await pool.query('DELETE FROM sarva.app_user WHERE id=ANY($1::bigint[])',[[actor?.id,other?.id].filter(Boolean)]);await new Promise(resolve=>server.close(resolve));await pool.end();});
test('configuration requires exact trusted HTTPS hostname or localhost',()=>{
 assert.equal(passkeyConfig({}),null);
 assert.equal(passkeyConfig({PASSKEY_ORIGIN:'https://[::1]',PASSKEY_RP_ID:'[::1]'}),null);
 assert.equal(passkeyConfig({PASSKEY_ORIGIN:'http://sarva.saeon.ac.za',PASSKEY_RP_ID:'sarva.saeon.ac.za'}),null);
 assert.equal(passkeyConfig({PASSKEY_ORIGIN:'https://evil.example',PASSKEY_RP_ID:'sarva.saeon.ac.za'}),null);
 assert.equal(passkeyConfig({PASSKEY_ORIGIN:'http://127.0.0.1:8095',PASSKEY_RP_ID:'127.0.0.1'}),null);
 assert.ok(passkeyConfig({PASSKEY_ORIGIN:'https://sarva.saeon.ac.za',PASSKEY_RP_ID:'sarva.saeon.ac.za'}));
});
test('enrollment requires an active signed-in account and current password',async()=>{
 assert.equal((await request('/passkeys/register/options',{password})).status,401);
 assert.equal((await request('/passkeys/register/options',{password:'wrong'},access)).status,401);
 assert.equal((await request('/passkeys/register/options',{password},access,null,'https://evil.example')).status,403);
});
test('real WebAuthn verifier rejects missing user verification and consumes challenge once',async()=>{
 const ceremony=await options('register',access);const credential=registration(ceremony.options.challenge,false);
 assert.equal((await request('/passkeys/register/verify',{credential},access,ceremony.cookie)).status,400);
 assert.equal((await request('/passkeys/register/verify',{credential},access,ceremony.cookie)).status,400);
});
test('expired challenges and another account cannot enroll',async()=>{
 let ceremony=await options('register',access);let credential=registration(ceremony.options.challenge);
 assert.equal((await request('/passkeys/register/verify',{credential},otherAccess,ceremony.cookie)).status,400);
 ceremony=await options('register',access);credential=registration(ceremony.options.challenge);
 await pool.query('UPDATE sarva.passkey_challenge SET expires_at=now()-make_interval(mins => 1) WHERE user_id=$1',[actor.id]);
 assert.equal((await request('/passkeys/register/verify',{credential},access,ceremony.cookie)).status,400);
});
test('device setup rejects a reported roaming authenticator and consumes its challenge',async()=>{
 const ceremony=await options('register',access);const credential=registration(ceremony.options.challenge);
 credential.authenticatorAttachment='cross-platform';
 assert.equal((await request('/passkeys/register/verify',{credential},access,ceremony.cookie)).status,400);
 credential.authenticatorAttachment='platform';
 assert.equal((await request('/passkeys/register/verify',{credential},access,ceremony.cookie)).status,400);
});
test('discoverable sign-in prefers the current device and does not enumerate accounts',async()=>{
 const ceremony=await options('login');assert.deepEqual(ceremony.options.hints,['client-device']);assert.equal(ceremony.options.userVerification,'required');assert.ok(!ceremony.options.allowCredentials?.length);
});
test('registers a cryptographically valid passkey and exposes metadata only',async()=>{
 const ceremony=await options('register',access);handle=ceremony.options.user.id;
 assert.equal(ceremony.options.authenticatorSelection.userVerification,'required');
 assert.equal(ceremony.options.authenticatorSelection.authenticatorAttachment,'platform');
 assert.equal(ceremony.options.authenticatorSelection.residentKey,'required');
 assert.deepEqual(ceremony.options.hints,['client-device']);
 const credential=registration(ceremony.options.challenge);
 const response=await request('/passkeys/register/verify',{credential,label:'Test authenticator'},access,ceremony.cookie);assert.equal(response.status,200);
 const list=await(await request('/passkeys',null,access)).json();assert.equal(list.data.length,1);assert.equal(list.data[0].label,'Test authenticator');assert.equal(list.data[0].public_key,undefined);
 const others=await(await request('/passkeys',null,otherAccess)).json();assert.equal(others.data.length,0);
});
test('login verifies signature, account binding and roles, and blocks replay',async()=>{
 const ceremony=await options('login');const response=await request('/passkeys/login/verify',{credential:assertion(ceremony.options.challenge)},null,ceremony.cookie);assert.equal(response.status,200);
 const body=await response.json();assert.equal(String(body.data.user.id),String(actor.id));assert.deepEqual(body.data.user.roles.map(role=>role.name),['viewer']);assert.ok(body.data.token);
 const session=JSON.parse(Buffer.from(body.data.token.split('.')[0],'base64url'));assert.equal(session.exp-session.iat,30*24*60*60);
 assert.equal((await request('/passkeys/login/verify',{credential:assertion(ceremony.options.challenge,2)},null,ceremony.cookie)).status,401);
});
test('wrong origin/RP/challenge, tampered signature, missing UV, mismatched handle and stale counter are rejected',async()=>{
 for(const mode of ['origin','rp','challenge','signature','uv','handle','counter']){
  const ceremony=await options('login');const credential=assertion(mode==='challenge'?'wrong-challenge':ceremony.options.challenge,mode==='counter'?1:2,mode==='origin'?'https://evil.example':origin,mode!=='uv',mode==='rp'?'evil.example':'localhost');
  if(mode==='handle')credential.response.userHandle='someone-else';
  if(mode==='signature'){const bytes=Buffer.from(credential.response.signature,'base64url');bytes[bytes.length-1]^=1;credential.response.signature=bytes.toString('base64url');}
  assert.equal((await request('/passkeys/login/verify',{credential},null,ceremony.cookie)).status,401,mode);
 }
});
test('inactive accounts cannot authenticate using a previously valid passkey',async()=>{
 await pool.query('UPDATE sarva.app_user SET is_active=false WHERE id=$1',[actor.id]);
 const ceremony=await options('login');assert.equal((await request('/passkeys/login/verify',{credential:assertion(ceremony.options.challenge,2)},null,ceremony.cookie)).status,401);
 await pool.query('UPDATE sarva.app_user SET is_active=true WHERE id=$1',[actor.id]);
});
test('only the owner with current password can remove a key; password fallback survives',async()=>{
 assert.equal((await request('/passkeys/remove',{id:credentialId,password:'wrong'},access)).status,401);
 assert.equal((await request('/passkeys/remove',{id:credentialId,password},otherAccess)).status,404);
 assert.equal((await(await request('/passkeys',null,access)).json()).data.length,1);
 assert.equal((await request('/passkeys/remove',{id:credentialId,password},access)).status,204);
 assert.equal((await(await request('/passkeys',null,access)).json()).data.length,0);
 const fallback=await request('/login',{email:actor.email,password});assert.equal(fallback.status,200);
 const fallbackBody=await fallback.json();const session=JSON.parse(Buffer.from(fallbackBody.data.token.split('.')[0],'base64url'));assert.equal(session.exp-session.iat,12*60*60);
});

test('passkeys remain disabled without explicit configuration',async()=>{
 const disabled=express();disabled.use(express.json());disabled.use('/api',createPasskeyRouter({db:pool,config:null}));const instance=disabled.listen(0,'127.0.0.1');await once(instance,'listening');
 try{const url='http://127.0.0.1:'+instance.address().port+'/api/auth/passkeys';assert.equal((await(await fetch(url+'/status')).json()).enabled,false);assert.equal((await fetch(url+'/login/options',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);}finally{await new Promise(resolve=>instance.close(resolve));}
});
test('rate limits repeated attempts without relying on untrusted body fields',async()=>{
 let response;
 for(let i=0;i<31;i++)response=await fetch(base+'/passkeys/login/options',{method:'POST',headers:{'Content-Type':'application/json','Origin':origin,'X-Forwarded-For':'198.51.100.250'},body:'{}'});
 assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
});
