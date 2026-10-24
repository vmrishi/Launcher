'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function launchSingle(
  entry,
  { shell, spawnProcess = spawn, stat = fs.stat, platform = process.platform },
) {
  if (entry.type === 'url') {
    const url = new URL(entry.target);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported URL protocol.');
    await shell.openExternal(url.href);
    return;
  }
  if (
    !path.isAbsolute(entry.target) &&
    !(platform === 'win32' && path.win32.isAbsolute(entry.target))
  )
    throw new Error('Choose an absolute path using Browse.');
  let info;
  try {
    info = await stat(entry.target);
  } catch {
    throw new Error(
      'Target was not found. Edit this application and choose its installed location.',
    );
  }
  if (entry.type === 'folder') {
    if (!info.isDirectory()) throw new Error('The selected target is not a folder.');
    const error = await shell.openPath(entry.target);
    if (error) throw new Error(error);
    return;
  }
  if (!info.isFile()) throw new Error('The selected target is not an application.');
  const ext = path.extname(entry.target).toLowerCase();
  if (platform === 'win32' && !['.exe', '.com', '.lnk', '.url'].includes(ext))
    throw new Error('Choose a Windows .exe, .com, .lnk or .url application.');
  if (['.lnk', '.url'].includes(ext)) {
    if (entry.args.length || entry.cwd)
      throw new Error(
        'Shortcut files use their own arguments and working directory. Edit the original shortcut instead.',
      );
    const error = await shell.openPath(entry.target);
    if (error) throw new Error(error);
    return;
  }
  if (entry.cwd) {
    const cwd = await stat(entry.cwd);
    if (!cwd.isDirectory()) throw new Error('The working directory is not a folder.');
  }
  await new Promise((resolve, reject) => {
    const child = spawnProcess(entry.target, entry.args, {
      cwd: entry.cwd || undefined,
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
async function launchEntry(id, config, deps) {
  const entry = config.entries.find((a) => a.id === id);
  if (!entry) throw new Error('This application no longer exists.');
  const entries =
    entry.type === 'group'
      ? entry.members.map((member) => config.entries.find((a) => a.id === member))
      : [entry];
  if (!entries.length) throw new Error('Add applications to this group first.');
  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];
    try {
      if (!item || item.type === 'group') throw new Error('Missing or invalid group member.');
      await launchSingle(item, deps);
      results.push({ name: item.name, success: true });
    } catch (error) {
      results.push({ name: item?.name ?? 'Missing app', success: false, error: error.message });
    }
    if (i < entries.length - 1 && entry.delay) await (deps.sleep ?? delay)(entry.delay);
  }
  const succeeded = results.filter((r) => r.success).length;
  return {
    success: succeeded === results.length,
    message:
      entry.type === 'group'
        ? `${succeeded} of ${results.length} applications launched.`
        : results[0].success
          ? `${entry.name} launched.`
          : results[0].error,
    results,
  };
}
module.exports = { launchSingle, launchEntry };
