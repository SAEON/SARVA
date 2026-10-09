import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEvents} from '../src/routes/disasterEvents.js';
const event=(coordinates=[30,-25],report='https://www.gdacs.org/report.aspx?eventid=1')=>({type:'Feature',geometry:{type:'Point',coordinates},properties:{eventid:1,episodeid:1,eventtype:'FL',name:'Flood',alertlevel:'Orange',todate:'2026-10-09T00:00:00',url:{report}}});
test('filters invalid/outside points and deduplicates episodes',()=>{const b=normalizeEvents({type:'FeatureCollection',features:[event(),event(),event([90,0]),event([null,-25])]});assert.equal(b.features.length,1);assert.equal(b.features[0].properties.alertlevel,'Orange');});
test('rejects unsafe report links and malformed upstream responses',()=>{assert.equal(normalizeEvents({type:'FeatureCollection',features:[event([30,-25],'javascript:alert(1)')]}).features[0].properties.reportUrl,'');assert.throws(()=>normalizeEvents({error:'failed'}));});
