import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exploreNavigation} from '../src/config/exploreNavigation.js';
test('cached Community menus are replaced with exactly DS Lab and Contact',()=>{
 const input=[{label:'Community',items:[{label:'Communities of Practice'},{label:'Communities of Practice'},{label:'Help & Training'},{label:'Contribute Data'},{label:'Data Science Lab',to:'/ds-lab/'}]}];
 const result=exploreNavigation(input)[0];assert.deepEqual(result.items,[{label:'Data Science Lab',href:'https://ds-lab.saeon.ac.za/',external:true},{label:'Contact SARVA',to:'/contact'}]);
 assert.equal(input[0].items.length,5);
});
test('local DS Lab target is retained and other menus are unaffected',()=>{
 const result=exploreNavigation([{label:' Community ',items:[]},{label:'Data',items:[{label:'Submit Data',href:'https://example.invalid'}]}],'http://127.0.0.1:8180/');
 assert.equal(result[0].items[0].href,'http://127.0.0.1:8180/');assert.equal(result[1].items[0].label,'Submit Data');
});
