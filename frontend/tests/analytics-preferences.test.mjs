import {test} from "node:test";
import assert from "node:assert/strict";
import {browserAnalyticsEnabled,analyticsPrivacySignal,setBrowserAnalytics,ANALYTICS_PREF_KEY,ANALYTICS_PREF_CHANGED} from "../src/config/analyticsPrivacy.js";
function browser(navigator={}) {
 const local=new Map([["sarva_auth_token","existing-login-token"]]);
 const session=new Map([["sarva_analytics_session","old-session"],["sarva_analytics_last_activity","123"],["other-draft","keep"]]);
 const events=[];
 const scope={navigator,localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value)},sessionStorage:{removeItem:key=>session.delete(key)},Event:class{constructor(type){this.type=type;}},dispatchEvent:event=>events.push(event.type)};
 return {scope,local,session,events};
}
test("opting out preserves login and drafts, clears only analytics IDs and persists a choice",()=>{
 const {scope,local,session,events}=browser();assert.equal(browserAnalyticsEnabled(scope),true);
 assert.equal(setBrowserAnalytics(false,scope),true);assert.equal(browserAnalyticsEnabled(scope),false);
 assert.equal(local.get(ANALYTICS_PREF_KEY),"off");assert.equal(local.get("sarva_auth_token"),"existing-login-token");
 assert.equal(session.has("sarva_analytics_session"),false);assert.equal(session.get("other-draft"),"keep");
 assert.deepEqual(events,[ANALYTICS_PREF_CHANGED]);
 assert.equal(setBrowserAnalytics(true,scope),true);assert.equal(browserAnalyticsEnabled(scope),true);
});
test("GPC and DNT override an allow preference",()=>{
 for(const navigator of [{globalPrivacyControl:true},{doNotTrack:"1"}]){
  const {scope}=browser(navigator);assert.equal(setBrowserAnalytics(true,scope),true);
  assert.equal(analyticsPrivacySignal(scope),true);assert.equal(browserAnalyticsEnabled(scope),false);
 }
});
test("blocked browser storage disables optional analytics without affecting sign-in storage",()=>{
 const {scope}=browser();scope.localStorage={getItem(){throw Error("blocked");},setItem(){throw Error("blocked");}};
 assert.equal(browserAnalyticsEnabled(scope),false);assert.equal(setBrowserAnalytics(false,scope),false);
});
