import { createClient } from '@supabase/supabase-js';
export interface Env { ROOMS: DurableObjectNamespace; SUPABASE_URL: string; SUPABASE_ANON_KEY: string; APP_ORIGIN: string; CHECKPOINT_SERVICE_ROLE?: string; RUNNER_URL?:string; RUNNER_TOKEN?:string }
export function database(env: Env, token: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('CONFIGURATION_REQUIRED');
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}
export async function identity(env: Env, token: string) {
  const db = database(env, token);
  const { data, error } = await db.auth.getClaims(token);
  if (error || !data?.claims?.sub || data.claims.aud !== 'authenticated' || data.claims.iss !== `${env.SUPABASE_URL}/auth/v1`) throw new Error('UNAUTHORIZED');
  return { db, userId: data.claims.sub, expiresAt: Number(data.claims.exp) * 1000 };
}
export async function access(env: Env, token: string, fileId: string, generation?: number) {
  const { db, userId, expiresAt } = await identity(env, token);
  const { data: file, error } = await db.from('files').select('*').eq('id', fileId).eq('status', 'ready').eq('kind', 'text').single();
  if (error || !file || (generation !== undefined && file.generation !== generation)) throw new Error('ACCESS_CHANGED');
  const { data: role, error: roleError } = await db.rpc('project_role', { pid: file.project_id });
  if (roleError || !role) throw new Error('ACCESS_CHANGED');
  return { file, role, userId, expiresAt };
}
export function room(env: Env, fileId: string, generation: number) { return env.ROOMS.get(env.ROOMS.idFromName(`${fileId}:${generation}`)); }
