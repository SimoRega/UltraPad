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
app.use('/v1/*',bodyLimit({maxSize:64*1024,onError:c=>c.json({error:'REQUEST_TOO_LARGE'},413)}));
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
app.get('/v1/bootstrap', async c => {
  const db = database(c.env, c.get('token'));
  const [ws, ps] = await Promise.all([db.from('workspaces').select('*').order('created_at'), db.from('projects').select('*').order('created_at')]);
  if (ws.error || ps.error) throw new Error('DATABASE_ERROR');
  const projects = await Promise.all((ps.data ?? []).map(async p => { const { data: role, error } = await db.rpc('project_role', { pid: p.id }); if (error) throw new Error('DATABASE_ERROR'); return { ...p, role }; }));
  return c.json({ workspaces: ws.data, projects });
});
app.get('/v1/projects/:id/files', async c => {
  const { data, error } = await database(c.env, c.get('token')).from('files').select('*').eq('project_id', id.parse(c.req.param('id'))).order('name');
  if (error) throw new Error('DATABASE_ERROR'); return c.json(data);
});
app.get('/v1/projects/:id/members', async c => {
  const { data, error } = await database(c.env, c.get('token')).from('project_members').select('user_id,role').eq('project_id', id.parse(c.req.param('id')));
  if (error) throw new Error('DATABASE_ERROR'); return c.json(data);
});
const operation = z.enum(['create_workspace','delete_workspace','create_project','delete_project','create_file','rename_file','move_file','delete_file','set_member']);
app.post('/v1/mutations', async c => {
  const { op, args } = z.object({ op: operation, args: z.record(z.string(), z.unknown()) }).parse(await c.req.json());
  if ('name' in args) args.name = validateName(z.string().parse(args.name));
  if (op === 'create_file' || op === 'rename_file') args.language = languageFor(String(args.name));
  const db = database(c.env, c.get('token'));
  const before = op === 'delete_file' ? await db.from('files').select('id,generation').eq('id', String(args.id)) : null;
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
  return room(c.env, fileId, auth.file.generation).fetch(new Request('https://room/ticket', { method: 'POST', body: JSON.stringify({ token: c.get('token'), fileId, generation: auth.file.generation }) }));
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
  const text = doc.getText('content').toString(); doc.destroy(); return c.json({ text });
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
  const text = doc.getText('content').toString(); doc.destroy();
  const seeded = await room(c.env, fileId, locked.pending_generation).fetch(new Request('https://room/seed', { method: 'POST', body: JSON.stringify({ fileId, generation: locked.pending_generation, text, operationId: args.operation_id }) }));
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
