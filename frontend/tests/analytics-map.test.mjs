import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapFeatures} from '../src/config/analyticsMap.js';
test('map combines device and audience groups without exposing identities',()=>{
 const base={country:'ZA',city:'Cape Town',latitude:-34,longitude:18,views:3,clicks:1,interactions:2,user_id:99};
 const result=mapFeatures([{...base,device:'Desktop'},{...base,device:'Mobile',views:2}]);
 assert.equal(result.features.length,1);const p=result.features[0].properties;
 assert.equal(p.views,5);assert.equal(p.desktop,3);assert.equal(p.mobile,2);assert.equal(p.clicks,2);assert.equal(p.user_id,undefined);
});
test('map excludes unknown, invalid and non-page-only points, not their table totals',()=>{
 const rows=[{latitude:null,longitude:null,views:9},{latitude:95,longitude:18,views:2},{latitude:0,longitude:0,views:0,interactions:4},{latitude:0,longitude:0,views:1}];
 const map=mapFeatures(rows);assert.equal(map.features.length,1);assert.deepEqual(map.features[0].geometry.coordinates,[0,0]);assert.equal(map.features[0].properties.views,1);
});
