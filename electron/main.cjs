'use strict';
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  screen,
  safeStorage,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { Updates } = require('./updates.cjs');
let updates, updateTimer;
function updatePreferences() {
  if (!updates) return;
  clearInterval(updateTimer);
  if (!settings().autoCheckUpdates) return;
  const run = async () => {
    await updates.check();
    if (
      settings().autoCheckUpdates &&
      settings().autoInstallUpdates &&
      updates.status().state === 'available'
    )
      await updates.install(true);
  };
  void run();
  updateTimer = setInterval(() => void run(), 6 * 60 * 60 * 1000);
  updateTimer.unref();
}
async function installUpdate(file) {
  const portable = process.env.PORTABLE_EXECUTABLE_FILE;
  let command = file,
    args = ['/S'];
  if (portable) {
    const script = path.join(app.getPath('userData'), 'updates', 'apply-portable.ps1');
    await fs.writeFile(
      script,
      `param([int]$OldPid,[string]$Source,[string]$Destination)
$ErrorActionPreference='Stop'
Wait-Process -Id $OldPid -ErrorAction SilentlyContinue
try {
 Copy-Item -LiteralPath $Destination -Destination ($Destination+'.previous') -Force
 Copy-Item -LiteralPath $Source -Destination ($Destination+'.updating') -Force
 Move-Item -LiteralPath ($Destination+'.updating') -Destination $Destination -Force
 Start-Process -FilePath $Destination
} catch { $_ | Out-File -FilePath ($Source+'.error.txt') }
`,
    );
    command = 'powershell.exe';
    args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'RemoteSigned',
      '-File',
      script,
      '-OldPid',
      String(process.pid),
      '-Source',
      file,
      '-Destination',
      portable,
    ];
  }
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
  quitting = true;
  app.quit();
}

const { randomUUID } = require('node:crypto');
const { Store } = require('./store.cjs');
const { validateConfig } = require('./schema.cjs');
const { launchEntry } = require('./launcher.cjs');
const { ShortcutManager } = require('./shortcuts.cjs');
let shortcutManager,
  capturing = false,
  openedAt = 0,
  lastToggle = 0;
const dev = process.argv.includes('--dev');
if (!app.isPackaged && process.env.ORBIT_TEST_USER_DATA)
  app.setPath('userData', path.resolve(process.env.ORBIT_TEST_USER_DATA));
let main,
  donut,
  tray,
  store,
  quitting = false,
  launching = false;
