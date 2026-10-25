const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Updates, newer, chooseRelease, expectedHash } = require('../electron/updates.cjs');
const asset = { id: 100, name: 'Orbit-Launcher-1.0.3-x64-Setup.exe' };
const checksum = { id: 101, name: 'SHA256SUMS.txt' };
const release = { tag_name: 'v1.0.3-preview', draft: false, assets: [asset, checksum] };
const secure = {
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'dpapi',
  encryptString: (s) => Buffer.from('encrypted:' + s),
  decryptString: (b) => b.toString().slice(10),
};
test('update versions compare numerically and select only complete matching packages', () => {
  assert.equal(newer('v1.0.10-preview', '1.0.9'), true);
  assert.equal(newer('v1.0.2-preview', '1.0.2'), false);
  assert.equal(newer('bad', '1.0.2'), false);
  assert.equal(chooseRelease([{ ...release, draft: true }], '1.0.2', false), null);
  assert.equal(chooseRelease([release], '1.0.2', true), null);
  assert.equal(chooseRelease([release], '1.0.2', false).asset.id, 100);
  assert.throws(() => expectedHash('not-a-hash  ' + asset.name, asset.name));
});
test('private repository errors are actionable and do not expose tokens', async () => {
  const u = new Updates({
    version: '1.0.2',
    fetcher: async () => new Response('', { status: 404 }),
  });
  u.token = 'sensitive-test';
  const status = await u.check();
  assert.equal(status.state, 'error');
  assert.match(status.message, /private repository/);
  assert.equal(JSON.stringify(status).includes('sensitive-test'), false);
});
test('saved update access is encrypted, reloadable, and removable', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'orbit-update-'));
  try {
    const u = new Updates({ directory, version: '1.0.2', secure });
    await u.saveToken('read-only-test');
    const encrypted = await fs.readFile(path.join(directory, 'update-access.bin'), 'utf8');
    assert.equal(encrypted, 'encrypted:read-only-test');
    assert.equal(JSON.stringify(u.status()).includes('read-only-test'), false);
    const reload = new Updates({ directory, version: '1.0.2', secure });
    await reload.initialize();
    assert.equal(reload.token, 'read-only-test');
    assert.equal(reload.status().tokenStored, true);
    await reload.saveToken('');
    assert.equal(reload.status().tokenStored, false);
    await assert.rejects(() => fs.stat(path.join(directory, 'update-access.bin')));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test('unavailable secure storage refuses to save update credentials', async () => {
  const u = new Updates({ secure: { isEncryptionAvailable: () => false } });
  await assert.rejects(() => u.saveToken('secret'), /encryption/);
});
for (const valid of [true, false])
  test(`update installer ${valid ? 'receives only checksum-verified executable' : 'never runs on checksum mismatch'}`, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'orbit-update-'));
    const bytes = Buffer.from('verified executable fixture');
    let installed = '';
    const checksumText =
      (valid ? createHash('sha256').update(bytes).digest('hex') : 'a'.repeat(64)) +
      '  ' +
      asset.name;
    const fetcher = async (url) =>
      url.endsWith('per_page=30')
        ? Response.json([release])
        : new Response(url.endsWith('/101') ? checksumText : bytes);
    try {
      const u = new Updates({
        directory,
        version: '1.0.2',
        portable: false,
        packaged: true,
        platform: 'win32',
        secure,
        fetcher,
        install: async (file) => {
          installed = await fs.readFile(file, 'utf8');
        },
      });
      assert.equal((await u.check()).state, 'available');
      const status = await u.install();
      assert.equal(status.state, valid ? 'ready' : 'error');
      assert.equal(installed, valid ? bytes.toString() : '');
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
test('turning automatic installation off prevents the installer even after download', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'orbit-auto-'));
  const bytes = Buffer.from('fixture');
  let calls = 0;
  try {
    const u = new Updates({
      directory,
      version: '1.0.2',
      portable: false,
      packaged: true,
      platform: 'win32',
      secure,
      canAutoInstall: () => false,
      fetcher: async (url) =>
        url.endsWith('per_page=30')
          ? Response.json([release])
          : new Response(
              url.endsWith('/101')
                ? createHash('sha256').update(bytes).digest('hex') + '  ' + asset.name
                : bytes,
            ),
      install: async () => {
        calls++;
      },
    });
    await u.check();
    assert.equal((await u.install(true)).state, 'available');
    assert.equal(calls, 0);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
