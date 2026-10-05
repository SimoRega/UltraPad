import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from '../scripts/local-config.mjs';
const root=resolve(import.meta.dirname,'..');
async function fixture(work) {
 const directory=await mkdtemp(join(tmpdir(),'ultrapad-setup-'));
 try {
  await mkdir(join(directory,'scripts'));await mkdir(join(directory,'apps/api'),{recursive:true});
  for(const file of ['scripts/setup-local.mjs','scripts/local-config.mjs','.env.example']) await copyFile(join(root,file),join(directory,file));
  await work(directory);
 } finally { await rm(directory,{recursive:true,force:true}); }
}
function run(directory,input) { return spawnSync(process.execPath,[join(directory,'scripts/setup-local.mjs')],{input,encoding:'utf8',timeout:10000}); }
test('project defaults configure both clients without overwriting unrelated settings',()=>fixture(async directory=>{
 await writeFile(join(directory,'.env'),'# user settings\nVITE_API_URL=http://old.invalid\nCUSTOM=keep\n');
 await writeFile(join(directory,'apps/api/.dev.vars'),'CHECKPOINT_SERVICE_ROLE=test-only-private-value\n');
 const result=run(directory,'\n');assert.equal(result.status,0,result.stderr);
 const web=parseEnv(await readFile(join(directory,'.env'),'utf8'));const api=parseEnv(await readFile(join(directory,'apps/api/.dev.vars'),'utf8'));
 assert.equal(web.VITE_SUPABASE_URL,'https://iqlxqzfivunyudfaxjlr.supabase.co');
 assert.equal(web.VITE_SUPABASE_ANON_KEY,api.SUPABASE_ANON_KEY);assert.match(web.VITE_SUPABASE_ANON_KEY,/^sb_publishable_/);
 assert.equal(web.CUSTOM,'keep');assert.equal(api.CHECKPOINT_SERVICE_ROLE,'test-only-private-value');
 assert.ok(!result.stdout.includes(web.VITE_SUPABASE_ANON_KEY));assert.ok(!result.stdout.includes(api.CHECKPOINT_SERVICE_ROLE));
}));
test('privileged keys are rejected before either configuration file changes',()=>fixture(async directory=>{
 await writeFile(join(directory,'.env'),'CUSTOM=keep\n');await writeFile(join(directory,'apps/api/.dev.vars'),'CUSTOM=keep\n');
 for(const key of ['sb_secret_test_only',`a.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.b`]) {
  const result=run(directory,`${key}\n`);assert.equal(result.status,1);
  assert.equal(await readFile(join(directory,'.env'),'utf8'),'CUSTOM=keep\n');
  assert.equal(await readFile(join(directory,'apps/api/.dev.vars'),'utf8'),'CUSTOM=keep\n');
 }
}));
test('running setup again keeps an existing public key on the same project',()=>fixture(async directory=>{
 const key='sb_publishable_test_only_replacement';assert.equal(run(directory,`${key}\n`).status,0);
 assert.equal(run(directory,'\n').status,0);
 assert.equal(parseEnv(await readFile(join(directory,'.env'),'utf8')).VITE_SUPABASE_ANON_KEY,key);
}));
