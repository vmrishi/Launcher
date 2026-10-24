'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateConfig } = require('./schema.cjs');
class Store {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'settings.json');
    this.value = null;
  }
  load() {
    if (!fs.existsSync(this.file)) return null;
    const size = fs.statSync(this.file).size;
    if (size > 5 * 1024 * 1024) throw new Error('Settings file exceeds 5 MB. Restore a backup.');
    this.value = validateConfig(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    return this.value;
  }
  save(value) {
    const clean = validateConfig(value);
    fs.mkdirSync(this.directory, { recursive: true });
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(clean, null, 2), { mode: 0o600 });
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, `${this.file}.bak`);
    fs.renameSync(temp, this.file);
    this.value = clean;
    return clean;
  }
}
module.exports = { Store };
