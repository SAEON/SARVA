import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAnalyticsPage} from '../src/config/analyticsPage.js';
test('known public and account pages may emit analytics',()=>{
 for(const path of ['/','/search','/testing','/admin/users','/account/passkeys','/themes/water'])assert.equal(isAnalyticsPage(path),true,path);
});
test('unknown and sensitive detail paths and analytics/privacy pages emit no events',()=>{
 for(const path of ['/unknown','/testing/10','/testing?email=private','/admin/users/123','/account/passkeys/private','/analytics','/data-health','/privacy',null])assert.equal(isAnalyticsPage(path),false,String(path));
});
