import {test} from "node:test";
import assert from "node:assert/strict";
import {exploreNavigation} from "../src/config/exploreNavigation.js";
test("cached and live menu records remove Ocean and link to current Explore tools",()=>{
 const groups=[{label:"Maps & Tools",items:[{label:"Ocean Data Explorer Tool",href:"https://dash.saeon.ac.za/apps/ocean/PELTER"},{label:"SARVA Atlas Gallery",href:"https://sarva.saeon.ac.za/atlas/",external:true},{label:"National Climate Change Information System",href:"old",external:true},{label:"Municipal Risk Profiler",to:"/municipal-risk-profiler"}]}];
 const before=JSON.stringify(groups);const result=exploreNavigation(groups)[0].items;
 assert.equal(result.length,3);assert.equal(result[0].label,"Atlases, tools and links");assert.equal(result[0].to,"/explore#atlas-tools");assert.equal(result[0].href,null);assert.equal(result[0].external,false);
 assert.equal(result[1].href,"https://nccis.saeon.ac.za/");assert.equal(result[2].to,"/municipal-risk-profiler");assert.equal(JSON.stringify(groups),before);
});

test("Explore is a direct link even when cached navigation contains dropdown items",()=>{
 const source=[{label:"EXPLORE",to:"/overview",items:[{label:"Explore South Africa",to:"/overview"}]},{label:"Data",items:[{label:"Search",to:"/search"}]}];
 const result=exploreNavigation(source);
 assert.equal(result[0].to,"/explore");assert.deepEqual(result[0].items,[]);
 assert.equal(source[0].items.length,1);assert.equal(result[1].items.length,1);
});
