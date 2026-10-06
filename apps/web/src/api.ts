import { createClient } from '@supabase/supabase-js';
import { apiEndpoint } from '../../../packages/contracts/src/api-endpoint';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(supabaseUrl && supabaseKey && import.meta.env.VITE_API_URL && !/YOUR_/.test(`${supabaseUrl} ${supabaseKey}`) && !supabaseUrl.includes('/rest/v1') && !supabaseKey.startsWith('sb_secret_'));
export const auth = configured ? createClient(supabaseUrl, supabaseKey, { auth: { flowType: 'pkce' } }) : null;
export const apiUrl = apiEndpoint(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8787',window.location.origin,import.meta.env.DEV);
export class ApiConnectionError extends TypeError {
  constructor() { super(import.meta.env.DEV ? 'Backend UltraPad non raggiungibile. Avvia pnpm dev (API e frontend) e verifica http://127.0.0.1:8787/health. Poi premi Riprova.' : 'Backend UltraPad non raggiungibile. Verifica la connessione e la configurazione del servizio, poi riprova.'); }
}
export async function request<T>(path: string, body?: unknown): Promise<T> {
  if (!auth) throw new Error('Configurazione richiesta');
  const { data: { session } } = await auth.auth.getSession();
  if (!session) throw new Error('Sessione scaduta. Accedi nuovamente.');
  let response: Response;
  try { response=await fetch(`${apiUrl}/v1${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(path.endsWith('/execute')?70000:30000) }); }
  catch { throw new ApiConnectionError(); }
  let value: T & {error?:string;expectedOrigin?:string};
  try { value=await response.json() as T & {error?:string;expectedOrigin?:string}; }
  catch { if([500,502,503,504].includes(response.status)) throw new ApiConnectionError(); throw new Error('Risposta API non valida. Verifica VITE_API_URL: deve puntare al backend UltraPad, non alla Data API Supabase.'); }
  if (!response.ok) {
    if(value.error==='ORIGIN') throw new Error(`Origine della pagina non consentita dal backend. Apri ${value.expectedOrigin ?? 'l’indirizzo configurato in APP_ORIGIN'} e verifica APP_ORIGIN in apps/api/.dev.vars.`);
    if(value.error==='FORBIDDEN') throw new Error('Operazione non consentita al tuo ruolo nel workspace o progetto.');
    if(value.error==='API_UNAVAILABLE') throw new ApiConnectionError();
    if(value.error==='SUPABASE_UNAVAILABLE') throw new Error('Il backend non riesce a collegarsi a Supabase. Controlla URL, rete e configurazione nel terminale API.');
    if(value.error==='DATABASE_ERROR') throw new Error('Database UltraPad non disponibile. Verifica le migrazioni SQL (inclusa la 004 per v1.1) e la configurazione Supabase del backend.');
    throw new Error(`${response.status}: ${value.error ?? 'Richiesta non riuscita'}`);
  }
  return value;
}
export const mutate = <T = unknown>(op: string, args: Record<string, unknown>) => request<T>('/mutations', { op, args });
