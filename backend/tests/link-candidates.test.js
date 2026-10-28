import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pool} from '../src/db/pool.js';
import {checkLibraryLinks} from '../src/services/linkChecker.js';
if(process.env.SARVA_ANALYTICS_TEST!=='synthetic-only')throw Error('Use isolated synthetic database');
const prefix='links-complete-'+crypto.randomUUID();
after(async()=>{await pool.query('DELETE FROM sarva.resources WHERE source_identifier LIKE $1',[prefix+'%']);await pool.end();});
test('complete dry run includes more than one batch and writes no statuses',async()=>{
 await pool.query("INSERT INTO sarva.resources(title,url,source_identifier,link_status) SELECT $1||n::text,'https://example.invalid/'||n::text,$1||n::text,'unchecked' FROM generate_series(1,251) n",[prefix]);
 const result=await checkLibraryLinks({complete:true,dryRun:true});assert.ok(result.summary.candidates>=251);assert.equal(result.summary.checked,0);
 const rows=(await pool.query('SELECT count(*)::int AS n FROM sarva.resources WHERE source_identifier LIKE $1 AND link_checked_at IS NOT NULL',[prefix+'%'])).rows[0];assert.equal(rows.n,0);
 const limited=await checkLibraryLinks({limit:50,dryRun:true});assert.ok(limited.summary.candidates<=50);
});
