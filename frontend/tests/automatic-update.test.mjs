import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldReload,watchAutomaticUpdate} from '../src/config/automaticUpdate.js';
const old='11111111-1111-4111-8111-111111111111',fresh='22222222-2222-4222-8222-222222222222';
test('refresh requires a new valid version, idle visible page and no work in progress',()=>{
 const state={current:old,latest:fresh,hidden:false,dirty:false,busy:false,idleMs:15000,attempted:null};
 assert.equal(shouldReload(state),true);
 for(const patch of [{latest:old},{latest:'<!DOCTYPE html>'},{hidden:true},{dirty:true},{busy:true},{idleMs:14999},{attempted:fresh}])assert.equal(shouldReload({...state,...patch}),false);
});
function setup(fetchVersion=async()=>({ok:true,json:async()=>({version:fresh})}),onAvailable=()=>{}){
 let time=0,reloads=0,busy=false,passwords=[];const listeners=new Map(),timers=new Map(),storage=new Map();
 const doc={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),querySelector:()=>busy?{}:null,querySelectorAll:()=>passwords};
 const win={sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},location:{reload:()=>reloads++},setInterval:(fn,ms)=>{timers.set(ms,fn);return ms;},clearInterval:ms=>timers.delete(ms)};
 const stop=watchAutomaticUpdate({win,doc,current:old,fetchVersion,now:()=>time,onAvailable});
 return {doc,win,stop,listeners,advance:ms=>{time+=ms;timers.get(5000)?.();},emit:(name,target)=>listeners.get(name)?.({target}),reloads:()=>reloads,setBusy:value=>busy=value,setPasswords:value=>passwords=value};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('new version automatically refreshes once, after idle time, without changing login storage',async()=>{
 const s=setup();s.win.sessionStorage.setItem('login-test','unchanged');await settle();assert.equal(s.reloads(),0);
 s.advance(15000);assert.equal(s.reloads(),1);s.advance(15000);assert.equal(s.reloads(),1);
 assert.equal(s.win.sessionStorage.getItem('login-test'),'unchanged');s.stop();assert.equal(s.listeners.size,0);
});
test('editing, pending submission and a password defer reload until safe',async()=>{
 const s=setup();await settle();const field={value:'',isConnected:true,matches:()=>true};
 s.emit('focusin',field);field.value='unfinished report';s.emit('input',field);s.advance(20000);assert.equal(s.reloads(),0);
 field.value='';s.emit('input',field);s.setBusy(true);s.advance(20000);assert.equal(s.reloads(),0);
 s.setBusy(false);s.setPasswords([{value:'private'}]);s.advance(20000);assert.equal(s.reloads(),0);
 s.setPasswords([]);s.advance(5000);assert.equal(s.reloads(),1);s.stop();
});
test('failed version request and hidden tabs do not refresh',async()=>{
 const bad=setup(async()=>{throw Error('offline');});await settle();bad.advance(60000);assert.equal(bad.reloads(),0);bad.stop();
 const s=setup();await settle();s.doc.hidden=true;s.advance(20000);assert.equal(s.reloads(),0);s.stop();
});

test('announces a new version even while editing prevents automatic refresh',async()=>{
 const versions=[];const s=setup(undefined,version=>versions.push(version));s.setBusy(true);await settle();
 assert.deepEqual(versions,[fresh]);s.advance(20000);assert.equal(s.reloads(),0);s.stop();
});
test('invalid version responses do not announce an update',async()=>{
 const versions=[];const s=setup(async()=>({ok:true,json:async()=>({version:'<!DOCTYPE html>'})}),version=>versions.push(version));
 await settle();assert.deepEqual(versions,[]);s.stop();
});
