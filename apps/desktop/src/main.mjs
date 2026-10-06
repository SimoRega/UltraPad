import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { assetResponse, externalUrl, httpsOrigin, newOAuthAttempt, oauthCallback, oauthLifetime, oauthRequestAllowed } from './security.mjs';

const source = dirname(fileURLToPath(import.meta.url));
const root = resolve(source, '..');
let window;
let attempt;
let attemptTimer;
let origin;
let authOrigin;

// Squirrel install/update/uninstall events create/remove Start menu shortcuts.
const squirrel = process.platform === 'win32' && process.argv.find(arg => /^--squirrel-(install|updated|uninstall|obsolete)$/.test(arg));
if (squirrel) {
  if (squirrel === '--squirrel-obsolete') app.quit();
  else {
    const action = squirrel === '--squirrel-uninstall' ? '--removeShortcut' : '--createShortcut';
    const updater = spawn(resolve(dirname(process.execPath), '..', 'Update.exe'), [action, basename(process.execPath)], { windowsHide: true });
    updater.once('error', () => app.quit()); updater.once('exit', () => app.quit());
  }
} else if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('open-url', (event, url) => { event.preventDefault(); receiveCallback(url); });
  app.on('second-instance', (_event, argv) => {
    const url = argv.find(arg => arg.startsWith('ultrapad:'));
    if (url) receiveCallback(url);
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  app.whenReady().then(start).catch(() => {
    dialog.showErrorBox('UltraPad', 'Avvio non riuscito. Ricrea la build con pnpm desktop:build e riprova.'); app.quit();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (!window && origin) void createWindow(); });
}

function clearAttempt() { attempt = undefined; clearTimeout(attemptTimer); }
function emitResult(result) { if (window && !window.isDestroyed()) window.webContents.send('desktop:oauth-result', result); }
function receiveCallback(url) {
  const result = oauthCallback(url, attempt);
  if (!result || !window) return;
  clearAttempt(); emitResult(result);
  if (window.isMinimized()) window.restore(); window.focus();
}
function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
    || new URL(event.senderFrame.url).origin !== origin) throw new Error('Richiesta desktop non autorizzata');
}
async function start() {
  const config = JSON.parse(await readFile(join(root, 'desktop-config.json'), 'utf8'));
  origin = httpsOrigin(config.appOrigin); authOrigin = httpsOrigin(config.supabaseOrigin);
  app.setName('UltraPad'); app.setAppUserModelId('com.squirrel.UltraPad.UltraPad');
  if (process.defaultApp) app.setAsDefaultProtocolClient('ultrapad', process.execPath, [root]);
  else app.setAsDefaultProtocolClient('ultrapad');
  const desktopSession = session.fromPartition('persist:ultrapad-desktop');
  desktopSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(permission === 'clipboard-sanitized-write' && details.requestingUrl?.startsWith(origin + '/'));
  });
  desktopSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => contents === window?.webContents && permission === 'clipboard-sanitized-write' && requestingOrigin === origin);
  await desktopSession.protocol.handle('https', async request => {
    const response = await assetResponse(request, join(root, 'renderer'), origin);
    return response ?? desktopSession.fetch(request, { bypassCustomProtocolHandlers: true });
  });
  desktopSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ title: 'Salva da UltraPad', defaultPath: join(app.getPath('downloads'), basename(item.getFilename())) });
  });
  ipcMain.handle('desktop:oauth-prepare', event => {
    trusted(event); clearAttempt(); attempt = newOAuthAttempt();
    attemptTimer = setTimeout(() => { clearAttempt(); emitResult({ error: 'Tempo di accesso scaduto. Riprova.' }); }, oauthLifetime);
    return { redirectTo: attempt.redirectTo };
  });
  ipcMain.handle('desktop:oauth-open', async (event, url) => {
    trusted(event);
    if (!oauthRequestAllowed(url, attempt, authOrigin)) throw new Error('URL di login non autorizzato');
    await shell.openExternal(url);
  });
  ipcMain.handle('desktop:oauth-cancel', event => { trusted(event); clearAttempt(); });
  const menu = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [{ role: 'close' }] },
    { role: 'editMenu' },
    { label: 'Visualizza', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])] },
    { label: 'Aiuto', submenu: [{ label: 'Informazioni su UltraPad', click: () => dialog.showMessageBox(window, { type: 'info', title: 'UltraPad', message: `UltraPad ${app.getVersion()}`, detail: 'Note, codice e progetti collaborativi.\nLa versione desktop usa gli stessi servizi della web app.' }) }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  await createWindow(desktopSession);
}
async function createWindow(desktopSession = session.fromPartition('persist:ultrapad-desktop')) {
  window = new BrowserWindow({ width: 1440, height: 960, minWidth: 800, minHeight: 600, title: 'UltraPad', icon: join(root, 'assets/ultrapad.png'), backgroundColor: '#18181b', show: false,
    webPreferences: { session: desktopSession, preload: join(source, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false }
  });
  window.once('ready-to-show', () => window?.show());
  window.on('closed', () => { window = undefined; clearAttempt(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) { event.preventDefault(); if (externalUrl(url)) void shell.openExternal(url); }
  });
  window.webContents.on('will-redirect', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`blob:${origin}/`)) return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { preload: undefined, nodeIntegration: false, contextIsolation: true, sandbox: true } } };
    if (externalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  await window.loadURL(origin + '/');
}
