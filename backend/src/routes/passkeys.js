import {Router} from 'express';
import crypto from 'node:crypto';
import {isIP} from 'node:net';
import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse} from '@simplewebauthn/server';
import {verifyToken} from '../utils/authSession.js';

export function passkeyConfig(env=process.env){
 if(!env.PASSKEY_ORIGIN||!env.PASSKEY_RP_ID)return null;
 try{
  const url=new URL(env.PASSKEY_ORIGIN),rpID=env.PASSKEY_RP_ID;
  if(url.origin!==env.PASSKEY_ORIGIN||url.hostname!==rpID||isIP(rpID.replace(/^\[|\]$/g,''))||url.username||url.password)return null;
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&rpID==='localhost'))return null;
  return {origin:url.origin,rpID,secure:url.protocol==='https:'};
 }catch{return null;}
}
const cookieName='sarva_passkey_ceremony';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function cookieToken(req){const value=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);return /^[A-Za-z0-9_-]{43}$/.test(value||'')?value:null;}
const validCredential=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,1400}$/.test(value);
export function createPasskeyRouter({db,getUserById,publicUser,tokenFor,verifyPassword,config=passkeyConfig()}){
 const router=Router(),buckets=new Map();
 router.use('/auth/passkeys',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/auth/passkeys/status',(_req,res)=>res.json({enabled:!!config,preference:'this-device'}));
 router.use('/auth/passkeys',(req,res,next)=>{
  if(!config)return res.status(503).json({message:'Passkeys are not enabled on this instance.'});
  if(req.method!=='GET'&&req.get('origin')!==config.origin)return res.status(403).json({message:'Passkey request origin is not allowed.'});
  const key=req.ip||req.socket.remoteAddress||'local',now=Date.now();
  const bucket=buckets.get(key);const entry=!bucket||now-bucket.at>60000?{at:now,count:1}:{at:bucket.at,count:bucket.count+1};
  if(buckets.size>10000)buckets.clear();buckets.set(key,entry);
  if(entry.count>30){res.set('Retry-After','60');return res.status(429).json({message:'Too many passkey attempts. Try again in a minute.'});}
  next();
 });
 async function actor(req){
  const header=String(req.headers.authorization||'');let payload;
  try{payload=header.startsWith('Bearer ')?verifyToken(header.slice(7)):null;}catch{return null;}
  if(!payload||!/^[0-9]+$/.test(String(payload.sub)))return null;
  return getUserById(payload.sub);
 }
 async function passwordOK(user,password){
  if(typeof password!=='string'||password.length>1000)return false;
  const row=(await db.query('SELECT password_hash,password_salt FROM sarva.app_user WHERE id=$1 AND is_active',[user.id])).rows[0];
  return !!row&&verifyPassword(password,row.password_salt,row.password_hash);
 }
 async function remember(req,res,purpose,challenge,userId=null){
  const previous=cookieToken(req);if(previous)await db.query('DELETE FROM sarva.passkey_challenge WHERE token_hash=$1',[digest(previous)]);
  await db.query('DELETE FROM sarva.passkey_challenge WHERE expires_at<=now()');
  const token=crypto.randomBytes(32).toString('base64url');
  await db.query('INSERT INTO sarva.passkey_challenge(token_hash,challenge,purpose,user_id,rp_id,origin) VALUES($1,$2,$3,$4,$5,$6)',[digest(token),challenge,purpose,userId,config.rpID,config.origin]);
  res.cookie(cookieName,token,{httpOnly:true,secure:config.secure,sameSite:'strict',path:'/api/auth/passkeys',maxAge:300000});
 }
 async function consume(req,res,purpose){
  const token=cookieToken(req);res.clearCookie(cookieName,{httpOnly:true,secure:config.secure,sameSite:'strict',path:'/api/auth/passkeys'});
  if(!token)return null;
  return (await db.query('DELETE FROM sarva.passkey_challenge WHERE token_hash=$1 AND purpose=$2 AND rp_id=$3 AND origin=$4 AND expires_at>now() RETURNING *',[digest(token),purpose,config.rpID,config.origin])).rows[0]||null;
 }
 const safe=handler=>async(req,res)=>{try{await handler(req,res);}catch(error){
  if(error.code==='23505')return res.status(409).json({message:'This passkey is already registered.'});
  res.status(400).json({message:'Passkey verification failed. Start again or sign in with your password.'});
 }};
 router.get('/auth/passkeys',safe(async(req,res)=>{
  const user=await actor(req);if(!user)return res.sendStatus(401);
  const rows=(await db.query('SELECT credential_id AS id,label,created_at,last_used_at,device_type,backed_up FROM sarva.account_passkey WHERE user_id=$1 AND rp_id=$2 ORDER BY created_at',[user.id,config.rpID])).rows;
  res.json({data:rows});
 }));
 router.post('/auth/passkeys/register/options',safe(async(req,res)=>{
  const user=await actor(req);if(!user)return res.sendStatus(401);
  if(!await passwordOK(user,req.body?.password))return res.status(401).json({message:'Confirm your current SARVA password to add a passkey.'});
  const existing=(await db.query('SELECT credential_id,transports FROM sarva.account_passkey WHERE user_id=$1 AND rp_id=$2',[user.id,config.rpID])).rows;
  if(existing.length>=10)return res.status(409).json({message:'Remove an unused passkey before adding another.'});
  await db.query('INSERT INTO sarva.passkey_identity(user_id,rp_id,user_handle) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[user.id,config.rpID,crypto.randomBytes(32)]);
  const handle=(await db.query('SELECT user_handle FROM sarva.passkey_identity WHERE user_id=$1 AND rp_id=$2',[user.id,config.rpID])).rows[0].user_handle;
  const options=await generateRegistrationOptions({rpName:'SARVA',rpID:config.rpID,userID:new Uint8Array(handle),userName:user.email,userDisplayName:user.display_name,
   attestationType:'none',preferredAuthenticatorType:'localDevice',authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'required',userVerification:'required'},supportedAlgorithmIDs:[-7,-257],
   excludeCredentials:existing.map(row=>({id:row.credential_id,transports:row.transports}))});
  options.hints=['client-device'];
  await remember(req,res,'register',options.challenge,user.id);res.json(options);
 }));
 router.post('/auth/passkeys/register/verify',safe(async(req,res)=>{
  const user=await actor(req);if(!user)return res.sendStatus(401);
  const challenge=await consume(req,res,'register');if(!challenge||String(challenge.user_id)!==String(user.id))return res.sendStatus(400);
  if(req.body?.credential?.authenticatorAttachment==='cross-platform')return res.status(400).json({message:'Enable a passkey saved on this device. Your password remains available.'});
  const result=await verifyRegistrationResponse({response:req.body?.credential,expectedChallenge:challenge.challenge,expectedOrigin:config.origin,expectedRPID:config.rpID,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});
  if(!result.verified)return res.sendStatus(400);
  const {credential,credentialDeviceType,credentialBackedUp}=result.registrationInfo;
  const label=typeof req.body.label==='string'?req.body.label.replace(/[\x00-\x1f]/g,'').trim().slice(0,80):'My passkey';
  const client=await db.connect();
  try{
   await client.query('BEGIN');
   const active=await client.query('SELECT id FROM sarva.app_user WHERE id=$1 AND is_active FOR UPDATE',[user.id]);
   if(!active.rowCount)throw Error('Account inactive');
   const count=await client.query('SELECT count(*)::integer AS count FROM sarva.account_passkey WHERE user_id=$1 AND rp_id=$2',[user.id,config.rpID]);
   if(count.rows[0].count>=10)throw Error('Passkey limit reached');
   await client.query('INSERT INTO sarva.account_passkey(rp_id,credential_id,user_id,public_key,counter,transports,device_type,backed_up,label) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[config.rpID,credential.id,user.id,Buffer.from(credential.publicKey),credential.counter,JSON.stringify(credential.transports||[]),credentialDeviceType,credentialBackedUp,label||'My passkey']);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  res.json({verified:true});
 }));
 router.post('/auth/passkeys/login/options',safe(async(req,res)=>{
  const options=await generateAuthenticationOptions({rpID:config.rpID,userVerification:'required'});
  options.hints=['client-device'];
  await remember(req,res,'authenticate',options.challenge);res.json(options);
 }));
 router.post('/auth/passkeys/login/verify',safe(async(req,res)=>{
  const challenge=await consume(req,res,'authenticate'),credential=req.body?.credential;
  if(!challenge||!validCredential(credential?.id))return res.sendStatus(401);
  const client=await db.connect();let userId;
  try{
   await client.query('BEGIN');
   const row=(await client.query(`SELECT p.*,i.user_handle FROM sarva.account_passkey p JOIN sarva.passkey_identity i ON i.user_id=p.user_id AND i.rp_id=p.rp_id JOIN sarva.app_user u ON u.id=p.user_id WHERE p.rp_id=$1 AND p.credential_id=$2 AND u.is_active FOR UPDATE OF p FOR SHARE OF u`,[config.rpID,credential.id])).rows[0];
   if(!row||credential.response?.userHandle!==Buffer.from(row.user_handle).toString('base64url'))throw Error('Unknown credential');
   const result=await verifyAuthenticationResponse({response:credential,expectedChallenge:challenge.challenge,expectedOrigin:config.origin,expectedRPID:config.rpID,requireUserVerification:true,
    credential:{id:row.credential_id,publicKey:new Uint8Array(row.public_key),counter:Number(row.counter),transports:row.transports}});
   if(!result.verified)throw Error('Invalid assertion');
   await client.query('UPDATE sarva.account_passkey SET counter=$1,last_used_at=now() WHERE rp_id=$2 AND credential_id=$3',[result.authenticationInfo.newCounter,config.rpID,row.credential_id]);
   userId=row.user_id;await client.query('COMMIT');
  }catch{await client.query('ROLLBACK');return res.status(401).json({message:'Passkey sign-in failed. Start again or use your password.'});}finally{client.release();}
  const user=await getUserById(userId);if(!user)return res.sendStatus(401);
  await db.query('UPDATE sarva.app_user SET last_login_at=now() WHERE id=$1',[user.id]);
  res.json({status:'ok',data:{user:publicUser(user),token:tokenFor(user)}});
 }));
 router.post('/auth/passkeys/remove',safe(async(req,res)=>{
  const user=await actor(req);if(!user)return res.sendStatus(401);
  if(!await passwordOK(user,req.body?.password))return res.status(401).json({message:'Confirm your SARVA password to remove a passkey.'});
  if(!validCredential(req.body?.id))return res.sendStatus(400);
  const removed=await db.query('DELETE FROM sarva.account_passkey WHERE rp_id=$1 AND user_id=$2 AND credential_id=$3 RETURNING credential_id',[config.rpID,user.id,req.body.id]);
  if(!removed.rowCount)return res.status(404).json({message:'Passkey not found on your account.'});
  res.sendStatus(204);
 }));
 return router;
}
