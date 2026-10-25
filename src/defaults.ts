import type { Config, Entry, EntryType } from './types';
export const uid = () => crypto.randomUUID();
export function entry(name: string, type: EntryType = 'app', target = ''): Entry {
  return {
    id: uid(),
    name,
    type,
    target,
    args: [],
    cwd: '',
    color: '#7f77dd',
    glyph:
      type === 'group' ? 'layers' : type === 'url' ? 'globe' : type === 'folder' ? 'folder' : 'app',
    members: [],
    delay: 500,
    favorite: true,
    hotkey: '',
  };
}
export function defaults(): Config {
  const entries: Entry[] = [
    {
      ...entry('File Explorer', 'app', 'C:\\Windows\\explorer.exe'),
      glyph: 'folder',
      color: '#e5ad48',
    },
    {
      ...entry('Calculator', 'app', 'C:\\Windows\\System32\\calc.exe'),
      glyph: 'calculator',
      color: '#66b89d',
    },
    {
      ...entry('Notepad', 'app', 'C:\\Windows\\System32\\notepad.exe'),
      glyph: 'file',
      color: '#6c9bd5',
    },
    { ...entry('GitHub', 'url', 'https://github.com'), glyph: 'github', color: '#777684' },
    { ...entry('Figma', 'url', 'https://www.figma.com'), glyph: 'figma', color: '#da8eac' },
    { ...entry('YouTube', 'url', 'https://www.youtube.com'), glyph: 'play', color: '#dd727b' },
    { ...entry('Google', 'url', 'https://www.google.com'), glyph: 'globe', color: '#7cabe1' },
    {
      ...entry('Settings', 'app', 'C:\\Windows\\System32\\control.exe'),
      glyph: 'settings',
      color: '#a39ab8',
    },
  ];
  return {
    version: 1,
    entries,
    profiles: [
      {
        id: uid(),
        name: 'Everyday',
        description: 'Your daily essentials, one gesture away.',
        entries: entries.map((a) => a.id),
      },
      {
        id: uid(),
        name: 'Work',
        description: 'A little more focus. A lot less switching.',
        entries: [entries[0].id, entries[2].id, entries[3].id, entries[4].id],
      },
    ],
    activeProfile: '',
    settings: {
      theme: 'light',
      style: 'soft',
      accent: '#7f77dd',
      radius: 16,
      uiFontScale: 118,
      donutFontSize: 16,
      sliceRadius: 0,
      opacity: 100,
      motion: true,
      display: 'both',
      donutSize: 400,
      perFace: 8,
      rotation: 0,
      hotkey: 'CommandOrControl+Shift+Space',
      launchAtLogin: false,
      startMinimized: false,
      closeToTray: true,
      autoHide: true,
      showRecent: true,
      showProfileSelector: true,
      autoCheckUpdates: true,
      autoInstallUpdates: false,
    },
    history: [],
  };
}
