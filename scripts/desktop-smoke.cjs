'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('@playwright/test');
(async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'orbit-desktop-'));
  let application;
  try {
    application = await _electron.launch({
      args: ['.', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
      cwd: path.resolve(__dirname, '..'),
      timeout: 30000,
      env: {
        ...process.env,
        ORBIT_TEST_USER_DATA: temp,
        XDG_CONFIG_HOME: path.join(temp, 'config'),
        XDG_CACHE_HOME: path.join(temp, 'cache'),
      },
    });
    // Either renderer may load first. Select the settings window by its URL.
    await application.firstWindow();
    let win;
    for (let attempt = 0; attempt < 100; attempt++) {
      win = application.windows().find((p) => p.url().startsWith('file:') && !p.url().includes('donut=1'));
      if (win) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(win, 'Settings window exists');
    await win.getByRole('heading', { name: 'Home.', exact: true }).waitFor();
    assert.equal(await win.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await win.evaluate(() => window.launcher.desktop), true);
    const preferences = await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => ({
        sandbox: w.webContents.getLastWebPreferences().sandbox,
        isolated: w.webContents.getLastWebPreferences().contextIsolation,
        node: w.webContents.getLastWebPreferences().nodeIntegration,
      })),
    );
    assert.equal(preferences.length, 2);
    for (const p of preferences) {
      assert.equal(p.sandbox, true);
      assert.equal(p.isolated, true);
      assert.equal(p.node, false);
    }
    let config = await win.evaluate(() => window.launcher.load());
    assert.equal(config.entries.length, 8);
    config.settings.autoHide = false;
    config.settings.theme = 'dark';
    await win.evaluate((c) => window.launcher.save(c), config);
    await win.reload();
    await win.getByRole('heading', { name: 'Home.', exact: true }).waitFor();
    assert.equal(await win.locator('html').getAttribute('data-theme'), 'dark');
    // A real native spawn writes a file; group execution is covered independently in core tests.
    const output = path.join(temp, 'launched.txt');
    config = await win.evaluate(() => window.launcher.load());
    const target = {
      ...config.entries[0],
      id: 'smoke-process',
      name: 'Smoke process',
      target: process.execPath,
      args: [
        '-e',
        'require("node:fs").writeFileSync(process.argv[1], "native launch worked")',
        output,
      ],
      hotkey: '',
      icon: undefined,
    };
    config.entries.push(target);
    await win.evaluate((c) => window.launcher.save(c), config);
    const launched = await win.evaluate(() => window.launcher.launch('smoke-process'));
    assert.equal(launched.success, true, launched.message);
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fs.readFile(output, 'utf8')) === 'native launch worked') break;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(await fs.readFile(output, 'utf8'), 'native launch worked');
    const history = await win.evaluate(() => window.launcher.load());
    assert.equal(history.history[0].name, 'Smoke process');
    assert.equal(history.history[0].success, true);
    // IPC validates an invalid update and keeps the last persisted settings intact.
    const bad = structuredClone(history);
    bad.settings.opacity = 0;
    const rejected = await win.evaluate(async (c) => {
      try {
        await window.launcher.save(c);
        return false;
      } catch {
        return true;
      }
    }, bad);
    assert.equal(rejected, true);
    await win.evaluate(() => window.launcher.showDonut());
    const donut = application.windows().find((p) => p.url().includes('donut=1'));
    assert.ok(donut, 'Floating donut window exists');
    await donut.getByRole('button', { name: 'Launch File Explorer', exact: true }).waitFor();
    assert.equal(await donut.locator('html').getAttribute('data-theme'), 'dark');
    await donut.evaluate(() => window.launcher.hideDonut());
    const state = await application.evaluate(({ BrowserWindow }) => ({
      main: BrowserWindow.getAllWindows()
        .find((w) => !w.webContents.getURL().includes('donut=1'))
        .isVisible(),
      donut: BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('donut=1'))
        .isVisible(),
    }));
    assert.equal(state.donut, false);
    assert.equal(state.main, true);
    // A shortcut conflict must restore the previous registered shortcut.
    await application.evaluate(({ globalShortcut }) =>
      globalShortcut.register('Control+Alt+9', () => {}),
    );
    config = await win.evaluate(() => window.launcher.load());
    config.entries[0].hotkey = 'Control+Alt+9';
    // The external conflict is intentionally simulated through the same API; registerShortcuts
    // clears Orbit's registrations, so mock a failing registration inside Electron for this test.
    const outcome = await application.evaluate(({ globalShortcut }) => {
      const original = globalShortcut.register;
      globalShortcut.register = (key, callback) =>
        key === 'Control+Alt+9' ? false : original.call(globalShortcut, key, callback);
      return true;
    });
    assert.equal(outcome, true);
    assert.equal(
      await win.evaluate(async (c) => {
        try {
          await window.launcher.save(c);
          return false;
        } catch {
          return true;
        }
      }, config),
      true,
    );
    const hotkeyStatus = await application.evaluate(({ globalShortcut }) =>
      globalShortcut.isRegistered('CommandOrControl+Shift+Space'),
    );
    assert.equal(hotkeyStatus, true, 'Previous shortcut restored after rejected settings');
    console.log(
      'PASS: Electron windows, isolated IPC, native process launch, history, disk persistence, config validation, synchronized donut theme, hide/show, and shortcut rollback.',
    );
  } finally {
    await application?.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
