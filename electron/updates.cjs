'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');
const REPOSITORY = 'vmrishi/Launcher';
function versionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?$/.exec(value);
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}
function newer(candidate, current) {
  const a = versionParts(candidate),
    b = versionParts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
function chooseRelease(releases, current, portable) {
  const candidates = releases
    .filter((r) => !r.draft && newer(r.tag_name, current))
    .sort((a, b) => {
      const x = versionParts(a.tag_name),
        y = versionParts(b.tag_name);
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
    });
  for (const r of candidates) {
    const kind = portable ? 'Portable' : 'Setup';
    const asset = r.assets?.find((a) =>
      new RegExp(`^Orbit-Launcher-\\d+\\.\\d+\\.\\d+-x64-${kind}\\.exe$`).test(a.name),
    );
    const checksums = r.assets?.find((a) => a.name === 'SHA256SUMS.txt');
    if (asset && checksums) return { version: r.tag_name, asset, checksums };
  }
  return null;
}
function expectedHash(text, name) {
  const line = text
    .split(/\r?\n/)
    .find((x) => x.trim().split(/\s+/).slice(1).join(' ').replace(/^\*/, '') === name);
  const hash = line?.trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/i.test(hash ?? '')) throw Error('The update has no valid SHA-256 checksum.');
  return hash.toLowerCase();
}
class Updates {
  constructor({
    directory,
    version,
    portable,
    packaged,
    platform,
    secure,
    fetcher = fetch,
    install,
    canAutoInstall = () => true,
  }) {
    Object.assign(this, {
      directory,
      version,
      portable,
      packaged,
      platform,
      secure,
      fetcher,
      canAutoInstall,
      installer: install,
    });
    this.token = '';
    this.pending = null;
    this.busy = null;
    this.state = {
      state: 'idle',
      message: 'Check GitHub Releases for updates.',
      tokenStored: false,
      currentVersion: version,
    };
  }
  status() {
    return { ...this.state };
  }
  set(state, message, extra = {}) {
    this.state = { ...this.state, state, message, ...extra };
    return this.status();
  }
  async initialize() {
    try {
      const encrypted = await fs.readFile(path.join(this.directory, 'update-access.bin'));
      if (
        this.secure.isEncryptionAvailable() &&
        this.secure.getSelectedStorageBackend?.() !== 'basic_text'
      ) {
        this.token = this.secure.decryptString(encrypted);
        this.state.tokenStored = true;
      }
    } catch (error) {
      if (error.code !== 'ENOENT')
        this.set('error', 'Could not unlock saved GitHub access. Save it again in About.');
    }
  }
  async saveToken(token) {
    if (typeof token !== 'string' || token.length > 4096 || /[\r\n]/.test(token))
      throw Error('Invalid GitHub token.');
    if (!token.trim()) {
      await fs.rm(path.join(this.directory, 'update-access.bin'), { force: true });
      this.token = '';
      this.state.tokenStored = false;
      return this.set('idle', 'GitHub access removed.');
    }
    if (
      !this.secure.isEncryptionAvailable() ||
      this.secure.getSelectedStorageBackend?.() === 'basic_text'
    )
      throw Error('Secure system encryption is unavailable. The token was not saved.');
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(
      path.join(this.directory, 'update-access.bin'),
      this.secure.encryptString(token.trim()),
      { mode: 0o600 },
    );
    this.token = token.trim();
    this.state.tokenStored = true;
    return this.set('idle', 'GitHub access saved using system encryption.');
  }
  async request(endpoint, binary = false) {
    const response = await this.fetcher(`https://api.github.com/repos/${REPOSITORY}/${endpoint}`, {
      headers: {
        Accept: binary ? 'application/octet-stream' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Orbit-Launcher',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      signal: AbortSignal.timeout(binary ? 300000 : 30000),
    });
    if (!response.ok) {
      if ([401, 403, 404].includes(response.status))
        throw Error(
          'GitHub access is required for this private repository, or its API limit was reached. Save a token with read-only Contents access to vmrishi/Launcher below.',
        );
      throw Error(`GitHub update request failed (${response.status}).`);
    }
    return response;
  }
  async check() {
    if (this.busy) return this.busy;
    this.busy = this.performCheck().finally(() => {
      this.busy = null;
    });
    return this.busy;
  }
  async performCheck() {
    this.set('checking', 'Checking GitHub Releases…');
    try {
      const data = await (await this.request('releases?per_page=30')).json();
      if (!Array.isArray(data)) throw Error('Invalid release information.');
      this.pending = chooseRelease(data, this.version, this.portable);
      if (!this.pending) return this.set('current', 'You are using the latest available version.');
      return this.set('available', `Version ${this.pending.version} is available.`, {
        version: this.pending.version,
      });
    } catch (error) {
      return this.set('error', error.message);
    }
  }
  async install(automatic = false) {
    if (this.busy) return this.busy;
    this.busy = this.performInstall(automatic).finally(() => {
      this.busy = null;
    });
    return this.busy;
  }
  async performInstall(automatic) {
    try {
      if (!this.packaged || this.platform !== 'win32')
        throw Error('Update installation is available in the packaged Windows app.');
      if (!this.pending) throw Error('Check for updates before installing.');
      this.set('downloading', 'Downloading and verifying the update…');
      const manifest = await this.request(
        `releases/assets/${Number(this.pending.checksums.id)}`,
        true,
      );
      const text = await manifest.text();
      if (text.length > 65536) throw Error('The checksum file is too large.');
      const expected = expectedHash(text, this.pending.asset.name);
      const response = await this.request(`releases/assets/${Number(this.pending.asset.id)}`, true);
      await fs.mkdir(this.directory, { recursive: true });
      const file = path.join(this.directory, 'pending-update.exe'),
        temporary = file + '.partial';
      let bytes = 0;
      const hash = createHash('sha256');
      try {
        await pipeline(
          Readable.fromWeb(response.body),
          async function* (source) {
            for await (const chunk of source) {
              bytes += chunk.length;
              if (bytes > 300 * 1024 * 1024)
                throw Error('Update exceeds the supported download size.');
              hash.update(chunk);
              yield chunk;
            }
          },
          createWriteStream(temporary, { mode: 0o600 }),
        );
        if (!bytes || hash.digest('hex') !== expected)
          throw Error('Update checksum verification failed. Nothing was installed.');
        await fs.rename(temporary, file);
      } catch (error) {
        await fs.rm(temporary, { force: true });
        throw error;
      }
      if (automatic && !this.canAutoInstall())
        return this.set(
          'available',
          'Automatic installation was disabled. The update was not installed.',
        );
      this.set('ready', 'Verified update ready. Orbit will restart to install it.');
      await this.installer(file);
      return this.status();
    } catch (error) {
      return this.set('error', error.message);
    }
  }
}
module.exports = { Updates, newer, chooseRelease, expectedHash };
