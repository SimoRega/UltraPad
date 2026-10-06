import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { httpsOrigin } from '../apps/desktop/src/security.mjs';

const root = resolve(import.meta.dirname, '..');
const variables = { ...loadEnv('production', root), ...process.env };
const worker = JSON.parse(await readFile(resolve(root, 'apps/api/wrangler.jsonc'), 'utf8'));
const appOrigin = httpsOrigin(variables.VITE_DESKTOP_APP_ORIGIN || worker.vars.APP_ORIGIN);
const supabaseOrigin = httpsOrigin(variables.VITE_SUPABASE_URL);
const api = new URL(variables.VITE_API_URL);
if (api.protocol !== 'https:' || api.username || api.password || !variables.VITE_SUPABASE_ANON_KEY || variables.VITE_SUPABASE_ANON_KEY.startsWith('sb_secret_')) throw new Error('La build desktop richiede URL API HTTPS e chiave Supabase pubblica. Controlla .env.production.');
const desktop = resolve(root, 'apps/desktop');
await rm(resolve(desktop, 'renderer'), { recursive: true, force: true });
await mkdir(desktop, { recursive: true });
await cp(resolve(root, 'apps/web/dist'), resolve(desktop, 'renderer'), { recursive: true });
// Pages-specific files and service workers must never replace the packaged shell.
for (const name of ['sw.js', '_headers']) await rm(resolve(desktop, 'renderer', name), { force: true });
await writeFile(resolve(desktop, 'desktop-config.json'), JSON.stringify({ appOrigin, supabaseOrigin }, null, 2) + '\n');
console.log('Frontend UltraPad incluso nel pacchetto desktop.');
