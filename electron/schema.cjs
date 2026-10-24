'use strict';
const HEX = /^#[0-9a-f]{6}$/i;
function fail(message) {
  throw new Error(message);
}
function string(value, label, max = 1000) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0'))
    fail(`Invalid ${label}.`);
  return value;
}
function id(value) {
  const result = string(value, 'identifier', 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) fail('Invalid identifier.');
  return result;
}
function bool(value) {
  if (typeof value !== 'boolean') fail('Invalid toggle.');
  return value;
}
function number(value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max)
    fail(`Value must be between ${min} and ${max}.`);
  return value;
}
function choice(value, values) {
  if (!values.includes(value)) fail('Invalid option.');
  return value;
}
function list(value, max) {
  if (!Array.isArray(value) || value.length > max)
    fail(`Expected a list with at most ${max} items.`);
  return value;
}
function hotkey(value) {
  const key = string(value, 'shortcut', 80);
  if (
    key &&
    (!/^[A-Za-z0-9+]+$/.test(key) || !/(Control|Ctrl|Alt|Shift|Command|Super|Meta)/i.test(key))
  )
    fail('Use a shortcut with a modifier, such as Control+Shift+Space.');
  return key;
}
function canonicalShortcut(key) {
  return key
    .toLowerCase()
    .replaceAll('commandorcontrol', 'control')
    .replaceAll('cmdorctrl', 'control')
    .replaceAll('ctrl', 'control')
    .replaceAll('cmd', 'command')
    .split('+')
    .sort()
    .join('+');
}
function validateConfig(value) {
  if (!value || value.version !== 1)
    fail('This is not a supported Orbit settings file (version 1).');
  const entries = list(value.entries, 500).map((a) => {
    const type = choice(a.type, ['app', 'url', 'folder', 'group']);
    const name = string(a.name, 'application name', 100).trim();
    if (!name) fail('Application names cannot be empty.');
    const target = string(a.target, 'target', 4096).trim();
    if (type !== 'group' && !target) fail(`${name} needs a target.`);
    if (type === 'url') {
      let url;
      try {
        url = new URL(target);
      } catch {
        fail(`Invalid URL for ${name}.`);
      }
      if (!['https:', 'http:'].includes(url.protocol))
        fail('Only HTTP and HTTPS links are supported.');
    }
    const icon = a.icon ? string(a.icon, 'icon', 500000) : undefined;
    if (icon && !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(icon))
      fail('Icons must be embedded PNG, JPEG or WebP images.');
    return {
      id: id(a.id),
      name,
      type,
      target,
      args: list(a.args, 100).map((x) => string(x, 'argument', 4096)),
      cwd: string(a.cwd, 'working directory', 4096),
      color: HEX.test(a.color) ? a.color : '#7f77dd',
      glyph: choice(a.glyph, [
        'app',
        'folder',
        'calculator',
        'file',
        'github',
        'figma',
        'play',
        'settings',
        'globe',
        'code',
        'music',
        'mail',
        'terminal',
        'layers',
        'image',
        'game',
        'coffee',
        'monitor',
      ]),
      ...(icon ? { icon } : {}),
      members: [...new Set(list(a.members, 100).map(id))],
      delay: number(a.delay, 0, 10000),
      favorite: bool(a.favorite),
      hotkey: hotkey(a.hotkey),
    };
  });
  const ids = new Set(entries.map((a) => a.id));
  if (ids.size !== entries.length) fail('Duplicate application identifiers.');
  for (const a of entries)
    if (a.type === 'group') {
      if (!a.members.length) fail(`${a.name} needs at least one application.`);
      for (const member of a.members)
        if (!ids.has(member) || entries.find((x) => x.id === member).type === 'group')
          fail('Groups can contain applications, folders and links, but not other groups.');
    }
  const profiles = list(value.profiles, 60).map((p) => ({
    id: id(p.id),
    name: string(p.name, 'profile name', 80).trim(),
    description: string(p.description, 'profile description', 300),
    entries: [...new Set(list(p.entries, 24).map(id))].filter((x) => ids.has(x)),
  }));
  if (
    !profiles.length ||
    profiles.some((p) => !p.name) ||
    new Set(profiles.map((p) => p.id)).size !== profiles.length
  )
    fail('At least one uniquely identified, named profile is required.');
  const s = value.settings;
  if (!s) fail('Missing settings.');
  const settings = {
    theme: choice(s.theme, ['system', 'light', 'dark']),
    style: choice(s.style, ['soft', 'material']),
    accent: HEX.test(s.accent) ? s.accent : fail('Invalid accent color.'),
    radius: number(s.radius, 0, 28),
    opacity: number(s.opacity, 30, 100),
    motion: bool(s.motion),
    display: choice(s.display, ['both', 'icon', 'name']),
    donutSize: number(s.donutSize, 280, 600),
    perFace: choice(s.perFace, [4, 6, 8, 10, 12]),
    rotation: number(s.rotation, 0, 360),
    hotkey: hotkey(s.hotkey),
    launchAtLogin: bool(s.launchAtLogin),
    startMinimized: bool(s.startMinimized),
    closeToTray: bool(s.closeToTray),
    autoHide: bool(s.autoHide),
    showRecent: bool(s.showRecent),
  };
  const keys = [settings.hotkey, ...entries.map((a) => a.hotkey)]
    .filter(Boolean)
    .map(canonicalShortcut);
  if (new Set(keys).size !== keys.length) fail('Each global shortcut must be unique.');
  const history = list(value.history ?? [], 100).map((h) => ({
    id: id(h.id),
    entryId: id(h.entryId),
    name: string(h.name, 'history name', 100),
    time: number(h.time, 0, Number.MAX_SAFE_INTEGER),
    success: bool(h.success),
    detail: string(h.detail, 'launch result', 1000),
  }));
  return {
    version: 1,
    entries,
    profiles,
    activeProfile: profiles.some((p) => p.id === value.activeProfile)
      ? value.activeProfile
      : profiles[0].id,
    settings,
    history,
  };
}
module.exports = { validateConfig };
