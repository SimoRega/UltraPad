import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetResponse, externalUrl, httpsOrigin, newOAuthAttempt, oauthCallback, oauthLifetime, oauthRequestAllowed } from '../../apps/desktop/src/security.mjs';

const origin = 'https://ultrapad.example';
const supabase = 'https://project.supabase.co';
function request(attempt) {
  const url = new URL(supabase + '/auth/v1/authorize');
  url.search = new URLSearchParams({ provider: 'google', redirect_to: attempt.redirectTo, code_challenge: 'a'.repeat(43), code_challenge_method: 's256' }).toString();
  return url;
}
test('desktop origins require HTTPS without paths or credentials', () => {
  assert.equal(httpsOrigin(origin), origin);
  for (const value of ['http://localhost', 'https://a:b@example.com', origin + '/extra', origin + '?token=x']) assert.throws(() => httpsOrigin(value));
});
test('external links reject executable protocols and credentials', () => {
  assert.equal(externalUrl('https://example.com/docs'), true);
  assert.equal(externalUrl('mailto:hello@example.com'), true);
  for (const value of ['javascript:alert(1)', 'file:///tmp/x', 'ultrapad://auth/callback', 'https://secret@example.com']) assert.equal(externalUrl(value), false);
});
test('OAuth browser launch is bound to provider, Supabase, nonce and PKCE', () => {
  const attempt = newOAuthAttempt(); const url = request(attempt);
  assert.equal(oauthRequestAllowed(url.href, attempt, supabase), true);
  for (const [key, value] of [['provider','other'],['redirect_to','https://evil.example'],['code_challenge_method','plain'],['code_challenge','']]) {
    const invalid = new URL(url); invalid.searchParams.set(key, value);
    assert.equal(oauthRequestAllowed(invalid.href, attempt, supabase), false);
  }
  assert.equal(oauthRequestAllowed(url.href.replace('project.supabase.co', 'evil.example'), attempt, supabase), false);
  assert.equal(oauthRequestAllowed(url.href, undefined, supabase), false);
});
test('callbacks reject stale, forged, duplicate or missing nonces and wrong paths', () => {
  const attempt = newOAuthAttempt(1000); const value = attempt.redirectTo + '&code=fixture';
  assert.deepEqual(oauthCallback(value, attempt, 2000), { code: 'fixture' });
  assert.equal(oauthCallback(value, attempt, 1000 + oauthLifetime), null);
  assert.equal(oauthCallback(value, undefined), null);
  assert.equal(oauthCallback(value.replace('state=', 'wrong='), attempt, 2000), null);
  assert.equal(oauthCallback(value.replace('/callback', '/other'), attempt, 2000), null);
  assert.equal(oauthCallback(value + '&state=forged', attempt, 2000), null);
  assert.equal(oauthCallback(value + '&code=second', attempt, 2000), null);
  assert.notEqual(newOAuthAttempt().redirectTo, newOAuthAttempt().redirectTo);
});
test('provider errors return a generic message without echoing untrusted details', () => {
  const attempt = newOAuthAttempt();
  const result = oauthCallback(attempt.redirectTo + '&error=denied&error_description=secret', attempt);
  assert.match(result.error, /Accesso non completato/); assert.equal(result.error.includes('secret'), false);
  assert.deepEqual(oauthCallback(attempt.redirectTo + '#error=denied&error_description=secret', attempt), result);
});
test('packaged origin serves assets and SPA routes with CSP, no remote fallback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ultrapad-assets-'));
  try {
    await writeFile(join(root, 'index.html'), '<h1>UltraPad</h1>');
    await writeFile(join(root, 'app.js'), 'export const value=1');
    for (const path of ['/', '/workspaces/123', '/projects/123/files/456']) {
      const response = await assetResponse(new Request(origin + path), root, origin);
      assert.equal(response.status, 200); assert.equal(await response.text(), '<h1>UltraPad</h1>');
      assert.match(response.headers.get('Content-Security-Policy'), /object-src 'none'/);
    }
    const script = await assetResponse(new Request(origin + '/app.js'), root, origin);
    assert.equal(script.headers.get('Content-Type'), 'text/javascript');
    assert.equal((await assetResponse(new Request(origin + '/missing.js'), root, origin)).status, 404);
    assert.equal((await assetResponse(new Request(origin + '/%2e%2e%2fsecret'), root, origin)).status, 403);
    assert.equal((await assetResponse(new Request(origin + '/%5csecret'), root, origin)).status, 403);
    assert.equal((await assetResponse(new Request(origin + '/', {method:'POST'}), root, origin)).status, 405);
    assert.equal(await assetResponse(new Request(supabase + '/auth/v1/token'), root, origin), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
