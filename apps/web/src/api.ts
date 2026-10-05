import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(supabaseUrl && supabaseKey && import.meta.env.VITE_API_URL && !/YOUR_/.test(`${supabaseUrl} ${supabaseKey}`) && !supabaseUrl.includes('/rest/v1') && !supabaseKey.startsWith('sb_secret_'));
export const auth = configured ? createClient(supabaseUrl, supabaseKey, { auth: { flowType: 'pkce' } }) : null;
export const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
export async function request<T>(path: string, body?: unknown): Promise<T> {
  if (!auth) throw new Error('Configurazione richiesta');
  const { data: { session } } = await auth.auth.getSession();
  if (!session) throw new Error('Sessione scaduta. Accedi nuovamente.');
  const response = await fetch(`${apiUrl}/v1${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(`${response.status}: ${value.error ?? 'Richiesta non riuscita'}`);
  return value;
}
export const mutate = <T = unknown>(op: string, args: Record<string, unknown>) => request<T>('/mutations', { op, args });
