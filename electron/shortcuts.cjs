'use strict';
function normalizeShortcut(value) {
  if (typeof value !== 'string' || value.length > 80) throw Error('Invalid shortcut.');
  if (!value.trim()) return '';
  const aliases = {
    ctrl: 'Control',
    control: 'Control',
    alt: 'Alt',
    shift: 'Shift',
    win: 'Super',
    windows: 'Super',
    meta: 'Super',
    super: 'Super',
    cmd: 'Command',
    command: 'Command',
    commandorcontrol: 'CommandOrControl',
    cmdorctrl: 'CommandOrControl',
    space: 'Space',
    spacebar: 'Space',
    esc: 'Escape',
    escape: 'Escape',
    enter: 'Enter',
    return: 'Enter',
    tab: 'Tab',
    backspace: 'Backspace',
    delete: 'Delete',
    insert: 'Insert',
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    up: 'Up',
    down: 'Down',
    left: 'Left',
    right: 'Right',
    plus: 'Plus',
    minus: 'Minus',
  };
  const tokens = value.split('+').map((x) => x.trim());
  const parts = tokens.map(
    (x) =>
      aliases[x.toLowerCase()] ||
      (/^[a-z0-9]$/i.test(x)
        ? x.toUpperCase()
        : /^f([1-9]|1\d|2[0-4])$/i.test(x)
          ? x.toUpperCase()
          : ''),
  );
  const modifiers = ['Control', 'Alt', 'Shift', 'Super', 'Command', 'CommandOrControl'];
  const keys = parts.filter((x) => !modifiers.includes(x));
  if (
    parts.some((x) => !x) ||
    keys.length !== 1 ||
    parts.length < 2 ||
    new Set(parts).size !== parts.length
  )
    throw Error('Press a modifier and one key, for example Ctrl + Shift + Space.');
  return [...parts.filter((x) => modifiers.includes(x)).sort(), keys[0]].join('+');
}
class ShortcutManager {
  constructor(api, dispatch) {
    this.api = api;
    this.dispatch = dispatch;
    this.bindings = new Map();
  }
  configure(bindings) {
    const next = new Map(
      bindings.map(([key, target]) => [normalizeShortcut(key), target]).filter(([key]) => key),
    );
    const added = [];
    try {
      for (const [key] of next)
        if (!this.bindings.has(key)) {
          if (!this.api.register(key, () => this.dispatch(this.bindings.get(key))))
            throw Error(`Shortcut ${key} is already in use. Choose another shortcut.`);
          added.push(key);
        }
    } catch (error) {
      for (const key of added) this.api.unregister(key);
      throw error;
    }
    for (const [key] of this.bindings) if (!next.has(key)) this.api.unregister(key);
    this.bindings = next;
  }
}
module.exports = { normalizeShortcut, ShortcutManager };
