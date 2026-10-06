import { randomBytes } from 'node:crypto';
import { resolve, sep, extname } from 'node:path';
import { readFile } from 'node:fs/promises';

export const callbackBase = 'ultrapad://auth/callback';
export const oauthLifetime = 5 * 60 * 1000;
export const contentPolicy = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; object-src 'none'; frame-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'";
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff':'font/woff', '.woff2':'font/woff2', '.wasm':'application/wasm', '.gz':'application/gzip', '.png':'image/png', '.ico':'image/x-icon' };

export function httpsOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Origine HTTPS desktop non valida');
  return url.origin;
}
export function externalUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
export function newOAuthAttempt(now = Date.now()) {
  const state = randomBytes(32).toString('hex');
  return { redirectTo: `${callbackBase}?state=${state}`, expires: now + oauthLifetime };
}
export function oauthRequestAllowed(value, attempt, supabaseOrigin, now = Date.now()) {
  if (!attempt || now >= attempt.expires || typeof value !== 'string' || value.length > 8192) return false;
  try {
    const url = new URL(value);
    return url.origin === supabaseOrigin && !url.username && !url.password && url.pathname === '/auth/v1/authorize'
      && ['google', 'github'].includes(url.searchParams.get('provider'))
      && url.searchParams.get('redirect_to') === attempt.redirectTo
      && url.searchParams.get('code_challenge_method')?.toLowerCase() === 's256'
      && /^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('code_challenge') ?? '');
  } catch { return false; }
}
export function oauthCallback(value, attempt, now = Date.now()) {
  if (!attempt || now >= attempt.expires || typeof value !== 'string' || value.length > 8192) return null;
  try {
    const url = new URL(value); const expected = new URL(attempt.redirectTo);
    if (url.protocol !== 'ultrapad:' || url.host !== 'auth' || url.pathname !== '/callback' || url.username || url.password
      || url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== expected.searchParams.get('state')) return null;
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (url.hash && !fragment.has('error')) return null;
    if (url.searchParams.has('error') || fragment.has('error')) return { error: 'Accesso non completato. Riprova dal pulsante di login.' };
    const code = url.searchParams.get('code');
    return url.searchParams.getAll('code').length === 1 && code && code.length <= 2048 ? { code } : null;
  } catch { return null; }
}

// Only packaged assets are served at the canonical web origin. No HTTP server,
// wildcard CORS, remote frontend fallback, or generic filesystem bridge.
export async function assetResponse(request, root, origin) {
  const url = new URL(request.url);
  if (url.origin !== origin) return null;
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return new Response(null, { status: 400 }); }
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..')) return new Response(null, { status: 403 });
  const file = resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + sep)) return new Response(null, { status: 403 });
  const extension = extname(file);
  const target = !extension ? resolve(root, 'index.html') : file;
  try {
    const bytes = await readFile(target);
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
      'Content-Type': types[extension || '.html'] ?? 'application/octet-stream',
      'Content-Security-Policy': contentPolicy, 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store'
    } });
  } catch { return new Response(null, { status: 404 }); }
}
