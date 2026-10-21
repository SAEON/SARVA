import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {locationFor,audienceFor} from '../src/utils/analyticsAudience.js';
test('GeoIP upgrade preserves private, invalid and public address classification',()=>{
 for(const ip of ['127.0.0.1','192.168.115.77','::1','::ffff:10.0.0.1','fe80::1'])assert.equal(locationFor(ip).locationSource,'local/private network');
 for(const ip of ['', 'not-an-ip','0127.0.0.1'])assert.equal(locationFor(ip).locationSource,'unknown');
 for(const ip of ['8.8.8.8','2001:4860:4860::8888']){const result=locationFor(ip);assert.equal(result.locationSource,'approximate IP location');assert.match(result.country,/^[A-Z]{2}$/);}
 assert.equal(audienceFor({get:()=> 'Mozilla/5.0 Chrome/130.0',ip:'127.0.0.1',socket:{}}).browser,'Chrome');
});
test('Express proxy dependency updates retain configured trust boundary',async()=>{
 const app=express();app.set('trust proxy',['loopback']);app.get('/',(req,res)=>res.json({ip:req.ip,ips:req.ips}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{const r=await fetch('http://127.0.0.1:'+server.address().port,{headers:{'X-Forwarded-For':'198.51.100.8, 192.168.1.2'}});const body=await r.json();assert.equal(body.ip,'192.168.1.2');assert.deepEqual(body.ips,['192.168.1.2']);}finally{await new Promise(resolve=>server.close(resolve));}
});
