import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '../../apps/desktop');
const requireDesktop = createRequire(join(root, 'package.json'));
let app: ElectronApplication;
let page: Page;
let userData: string;
test.beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'ultrapad-desktop-test-'));
  // --no-sandbox is ONLY for root-owned Linux CI containers, never application code.
  app = await electron.launch({ executablePath: process.env.ULTRAPAD_ELECTRON_EXECUTABLE ?? requireDesktop('electron'), args: [process.env.ULTRAPAD_ELECTRON_TEST_ENTRY ?? root, `--user-data-dir=${userData}`, ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : [])] });
  page = await app.firstWindow();
  await expect(page.getByRole('button', { name: 'Continua senza account', exact: true })).toBeVisible();
});
test.afterEach(async () => { if(app)await app.close(); if(userData)await rm(userData, {recursive:true,force:true}); });

test('packaged frontend starts offline with sandboxed renderer and native menus', async () => {
  const config = JSON.parse(await readFile(join(root, 'desktop-config.json'), 'utf8'));
  expect(new URL(page.url()).origin).toBe(config.appOrigin);
  expect(await page.evaluate(() => ({ node: typeof (window as unknown as {require?:unknown}).require, desktop: Boolean(window.ultrapadDesktop), secure: isSecureContext }))).toEqual({node:'undefined',desktop:true,secure:true});
  expect(await app.evaluate(({ BrowserWindow }) => {
    const prefs = (BrowserWindow.getAllWindows()[0].webContents as unknown as {getLastWebPreferences():Record<string,boolean>}).getLastWebPreferences();
    return {sandbox:prefs.sandbox,contextIsolation:prefs.contextIsolation,nodeIntegration:prefs.nodeIntegration,webSecurity:prefs.webSecurity};
  })).toEqual({sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true});
  await page.context().setOffline(true);
  await page.getByRole('button', {name:'Continua senza account',exact:true}).click();
  await page.getByRole('button', {name:'+ Nuovo file',exact:true}).click();
  await page.getByLabel('Nome',{exact:true}).fill('desktop.txt');
  await page.getByRole('button',{name:'Crea',exact:true}).click();
  const editor = page.getByRole('textbox',{name:'Contenuto desktop.txt'});
  await editor.fill('UltraPad desktop offline');
  await page.reload();
  await page.getByRole('button',{name:'desktop.txt',exact:true}).click();
  await expect(editor).toHaveText('UltraPad desktop offline');
  expect(await page.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});

test('desktop OAuth opens system browser, rejects forged callbacks and exchanges PKCE once', async () => {
  // Fixtures remain confined to tests; no real account or production mutation.
  await app.evaluate(({ shell }) => { shell.openExternal = async url => { (globalThis as unknown as {opened:string}).opened=url; }; });
  // HTTPS requests pass through the native protocol handler, so fixture the
  // main session transport rather than Playwright's renderer-only routing.
  await app.evaluate(({ session }) => {
    const desktopSession = session.fromPartition('persist:ultrapad-desktop');
    const forward = desktopSession.fetch.bind(desktopSession);
    const state = globalThis as unknown as {exchanges:number;pkceBody:Record<string,string>};
    state.exchanges = 0;
    desktopSession.fetch = async (input, options) => {
      if (input instanceof Request && input.url.includes('/auth/v1/token?grant_type=pkce')) {
        state.pkceBody = await input.json();state.exchanges++;
        return new Response(JSON.stringify({error:'invalid_grant',error_description:'Test code only'}), {status:400,headers:{'Content-Type':'application/json'}});
      }
      return forward(input, options);
    };
  });
  await page.getByRole('button',{name:'Accedi con Google →',exact:true}).click();
  await expect.poll(()=>app.evaluate(()=> (globalThis as unknown as {opened:string}).opened)).toBeTruthy();
  const url = new URL(await app.evaluate(()=> (globalThis as unknown as {opened:string}).opened));
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('code_challenge_method')).toBe('s256');
  const callback = url.searchParams.get('redirect_to')!;
  expect(callback.startsWith('ultrapad://auth/callback?state=')).toBe(true);
  await app.evaluate(({app}, callback)=>app.emit('open-url',{preventDefault(){}},callback), callback.replace('state=', 'forged=')+'&code=desktop-fixture-code');
  expect(await app.evaluate(()=> (globalThis as unknown as {exchanges:number}).exchanges)).toBe(0);
  await app.evaluate(({app}, callback)=>app.emit('open-url',{preventDefault(){}},callback), callback+'&code=desktop-fixture-code');
  await expect(page.getByRole('alert')).toContainText('Accesso non completato');
  expect(await app.evaluate(()=> (globalThis as unknown as {exchanges:number}).exchanges)).toBe(1);
  const body = await app.evaluate(()=> (globalThis as unknown as {pkceBody:Record<string,string>}).pkceBody);
  expect(body.auth_code).toBe('desktop-fixture-code');expect(body.code_verifier).toBeTruthy();
  await app.evaluate(({app}, callback)=>app.emit('open-url',{preventDefault(){}},callback), callback+'&code=desktop-fixture-code');
  expect(await app.evaluate(()=> (globalThis as unknown as {exchanges:number}).exchanges)).toBe(1);
  await expect(page.getByRole('button',{name:'Accedi con Google →',exact:true})).toBeEnabled();
});

test('OAuth cancellation permits retry and shell refuses arbitrary URLs', async () => {
  await app.evaluate(({ shell }) => { shell.openExternal = async () => {}; });
  expect(await page.evaluate(async () => {
    try { await window.ultrapadDesktop!.openOAuth('file:///etc/passwd'); return false; } catch { return true; }
  })).toBe(true);
  await page.getByRole('button',{name:'Accedi con GitHub →',exact:true}).click();
  await page.getByRole('button',{name:'Annulla accesso',exact:true}).click();
  await expect(page.getByRole('button',{name:'Accedi con Google →',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Continua senza account',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Il tuo spazio ospite'})).toBeVisible();
});
