import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {once} from 'node:events';
import {pool} from '../src/db/pool.js';
import {resourcesRouter} from '../src/routes/resources.js';
if(process.env.SARVA_ANALYTICS_TEST!=='synthetic-only')throw Error('Use isolated synthetic database only');
const prefix='publication-test-'+crypto.randomUUID();
const app=express();app.use('/api',resourcesRouter);const server=app.listen(0,'127.0.0.1');await once(server,'listening');
after(async()=>{await pool.query('DELETE FROM sarva.resources WHERE source_identifier LIKE $1',[prefix+'%']);await new Promise(resolve=>server.close(resolve));await pool.end();});
test('publication-year ordering is numeric, paginated and keeps unknown years last',async()=>{
 for(const [index,year] of [null,'na','', '2020','2026',' 2024 '].entries())await pool.query('INSERT INTO sarva.resources(title,publication_year,resource_type,source_identifier) VALUES($1,$2,$3,$4)',[prefix+' '+index,year,'Report',prefix+index]);
 async function page(number){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/resources?search='+prefix+'&resource_group=reports_stories&sort=publication_year&order=desc&limit=2&page='+number);assert.equal(response.status,200);return response.json();}
 const first=await page(1);assert.equal(first.pagination.total,6);
 assert.deepEqual(first.data.map(row=>row.publication_year),['2026',' 2024 ']);
 const second=await page(2);assert.equal(second.data[0].publication_year,'2020');
 const third=await page(3);
 assert.ok([...second.data.slice(1),...third.data].every(row=>[null,'na',''].includes(row.publication_year)));
});
