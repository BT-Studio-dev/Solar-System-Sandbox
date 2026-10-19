'use strict';
const { app, BrowserWindow, session, Menu } = require('electron');
const path = require('node:path');

// All content is bundled. No remote URLs, Node integration, or renderer IPC.
app.setAppUserModelId('dev.btstudio.solarsystem');
let window;
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith('file:') && !details.url.startsWith('devtools:') });
  });
  function createWindow() {
    window = new BrowserWindow({
      width: 1440, height: 940, minWidth: 760, minHeight: 520,
      backgroundColor: '#080d17', title: 'Solar System Sandbox',
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.loadFile(path.join(__dirname, '..', 'web', 'index.html'));
    window.on('closed', () => { window = null; });
  }
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