const fallback = { hotkey: 'CommandOrControl+Shift+Space', closeToTray: true, donutSize: 400 };
const settings = () => store.value?.settings ?? fallback;
const traySvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="18" fill="#7f77dd"/><circle cx="32" cy="32" r="20" fill="none" stroke="white" stroke-width="9"/><path d="M32 7v10M57 32H47M32 57V47M7 32h10" stroke="#7f77dd" stroke-width="4"/></svg>';
function broadcast() {
  for (const win of [main, donut])
    if (win && !win.isDestroyed()) win.webContents.send('config:changed', store.value);
}
function showSettings() {
  if (main.isMinimized()) main.restore();
  main.show();
  main.focus();
}
function showDonut() {
  if (!donut || donut.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(cursor).workArea;
  const size = Math.min(settings().donutSize + 100, area.width, area.height);
  donut.setBounds({
    width: size,
    height: size,
    x: Math.round(Math.max(area.x, Math.min(cursor.x - size / 2, area.x + area.width - size))),
    y: Math.round(Math.max(area.y, Math.min(cursor.y - size / 2, area.y + area.height - size))),
  });
  openedAt = Date.now();
  donut.show();
  donut.focus();
  donut.webContents.send('donut:opened');
}
function registerShortcuts(config) {
  if (!shortcutManager)
    shortcutManager = new ShortcutManager(globalShortcut, (target) => {
      if (target === 'donut') {
        if (Date.now() - lastToggle < 400) return;
        lastToggle = Date.now();
        donut.isVisible() ? donut.hide() : showDonut();
      } else if (target)
        void performLaunch(target).catch((error) =>
          dialog.showErrorBox('Could not launch application', error.message),
        );
    });
  shortcutManager.configure(
    capturing
      ? []
      : [
          [config?.settings.hotkey ?? fallback.hotkey, 'donut'],
          ...(config?.entries ?? []).filter((a) => a.hotkey).map((a) => [a.hotkey, a.id]),
        ],
  );
}
function endCapture() {
  if (!capturing) return;
  capturing = false;
  registerShortcuts(store.value);
}
function trayMenu() {
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open donut', click: showDonut },
      { label: 'Open Orbit settings', click: showSettings },
      { type: 'separator' },
      ...(store.value?.profiles ?? []).map((p) => ({
        label: p.name,
        type: 'radio',
        checked: p.id === store.value.activeProfile,
        click: () => {
          store.save({ ...store.value, activeProfile: p.id });
          broadcast();
          trayMenu();
        },
      })),
      { type: 'separator' },
      {
        label: 'Quit Orbit',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}
function commit(value) {
  const clean = validateConfig(value),
    previous = store.value;
  // Renderer snapshots never replace newer history written by a completed launch.
  clean.history = previous?.history ?? clean.history;
  try {
    registerShortcuts(clean);
    if (process.platform === 'win32')
      app.setLoginItemSettings({
        openAtLogin: clean.settings.launchAtLogin,
        path: process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe'),
        args: [],
      });
    store.save(clean);
  } catch (error) {
    try {
      registerShortcuts(previous);
      if (process.platform === 'win32')
        app.setLoginItemSettings({
          openAtLogin: previous?.settings.launchAtLogin ?? false,
          path: process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe'),
          args: [],
        });
    } catch {}
    throw error;
  }
  broadcast();
  trayMenu();
  if (
    previous?.settings.autoCheckUpdates !== clean.settings.autoCheckUpdates ||
    previous?.settings.autoInstallUpdates !== clean.settings.autoInstallUpdates
  )
    updatePreferences();
  return store.value;
}
async function performLaunch(id) {
  if (launching) return { success: false, message: 'A launch is already in progress.' };
  if (!store.value) return { success: false, message: 'Open settings to finish setup.' };
  launching = true;
  try {
    const config = store.value;
    const result = await launchEntry(id, config, { shell });
    const entry = config.entries.find((a) => a.id === id);
    const detail = result.results
      .filter((r) => !r.success)
      .map((r) => `${r.name}: ${r.error}`)
      .join(' ');
    const record = {
      id: randomUUID(),
      entryId: id,
      name: entry?.name ?? 'Application',
      time: Date.now(),
      success: result.success,
      detail: (detail || result.message).slice(0, 1000),
    };
    store.save({ ...store.value, history: [record, ...store.value.history].slice(0, 100) });
    broadcast();
    if (result.success && settings().autoHide) donut.hide();
    return result;
  } finally {
    launching = false;
  }
}
function createWindow(radial = false) {
  const win = new BrowserWindow({
    width: radial ? 500 : 1220,
    height: radial ? 500 : 850,
    minWidth: radial ? 280 : 920,
    minHeight: radial ? 280 : 620,
    show: false,
    title: radial ? 'Orbit donut' : 'Orbit Launcher',
    frame: false,
    transparent: radial,
    backgroundColor: radial ? '#00000000' : '#f6f5f1',
    resizable: !radial,
    alwaysOnTop: radial,
    skipTaskbar: radial,
    hasShadow: !radial,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  if (dev) win.loadURL(`http://127.0.0.1:5173/${radial ? '?donut=1' : ''}`);
  else
    win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: radial ? { donut: '1' } : {},
    });
  if (radial) {
    win.on('blur', () => {
      if (settings().autoHide && Date.now() - openedAt > 600) win.hide();
    });
  } else {
    win.on('blur', () => {
      try {
        endCapture();
      } catch (error) {
        dialog.showErrorBox('Shortcut unavailable', error.message);
      }
    });
    win.once('ready-to-show', () => {
      if (!settings().startMinimized) win.show();
    });
    win.on('close', (event) => {
      if (!quitting && settings().closeToTray && tray) {
        event.preventDefault();
        win.hide();
      }
    });
  }
  return win;
}
function authorized(event) {
  const sender = event.sender;
  if (
    ![main?.webContents, donut?.webContents].includes(sender) ||
    event.senderFrame !== sender.mainFrame
  )
    throw new Error('Untrusted IPC sender.');
}
function handle(channel, callback) {
  ipcMain.handle(channel, async (event, ...args) => {
    authorized(event);
    return callback(...args);
  });
}
async function describeFile(target) {
  if (typeof target !== 'string' || target.length > 4096 || !path.isAbsolute(target))
    throw new Error('Invalid file path.');
  const info = await fs.stat(target);
  const name = path.basename(target).replace(/\.(exe|com|lnk|url)$/i, '');
  if (!info.isDirectory() && process.platform === 'win32' && !/\.(exe|com|lnk|url)$/i.test(target))
    throw new Error('Drop an application (.exe), shortcut (.lnk/.url), or folder.');
  let icon;
  try {
    icon = (await app.getFileIcon(target, { size: 'large' })).toDataURL();
  } catch {}
  return { name, target, icon, type: info.isDirectory() ? 'folder' : 'app' };
}
function setupIPC() {
  handle('shortcut:capture', (active) => {
    if (typeof active !== 'boolean') throw Error('Invalid capture state.');
    capturing = active;
    registerShortcuts(store.value);
  });
  handle('repository:open', () => shell.openExternal('https://github.com/vmrishi/Launcher'));
  handle('updates:action', (action) => {
    if (action === 'status') return updates.status();
    if (action === 'check') return updates.check();
    if (action === 'install') return updates.install();
    throw Error('Invalid update action.');
  });
  handle('updates:token', async (token) => {
    const result = await updates.saveToken(token);
    updatePreferences();
    return result;
  });
  handle('config:load', () => store.value);
  handle('config:save', commit);
  handle('launch', (id) => {
    if (typeof id !== 'string' || id.length > 100) throw new Error('Invalid application.');
    return performLaunch(id);
  });
  handle('donut:show', showDonut);
  handle('donut:hide', () => donut.hide());
  handle('settings:show', showSettings);
  handle('browse', async (kind) => {
    if (!['app', 'folder', 'icon'].includes(kind)) throw new Error('Invalid picker.');
    const result = await dialog.showOpenDialog(main, {
      title: kind === 'icon' ? 'Choose an icon' : 'Add to Orbit',
      properties: kind === 'folder' ? ['openDirectory'] : ['openFile'],
      filters:
        kind === 'icon'
          ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'ico'] }]
          : kind === 'app'
            ? [
                {
                  name: 'Windows applications & shortcuts',
                  extensions: ['exe', 'com', 'lnk', 'url'],
                },
                { name: 'All files', extensions: ['*'] },
              ]
            : [],
    });
    if (result.canceled) return null;
    if (kind === 'icon') {
      const target = result.filePaths[0];
      if ((await fs.stat(target)).size > 2 * 1024 * 1024)
        throw new Error('Choose an icon smaller than 2 MB.');
      const image = nativeImage.createFromPath(target);
      if (image.isEmpty()) throw new Error('This image could not be read.');
      return {
        name: 'Custom icon',
        target,
        icon: image.resize({ width: 64, height: 64 }).toDataURL(),
      };
    }
    return describeFile(result.filePaths[0]);
  });
  handle('describe', async (paths) => {
    if (!Array.isArray(paths) || paths.length > 100)
      throw new Error('Drop up to 100 applications at once.');
    return Promise.all(paths.map(describeFile));
  });
  handle('scan', async () => {
    if (process.platform !== 'win32') return [];
    const roots = [
      process.env.APPDATA &&
        path.join(process.env.APPDATA, 'Microsoft/Windows/Start Menu/Programs'),
      process.env.ProgramData &&
        path.join(process.env.ProgramData, 'Microsoft/Windows/Start Menu/Programs'),
    ].filter(Boolean);
    const found = [];
    async function walk(directory, depth = 0) {
      if (depth > 8 || found.length >= 500) return;
      let items;
      try {
        items = await fs.readdir(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const item of items) {
        if (found.length >= 500) break;
        const full = path.join(directory, item.name);
        if (item.isDirectory()) await walk(full, depth + 1);
        else if (/\.(lnk|url)$/i.test(item.name) && !/uninstall/i.test(item.name)) found.push(full);
      }
    }
    for (const root of roots) await walk(root);
    const results = [];
    for (const file of found) {
      try {
        results.push(await describeFile(file));
      } catch {}
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  });
  handle('config:export', async () => {
    if (!store.value) return false;
    const result = await dialog.showSaveDialog(main, {
      defaultPath: 'orbit-settings.json',
      filters: [{ name: 'Orbit settings', extensions: ['json'] }],
    });
    if (result.canceled) return false;
    await fs.writeFile(result.filePath, JSON.stringify({ ...store.value, history: [] }, null, 2));
    return true;
  });
  handle('config:import', async () => {
    const result = await dialog.showOpenDialog(main, {
      filters: [{ name: 'Orbit settings', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if ((await fs.stat(file)).size > 5 * 1024 * 1024)
      throw new Error('Settings file exceeds 5 MB.');
    const clean = validateConfig(JSON.parse(await fs.readFile(file, 'utf8')));
    const answer = await dialog.showMessageBox(main, {
      type: 'question',
      buttons: ['Cancel', 'Import settings'],
      defaultId: 0,
      cancelId: 0,
      title: 'Replace Orbit settings?',
      message: `Import ${clean.entries.length} applications and ${clean.profiles.length} profiles?`,
      detail:
        'This replaces your current library, themes and shortcuts. Imported targets will only run when you launch them. Windows sign-in startup remains unchanged.',
    });
    if (answer.response !== 1) return null;
    clean.settings.launchAtLogin = settings().launchAtLogin ?? false;
    return commit(clean);
  });
  handle('history:clear', () => {
    if (store.value) {
      store.save({ ...store.value, history: [] });
      broadcast();
    }
  });
  ipcMain.on('window', (event, action) => {
    authorized(event);
    if (action === 'minimize') main.minimize();
    if (action === 'maximize') main.isMaximized() ? main.unmaximize() : main.maximize();
    if (action === 'close') main.close();
    if (action === 'quit') {
      quitting = true;
      app.quit();
    }
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (main) showSettings();
  });
  app
    .whenReady()
    .then(async () => {
      store = new Store(app.getPath('userData'));
      try {
        store.load();
      } catch (error) {
        dialog.showErrorBox(
          'Orbit settings need attention',
          `${error.message}\n\nYour settings were preserved. Close Orbit and restore settings.json.bak in ${app.getPath('userData')}.`,
        );
        app.quit();
        return;
      }
      updates = new Updates({
        directory: path.join(app.getPath('userData'), 'updates'),
        version: app.getVersion(),
        portable: !!process.env.PORTABLE_EXECUTABLE_FILE,
        packaged: app.isPackaged,
        platform: process.platform,
        secure: safeStorage,
        install: installUpdate,
        canAutoInstall: () => settings().autoCheckUpdates && settings().autoInstallUpdates,
      });
      await updates.initialize();
      const initialUpdate = setTimeout(updatePreferences, 10000);
      initialUpdate.unref();
      main = createWindow();
      donut = createWindow(true);
      const icon = nativeImage.createFromDataURL(
        `data:image/svg+xml;base64,${Buffer.from(traySvg).toString('base64')}`,
      );
      // SVG decoding differs across Electron platforms; a PNG is bundled at build time.
      const bundled = nativeImage.createFromPath(path.join(__dirname, '../dist/orbit.png'));
      tray = new Tray(bundled.isEmpty() ? icon : bundled);
      tray.setToolTip('Orbit Launcher');
      tray.on('double-click', showSettings);
      tray.on('click', showDonut);
      trayMenu();
      setupIPC();
      try {
        registerShortcuts({
          settings: { hotkey: store.value?.settings.hotkey ?? fallback.hotkey },
          entries: [],
        });
        registerShortcuts(store.value);
      } catch (error) {
        main.show();
        dialog.showErrorBox(
          'Shortcut unavailable',
          error.message + ' Open Shortcuts in settings and assign a different key.',
        );
      }
    })
    .catch((error) => {
      dialog.showErrorBox('Orbit could not start', error.message);
      app.quit();
    });
  app.on('before-quit', () => {
    quitting = true;
    clearInterval(updateTimer);
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => {
    if (quitting) app.quit();
  });
}
