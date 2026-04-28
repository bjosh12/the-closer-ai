import { app, BrowserWindow, ipcMain, globalShortcut, dialog, Tray, Menu, desktopCapturer } from 'electron';
import path from 'path';
import { dbHelpers } from './db';
import { cloudSync } from './cloud';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const store = new Store();
const execPromise = promisify(exec);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let widgetWindow: BrowserWindow | null = null;

// Set the App User Model ID so Windows shows "Mocking Bird AI" instead of "Electron"
// in Toast Notifications and Privacy Settings (Microphone/Screen Capture).
if (process.platform === 'win32') {
  app.setAppUserModelId('Mocking Bird AI');
}

// ─── Auto Updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (status: string) => mainWindow?.webContents.send('app:updateStatus', status);

  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-available', (info) => send(`available:${info.version}`));
  autoUpdater.on('update-not-available', () => send('latest'));
  autoUpdater.on('download-progress', (p) => send(`downloading:${Math.round(p.percent)}`));
  autoUpdater.on('update-downloaded', (info) => {
    send(`downloaded:${info.version}`);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready — Mocking Bird AI',
      message: `Version ${info.version} has been downloaded.\nRestart now to apply the update?`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then((result) => { if (result.response === 0) autoUpdater.quitAndInstall(); });
  });
  autoUpdater.on('error', (err) => send(`error:${err.message}`));

  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}

// ─── System Tray ──────────────────────────────────────────────────────────────
function setupTray() {
  const iconPath = process.env.VITE_DEV_SERVER_URL
    ? path.join(process.cwd(), 'public/icon.ico')
    : path.join(__dirname, '../public/icon.ico');

  tray = new Tray(iconPath);
  tray.setToolTip('Mocking Bird AI');

  const buildMenu = () => {
    const isStartup = app.getLoginItemSettings().openAtLogin;
    const menu = Menu.buildFromTemplate([
      { label: 'Show Mocking Bird AI', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      {
        label: 'Launch at Startup', type: 'checkbox', checked: isStartup,
        click: () => { app.setLoginItemSettings({ openAtLogin: !isStartup }); buildMenu(); }
      },
      { type: 'separator' },
      { label: 'Quit Mocking Bird AI', click: () => { app.exit(0); } },
    ]);
    tray?.setContextMenu(menu);
  };

  buildMenu();
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ─── Window ───────────────────────────────────────────────────────────────────
function saveBounds() {
  if (mainWindow && !mainWindow.isMaximized()) {
    store.set('windowBounds', mainWindow.getBounds());
  }
}

function createWindow() {
  const savedBounds = store.get('windowBounds') as Electron.Rectangle | undefined;

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1200,
    height: savedBounds?.height ?? 800,
    x: savedBounds?.x,
    y: savedBounds?.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#09090b', symbolColor: '#ffffff' },
  });

  // Minimize to tray instead of quitting
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow?.hide();
    tray?.displayBalloon?.({
      title: 'Mocking Bird AI',
      content: 'Still running in the background. Double-click the tray icon to reopen.',
      iconType: 'info',
    });
  });

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  setupTray();
  setupAutoUpdater();
  
  // Enable silent system audio capture for getDisplayMedia
  const { session } = require('electron');
  session.defaultSession.setDisplayMediaRequestHandler((_request: any, callback: any) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    });
  });

  const registerShortcuts = () => {
    globalShortcut.unregisterAll();
    
    // Alt+C: Toggle Widget/Main Window
    globalShortcut.register('Alt+C', () => {
      if (widgetWindow) {
        widgetWindow.isVisible() ? widgetWindow.hide() : widgetWindow.show();
      } else {
        mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show();
      }
    });

    // Alt+G: Toggle Widget Ghost Mode (Click-through)
    globalShortcut.register('Alt+G', () => {
      if (widgetWindow) {
        // We need to track the state. For now we can use a store or just send a message.
        widgetWindow.webContents.send('widget:toggleGhost');
      }
    });

    // Alt+S: Start/Stop Session
    globalShortcut.register('Alt+S', () => {
      mainWindow?.webContents.send('shortcut:toggle-session');
    });

    // Alt+A: Generate Answer
    globalShortcut.register('Alt+A', () => {
      mainWindow?.webContents.send('shortcut:generate-answer');
    });

    // Alt+X: Clear Transcript
    globalShortcut.register('Alt+X', () => {
      mainWindow?.webContents.send('shortcut:clear-transcript');
    });

    // Ctrl+,: Open Settings
    globalShortcut.register('CommandOrControl+,', () => {
      mainWindow?.show();
      mainWindow?.webContents.send('shortcut:open-settings');
    });

    // Ctrl+H: View History
    globalShortcut.register('CommandOrControl+H', () => {
      mainWindow?.show();
      mainWindow?.webContents.send('shortcut:open-history');
    });
  };

  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });
