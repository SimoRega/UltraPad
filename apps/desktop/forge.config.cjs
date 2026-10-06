module.exports = {
  packagerConfig: {
    name: 'UltraPad', executableName: 'UltraPad', appBundleId: 'it.ultrapad.desktop',
    asar: true, prune: false, icon: `${__dirname}/assets/ultrapad`,
    ignore: path => Boolean(path && !/^\/(src|assets|renderer|package\.json|desktop-config\.json)(\/|$)/.test(path)),
    protocols: [{ name: 'UltraPad authentication', schemes: ['ultrapad'] }]
  },
  makers: [
    { name: '@electron-forge/maker-squirrel', config: { name: 'UltraPad', setupExe: 'UltraPad-Setup.exe', setupIcon: `${__dirname}/assets/ultrapad.ico` } },
    { name: '@electron-forge/maker-zip', platforms: ['win32', 'darwin', 'linux'] }
  ]
};
