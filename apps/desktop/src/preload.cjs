// The renderer can initiate a bounded OAuth attempt; it cannot access Node,
// arbitrary IPC channels, paths, or the operating system shell.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ultrapadDesktop', {
  platform: process.platform,
  prepareOAuth: () => ipcRenderer.invoke('desktop:oauth-prepare'),
  openOAuth: url => ipcRenderer.invoke('desktop:oauth-open', url),
  cancelOAuth: () => ipcRenderer.invoke('desktop:oauth-cancel'),
  onOAuthResult: callback => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('desktop:oauth-result', listener);
    return () => ipcRenderer.removeListener('desktop:oauth-result', listener);
  }
});
