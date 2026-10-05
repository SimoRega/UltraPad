import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const { SUPABASE_URL, SUPABASE_ANON_KEY, RLS_OWNER_TOKEN, RLS_VIEWER_TOKEN, RLS_OUTSIDER_TOKEN } = process.env;
if (![SUPABASE_URL, SUPABASE_ANON_KEY, RLS_OWNER_TOKEN, RLS_VIEWER_TOKEN, RLS_OUTSIDER_TOKEN].every(Boolean)) {
 console.error('Richiesti URL, chiave anon e tre JWT di utenti distinti in staging: RLS_OWNER_TOKEN, RLS_VIEWER_TOKEN, RLS_OUTSIDER_TOKEN. Nessun test eseguito.'); process.exit(1);
}
const db = token => createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
const owner=db(RLS_OWNER_TOKEN), viewer=db(RLS_VIEWER_TOKEN), outsider=db(RLS_OUTSIDER_TOKEN);
const rpc = async (client,op,args) => { const result=await client.rpc('mutate',{op,args}); assert.equal(result.error,null,result.error?.message); return result.data; };
const w=await rpc(owner,'create_workspace',{name:'RLS isolated test'});
try {
 const p=await rpc(owner,'create_project',{workspace_id:w.id,name:'RLS'});
 const f=await rpc(owner,'create_file',{project_id:p.id,name:'secret.txt',kind:'text'});
 assert.deepEqual((await outsider.from('files').select('*').eq('id',f.id)).data,[]);
 assert.ok((await outsider.rpc('mutate',{op:'rename_file',args:{id:f.id,name:'stolen.txt',metadata_version:1}})).error);
 const identity=await viewer.auth.getUser(RLS_VIEWER_TOKEN);assert.ok(identity.data.user?.email_confirmed_at);
 const tokenHash='f'.repeat(64);
 await rpc(owner,'create_invite',{project_id:p.id,email:identity.data.user.email,role:'viewer',token_hash:tokenHash});
 await rpc(viewer,'accept_invite',{token_hash:tokenHash});
 assert.ok((await viewer.rpc('mutate',{op:'accept_invite',args:{token_hash:tokenHash}})).error,'invite replay denied');
 assert.equal((await viewer.from('files').select('*').eq('id',f.id)).data?.length,1);
 assert.ok((await viewer.from('files').update({name:'bypass.txt'}).eq('id',f.id)).error,'direct DML denied');
 assert.ok((await viewer.rpc('mutate',{op:'create_file',args:{project_id:p.id,name:'bypass.txt',kind:'text'}})).error,'viewer RPC denied');
 await rpc(owner,'set_member',{project_id:p.id,user_id:identity.data.user.id,role:null});
 assert.deepEqual((await viewer.from('files').select('*').eq('id',f.id)).data,[]);
 const folder=await rpc(owner,'create_file',{project_id:p.id,name:'parent',kind:'folder'});
 const child=await rpc(owner,'create_file',{project_id:p.id,name:'child',kind:'folder',parent_id:folder.id});
 assert.ok((await owner.rpc('mutate',{op:'move_file',args:{id:folder.id,parent_id:child.id,metadata_version:1}})).error,'cycle denied');
 const another=await rpc(owner,'create_project',{workspace_id:w.id,name:'Other'});
 assert.ok((await owner.rpc('mutate',{op:'create_file',args:{project_id:another.id,parent_id:folder.id,name:'cross.txt',kind:'text'}})).error,'cross-project parent denied');
 console.log('PASS: tenant reads, direct DML, RPC viewer, invitation replay, revocation, cycles and cross-project FK.');
} finally { await rpc(owner,'delete_workspace',{id:w.id}); }
