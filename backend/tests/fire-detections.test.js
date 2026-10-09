import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDetections} from '../src/routes/fireDetections.js';
test('filters location, invalid times and old detections while preserving UTC properties',()=>{
 const csv='latitude,longitude,acq_date,acq_time,satellite,confidence,frp\n-30,25,2026-10-09,0905,N,nominal,4.5\n40,25,2026-10-09,0905,N,nominal,5\n-30,25,2026-09-01,0905,N,nominal,5\n-30,25,invalid,0905,N,nominal,5';
 const rows=parseDetections(csv,Date.parse('2026-10-09T10:05:00Z'));
 assert.equal(rows.length,1);assert.equal(rows[0].properties.ageHours,1);assert.equal(rows[0].properties.frp,4.5);assert.deepEqual(rows[0].geometry.coordinates,[25,-30]);
});
