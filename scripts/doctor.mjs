import { existsSync, readFileSync } from 'node:fs';
import { parseEnv, publicKeyValid } from './local-config.mjs';
const paths=['.env','apps/api/.dev.vars'];
const configs={};let failed=false;
for(const path of paths) {
 if(!existsSync(path)) { console.error(`${path} mancante: esegui pnpm setup:local`);failed=true;continue; }
 const env=parseEnv(readFileSync(path,'utf8'));configs[path]=env;
 const names=path==='.env'?['VITE_API_URL','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY']:['APP_ORIGIN','SUPABASE_URL','SUPABASE_ANON_KEY'];
 for(const name of names) if(!env[name] || env[name].includes('YOUR_')) {console.error(`${path}: configura ${name}`);failed=true;}
 const key=env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;
 if(!publicKeyValid(key)) { console.error(`${path}: serve una chiave Publishable o anon; le chiavi privilegiate non sono ammesse.`);failed=true; }
 const url=env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
 try { const parsed=new URL(url);if(parsed.pathname!=='/' || !['http:','https:'].includes(parsed.protocol)) throw new Error(); }
 catch { console.error(`${path}: usa URL base Supabase senza /rest/v1/`);failed=true; }
}
if(existsSync('.env.local') || existsSync('.env.development') || existsSync('.env.development.local')) {
 console.error('Sono presenti override Vite .env.local/.env.development: controllali o spostali prima del setup locale, possono prevalere su .env.');failed=true;
}
const web=configs['.env'];const api=configs['apps/api/.dev.vars'];
if(web && api && (web.VITE_SUPABASE_URL!==api.SUPABASE_URL || web.VITE_SUPABASE_ANON_KEY!==api.SUPABASE_ANON_KEY)) {
 console.error('Frontend e API devono usare lo stesso progetto e la stessa chiave pubblica. Esegui pnpm setup:local.');failed=true;
}
if(!failed) {
 try {
  const response=await fetch(`${web.VITE_SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:web.VITE_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const settings=await response.json();
  if(!settings.external?.github) { console.error('Connessione Supabase riuscita, ma GitHub non è abilitato in Authentication → Providers.');failed=true; }
  else console.log('Progetto Supabase raggiungibile; chiave accettata e provider GitHub abilitato.');
 } catch(e) { console.error(`Verifica Supabase non riuscita (${e instanceof TypeError?'rete/DNS':e.message}). Controlla URL, chiave, rete e stato del progetto.`);failed=true; }
}
if(process.argv.includes('--api') && web) {
 try {
  const target=new URL(web.VITE_API_URL);if(['localhost','[::1]'].includes(target.hostname))target.hostname='127.0.0.1';
  const response=await fetch(`${target.href.replace(/\/$/,'')}/health`,{signal:AbortSignal.timeout(5000)});
  const state=await response.json();
  if(!response.ok || state.service!=='ultrapad' || !state.configured)throw new Error('API_NON_CONFIGURATA');
  console.log('Backend UltraPad locale raggiungibile e configurato.');
 } catch { console.error('Backend UltraPad non raggiungibile/configurato: avvia pnpm dev e controlla il terminale API (porta 8787).');failed=true; }
}
console.log('Le credenziali non vengono stampate. Migrazioni, redirect e login reale restano da verificare: docs/LOCAL_LOGIN.md.');
if(!failed) console.log('Configurazione pronta per la prova: pnpm dev → http://localhost:5173/');
process.exitCode=failed?1:0;
