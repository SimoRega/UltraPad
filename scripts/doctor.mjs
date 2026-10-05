import { existsSync, readFileSync } from 'node:fs';
const files = ['.env', 'apps/api/.dev.vars'];
let missing = false;
for (const path of files) {
 if (!existsSync(path)) { console.error(`${path} mancante: copia il corrispondente .example`); missing = true; continue; }
 const contents = readFileSync(path, 'utf8');
 const keys = path === '.env' ? ['VITE_API_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] : ['APP_ORIGIN','SUPABASE_URL','SUPABASE_ANON_KEY'];
 for (const key of keys) if (!new RegExp(`^${key}=.+`, 'm').test(contents) || new RegExp(`^${key}=.*YOUR_`, 'm').test(contents)) { console.error(`${path}: configura ${key}`); missing = true; }
}
console.log('Le credenziali non vengono stampate. Dopo la configurazione: pnpm dev.');
process.exitCode = missing ? 1 : 0;
