import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visitorIpHash} from '../src/utils/analyticsVisitor.js';
import {reviewPage} from '../src/utils/reviewPage.js';
test('IP hashing uses the trusted address, canonicalizes IPv6 and does not expose IPs',()=>{
 process.env.AUTH_SECRET='synthetic-only-hmac-key';
 const req=ip=>({ip,socket:{remoteAddress:'172.19.0.3'},headers:{'x-forwarded-for':'attacker'}});
 const a=visitorIpHash(req('8.8.8.8'));
 assert.match(a,/^[a-f0-9]{64}$/);assert.equal(a,visitorIpHash(req('::ffff:8.8.8.8')));
 assert.notEqual(a,visitorIpHash(req('1.1.1.1')));
 assert.equal(visitorIpHash(req('2001:0db8:0:0:0:0:0:1')),visitorIpHash(req('2001:db8::1')));
 assert.equal(visitorIpHash(req('not-an-ip')),null);
});
test('page values are optional and pasted URL secrets are discarded',()=>{
 for(const value of [null,undefined,'','  '])assert.equal(reviewPage(value),'');
 assert.equal(reviewPage('explore'),'/explore');
 assert.equal(reviewPage('https://sarva.saeon.ac.za/?secret=private#x'),'/');
 for(const value of ['//evil.invalid','data:text/html,x','/bad\\path','https://evil.invalid/'])assert.throws(()=>reviewPage(value));
});
