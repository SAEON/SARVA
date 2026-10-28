import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
async function scan(dir){const found=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())found.push(...await scan(file));else if(/\.[jt]sx?$/.test(file)){const text=await readFile(file,'utf8');if(/["']PATCH["']/.test(text))found.push(path.relative(dir,file));}}return found;}
test('application code never sends PATCH requests',async()=>assert.deepEqual(await scan(fileURLToPath(new URL('../src/',import.meta.url))),[]));
