import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {checkUrl} from '../src/services/linkChecker.js';
import {pool} from '../src/db/pool.js';
after(()=>pool.end());
function fake(status,redirected=false){return {status,ok:status>=200&&status<300,redirected,body:{cancel:async()=>{}}};}
test('successful destinations are active or redirected, but redirected errors are not healthy',async()=>{
 assert.deepEqual(await checkUrl('https://example.invalid',{fetchImpl:async()=>fake(200)}),{link_status:'active',link_status_code:200});
 assert.equal((await checkUrl('https://example.invalid',{fetchImpl:async()=>fake(200,true)})).link_status,'redirected');
 assert.equal((await checkUrl('https://example.invalid',{fetchImpl:async()=>fake(404,true)})).link_status,'broken');
});
test('automation restrictions and temporary failures are not broken links',async()=>{
 for(const status of [401,403,405,429,500,503])assert.equal((await checkUrl('https://example.invalid',{fetchImpl:async()=>fake(status)})).link_status,'unchecked',String(status));
 assert.deepEqual(await checkUrl('https://example.invalid',{fetchImpl:async()=>{throw Error('timeout');}}),{link_status:'unchecked',link_status_code:null});
});
test('HEAD rejection or missing response is verified with GET before classifying',async()=>{
 const methods=[];assert.equal((await checkUrl('https://example.invalid',{fetchImpl:async(_url,options)=>{methods.push(options.method);return fake(options.method==='HEAD'?403:200);}})).link_status,'active');
 assert.deepEqual(methods,['HEAD','GET']);
 for(const status of [404,410])assert.equal((await checkUrl('https://example.invalid',{fetchImpl:async()=>fake(status)})).link_status,'broken');
});
test('missing and invalid schemes never produce outgoing requests',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return fake(200);};
 assert.equal((await checkUrl(null,{fetchImpl})).link_status,'missing');
 for(const url of ['not a URL','file:///tmp/private','https://user:password@example.invalid'])assert.equal((await checkUrl(url,{fetchImpl})).link_status,'unchecked');
 assert.equal(calls,0);
});
