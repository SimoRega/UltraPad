import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseEnv, mergeEnv, publicKeyValid } from './local-config.mjs';
const root=resolve(import.meta.dirname,'..');
async function read(path) { try { return await readFile(resolve(root,path),'utf8'); } catch(e) { if(e.code==='ENOENT') return ''; throw e; } }
const example=parseEnv(await read('.env.example'));const current=await read('.env');
const url=example.VITE_SUPABASE_URL;const previous=parseEnv(current);
const terminal=createInterface({input:process.stdin,output:process.stdout});
try {
 console.log(`Configurazione locale UltraPad: ${url}`);
 console.log('Supabase → Settings → API Keys: copia Publishable key (sb_publishable_...) oppure legacy anon.');
 console.log('Non inserire service_role, secret key, password database o GitHub Client Secret.');
 const reusable=previous.VITE_SUPABASE_URL===url && publicKeyValid(previous.VITE_SUPABASE_ANON_KEY);
 const fallback=reusable?previous.VITE_SUPABASE_ANON_KEY:example.VITE_SUPABASE_ANON_KEY;
 const input=(await terminal.question(`Chiave pubblica (Invio per ${reusable?'mantenere quella presente':'usare la Publishable del progetto UltraPad'}): `)).trim();
 const key=input || fallback;
 if(!publicKeyValid(key)) throw new Error('Chiave pubblica non valida. Usa Publishable key oppure legacy anon. Nessun file modificato.');
 // Both files remain ignored by Git. Preserve unrelated settings, including backup secrets.
 await writeFile(resolve(root,'.env'),mergeEnv(current,{VITE_API_URL:'http://localhost:8787',VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:key}),{mode:0o600});
 await writeFile(resolve(root,'apps/api/.dev.vars'),mergeEnv(await read('apps/api/.dev.vars'),{APP_ORIGIN:'http://localhost:5173',SUPABASE_URL:url,SUPABASE_ANON_KEY:key}),{mode:0o600});
 console.log('Salvati .env e apps/api/.dev.vars. La chiave non viene stampata.');
 console.log(`Callback GitHub OAuth: ${url}/auth/v1/callback`);
 console.log('Supabase Auth → URL Configuration: Site URL e Redirect URL http://localhost:5173/');
 console.log('Applica le tre migrazioni SQL e abilita GitHub in Auth → Providers. Guida: docs/LOCAL_LOGIN.md');
 console.log('Poi: pnpm run doctor e pnpm dev.');
} catch(e) { console.error(e.message); process.exitCode=1; }
finally { terminal.close(); }
