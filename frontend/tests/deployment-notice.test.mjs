import {test} from "node:test";
import assert from "node:assert/strict";
import {deploymentInProgress} from "../src/config/deploymentNotice.js";
test("ribbon shows only an active unexpired bounded deployment",()=>{
 const start=Date.parse("2026-10-28T10:00:00Z");
 const data={active:true,startedAt:new Date(start).toISOString(),expiresAt:new Date(start+45*60000).toISOString()};
 assert.equal(deploymentInProgress(data,start+1000),true);
 assert.equal(deploymentInProgress(data,start+45*60000),false);
 assert.equal(deploymentInProgress({...data,active:false},start+1000),false);
 assert.equal(deploymentInProgress(data,start-1),false);
 assert.equal(deploymentInProgress({...data,expiresAt:new Date(start+46*60000).toISOString()},start+1000),false);
 for(const invalid of [null,{}, {active:true}, {active:"true"}, {...data,expiresAt:"bad"}]) assert.equal(deploymentInProgress(invalid,start+1000),false);
});
