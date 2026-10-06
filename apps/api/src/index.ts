import {resolveMapsLink} from '../../../packages/product/src/maps';
import {thesisFiles} from '../../../packages/product/src/thesis';
import {purge} from './purge';
import {codeCells,execute,cancelExecution} from './execution';
import {validateRichDelta} from '../../../packages/rich-text/src/index';
import { checkpointBytes } from './checkpoints';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { z } from 'zod';
import * as Y from 'yjs';
import { database, identity, room, access, type Env } from './db';
import { configuredOrigin, originAllowed } from './origin';
import { canAdmin, canEdit, sha256, validateName, languageFor } from '../../../packages/domain/src/index';
import { id, roleSchema } from '../../../packages/contracts/src/index';
export { DocumentRoom } from '../../collaboration/src/room';
const app = new Hono<{ Bindings: Env; Variables: { token: string } }>();
app.use('*', async (c, next) => {
  c.header('Referrer-Policy', 'no-referrer'); c.header('X-Content-Type-Options', 'nosniff'); c.header('Cache-Control', 'no-store');
  const expected=configuredOrigin(c.env.APP_ORIGIN);const received=c.req.header('Origin');
  if(!expected)return c.json({error:'CONFIGURATION_REQUIRED'},503);
  if (!originAllowed(c.env.APP_ORIGIN,received,c.req.url)) return c.json({ error: 'ORIGIN', expectedOrigin:expected }, 403);
  return cors({ origin: received ?? expected, allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] })(c, next);
});
app.use('/v1/*',async(c,next)=>{const maxSize=c.req.path==='/v1/guest-transfer'?8*1024*1024:c.req.path.startsWith('/v1/calderone')?1024*1024:64*1024;return bodyLimit({maxSize,onError:c=>c.json({error:'REQUEST_TOO_LARGE'},413)})(c,next);});
app.get('/maps-preview',async c=>{try{const url=await resolveMapsLink(c.req.query('url')??'');return c.json({url});}catch{return c.json({error:'MAPS_PREVIEW_UNAVAILABLE'},400);}});
app.get('/health', c => c.json({ service: 'ultrapad', configured: Boolean(c.env.SUPABASE_URL && c.env.SUPABASE_ANON_KEY) }));
app.get('/ws/:fileId/:generation', c => {
  id.parse(c.req.param('fileId')); const generation = z.coerce.number().int().positive().parse(c.req.param('generation'));
  if (c.req.header('Upgrade') !== 'websocket' || !c.req.header('Origin') || !originAllowed(c.env.APP_ORIGIN,c.req.header('Origin'),c.req.url)) return c.json({ error: 'UPGRADE_REQUIRED' }, 403);
  return room(c.env, c.req.param('fileId'), generation).fetch(new Request('https://room/ws', { headers: c.req.raw.headers }));
});
app.use('/v1/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer /, '') ?? '';
  await identity(c.env, token); c.set('token', token); await next();
});
app.get('/v1/execution/capabilities',c=>c.json({enabled:Boolean(c.env.RUNNER_URL&&c.env.RUNNER_TOKEN),languages:['javascript','python']}));
app.post('/v1/execution/revisions',async c=>{const {revisions}=z.object({revisions:z.array(z.object({id,generation:z.number().int().positive(),serverSeq:z.number().int().min(0)})).max(30)}).parse(await c.req.json());let stale=false;for(const revision of revisions){const {file}=await access(c.env,c.get('token'),revision.id);if(file.generation!==revision.generation){stale=true;continue;}const value=await(await room(c.env,file.id,file.generation).fetch('https://room/revision')).json() as {serverSeq:number};if(value.serverSeq!==revision.serverSeq)stale=true;}return c.json({stale});});
app.post('/v1/execution/cancel',async c=>{const args=z.object({jobId:id}).parse(await c.req.json());const user=await identity(c.env,c.get('token'));await cancelExecution(c.env,user.userId,args.jobId);return c.json({ok:true});});
app.post('/v1/files/:id/execute',async c=>{
 const fid=id.parse(c.req.param('id'));const token=c.get('token');const auth=await access(c.env,token,fid);if(!canEdit(auth.role))throw new Error('FORBIDDEN');
 const args=z.object({jobId:id,expectedHash:z.string().regex(/^[a-f0-9]{64}$/),kind:z.enum(['code','latex']),cell:z.number().int().min(0).max(100).optional()}).parse(await c.req.json());
 const snapshot=async(file:{id:string;name:string;generation:number})=>{const response=await room(c.env,file.id,file.generation).fetch('https://room/snapshot');if(!response.ok)throw new Error('SNAPSHOT_FAILED');const value=await response.json() as {text:string;serverSeq:number;generation:number};return {...value,id:file.id,name:file.name};};
 const revisions=[];let job;
 if(args.kind==='code'){const copy=await snapshot(auth.file);revisions.push({id:fid,name:copy.name,generation:copy.generation,serverSeq:copy.serverSeq});const cell=codeCells(copy.text)[args.cell??0];if(!cell||cell.code.length>32768)throw new Error('INVALID_CELL');if(await sha256(new TextEncoder().encode(cell.code))!==args.expectedHash)throw new Error('WAIT_FOR_SERVER_SYNC');job={kind:'code',language:cell.language,code:cell.code};}
 else {if(!/^[a-zA-Z0-9_-]+\.tex$/.test(auth.file.name))throw new Error('LATEX_FILENAME');const {data:files,error}=await database(c.env,token).from('files').select('id,name,generation').eq('project_id',auth.file.project_id).eq('status','ready').eq('kind','text');if(error)throw new Error('DATABASE_ERROR');const sources=(files??[]).filter(f=>/\.(tex|bib)$/.test(f.name));if(sources.length>30)throw new Error('MANIFEST_LIMIT');const copies=await Promise.all(sources.map(snapshot));if(await sha256(new TextEncoder().encode(copies.find(f=>f.id===fid)?.text??''))!==args.expectedHash)throw new Error('WAIT_FOR_SERVER_SYNC');for(const f of copies)revisions.push({id:f.id,name:f.name,generation:f.generation,serverSeq:f.serverSeq});job={kind:'latex',main:auth.file.name,files:copies.map(f=>({name:f.name,text:f.text}))};}
 const result=await execute(c.env,auth.userId,job,args.jobId);for(const revision of revisions)await access(c.env,token,revision.id,revision.generation);return c.json({...result,revisions});
});
app.get('/v1/navigation',async c=>{const {data,error}=await database(c.env,c.get('token')).from('file_preferences').select('favorite,opened_at,file:files!file_id(*)').order('favorite',{ascending:false}).order('opened_at',{ascending:false}).limit(100);if(error)throw new Error(error.message);return c.json(data);});
app.post('/v1/navigation',async c=>{const args=z.object({file_id:id,favorite:z.boolean().optional()}).parse(await c.req.json());const auth=await access(c.env,c.get('token'),args.file_id);const db=database(c.env,c.get('token'));const {data:old,error:readError}=await db.from('file_preferences').select('favorite').eq('file_id',args.file_id).maybeSingle();if(readError)throw new Error(readError.message);const {error}=await db.from('file_preferences').upsert({user_id:auth.userId,file_id:args.file_id,favorite:args.favorite??old?.favorite??false,opened_at:new Date().toISOString()});if(error)throw new Error(error.message);return c.json({ok:true});});
app.post('/v1/inbox/read',async c=>{const args=z.object({id}).parse(await c.req.json());const {error}=await database(c.env,c.get('token')).from('mentions').update({read_at:new Date().toISOString()}).eq('comment_id',args.id);if(error)throw new Error(error.message);return c.json({ok:true});});
app.post('/v1/invitations/preview',async c=>{const {token}=z.object({token:z.string().length(72)}).parse(await c.req.json());const {data,error}=await database(c.env,c.get('token')).rpc('invitation_preview',{hash:await sha256(new TextEncoder().encode(token))});if(error)throw new Error(error.message);return c.json(data);});
app.get('/v1/bootstrap', async c => {
  const db = database(c.env, c.get('token'));
  const [ws, ps] = await Promise.all([db.from('workspaces').select('*').order('created_at'), db.from('projects').select('*').order('created_at')]);
  if (ws.error || ps.error) throw new Error('DATABASE_ERROR');
  const projects = await Promise.all((ps.data ?? []).map(async p => { const { data: role, error } = await db.rpc('project_role', { pid: p.id }); if (error) throw new Error('DATABASE_ERROR'); return { ...p, role }; }));
  return c.json({ workspaces: ws.data, projects });
});
app.post('/v1/projects/:id/templates/thesis',async c=>{
 const pid=id.parse(c.req.param('id'));const token=c.get('token'),db=database(c.env,token);const {data:role,error:roleError}=await db.rpc('project_role',{pid});if(roleError||!role||!canEdit(role))throw new Error('FORBIDDEN');
 const {data:existing,error}=await db.from('files').select('id').eq('project_id',pid).is('deleted_at',null).limit(1);if(error)throw new Error('DATABASE_ERROR');if(existing?.length)throw new Error('EMPTY_PROJECT_REQUIRED');
 const created:string[]=[];try{for(const source of thesisFiles){const {data:f,error}=await db.rpc('mutate',{op:'create_file',args:{project_id:pid,name:source.name,kind:'text',language:languageFor(source.name)}});if(error)throw new Error(error.message);created.push(f.id);const d=new Y.Doc();d.getText('content').insert(0,source.text);const {error:quota}=await db.rpc('reserve_document_bytes',{fid:f.id,gen:f.generation,n:Y.encodeStateAsUpdate(d).length});d.destroy();if(quota)throw new Error('QUOTA');const seed=await room(c.env,f.id,f.generation).fetch(new Request('https://room/seed',{method:'POST',body:JSON.stringify({fileId:f.id,generation:f.generation,text:source.text,operationId:crypto.randomUUID()})}));if(!seed.ok)throw new Error('TEMPLATE_SEED_FAILED');}return c.json({ok:true});}
 catch{for(const fid of created)await db.rpc('mutate',{op:'delete_file',args:{id:fid}});throw new Error('TEMPLATE_FAILED_COPIES_IN_TRASH');}
});
app.get('/v1/projects/:id/files', async c => {
  const { data, error } = await database(c.env, c.get('token')).from('files').select('*').eq('project_id', id.parse(c.req.param('id'))).is('deleted_at',null).order('name');
  if (error) throw new Error('DATABASE_ERROR'); return c.json(data);
});
app.get('/v1/projects/:id/members', async c => {
  const { data, error } = await database(c.env, c.get('token')).from('project_members').select('user_id,role').eq('project_id', id.parse(c.req.param('id')));
  if (error) throw new Error('DATABASE_ERROR'); return c.json(data);
});
app.get('/v1/dashboard', async c => {
  let query=database(c.env,c.get('token')).from('files').select('*').eq('kind','text').is('deleted_at',null);const workspace=c.req.query('workspace_id');if(workspace)query=query.eq('workspace_id',id.parse(workspace));
  const {data,error}=await query.order('updated_at',{ascending:false}).limit(100);
  if(error)throw new Error('DATABASE_ERROR');return c.json(data);
});
app.post('/v1/guest-transfer',bodyLimit({maxSize:8*1024*1024}),async c=>{
 const args=z.object({source:id,name:z.string().max(120),text:z.string().max(1048576),delta:z.array(z.unknown()).optional()}).parse(await c.req.json());
 const delta=args.delta?validateRichDelta(args.delta):undefined;if(delta&&delta.map(op=>op.insert).join('')!==args.text)throw new Error('SCHEMA');
 const db=database(c.env,c.get('token'));const {data:file,error}=await db.rpc('transfer_guest',{source:args.source,n:validateName(args.name),lang:languageFor(args.name)});if(error)throw new Error(error.message);
 const bytes=new Y.Doc();if(delta)bytes.getText('content').applyDelta(delta);else bytes.getText('content').insert(0,args.text);
 const {error:quota}=await db.rpc('reserve_document_bytes',{fid:file.id,gen:file.generation,n:Y.encodeStateAsUpdate(bytes).length});bytes.destroy();if(quota)throw new Error('QUOTA');
 const seeded=await room(c.env,file.id,file.generation).fetch(new Request('https://room/seed',{method:'POST',body:JSON.stringify({fileId:file.id,generation:file.generation,text:args.text,delta,operationId:args.source})}));if(!seeded.ok)throw new Error('TRANSFER_SEED_FAILED');return c.json(file);
});
app.get('/v1/files/:id/metadata',async c=>{const {file}=await access(c.env,c.get('token'),id.parse(c.req.param('id')));return c.json(file);});
app.get('/v1/files/:id/discussion',async c=>{const fid=id.parse(c.req.param('id'));await access(c.env,c.get('token'),fid);const db=database(c.env,c.get('token'));const {data:threads,error}=await db.from('comment_threads').select('*').eq('file_id',fid).order('created_at');if(error)throw new Error(error.message);const ids=(threads??[]).map(t=>t.id);const {data:comments,error:ce}=ids.length?await db.from('comments').select('*').in('thread_id',ids).order('created_at'):{data:[],error:null};if(ce)throw new Error(ce.message);return c.json({threads,comments});});
app.get('/v1/inbox',async c=>{const {data,error}=await database(c.env,c.get('token')).from('mentions').select('*,comments(*,comment_threads(*))');if(error)throw new Error(error.message);return c.json(data);});
app.get('/v1/files/:id/links',async c=>{const fid=id.parse(c.req.param('id'));await access(c.env,c.get('token'),fid);const {data,error}=await database(c.env,c.get('token')).from('file_links').select('*,source:files!source_id(id,name,project_id),target:files!target_id(id,name,project_id)').or(`source_id.eq.${fid},target_id.eq.${fid}`);if(error)throw new Error(error.message);return c.json(data);});
app.get('/v1/projects/:id/board/checkpoints',async c=>{const {data,error}=await database(c.env,c.get('token')).from('board_checkpoints').select('*').eq('project_id',id.parse(c.req.param('id'))).order('created_at',{ascending:false}).limit(20);if(error)throw new Error(error.message);return c.json(data);});
app.get('/v1/projects/:id/board',async c=>{const {data,error}=await database(c.env,c.get('token')).from('board_items').select('*').eq('project_id',id.parse(c.req.param('id'))).order('updated_at');if(error)throw new Error(error.message);return c.json(data);});
app.post('/v1/collaborate',async c=>{const args=z.object({op:z.enum(['thread','reply','resolve','link','board_put','board_delete','board_checkpoint']),args:z.record(z.string(),z.unknown())}).parse(await c.req.json());const {data,error}=await database(c.env,c.get('token')).rpc('collaborate',args);if(error)throw new Error(error.message);return c.json(data);});
app.get('/v1/calderone',async c=>{const {data,error}=await database(c.env,c.get('token')).from('calderone').select('*').order('updated_at',{ascending:false}).limit(500);if(error)throw new Error(error.message);return c.json(data);});
app.post('/v1/calderone',async c=>{const args=z.object({id,version:z.number().int().min(0),title:z.string().max(120),body:z.string().max(600000),image:z.string().max(700000).optional(),encrypted:z.boolean(),delete:z.boolean().optional()}).parse(await c.req.json());const {data,error}=await database(c.env,c.get('token')).rpc('save_calderone',{args});if(error)throw new Error(error.message);return c.json(data);});
app.post('/v1/search/reindex',async c=>{const {offset}=z.object({offset:z.number().int().min(0)}).parse(await c.req.json());const token=c.get('token'),db=database(c.env,token);const {data:files,error}=await db.from('files').select('id,generation,project_id').eq('status','ready').eq('kind','text').order('id').range(offset,offset+19);if(error)throw new Error('DATABASE_ERROR');let indexed=0,skipped=0;for(const f of files??[]){const {data:role}=await db.rpc('project_role',{pid:f.project_id});if(!role||!canEdit(role)){skipped++;continue;}const res=await room(c.env,f.id,f.generation).fetch('https://room/snapshot');if(!res.ok)throw new Error('SNAPSHOT_FAILED');const v=await res.json() as {text:string;serverSeq:number};const {error}=await db.rpc('index_file',{fid:f.id,gen:f.generation,seq:v.serverSeq,body:v.text});if(error)throw new Error(error.message);indexed++;}return c.json({indexed,skipped,next:(files??[]).length===20?offset+20:null});});
app.get('/v1/search',async c=>{const {data,error}=await database(c.env,c.get('token')).rpc('search_files',{q:(c.req.query('q')??'').slice(0,200),offset_rows:Math.max(0,Number(c.req.query('offset'))||0),workspace:c.req.query('workspace')?id.parse(c.req.query('workspace')):null,format:(c.req.query('format')??'').slice(0,20),topic:(c.req.query('topic')??'').slice(0,60),author:c.req.query('author')?id.parse(c.req.query('author')):null,since:c.req.query('since')?z.iso.datetime().parse(c.req.query('since')):null});if(error)throw new Error(error.message);return c.json(data);});
app.get('/v1/trash/capabilities',c=>c.json({purge:Boolean(c.env.CHECKPOINT_SERVICE_ROLE)}));
app.post('/v1/trash/:id/purge',async c=>c.json(await purge(c.env,c.get('token'),id.parse(c.req.param('id')))));
app.get('/v1/trash',async c=>{const {data,error}=await database(c.env,c.get('token')).from('files').select('*').eq('status','deleted').order('deleted_at',{ascending:false});if(error)throw new Error(error.message);return c.json(data);});
app.get('/v1/projects/:id/invitations',async c=>{const {data,error}=await database(c.env,c.get('token')).rpc('project_invitations',{pid:id.parse(c.req.param('id'))});if(error)throw new Error(error.message);return c.json(data);});
const operation = z.enum(['rename_workspace','rename_project','restore_deleted','revoke_invite','create_standalone','set_theme','create_workspace','delete_workspace','create_project','delete_project','create_file','rename_file','move_file','delete_file','set_member']);
app.post('/v1/mutations', async c => {
  const { op, args } = z.object({ op: operation, args: z.record(z.string(), z.unknown()) }).parse(await c.req.json());
  if ('name' in args) args.name = validateName(z.string().parse(args.name));
  if (op === 'create_file' || op === 'create_standalone' || op === 'rename_file') args.language = languageFor(String(args.name));
  const db = database(c.env, c.get('token'));
  const before = op === 'delete_file' ? await db.from('files').select('id,generation').eq('project_id',(await db.from('files').select('project_id').eq('id',String(args.id)).single()).data?.project_id) : null;
  const projectFiles = ['set_member','delete_project'].includes(op) ? await db.from('files').select('id,generation').eq('project_id', String(args.project_id)) : null;
  const { data, error } = await db.rpc('mutate', { op, args }); if (error) throw new Error(error.message);
  for (const f of [...(before?.data ?? []), ...(projectFiles?.data ?? [])]) await room(c.env, f.id, f.generation).fetch('https://room/revoke');
  return c.json(data);
});
app.post('/v1/projects/:id/invitations', async c => {
  const args = z.object({ email: z.email(), role: roleSchema }).parse(await c.req.json());
  const token = crypto.randomUUID() + crypto.randomUUID();
  const { data, error } = await database(c.env, c.get('token')).rpc('mutate', { op: 'create_invite', args: { ...args, project_id: id.parse(c.req.param('id')), token_hash: await sha256(new TextEncoder().encode(token)) } });
  if (error) throw new Error(error.message);
  return c.json({ ...data, url: `${configuredOrigin(c.env.APP_ORIGIN)}/#invite=${token}` });
});
app.post('/v1/invitations/accept', async c => {
  const { token } = z.object({ token: z.string().length(72) }).parse(await c.req.json());
  const { data, error } = await database(c.env, c.get('token')).rpc('mutate', { op: 'accept_invite', args: { token_hash: await sha256(new TextEncoder().encode(token)) } });
  if (error) throw new Error(error.message); return c.json(data);
});
app.post('/v1/files/:id/collaboration-ticket', async c => {
  const fileId = id.parse(c.req.param('id')); const auth = await access(c.env, c.get('token'), fileId);
  const options=z.object({document:z.boolean().optional()}).parse(await c.req.json());if(options.document&&!/\.txt$/i.test(auth.file.name))return c.json({error:'DOCUMENT_TYPE_REQUIRED'},400);
  return room(c.env, fileId, auth.file.generation).fetch(new Request('https://room/ticket', { method: 'POST', body: JSON.stringify({ token: c.get('token'), fileId, generation: auth.file.generation,document:options.document }) }));
});
app.get('/v1/files/:id/presence', async c => {
  const fileId=id.parse(c.req.param('id'));const {file}=await access(c.env,c.get('token'),fileId);
  return room(c.env,fileId,file.generation).fetch('https://room/presence');
});
app.get('/v1/files/:id/snapshot', async c => {
  const fileId = id.parse(c.req.param('id')); const { file } = await access(c.env, c.get('token'), fileId);
  return room(c.env, fileId, file.generation).fetch('https://room/snapshot');
});
app.get('/v1/files/:id/backup-health', async c => {
  const fileId=id.parse(c.req.param('id'));const {file}=await access(c.env,c.get('token'),fileId);
  const response=await room(c.env,fileId,file.generation).fetch('https://room/backup-health');
  return c.json({configured:Boolean(c.env.CHECKPOINT_SERVICE_ROLE),state:await response.json()});
});
app.get('/v1/files/:id/checkpoints', async c => {
  const fileId = id.parse(c.req.param('id')); const { file } = await access(c.env, c.get('token'), fileId);
  const local=await room(c.env,fileId,file.generation).fetch('https://room/checkpoints');
  const localList=await local.json() as {id:string;label:string;seq:number;generation:number;created:number}[];
  const {data:published,error}=await database(c.env,c.get('token')).from('document_checkpoints').select('*').eq('file_id',fileId).order('created_at',{ascending:false});
  if(error)throw new Error('CHECKPOINT_METADATA_ERROR');
  const merged=new Map(localList.map(cp=>[cp.id,cp]));
  for(const cp of published??[])merged.set(cp.id,{id:cp.id,label:cp.label,seq:cp.server_seq,generation:cp.generation,created:new Date(cp.created_at).getTime()});
  return c.json([...merged.values()].sort((a,b)=>b.created-a.created));
});
app.post('/v1/files/:id/checkpoints', async c => {
  const fileId = id.parse(c.req.param('id')); const { file, role } = await access(c.env, c.get('token'), fileId);
  if (!canEdit(role)) return c.json({ error: 'FORBIDDEN' }, 403);
  const { label } = z.object({ label: z.string().min(1).max(120) }).parse(await c.req.json());
  return room(c.env, fileId, file.generation).fetch(new Request('https://room/checkpoints', { method: 'POST', body: JSON.stringify({ label }) }));
});
app.get('/v1/files/:id/checkpoints/:checkpoint', async c => {
  const fileId = id.parse(c.req.param('id')); const { file } = await access(c.env, c.get('token'), fileId);
  const bytes=await checkpointBytes(c.env,database(c.env,c.get('token')),fileId,file.generation,id.parse(c.req.param('checkpoint')));
  const doc = new Y.Doc(); Y.applyUpdate(doc, bytes);
  const text = doc.getText('content').toString();const delta=doc.getText('content').toDelta(); doc.destroy(); return c.json({ text,delta });
});
app.get('/v1/files/:id/checkpoints/:checkpoint/raw',async c=>{
  const fileId=id.parse(c.req.param('id'));const {file}=await access(c.env,c.get('token'),fileId);
  const bytes=await checkpointBytes(c.env,database(c.env,c.get('token')),fileId,file.generation,id.parse(c.req.param('checkpoint')));
  return new Response(bytes.slice().buffer,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}});
});
app.post('/v1/files/:id/restore', async c => {
  const fileId = id.parse(c.req.param('id'));
  const args = z.object({ checkpoint_id: id, operation_id: id }).parse(await c.req.json());
  const db = database(c.env, c.get('token'));
  const { data: file, error: fileError } = await db.from('files').select('*').eq('id', fileId).single();
  if (fileError || !file) throw new Error('ACCESS_CHANGED');
  const { data: role } = await db.rpc('project_role', { pid: file.project_id });
  if (!role || !canAdmin(role)) return c.json({ error: 'FORBIDDEN' }, 403);
  if (file.status === 'ready' && file.restore_id === args.operation_id) return c.json(file);
  const oldRoom = room(c.env, fileId, file.generation);
  const selected=await checkpointBytes(c.env,db,fileId,file.generation,args.checkpoint_id);
  const { data: locked, error } = await db.rpc('mutate', { op: 'begin_restore', args: { ...args, id: fileId } });
  if (error) throw new Error(error.message);
  await oldRoom.fetch('https://room/revoke');
  const safety = await oldRoom.fetch(new Request('https://room/checkpoints', { method: 'POST', body: JSON.stringify({ label: 'Prima del ripristino', id: args.operation_id }) }));
  if (!safety.ok) throw new Error('RESTORE_SAFETY_FAILED');
  const doc = new Y.Doc(); Y.applyUpdate(doc, selected);
  const text = doc.getText('content').toString();const delta=doc.getText('content').toDelta(); doc.destroy();
  const seeded = await room(c.env, fileId, locked.pending_generation).fetch(new Request('https://room/seed', { method: 'POST', body: JSON.stringify({ fileId, generation: locked.pending_generation, text, delta, operationId: args.operation_id }) }));
  if (!seeded.ok) throw new Error('RESTORE_SEED_FAILED');
  const completed = await db.rpc('mutate', { op: 'finish_restore', args: { ...args, id: fileId } });
  if (completed.error) throw new Error(completed.error.message); return c.json(completed.data);
});
app.onError((e, c) => {
  const message = e instanceof z.ZodError ? 'INVALID_REQUEST' : /fetch failed|failed to fetch/i.test(e.message) ? 'SUPABASE_UNAVAILABLE' : e.message;
  const status = message === 'UNAUTHORIZED' ? 401 : /FORBIDDEN|ACCESS_CHANGED/.test(message) ? 403 : ['CONFIGURATION_REQUIRED','SUPABASE_UNAVAILABLE','DATABASE_ERROR'].includes(message) ? 503 : 409;
  return c.json({ error: message }, status);
});
export default app;