// Don't quit when all windows closed — tray keeps app alive
app.on('window-all-closed', () => {});

// ─── IPC: Window ──────────────────────────────────────────────────────────────
ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});

// ─── IPC: App ─────────────────────────────────────────────────────────────────
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:checkForUpdates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result) {
      mainWindow?.webContents.send('app:updateStatus', 'error:Updates not available in local dev mode');
    }
    return result;
  } catch (err: any) {
    mainWindow?.webContents.send('app:updateStatus', `error:${err.message}`);
    throw err;
  }
});
ipcMain.handle('app:getSources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
  return sources.map(s => ({ id: s.id, name: s.name }));
});
ipcMain.handle('app:installUpdate', () => autoUpdater.quitAndInstall());

ipcMain.handle('app:getLaunchAtStartup', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('app:setLaunchAtStartup', (_, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enabled });
});
ipcMain.on('app:quit', () => app.exit(0));

ipcMain.handle('app:isFirstRun', () => !store.get('HAS_ONBOARDED'));
ipcMain.handle('app:completeOnboarding', () => store.set('HAS_ONBOARDED', true));

ipcMain.handle('app:getWhatsNew', () => {
  const currentVersion = app.getVersion();
  const lastSeen = store.get('lastSeenVersion') as string | undefined;
  const isNew = lastSeen !== currentVersion;
  store.set('lastSeenVersion', currentVersion);
  return { isNew, version: currentVersion };
});

// ─── IPC: Store ───────────────────────────────────────────────────────────────
ipcMain.handle('store:get', (_, key) => store.get(key));
ipcMain.handle('store:set', (_, key, value) => { store.set(key, value); });

// ─── IPC: DB ──────────────────────────────────────────────────────────────────
ipcMain.handle('db:getSessions', () => dbHelpers.getSessions());
ipcMain.handle('db:createSession', (_, session) => dbHelpers.createSession(session));
ipcMain.handle('db:getSession', (_, id) => dbHelpers.getSession(id));
ipcMain.handle('db:saveTranscript', (_, t) => dbHelpers.saveTranscript(t));
ipcMain.handle('db:getTranscripts', (_, id) => dbHelpers.getTranscripts(id));
ipcMain.handle('db:saveAnswer', (_, a) => dbHelpers.saveAnswer(a));
ipcMain.handle('db:getAnswers', (_, id) => dbHelpers.getAnswers(id));
ipcMain.handle('db:getProfile', (_, userId) => dbHelpers.getProfile(userId));
ipcMain.handle('db:saveProfile', (_, profile) => dbHelpers.saveProfile(profile));
ipcMain.handle('db:getTemplates', () => dbHelpers.getTemplates());
ipcMain.handle('db:saveTemplate', (_, t) => dbHelpers.saveTemplate(t));
ipcMain.handle('db:deleteTemplate', (_, id) => dbHelpers.deleteTemplate(id));
ipcMain.handle('db:getDocuments', () => dbHelpers.getDocuments());
ipcMain.handle('db:saveDocument', (_, doc) => dbHelpers.saveDocument(doc));
ipcMain.handle('db:deleteDocument', (_, id) => dbHelpers.deleteDocument(id));

