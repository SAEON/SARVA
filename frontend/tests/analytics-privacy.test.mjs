import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackInteraction} from '../src/config/analyticsInteraction.js';
test('interaction dispatch respects DNT and Global Privacy Control',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const oldWindow=globalThis.window;const events=[];
 globalThis.window={dispatchEvent:event=>events.push(event)};
 try {
  Object.defineProperty(globalThis,'navigator',{value:{doNotTrack:'1'},configurable:true});trackInteraction('map_layer','heat-risk');assert.equal(events.length,0);
  Object.defineProperty(globalThis,'navigator',{value:{globalPrivacyControl:true},configurable:true});trackInteraction('map_layer','heat-risk');assert.equal(events.length,0);
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});trackInteraction('map_layer','heat-risk');assert.equal(events.length,1);assert.deepEqual(events[0].detail,{action:'map_layer',subject:'heat-risk'});
 }finally {if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;globalThis.window=oldWindow;}
});
