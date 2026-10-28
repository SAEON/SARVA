import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readReviewResponse} from '../src/config/reviewResponse.js';
test('HTML responses produce a helpful status instead of a JSON syntax error',async()=>{
 const response=new Response('<!DOCTYPE html><title>Bad Gateway</title>',{status:502,headers:{'Content-Type':'text/html'}});
 await assert.rejects(()=>readReviewResponse(response),/HTTP 502.*could not be confirmed/);
});
test('JSON assignment errors and successful saves are preserved',async()=>{
 await assert.rejects(()=>readReviewResponse(new Response(JSON.stringify({message:'Refresh before assigning.'}),{status:409})),/Refresh before assigning/);
 assert.deepEqual(await readReviewResponse(new Response(JSON.stringify({message:'Issue assigned'}))),{message:'Issue assigned'});
});
