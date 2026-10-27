import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeApiBase,apiUrl} from '../src/config/api.js';
test('same-origin API configuration stays rooted on nested administrator routes',()=>{
 for(const value of ['.','./','/']){
  const path=normalizeApiBase(value)+'/api/admin/users';
  assert.equal(new URL(path,'http://localhost:8095/admin/users').href,'http://localhost:8095/api/admin/users');
 }
 assert.equal(normalizeApiBase('/api/'),'/api');
 assert.equal(normalizeApiBase('https://example.invalid/api/'),'https://example.invalid/api');
 assert.equal(apiUrl('/api/auth/me'),'/api/auth/me');
 assert.equal(apiUrl('/public/example.png'),'/public/example.png');
});