// ─── IPC: Cloud ───────────────────────────────────────────────────────────────
ipcMain.handle('cloud:signIn', (_, email, password) => cloudSync.signIn(email, password));
ipcMain.handle('cloud:signUp', (_, email, password, metadata) => cloudSync.signUp(email, password, metadata));
ipcMain.handle('cloud:signOut', () => cloudSync.signOut());
ipcMain.handle('cloud:getUser', () => cloudSync.getUser());
ipcMain.handle('cloud:getAuthSession', () => cloudSync.getAuthSession());
ipcMain.handle('cloud:getProfile', (_, userId) => cloudSync.getProfile(userId));
ipcMain.handle('cloud:getDocuments', (_, userId) => cloudSync.getDocuments(userId));
ipcMain.handle('cloud:syncDocument', (_, doc, userId) => cloudSync.syncDocument(doc, userId));
ipcMain.handle('cloud:deleteDocument', (_, id) => cloudSync.deleteDocument(id));
ipcMain.handle('cloud:syncSession', (_, session, userId) => cloudSync.syncSession(session, userId));
ipcMain.handle('cloud:incrementMinutes', (_, userId, minutes) => cloudSync.incrementMinutes(userId, minutes));
ipcMain.handle('cloud:checkTrial', (_, userId) => cloudSync.checkTrial(userId));
ipcMain.handle('cloud:verifyLicense', (_, key, machineId, userId) => cloudSync.verifyLicense(key, machineId, userId));

// ─── IPC: File ────────────────────────────────────────────────────────────────
const pdfParse = require('pdf-parse');
ipcMain.handle('file:parsePdf', async (_, filePath) => {
  const data = await pdfParse(fs.readFileSync(filePath));
  return data.text;
});

// ─── IPC: URL Fetch ───────────────────────────────────────────────────────────
ipcMain.handle('url:fetch', async (_, url) => {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    win.webContents.on('did-finish-load', async () => {
      try {
        const text = await win.webContents.executeJavaScript('document.body.innerText');
        win.destroy();
        resolve(text.replace(/\s+/g, ' ').trim());
      } catch (err) { win.destroy(); reject(err); }
    });
    win.webContents.on('did-fail-load', (_, _code, desc) => { win.destroy(); reject(new Error(desc)); });
    setTimeout(() => { if (!win.isDestroyed()) { win.destroy(); reject(new Error('Timeout')); } }, 15000);
    win.loadURL(url).catch(err => { if (!win.isDestroyed()) win.destroy(); reject(err); });
  });
});

ipcMain.handle('url:post', async (_, url, headers, body) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
    });
    if (!response.ok) {
      return { ok: false, error: response.statusText };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('url:postStream', async (event, url, headers, body) => {
  try {
    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) return { ok: false, error: response.statusText };

    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          const token = data.choices?.[0]?.delta?.content || '';
          if (token) {
            full += token;
            event.sender.send('stream:chunk', token);
          }
        } catch {}
      }
    }
    return { ok: true, data: full };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Widget ──────────────────────────────────────────────────────────────
ipcMain.handle('widget:open', () => {
  if (widgetWindow) { widgetWindow.show(); return; }
  widgetWindow = new BrowserWindow({
    width: 450, height: 300, transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: true },
  });
  widgetWindow.setContentProtection(true);
  if (process.env.VITE_DEV_SERVER_URL) widgetWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#widget`);
  else widgetWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'widget' });
  widgetWindow.on('closed', () => { widgetWindow = null; });
});
ipcMain.handle('widget:close', () => { widgetWindow?.close(); widgetWindow = null; });
ipcMain.on('widget:update', (_, data) => widgetWindow?.webContents.send('widget:onUpdate', data));
ipcMain.on('widget:setOpacity', (_, opacity) => widgetWindow?.setOpacity(opacity));
ipcMain.on('widget:setIgnoreMouseEvents', (_, ignore) => widgetWindow?.setIgnoreMouseEvents(ignore, { forward: true }));
ipcMain.on('widget:forceAnswer', () => mainWindow?.webContents.send('shortcut:generate-answer'));
ipcMain.on('widget:clear', () => widgetWindow?.webContents.send('widget:onClear'));

// ─── IPC: License ─────────────────────────────────────────────────────────────
async function getMachineId() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execPromise('wmic csproduct get uuid');
      return stdout.split('\n')[1].trim();
    } else {
      const { stdout } = await execPromise('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID');
      return stdout.split('"')[3];
    }
  } catch { return 'unknown-hwid-' + process.platform; }
}
ipcMain.handle('license:getMachineId', () => getMachineId());
ipcMain.handle('license:verify', async (_, licenseKey) => ({ machineId: await getMachineId(), licenseKey }));
ipcMain.handle('app:getSources', async () => {
  return await desktopCapturer.getSources({ types: ['screen', 'window'], fetchWindowIcons: false });
});
ipcMain.handle('ping', () => 'pong');
