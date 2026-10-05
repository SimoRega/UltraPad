import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const viewer = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
async function asUser(user: string) {
  await db.exec('RESET ROLE'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); await db.exec('SET ROLE authenticated');
}
async function mutate<T = { id: string }>(op: string, args: Record<string, unknown>) {
  const result=await db.query<{ value: T }>('select public.mutate($1,$2::jsonb) value',[op,JSON.stringify(args)]);return result.rows[0].value;
}
beforeAll(async()=>{
  await db.exec(`create schema auth; create schema extensions; create role anon; create role authenticated; create role service_role;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;`);
  for(const [uid,email] of [[owner,'owner@test.invalid'],[viewer,'viewer@test.invalid'],[outsider,'other@test.invalid']]) await db.query('insert into auth.users values($1,$2,now())',[uid,email]);
  const sql=await readFile(new URL('../../../supabase/migrations/202610050001_core.sql',import.meta.url),'utf8');
  // gen_random_uuid is built into Postgres. pgcrypto is not bundled with PGlite and is unused by this migration.
  await db.exec(sql.replace('create extension if not exists pgcrypto with schema extensions;',''));
  await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;`);
  await db.exec(await readFile(new URL('../../../supabase/migrations/202610050002_checkpoints.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../../supabase/migrations/202610050003_quotas.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../../supabase/migrations/202610050004_v11.sql',import.meta.url),'utf8'));
},30000);
afterAll(()=>db.close());
it('executes the actual migration and enforces tenant RLS, roles, invites, FK and folder cycles',async()=>{
 await asUser(owner);const w=await mutate('create_workspace',{name:'Tests'});const p=await mutate('create_project',{workspace_id:w.id,name:'Private'});
 const f=await mutate('create_file',{project_id:p.id,name:'secret.txt',kind:'text'});
 await asUser(outsider);expect((await db.query('select * from public.files')).rows).toEqual([]);
 await expect(mutate('rename_file',{id:f.id,name:'stolen.txt',metadata_version:1})).rejects.toThrow('FORBIDDEN');
 await asUser(owner);await mutate('create_invite',{project_id:p.id,email:'viewer@test.invalid',role:'viewer',token_hash:'hash'});
 await asUser(outsider);await expect(mutate('accept_invite',{token_hash:'hash'})).rejects.toThrow('INVITATION_IDENTITY');
 await asUser(viewer);await mutate('accept_invite',{token_hash:'hash'});
 await expect(mutate('accept_invite',{token_hash:'hash'})).rejects.toThrow('INVALID_INVITATION');
 expect((await db.query('select * from public.files')).rows).toHaveLength(1);
 await db.exec('RESET ROLE');
 await db.query("insert into public.document_checkpoints(id,file_id,generation,server_seq,storage_key,checksum,label,size_bytes) values(gen_random_uuid(),$1,1,1,'scoped.yjs','abc','test',100)",[f.id]);
 await db.exec("insert into storage.objects(bucket_id,name) values('ultrapad-checkpoints','scoped.yjs'),('ultrapad-checkpoints','unscoped.yjs')");
 await asUser(viewer);expect((await db.query('select name from storage.objects')).rows).toEqual([{name:'scoped.yjs'}]);
 await asUser(outsider);expect((await db.query('select name from storage.objects')).rows).toHaveLength(0);
 await asUser(viewer);
 await expect(db.exec("update public.files set name='bypass.txt'")).rejects.toThrow('permission denied');
 await expect(mutate('create_file',{project_id:p.id,name:'bypass.txt',kind:'text'})).rejects.toThrow('FORBIDDEN');
 await expect(db.query('select public.reserve_document_bytes($1,1,100)',[f.id])).rejects.toThrow('ACCESS_CHANGED');
 await asUser(owner);await mutate('set_member',{project_id:p.id,user_id:viewer,role:null});
 await asUser(viewer);expect((await db.query('select * from public.files')).rows).toHaveLength(0);
 await asUser(owner);const parent=await mutate('create_file',{project_id:p.id,name:'parent',kind:'folder'});
 const child=await mutate('create_file',{project_id:p.id,name:'child',kind:'folder',parent_id:parent.id});
 await expect(mutate('move_file',{id:parent.id,parent_id:child.id,metadata_version:1})).rejects.toThrow('FOLDER_CYCLE');
 const other=await mutate('create_project',{workspace_id:w.id,name:'Other'});
 await expect(mutate('create_file',{project_id:other.id,parent_id:parent.id,name:'cross.txt',kind:'text'})).rejects.toThrow('INVALID_PARENT');
 await db.query('select public.reserve_document_bytes($1,1,100)',[f.id]);
 await expect(db.query('select public.reserve_document_bytes($1,1,8388609)',[f.id])).rejects.toThrow('QUOTA');
 await mutate('rename_file',{id:f.id,name:'new.txt',metadata_version:1});
 await expect(mutate('rename_file',{id:f.id,name:'stale.txt',metadata_version:1})).rejects.toThrow('METADATA_CONFLICT');
},30000);
it('v1.1 creates atomic personal files, enforces private containers and protects activity/themes',async()=>{
 await asUser(owner);
 const a=await mutate<{id:string;project_id:string;workspace_id:string}>('create_standalone',{name:'uno.md',language:'markdown'});
 const b=await mutate<{id:string;project_id:string;workspace_id:string}>('create_standalone',{name:'due.txt'});
 expect(a.project_id).toBe(b.project_id);expect(a.workspace_id).toBe(b.workspace_id);
 expect((await db.query('select * from public.workspaces where is_personal')).rows).toHaveLength(1);
 await expect(mutate('create_standalone',{name:'uno.md'})).rejects.toThrow('duplicate key');
 await mutate('set_theme',{kind:'file',id:a.id,theme:'Tesi'});
 await db.query('select public.record_file_activity($1,1,5)',[a.id]);
 await db.query('select public.record_file_activity($1,1,3)',[a.id]);
 const activity=await db.query<{activity_seq:number;last_modified_by:string;theme:string}>('select activity_seq,last_modified_by,theme from public.files where id=$1',[a.id]);
 expect(Number(activity.rows[0].activity_seq)).toBe(5);expect(activity.rows[0].last_modified_by).toBe(owner);expect(activity.rows[0].theme).toBe('Tesi');
 await db.query('select public.record_file_activity($1,2,99)',[a.id]);
 expect(Number((await db.query<{activity_seq:number}>('select activity_seq from public.files where id=$1',[a.id])).rows[0].activity_seq)).toBe(5);
 await expect(mutate('create_invite',{project_id:a.project_id,email:'viewer@test.invalid',role:'editor',token_hash:'personal'})).rejects.toThrow('PERSONAL_SPACE_PRIVATE');
 await expect(mutate('set_member',{project_id:a.project_id,user_id:viewer,role:'editor'})).rejects.toThrow('PERSONAL_SPACE_PRIVATE');
 await expect(mutate('create_project',{workspace_id:a.workspace_id,name:'Invite bypass'})).rejects.toThrow('PERSONAL_SPACE_PRIVATE');
 await expect(db.query("select public.mutate_v1('set_member',$1::jsonb)",[JSON.stringify({project_id:a.project_id,user_id:viewer,role:'editor'})])).rejects.toThrow('permission denied');
 await expect(mutate('set_theme',{kind:'file',id:a.id,theme:'x'.repeat(61)})).rejects.toThrow('INVALID_THEME');
 await asUser(outsider);
 expect((await db.query('select id from public.files where id=$1',[a.id])).rows).toHaveLength(0);
 await expect(mutate('set_theme',{kind:'project',id:a.project_id,theme:'Hack'})).rejects.toThrow('FORBIDDEN');
 await expect(db.query('select public.record_file_activity($1,1,999)',[a.id])).rejects.toThrow('FORBIDDEN');
 await expect(mutate('create_standalone',{name:'../invalid'})).rejects.toThrow('INVALID_NAME');
 expect((await db.query('select * from public.workspaces where is_personal')).rows).toHaveLength(0);
 await asUser(owner);await mutate('delete_workspace',{id:a.workspace_id});
},30000);
