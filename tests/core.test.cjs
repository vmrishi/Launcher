const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Store } = require('../electron/store.cjs');
const { validateConfig } = require('../electron/schema.cjs');
const { launchSingle, launchEntry } = require('../electron/launcher.cjs');
function app(id = 'app1', target = 'C:\\Tools\\Editor.exe') {
  return {
    id,
    name: id,
    type: 'app',
    target,
    args: [],
    cwd: '',
    color: '#7f77dd',
    glyph: 'app',
    members: [],
    delay: 0,
    favorite: true,
    hotkey: '',
  };
}
function config() {
  return {
    version: 1,
    entries: [app()],
    profiles: [{ id: 'everyday', name: 'Everyday', description: '', entries: ['app1'] }],
    activeProfile: 'everyday',
    settings: {
      theme: 'light',
      style: 'soft',
      accent: '#7f77dd',
      radius: 16,
      opacity: 100,
      motion: true,
      display: 'both',
      donutSize: 400,
      perFace: 8,
      rotation: 0,
      hotkey: 'Control+Shift+Space',
      launchAtLogin: false,
      startMinimized: false,
      closeToTray: true,
      autoHide: true,
      showRecent: true,
    },
    history: [],
  };
}
test('settings persist atomically and keep a recoverable previous backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-store-'));
  try {
    const store = new Store(dir);
    assert.equal(store.load(), null);
    store.save(config());
    const next = config();
    next.settings.theme = 'dark';
    store.save(next);
    assert.equal(new Store(dir).load().settings.theme, 'dark');
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(dir, 'settings.json.bak'))).settings.theme,
      'light',
    );
    assert.equal(fs.existsSync(path.join(dir, 'settings.json.tmp')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('invalid settings never overwrite the saved file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-store-'));
  try {
    const store = new Store(dir);
    store.save(config());
    const invalid = config();
    invalid.settings.opacity = 0;
    assert.throws(() => store.save(invalid));
    assert.equal(new Store(dir).load().settings.opacity, 100);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('unknown import properties are stripped and stale profile references removed', () => {
  const c = config();
  c.untrusted = 'no';
  c.entries[0].shell = true;
  c.profiles[0].entries.push('missing');
  c.activeProfile = 'missing';
  const clean = validateConfig(c);
  assert.equal(clean.untrusted, undefined);
  assert.equal(clean.entries[0].shell, undefined);
  assert.deepEqual(clean.profiles[0].entries, ['app1']);
  assert.equal(clean.activeProfile, 'everyday');
});
test('imports reject executable URL schemes and external image references', () => {
  const c = config();
  c.entries[0].type = 'url';
  c.entries[0].target = 'javascript:alert(1)';
  assert.throws(() => validateConfig(c), /HTTP/);
  c.entries[0].target = 'https://example.com';
  c.entries[0].icon = 'https://tracking.invalid/icon.png';
  assert.throws(() => validateConfig(c), /embedded/);
});
test('duplicate IDs, duplicate shortcuts, invalid group members and nested groups are rejected', () => {
  let c = config();
  c.entries.push(app());
  assert.throws(() => validateConfig(c), /Duplicate/);
  c = config();
  c.entries[0].hotkey = 'Control+Shift+Space';
  assert.throws(() => validateConfig(c), /unique/);
  c = config();
  c.entries.push({ ...app('group'), type: 'group', members: ['missing'] });
  assert.throws(() => validateConfig(c), /Groups/);
  c.entries[1].members = ['group'];
  assert.throws(() => validateConfig(c), /Groups/);
});
test('launch arguments are passed literally with shell execution disabled', async () => {
  const calls = [];
  const a = app('app1', 'C:\\Tools\\Editor.exe');
  a.args = ['a b', '$(touch /tmp/no)', '& echo nope'];
  await launchSingle(a, {
    platform: 'win32',
    shell: {},
    stat: async () => ({ isFile: () => true }),
    spawnProcess: (target, args, options) => {
      calls.push({ target, args, options });
      const child = new EventEmitter();
      child.unref = () => {};
      process.nextTick(() => child.emit('spawn'));
      return child;
    },
  });
  assert.deepEqual(calls[0].args, a.args);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].target, a.target);
});
test('missing apps and command scripts report an actionable failure', async () => {
  await assert.rejects(
    () =>
      launchSingle(app(), {
        platform: 'win32',
        shell: {},
        stat: async () => {
          throw Error('ENOENT');
        },
      }),
    /not found/,
  );
  await assert.rejects(
    () =>
      launchSingle(app('batch', 'C:\\Tools\\command.bat'), {
        platform: 'win32',
        shell: {},
        stat: async () => ({ isFile: () => true }),
      }),
    /Windows/,
  );
});
test('groups launch in order, wait between members, and continue after a failure', async () => {
  const c = config();
  c.entries = [
    { ...app('first'), type: 'url', target: 'https://first.example' },
    { ...app('bad'), type: 'url', target: 'https://bad.example' },
    { ...app('last'), type: 'url', target: 'https://last.example' },
    { ...app('group'), type: 'group', members: ['first', 'bad', 'last'], delay: 500 },
  ];
  const calls = [];
  const result = await launchEntry('group', c, {
    shell: {
      openExternal: async (url) => {
        calls.push(url);
        if (url.includes('bad')) throw Error('Browser missing');
      },
    },
    sleep: async (n) => calls.push(n),
  });
  assert.equal(result.success, false);
  assert.match(result.message, /2 of 3/);
  assert.deepEqual(calls, [
    'https://first.example/',
    500,
    'https://bad.example/',
    500,
    'https://last.example/',
  ]);
  assert.equal(result.results[1].error, 'Browser missing');
});
test('folders and shortcuts use OS opening and propagate OS errors', async () => {
  const c = { ...app(), type: 'folder', target: '/tmp/folder' };
  await assert.rejects(
    () =>
      launchSingle(c, {
        stat: async () => ({ isDirectory: () => true }),
        shell: { openPath: async () => 'Access denied' },
      }),
    /Access denied/,
  );
  c.type = 'app';
  c.target = '/tmp/app.lnk';
  c.args = ['oops'];
  await assert.rejects(
    () => launchSingle(c, { stat: async () => ({ isFile: () => true }), shell: {} }),
    /own arguments/,
  );
});
test('the real process runner can start a process without interpreting arguments', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-run-'));
  try {
    const output = path.join(dir, 'result.txt');
    const a = {
      ...app('node', process.execPath),
      args: [
        '-e',
        'require("node:fs").writeFileSync(process.argv[1], process.argv[2])',
        output,
        'literal & $(text)',
      ],
    };
    await launchSingle(a, { shell: {} });
    for (let attempt = 0; attempt < 50 && !fs.existsSync(output); attempt++)
      await new Promise((r) => setTimeout(r, 20));
    assert.equal(fs.readFileSync(output, 'utf8'), 'literal & $(text)');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
module.exports = { config, app };

test('shortcut aliases and spaced combinations normalize to valid accelerators', () => {
  const { normalizeShortcut } = require('../electron/shortcuts.cjs');
  assert.equal(normalizeShortcut('ctrl + shift + space'), 'Control+Shift+Space');
  assert.equal(normalizeShortcut('Win + a'), 'Super+A');
  for (const invalid of ['Ctrl', 'Shift+Alt', 'Ctrl++A', 'Ctrl+Nonsense', 'A'])
    assert.throws(() => normalizeShortcut(invalid));
});
test('shortcut changes are transactional and unrelated settings never unregister active keys', () => {
  const { ShortcutManager } = require('../electron/shortcuts.cjs');
  const handlers = new Map();
  let registrations = 0;
  let fired;
  const api = {
    register: (key, fn) => {
      registrations++;
      if (key === 'Alt+F2') return false;
      handlers.set(key, fn);
      return true;
    },
    unregister: (key) => handlers.delete(key),
  };
  const manager = new ShortcutManager(api, (target) => (fired = target));
  manager.configure([['Ctrl + Shift + Space', 'donut']]);
  handlers.get('Control+Shift+Space')();
  assert.equal(fired, 'donut');
  manager.configure([['Control+Shift+Space', 'donut']]);
  assert.equal(registrations, 1);
  assert.throws(() =>
    manager.configure([
      ['Alt+F1', 'app'],
      ['Alt+F2', 'donut'],
    ]),
  );
  assert.equal(handlers.has('Control+Shift+Space'), true);
  assert.equal(handlers.has('Alt+F1'), false);
  manager.configure([['Alt+F1', 'donut']]);
  handlers.get('Alt+F1')();
  assert.equal(fired, 'donut');
  assert.equal(handlers.has('Control+Shift+Space'), false);
});
test('old settings migrate font and slice options without losing user customizations', () => {
  const c = config();
  const migrated = validateConfig(c);
  assert.equal(migrated.settings.uiFontScale, 118);
  assert.equal(migrated.settings.donutFontSize, 16);
  assert.equal(migrated.settings.sliceRadius, 0);
  assert.equal(migrated.entries[0].id, c.entries[0].id);
  c.settings.donutFontSize = 25;
  assert.throws(() => validateConfig(c));
});

test('platform shortcut aliases retain the same OS registration', () => {
  const { ShortcutManager } = require('../electron/shortcuts.cjs');
  let registrations = 0,
    removals = 0;
  const manager = new ShortcutManager(
    {
      register: () => {
        registrations++;
        return true;
      },
      unregister: () => removals++,
    },
    () => {},
  );
  manager.configure([['CommandOrControl+Shift+Space', 'donut']]);
  manager.configure([
    [process.platform === 'darwin' ? 'Command+Shift+Space' : 'Ctrl+Shift+Space', 'donut'],
  ]);
  assert.equal(registrations, 1);
  assert.equal(removals, 0);
});
