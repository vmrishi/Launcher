import { useEffect, useRef, useState } from 'react';
import {
  Home,
  Settings,
  Keyboard,
  Disc3,
  Layers,
  Palette,
  AppWindow,
  Info,
  Plus,
  ArrowUpRight,
  Search,
  Play,
  Clock,
  Star,
  MoreHorizontal,
  Check,
  ChevronRight,
  Upload,
  FolderOpen,
  GripVertical,
  Trash2,
  Pencil,
  Copy,
  Download,
  Monitor,
  Sun,
  Moon,
  RotateCcw,
  Minus,
  Square,
  X,
  Orbit,
  Command,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  LoaderCircle,
  MousePointer2,
  ArrowRight,
  LayoutGrid,
} from 'lucide-react';
import type { Config, Entry, Profile, Settings as Preferences, Discovery } from './types';
import { desktop, load, save } from './bridge';
import { entry, uid } from './defaults';
import { EntryIcon } from './components/Icon';
import Donut from './components/Donut';
import EntryEditor from './components/EntryEditor';
import { Modal, Toggle, Range } from './components/Controls';
const pages = [
  { id: 'home', name: 'Home', icon: Home },
  { id: 'general', name: 'General', icon: Settings },
  { id: 'shortcuts', name: 'Shortcuts', icon: Keyboard },
  { id: 'donut', name: 'Donut toolbar', icon: Disc3 },
  { id: 'presets', name: 'Presets', icon: Layers },
  { id: 'applications', name: 'Applications', icon: AppWindow },
  { id: 'theme', name: 'Theme', icon: Palette },
  { id: 'about', name: 'About', icon: Info },
];
const captions: Record<string, string> = {
  home: 'Your favorite apps. One little orbit.',
  general: 'A launcher that fits into your day.',
  shortcuts: 'Less reaching. More doing.',
  donut: 'A place for everything you reach for.',
  presets: 'Your whole workspace, in a single click.',
  applications: 'All your favorites, beautifully organized.',
  theme: 'A little more you.',
  about: 'A familiar idea. A whole new purpose.',
};
const accents = [
  ['Lavender', '#7f77dd'],
  ['Ocean', '#538cc6'],
  ['Sage', '#4a967c'],
  ['Rose', '#c87393'],
  ['Tangerine', '#c78349'],
  ['Slate', '#7b8499'],
  ['Coral', '#ce6e69'],
  ['Grape', '#a578c8'],
];
type Mutator = (config: Config) => Config;
export default function App() {
  const [config, setConfig] = useState<Config | null>(null),
    [fatal, setFatal] = useState(''),
    [page, setPage] = useState('home'),
    [editor, setEditor] = useState<Entry | null>(null),
    [toast, setToast] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [preview, setPreview] = useState(false),
    [dropOver, setDropOver] = useState(false),
    [profileEditor, setProfileEditor] = useState<Profile | null>(null),
    [confirm, setConfirm] = useState<{ title: string; message: string; action: () => void } | null>(
      null,
    ),
    [discovered, setDiscovered] = useState<Discovery[] | null>(null),
    [scanSearch, setScanSearch] = useState(''),
    [scanSelected, setScanSelected] = useState<Set<string>>(new Set()),
    [scanning, setScanning] = useState(false),
    [launching, setLaunching] = useState<string | null>(null),
    [saving, setSaving] = useState(0);
  const ref = useRef<Config | null>(null),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const radial = new URLSearchParams(location.search).has('donut');
  const notify = (message: string) => {
    setToast(message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5500);
  };
  const apply = (value: Config) => {
    ref.current = value;
    setConfig(value);
  };
  useEffect(() => {
    let cancelled = false;
    load()
      .then((c) => {
        if (!cancelled) apply(c);
      })
      .catch((e) => {
        if (!cancelled) setFatal(e.message);
      });
    const unsub = window.launcher?.onConfig(apply);
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);
  useEffect(() => {
    const off = window.launcher?.onDonut(() => setToast(''));
    return () => off?.();
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const persist = (fn: Mutator): Promise<Config> => {
    setSaving((v) => v + 1);
    const next = queue.current
      .catch(() => {})
      .then(async () => {
        if (!ref.current) throw new Error('Settings are not loaded yet.');
        const result = await save(fn(structuredClone(ref.current)));
        apply(result);
        return result;
      });
    queue.current = next;
    return next.finally(() => setSaving((v) => v - 1));
  };
  const update = (fn: Mutator) => {
    void persist(fn).catch((e) => notify(e.message));
  };
  const setting = (patch: Partial<Preferences>) =>
    update((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  useEffect(() => {
    if (!config) return;
    const s = config.settings;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    function theme() {
      document.documentElement.dataset.theme =
        s.theme === 'system' ? (mq.matches ? 'dark' : 'light') : s.theme;
    }
    theme();
    mq.addEventListener('change', theme);
    document.documentElement.dataset.style = s.style;
    document.documentElement.style.setProperty('--accent', s.accent);
    document.documentElement.style.setProperty('--radius', `${s.radius}px`);
    document.documentElement.dataset.motion = s.motion ? 'on' : 'off';
    document.body.classList.toggle('radial-body', radial);
    return () => mq.removeEventListener('change', theme);
  }, [config?.settings, radial]);
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null);
        else if (discovered) setDiscovered(null);
        else if (profileEditor) setProfileEditor(null);
        else if (editor) setEditor(null);
        else if (preview) setPreview(false);
        else if (radial) void window.launcher?.hideDonut();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !radial) {
        e.preventDefault();
        setPage('applications');
        setTimeout(() => document.querySelector<HTMLInputElement>('#app-search')?.focus(), 50);
      }
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [editor, profileEditor, confirm, discovered, preview, radial]);
  if (fatal)
    return (
      <div className="loading">
        <AlertCircle size={36} />
        <h2>Couldn’t read your settings</h2>
        <p>{fatal}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!config)
    return (
      <div className="loading">
        <Orbit className="spin" size={36} />
        <p>Finding your orbit…</p>
      </div>
    );
  const profile = config.profiles.find((p) => p.id === config.activeProfile) ?? config.profiles[0];
  const apps = config.entries.filter((a) => a.type !== 'group'),
    groups = config.entries.filter((a) => a.type === 'group');
  const activateProfile = (id: string) => update((c) => ({ ...c, activeProfile: id }));
  function addNew(type: 'app' | 'group' = 'app') {
    setEditor(entry(type === 'group' ? 'New launch group' : 'New application', type));
  }
  async function launch(id: string) {
    if (!window.launcher) {
      notify('Desktop preview: install or run Orbit on Windows to launch applications.');
      return;
    }
    setLaunching(id);
    try {
      const result = await window.launcher.launch(id);
      notify(
        result.message +
          (result.success
            ? ''
            : (result.results
                ?.filter((r) => !r.success)
                .map((r) => ` ${r.name}: ${r.error}`)
                .join('') ?? '')),
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLaunching(null);
    }
  }
  async function showDonut() {
    if (window.launcher) await window.launcher.showDonut();
    else setPreview(true);
  }
  async function saveEntry(value: Entry) {
    await persist((c) => {
      const existing = c.entries.some((a) => a.id === value.id);
      const entries = existing
        ? c.entries.map((a) => (a.id === value.id ? value : a))
        : [...c.entries, value];
      const profiles = existing
        ? c.profiles
        : c.profiles.map((p) =>
            p.id === c.activeProfile && p.entries.length < 24
              ? { ...p, entries: [...p.entries, value.id] }
              : p,
          );
      return { ...c, entries, profiles };
    });
    notify('Saved to your orbit.');
  }
  function deleteEntry(value: Entry) {
    setConfirm({
      title: `Delete ${value.name}?`,
      message:
        'This removes it from your library and donut profiles. Any launch group left with no apps will also be removed. Your installed software stays on your computer.',
      action: () => {
        update((c) => {
          const remove = new Set([
            value.id,
            ...c.entries
              .filter(
                (a) => a.type === 'group' && a.members.length === 1 && a.members[0] === value.id,
              )
              .map((a) => a.id),
          ]);
          return {
            ...c,
            entries: c.entries
              .filter((a) => !remove.has(a.id))
              .map((a) => ({ ...a, members: a.members.filter((id) => !remove.has(id)) })),
            profiles: c.profiles.map((p) => ({
              ...p,
              entries: p.entries.filter((id) => !remove.has(id)),
            })),
          };
        });
        setEditor(null);
        setConfirm(null);
      },
    });
  }
  function arrange(id: string, index?: number) {
    update((c) => ({
      ...c,
      profiles: c.profiles.map((p) => {
        if (p.id !== c.activeProfile) return p;
        if (!c.entries.some((a) => a.id === id)) return p;
        const ids = p.entries.filter((a) => a !== id);
        if (ids.length >= 24)
          throw new Error('This profile is full (24 apps). Create another profile.');
        ids.splice(Math.min(index ?? ids.length, ids.length), 0, id);
        return { ...p, entries: ids };
      }),
    }));
  }
  function removeFromDonut(id: string) {
    update((c) => ({
      ...c,
      profiles: c.profiles.map((p) =>
        p.id === c.activeProfile ? { ...p, entries: p.entries.filter((a) => a !== id) } : p,
      ),
    }));
  }
  async function addDiscoveries(found: Discovery[]) {
    if (!found.length) return;
    await persist((c) => {
      const added: Entry[] = [];
      const ids: string[] = [];
      for (const item of found) {
        let a =
          c.entries.find(
            (a) => a.type !== 'group' && a.target.toLowerCase() === item.target.toLowerCase(),
          ) ?? added.find((a) => a.target.toLowerCase() === item.target.toLowerCase());
        if (!a) {
          a = { ...entry(item.name, item.type ?? 'app', item.target), icon: item.icon };
          added.push(a);
        }
        ids.push(a.id);
      }
      if (c.entries.length + added.length > 500)
        throw new Error('The library supports up to 500 applications.');
      return {
        ...c,
        entries: [...c.entries, ...added],
        profiles: c.profiles.map((p) =>
          p.id === c.activeProfile
            ? { ...p, entries: [...new Set([...p.entries, ...ids])].slice(0, 24) }
            : p,
        ),
      };
    });
    notify(
      `${found.length} item${found.length === 1 ? '' : 's'} added. Profiles show up to 24 items; the full library is in Applications.`,
    );
  }
  async function dropFiles(e: React.DragEvent) {
    e.preventDefault();
    setDropOver(false);
    const internal = e.dataTransfer.getData('application/orbit-entry');
    if (internal) {
      arrange(internal);
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    if (!window.launcher) {
      notify(
        'Drag desktop applications in the installed app. Use Add application to try the editor here.',
      );
      return;
    }
    try {
      const paths = files.map((f) => window.launcher!.filePath(f)).filter(Boolean);
      if (paths.length) await addDiscoveries(await window.launcher.describe(paths));
      else {
        const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (/^https?:\/\//.test(url.trim()))
          setEditor(entry(new URL(url.trim()).hostname, 'url', url.trim()));
        else notify('Drop .exe files, shortcuts, folders, or a website link.');
      }
    } catch (error) {
      notify((error as Error).message);
    }
  }
  async function scan() {
    if (!window.launcher) {
      notify('Start Menu discovery is available in the Windows desktop app.');
      return;
    }
    setScanning(true);
    try {
      setDiscovered(await window.launcher.scan());
      setScanSelected(new Set());
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setScanning(false);
    }
  }
  function drag(e: React.DragEvent, id: string, source = 'library') {
    e.dataTransfer.setData('application/orbit-entry', id);
    e.dataTransfer.setData('application/orbit-source', source);
    e.dataTransfer.effectAllowed = 'copyMove';
  }
  function profileActions(kind: 'duplicate' | 'delete') {
    if (kind === 'duplicate') {
      update((c) => {
        if (c.profiles.length >= 60) throw new Error('You can create up to 60 profiles.');
        const p = { ...profile, id: uid(), name: `${profile.name.slice(0, 70)} copy` };
        return { ...c, profiles: [...c.profiles, p], activeProfile: p.id };
      });
      notify('Profile duplicated.');
    } else if (config!.profiles.length > 1)
      setConfirm({
        title: `Delete ${profile.name}?`,
        message: 'This deletes the profile layout. The applications in your library will be kept.',
        action: () => {
          update((c) => ({
            ...c,
            profiles: c.profiles.filter((p) => p.id !== profile.id),
            activeProfile: c.profiles.find((p) => p.id !== profile.id)!.id,
          }));
          setConfirm(null);
        },
      });
  }
  async function exportSettings() {
    if (window.launcher) {
      try {
        if (await window.launcher.exportConfig()) notify('Settings exported.');
      } catch (e) {
        notify((e as Error).message);
      }
      return;
    }
    const blob = new Blob([JSON.stringify({ ...config, history: [] }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orbit-settings.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Settings exported.');
  }
  async function importSettings() {
    if (!window.launcher) {
      notify('Use the desktop app to import and validate a settings backup.');
      return;
    }
    try {
      const value = await window.launcher.importConfig();
      if (value) {
        apply(value);
        notify('Settings imported.');
      }
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const donut = (
    <Donut
      key={profile.id}
      entries={config.entries}
      profile={profile}
      settings={config.settings}
      onActivate={(id) => void launch(id)}
    />
  );
  if (radial)
    return (
      <div className="radial-window">
        <div className="radial-donut">{donut}</div>
        <div className="radial-actions">
          <button
            className="icon-button"
            aria-label="Open settings"
            onClick={() => void window.launcher?.openSettings()}
          >
            <Settings size={17} />
          </button>
          <select
            aria-label="Donut profile"
            value={profile.id}
            onChange={(e) => activateProfile(e.target.value)}
          >
            {config.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="icon-button"
            aria-label="Close donut"
            onClick={() => void window.launcher?.hideDonut()}
          >
            <X size={17} />
          </button>
        </div>
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    );
  const matches = (a: Entry) =>
    a.name.toLowerCase().includes(search.toLowerCase()) &&
    (filter === 'all' || (filter === 'favorites' ? a.favorite : a.type === filter));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="./orbit.png" width="36" height="36" alt="" />
          <div>
            <strong>
              Orbit<span>launcher</span>
            </strong>
            <p>Click. Launch. Yours.</p>
          </div>
        </div>
        <div className="nav-label">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          {pages.map(({ id, name, icon: Icon }, i) => (
            <div key={id}>
              {i === 6 && <div className="nav-separator" />}
              <button
                className={`nav-item ${page === id ? 'active' : ''}`}
                onClick={() => {
                  setPage(id);
                  setSearch('');
                  setFilter('all');
                }}
                aria-label={name}
                aria-current={page === id ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{name}</span>
                {id === 'applications' && <small aria-hidden="true">{config.entries.length}</small>}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quick-key">
            <span className="online-dot" />
            <span>{desktop ? 'Running in your tray' : 'Browser preview'}</span>
          </div>
          <button className="sidebar-launch" onClick={() => void showDonut()}>
            <Command size={16} />
            <span>Open your orbit</span>
            <ArrowUpRight size={15} />
          </button>
          <div className="version">
            <span>Orbit v1.0.0</span>
            <span>Made for your desktop</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <div className="titlebar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={12} />
            <span>{pages.find((p) => p.id === page)?.name}</span>
          </div>
          <div className="window-controls">
            <span className="save-status">
              {saving ? (
                <>
                  <LoaderCircle size={12} className="spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check size={12} />
                  All changes saved
                </>
              )}
            </span>
            {desktop && (
              <>
                <button
                  aria-label="Minimize window"
                  onClick={() => window.launcher!.window('minimize')}
                >
                  <Minus size={14} />
                </button>
                <button
                  aria-label="Maximize window"
                  onClick={() => window.launcher!.window('maximize')}
                >
                  <Square size={11} />
                </button>
                <button
                  className="close-window"
                  aria-label="Close window"
                  onClick={() => window.launcher!.window('close')}
                >
                  <X size={15} />
                </button>
              </>
            )}
          </div>
        </div>
        <main>
          <header className="page-header">
            <div>
              <div className="eyebrow">
                {page === 'home' ? 'A LITTLE SPACE, JUST FOR YOU' : 'MAKE YOURSELF AT HOME'}
              </div>
              <h1>
                {pages.find((p) => p.id === page)?.name}
                <span className="heading-dot">.</span>
              </h1>
              <p>{captions[page]}</p>
            </div>
            {['home', 'applications'].includes(page) && (
              <button className="button primary" onClick={() => addNew()}>
                <Plus size={17} />
                Add application
              </button>
            )}
            {page === 'presets' && (
              <button className="button primary" onClick={() => addNew('group')}>
                <Plus size={17} />
                New launch group
              </button>
            )}
            {page === 'donut' && (
              <button className="button secondary" onClick={() => void showDonut()}>
                <Play size={15} />
                Try your donut
              </button>
            )}
          </header>
          {page === 'home' && (
            <>
              <div className="home-hero">
                <div className="hero-copy">
                  <span className="pill">
                    <span className="online-dot" />
                    YOUR DESKTOP, SIMPLIFIED
                  </span>
                  <h2>
                    Good things.
                    <br />
                    One orbit away.
                  </h2>
                  <p>
                    Gather your favorite apps in a little circle.
                    <br />
                    Spend less time looking. More time doing.
                  </p>
                  <button className="button primary" onClick={() => void showDonut()}>
                    <Disc3 size={17} />
                    Open launcher
                    <ArrowUpRight size={15} />
                  </button>
                  <div className="shortcut-hint">
                    <kbd>
                      {config.settings.hotkey
                        .replace('CommandOrControl', 'Ctrl')
                        .replaceAll('+', ' + ') || 'No shortcut set'}
                    </kbd>
                    <span>from anywhere on your desktop</span>
                  </div>
                </div>
                <div className="hero-donut">
                  {donut}
                  <span className="hero-caption">
                    <MousePointer2 size={13} />A little circle. Endless possibilities.
                  </span>
                </div>
              </div>
              <div className="stats-strip">
                <div>
                  <AppWindow size={18} />
                  <strong>{apps.length}</strong>
                  <span>applications</span>
                </div>
                <div>
                  <Disc3 size={18} />
                  <strong>{config.profiles.length}</strong>
                  <span>donut profiles</span>
                </div>
                <div>
                  <Layers size={18} />
                  <strong>{groups.length}</strong>
                  <span>launch groups</span>
                </div>
                <div className="local-badge">
                  <span className="online-dot" />
                  <span>Local. Private. Yours.</span>
                </div>
              </div>
              <div className="section-heading">
                <div>
                  <h2>
                    Your favorites{' '}
                    <span className="count-badge">
                      {config.entries.filter((a) => a.favorite).length}
                    </span>
                  </h2>
                  <p>The things you reach for, right where you need them.</p>
                </div>
                <button className="text-button" onClick={() => setPage('applications')}>
                  View all applications
                  <ArrowRight size={15} />
                </button>
              </div>
              <div className="favorites-grid">
                {config.entries
                  .filter((a) => a.favorite)
                  .slice(0, 7)
                  .map((a) => (
                    <button
                      key={a.id}
                      className="favorite-card"
                      onClick={() => void launch(a.id)}
                      disabled={!!launching}
                    >
                      <EntryIcon entry={a} size={25} />
                      <strong>{a.name}</strong>
                      <span>
                        {a.type === 'group'
                          ? `${a.members.length} apps`
                          : a.type === 'url'
                            ? 'Website'
                            : a.type === 'folder'
                              ? 'Folder'
                              : 'Application'}
                      </span>
                      <ArrowUpRight className="favorite-arrow" size={13} />
                    </button>
                  ))}
                <button className="favorite-card add-favorite" onClick={() => addNew()}>
                  <span className="add-circle">
                    <Plus size={23} />
                  </span>
                  <strong>Add a favorite</strong>
                  <span>Make room for more</span>
                </button>
              </div>
              <div
                className={`drop-zone ${dropOver ? 'over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropOver(true);
                }}
                onDragLeave={() => setDropOver(false)}
                onDrop={(e) => void dropFiles(e)}
              >
                <div className="drop-icon">
                  <Upload size={21} />
                </div>
                <div>
                  <strong>Drop it here. Make it yours.</strong>
                  <p>Drag an app, desktop shortcut, or folder to add it to your launcher.</p>
                </div>
                <button className="button secondary" onClick={() => addNew()}>
                  <FolderOpen size={15} />
                  Browse & add
                </button>
              </div>
              {config.settings.showRecent && (
                <section>
                  <div className="section-heading">
                    <h2>Recently launched</h2>
                    {config.history.length > 0 && (
                      <button
                        className="text-button"
                        onClick={() => {
                          if (window.launcher)
                            void window.launcher.clearHistory().catch((e) => notify(e.message));
                          else update((c) => ({ ...c, history: [] }));
                        }}
                      >
                        Clear history
                      </button>
                    )}
                  </div>
                  {config.history.length ? (
                    <div className="history-list">
                      {config.history.slice(0, 5).map((h) => (
                        <div className="history-row" key={h.id}>
                          <span className={`history-state ${h.success ? 'ok' : 'failed'}`}>
                            {h.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                          </span>
                          <div>
                            <strong>{h.name}</strong>
                            <p>{h.detail}</p>
                          </div>
                          <time>
                            {new Date(h.time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                          <button
                            className="icon-button"
                            aria-label={`Launch ${h.name} again`}
                            disabled={
                              !config.entries.some((a) => a.id === h.entryId) || !!launching
                            }
                            onClick={() => void launch(h.entryId)}
                          >
                            <Play size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-history">
                      <Clock size={21} />
                      <p>
                        Your next great session starts here.
                        <span>Launch an app and it will appear in your recent activity.</span>
                      </p>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {page === 'applications' && (
            <>
              <div className="toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    id="app-search"
                    placeholder="Find an application…"
                    aria-label="Search applications"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <kbd>Ctrl K</kbd>
                </div>
                <button
                  className="button secondary"
                  onClick={() => void scan()}
                  disabled={scanning}
                >
                  {scanning ? <LoaderCircle className="spin" size={16} /> : <Monitor size={16} />}
                  Discover apps
                </button>
              </div>
              <div className="filter-row">
                {[
                  ['all', 'All applications'],
                  ['favorites', 'Favorites'],
                  ['app', 'Desktop apps'],
                  ['url', 'Websites'],
                  ['folder', 'Folders'],
                  ['group', 'Launch groups'],
                ].map(([id, label]) => (
                  <button
                    className={`filter-pill ${filter === id ? 'selected' : ''}`}
                    key={id}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="application-grid">
                {config.entries.filter(matches).map((a) => (
                  <article
                    className="application-card"
                    key={a.id}
                    draggable
                    onDragStart={(e) => drag(e, a.id)}
                  >
                    <div className="application-top">
                      <EntryIcon entry={a} size={27} />
                      <button
                        className={`icon-button favorite-toggle ${a.favorite ? 'starred' : ''}`}
                        aria-label={`${a.favorite ? 'Unfavorite' : 'Favorite'} ${a.name}`}
                        onClick={() =>
                          update((c) => ({
                            ...c,
                            entries: c.entries.map((x) =>
                              x.id === a.id ? { ...x, favorite: !x.favorite } : x,
                            ),
                          }))
                        }
                      >
                        <Star size={16} fill={a.favorite ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${a.name}`}
                        onClick={() => setEditor(a)}
                      >
                        <MoreHorizontal size={19} />
                      </button>
                    </div>
                    <h3>{a.name}</h3>
                    <p className="app-target" title={a.target}>
                      {a.type === 'group'
                        ? `${a.members.length} applications · ${a.delay / 1000}s delay`
                        : a.target}
                    </p>
                    <div className="application-bottom">
                      <span className="type-tag">
                        {a.type === 'group'
                          ? 'Launch group'
                          : a.type === 'app'
                            ? 'Desktop app'
                            : a.type === 'url'
                              ? 'Website'
                              : 'Folder'}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => void launch(a.id)}
                        disabled={!!launching}
                      >
                        {launching === a.id ? 'Launching…' : 'Launch'}
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </article>
                ))}
                <button className="application-card add-card" onClick={() => addNew()}>
                  <Plus size={24} />
                  <strong>Add application</strong>
                  <span>Apps, websites, folders & more</span>
                </button>
              </div>
              <div className="info-note">
                <GripVertical size={17} />
                <span>
                  Drag applications into the Donut toolbar editor to arrange your launcher. Drop
                  files anywhere below to add them.
                </span>
              </div>
              <div
                className={`drop-zone compact ${dropOver ? 'over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropOver(true);
                }}
                onDragLeave={() => setDropOver(false)}
                onDrop={(e) => void dropFiles(e)}
              >
                <Upload size={20} />
                <span>Drop applications, shortcuts, or folders here</span>
              </div>
            </>
          )}
          {page === 'donut' && (
            <>
              <div className="donut-editor-layout">
                <section className="profile-column">
                  <div className="step-label">
                    <span>1</span>Choose a profile
                  </div>
                  <div className="card profile-list">
                    {config.profiles.map((p) => (
                      <button
                        key={p.id}
                        className={`profile-item ${p.id === profile.id ? 'selected' : ''}`}
                        onClick={() => activateProfile(p.id)}
                      >
                        <Disc3 size={16} />
                        <span>{p.name}</span>
                        <small>{p.entries.length}</small>
                      </button>
                    ))}
                    <button
                      className="new-profile"
                      onClick={() =>
                        setProfileEditor({
                          id: uid(),
                          name: 'New profile',
                          description: '',
                          entries: [],
                        })
                      }
                    >
                      <Plus size={15} />
                      New profile
                    </button>
                  </div>
                  <div className="profile-detail">
                    <div className="section-heading">
                      <h3>{profile.name}</h3>
                      <button
                        className="icon-button"
                        aria-label="Edit profile"
                        onClick={() => setProfileEditor(profile)}
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    <p>{profile.description || 'Your apps, your arrangement.'}</p>
                    <div className="profile-actions">
                      <button
                        className="icon-button"
                        aria-label="Duplicate profile"
                        title="Duplicate profile"
                        onClick={() => profileActions('duplicate')}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Delete profile"
                        title="Delete profile"
                        disabled={config.profiles.length < 2}
                        onClick={() => profileActions('delete')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="tip-card">
                    <MousePointer2 size={21} />
                    <strong>A little drag. A better day.</strong>
                    <p>
                      Drag apps onto the donut to add or rearrange them. Drop a slice back into the
                      library to remove it. Click a slice to edit.
                    </p>
                  </div>
                </section>
                <section className="arrange-column">
                  <div className="step-label">
                    <span>2</span>Arrange your orbit<small>{profile.entries.length} / 24</small>
                  </div>
                  <div
                    className={`card donut-preview ${dropOver ? 'over' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropOver(true);
                    }}
                    onDragLeave={() => setDropOver(false)}
                    onDrop={(e) => void dropFiles(e)}
                  >
                    <Donut
                      key={profile.id}
                      entries={config.entries}
                      profile={profile}
                      settings={config.settings}
                      onActivate={(id) => setEditor(config.entries.find((a) => a.id === id)!)}
                      onDrop={(id, index) => {
                        setDropOver(false);
                        arrange(id, index);
                      }}
                      editable
                    />
                    <p>
                      <GripVertical size={13} />
                      Drag to arrange. Click to customize.
                    </p>
                  </div>
                  <div className="card appearance-card">
                    <h3>Donut appearance</h3>
                    <label className="field">
                      Show on each slice
                      <div className="segmented">
                        {[
                          ['both', 'Icon + name'],
                          ['icon', 'Icon only'],
                          ['name', 'Name only'],
                        ].map(([id, label]) => (
                          <button
                            key={id}
                            className={config.settings.display === id ? 'selected' : ''}
                            onClick={() => setting({ display: id as Preferences['display'] })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </label>
                    <div className="form-grid">
                      <label className="field">
                        Apps per face
                        <select
                          value={config.settings.perFace}
                          onChange={(e) => setting({ perFace: Number(e.target.value) })}
                        >
                          {[4, 6, 8, 10, 12].map((n) => (
                            <option key={n} value={n}>
                              {n} apps
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Active profile
                        <select
                          value={profile.id}
                          onChange={(e) => activateProfile(e.target.value)}
                        >
                          {config.profiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <Range
                      label="Size"
                      min={280}
                      max={600}
                      step={10}
                      value={config.settings.donutSize}
                      suffix=" px"
                      onChange={(n) => setting({ donutSize: n })}
                    />
                    <Range
                      label="Opacity"
                      min={30}
                      max={100}
                      value={config.settings.opacity}
                      suffix="%"
                      onChange={(n) => setting({ opacity: n })}
                    />
                    <Range
                      label="Rotation"
                      min={0}
                      max={360}
                      step={5}
                      value={config.settings.rotation}
                      suffix="°"
                      onChange={(n) => setting({ rotation: n })}
                    />
                    <Toggle
                      label="Hide after launching"
                      checked={config.settings.autoHide}
                      onChange={(n) => setting({ autoHide: n })}
                    />
                  </div>
                </section>
                <section className="palette-column">
                  <div className="step-label">
                    <span>3</span>Your application library
                  </div>
                  <div className="search narrow">
                    <Search size={15} />
                    <input
                      aria-label="Search donut library"
                      placeholder="Find an app…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div
                    className="card palette"
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes('application/orbit-entry'))
                        e.preventDefault();
                    }}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData('application/orbit-entry');
                      if (id && e.dataTransfer.getData('application/orbit-source') === 'donut') {
                        e.preventDefault();
                        removeFromDonut(id);
                      }
                    }}
                  >
                    {config.entries
                      .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
                      .map((a) => (
                        <div
                          key={a.id}
                          className={`palette-app ${profile.entries.includes(a.id) ? 'in-donut' : ''}`}
                          draggable
                          onDragStart={(e) => drag(e, a.id)}
                        >
                          <GripVertical size={13} />
                          <EntryIcon entry={a} size={19} />
                          <span>{a.name}</span>
                          <button
                            className="icon-button"
                            aria-label={`${profile.entries.includes(a.id) ? 'Remove' : 'Add'} ${a.name} ${profile.entries.includes(a.id) ? 'from' : 'to'} donut`}
                            onClick={() =>
                              profile.entries.includes(a.id) ? removeFromDonut(a.id) : arrange(a.id)
                            }
                          >
                            {profile.entries.includes(a.id) ? (
                              <Check size={14} />
                            ) : (
                              <Plus size={14} />
                            )}
                          </button>
                        </div>
                      ))}
                    <button className="new-profile" onClick={() => addNew()}>
                      <Plus size={15} />
                      Add application
                    </button>
                  </div>
                  <div className="palette-footer">
                    <span className="online-dot" />
                    Changes save automatically
                  </div>
                </section>
              </div>
            </>
          )}
          {page === 'presets' && (
            <>
              <div className="banner-card">
                <span className="banner-icon">
                  <Layers size={26} />
                </span>
                <div>
                  <h2>One click. Your whole workspace.</h2>
                  <p>
                    Bundle the apps you use together. Add a launch group to any donut profile,
                    <br />
                    or give it a keyboard shortcut for an instant fresh start.
                  </p>
                </div>
              </div>
              <div className="groups-grid">
                {groups.map((a) => (
                  <article className="card group-card" key={a.id}>
                    <div className="section-heading">
                      <EntryIcon entry={a} size={26} />
                      <button
                        className="icon-button"
                        aria-label={`Edit ${a.name}`}
                        onClick={() => setEditor(a)}
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    </div>
                    <h2>{a.name}</h2>
                    <p>
                      {a.members.length} applications ·{' '}
                      {a.delay ? `${a.delay / 1000}s between apps` : 'all at once'}
                    </p>
                    <div className="group-stack">
                      {a.members.slice(0, 5).map((id) => {
                        const member = config.entries.find((x) => x.id === id);
                        return member && <EntryIcon key={id} entry={member} size={18} />;
                      })}
                      {a.members.length > 5 && <span>+{a.members.length - 5}</span>}
                    </div>
                    <div className="group-members">
                      {a.members
                        .map((id) => config.entries.find((x) => x.id === id)?.name)
                        .join(' + ')}
                    </div>
                    <button
                      className="button primary"
                      disabled={!!launching}
                      onClick={() => void launch(a.id)}
                    >
                      <Play size={15} />
                      {launching === a.id ? 'Launching…' : 'Launch workspace'}
                      <ArrowUpRight size={15} />
                    </button>
                  </article>
                ))}
                <button className="card group-card new-group" onClick={() => addNew('group')}>
                  <span className="add-circle">
                    <Plus size={26} />
                  </span>
                  <h3>Create a launch group</h3>
                  <p>
                    Pick your apps.
                    <br />
                    Give your routine a shortcut.
                  </p>
                </button>
              </div>
              <div className="section-heading">
                <h2>A little inspiration</h2>
              </div>
              <div className="inspiration-grid">
                {[
                  {
                    name: 'Focus time',
                    icon: CodeIcon,
                    desc: 'Editor + browser + notes',
                    members: [apps[2]?.id, apps[3]?.id],
                  },
                  {
                    name: 'Creative flow',
                    icon: Palette,
                    desc: 'Design tools + references',
                    members: [apps[4]?.id, apps[6]?.id],
                  },
                  {
                    name: 'Morning routine',
                    icon: Sun,
                    desc: 'Your day, ready to go',
                    members: [apps[0]?.id, apps[1]?.id],
                  },
                ].map(({ name, icon: Icon, desc, members }) => (
                  <button
                    className="inspiration-card"
                    key={name}
                    onClick={() =>
                      setEditor({
                        ...entry(name, 'group'),
                        members: members.filter((id): id is string => !!id),
                      })
                    }
                  >
                    <Icon size={19} />
                    <div>
                      <strong>{name}</strong>
                      <p>{desc}</p>
                    </div>
                    <Plus size={17} />
                  </button>
                ))}
              </div>
            </>
          )}
          {page === 'general' && (
            <div className="settings-layout">
              <div className="settings-main">
                <section className="card settings-card">
                  <div className="card-heading">
                    <Monitor size={19} />
                    <h2>At home on your desktop</h2>
                  </div>
                  <Toggle
                    label="Launch at Windows sign-in"
                    description="Have your favorite apps ready when you are."
                    checked={config.settings.launchAtLogin}
                    onChange={(v) => setting({ launchAtLogin: v })}
                  />
                  <Toggle
                    label="Start quietly in the tray"
                    description="Keep the settings window out of your way on startup."
                    checked={config.settings.startMinimized}
                    onChange={(v) => setting({ startMinimized: v })}
                  />
                  <Toggle
                    label="Close to system tray"
                    description="Keep your donut and shortcuts available after closing this window."
                    checked={config.settings.closeToTray}
                    onChange={(v) => setting({ closeToTray: v })}
                  />
                </section>
                <section className="card settings-card">
                  <div className="card-heading">
                    <MousePointer2 size={19} />
                    <h2>Your launch experience</h2>
                  </div>
                  <Toggle
                    label="Hide after launching"
                    description="Tuck the donut away after a successful launch or when it loses focus."
                    checked={config.settings.autoHide}
                    onChange={(v) => setting({ autoHide: v })}
                  />
                  <Toggle
                    label="Show recent activity"
                    description="Keep your latest launches on Home. Nothing leaves your device."
                    checked={config.settings.showRecent}
                    onChange={(v) => setting({ showRecent: v })}
                  />
                  <div className="setting-row">
                    <div>
                      <strong>Default donut profile</strong>
                      <p>Choose the apps that greet you.</p>
                    </div>
                    <select
                      aria-label="Default donut profile"
                      value={profile.id}
                      onChange={(e) => activateProfile(e.target.value)}
                    >
                      {config.profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>
                <section className="card settings-card">
                  <div className="card-heading">
                    <Download size={19} />
                    <h2>Keep your setup close</h2>
                  </div>
                  <p className="card-description">
                    Back up your library, profiles, groups, and theme. Settings backups contain
                    local paths; recent launch activity is excluded.
                  </p>
                  <div className="button-row">
                    <button className="button secondary" onClick={() => void exportSettings()}>
                      <Download size={16} />
                      Export settings
                    </button>
                    <button className="button secondary" onClick={() => void importSettings()}>
                      <Upload size={16} />
                      Import settings
                    </button>
                  </div>
                </section>
              </div>
              <aside className="settings-aside">
                <div className="tip-card">
                  <Orbit size={28} />
                  <h3>Always a gesture away.</h3>
                  <p>
                    Use your global shortcut or click the tray icon to open Orbit at your cursor.
                  </p>
                  <kbd>
                    {config.settings.hotkey
                      .replace('CommandOrControl', 'Ctrl')
                      .replaceAll('+', ' + ') || 'Shortcut disabled'}
                  </kbd>
                </div>
                {!desktop && (
                  <div className="info-note vertical">
                    <Monitor size={22} />
                    <strong>You’re in the browser preview</strong>
                    <p>
                      Customizations save in this browser. File picking, sign-in startup, global
                      shortcuts, imports, and native launching work in the Windows app.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          )}
          {page === 'shortcuts' && (
            <div className="settings-layout">
              <div className="settings-main">
                <section className="card settings-card">
                  <div className="card-heading">
                    <Keyboard size={19} />
                    <h2>Open your orbit</h2>
                  </div>
                  <p className="card-description">
                    Your donut appears at the cursor, wherever you’re working. Use Electron shortcut
                    names, such as Control, Alt, Shift, Space, or F1.
                  </p>
                  <ShortcutInput
                    value={config.settings.hotkey}
                    onSave={(hotkey) => setting({ hotkey })}
                    label="Global donut shortcut"
                  />
                  <div className="info-note">
                    <Info size={16} />
                    <span>
                      A shortcut already used by Windows or another app cannot be registered. Orbit
                      will keep your previous settings if registration fails.
                    </span>
                  </div>
                </section>
                <section className="card settings-card">
                  <div className="card-heading">
                    <AppWindow size={19} />
                    <h2>Application & group shortcuts</h2>
                  </div>
                  <p className="card-description">
                    Launch a single app or an entire workspace without opening the donut.
                  </p>
                  {config.entries
                    .filter((a) => a.hotkey)
                    .map((a) => (
                      <div className="shortcut-row" key={a.id}>
                        <EntryIcon entry={a} size={17} />
                        <span>{a.name}</span>
                        <kbd>{a.hotkey.replaceAll('+', ' + ')}</kbd>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${a.name} shortcut`}
                          onClick={() => setEditor(a)}
                        >
                          <Pencil size={15} />
                        </button>
                      </div>
                    ))}
                  <button
                    className="button secondary"
                    onClick={() => {
                      setPage('applications');
                      notify('Edit an application or launch group to assign its global shortcut.');
                    }}
                  >
                    <Plus size={15} />
                    Assign a shortcut
                  </button>
                </section>
                <section className="card settings-card">
                  <h2>While the donut is open</h2>
                  {[
                    ['Click a slice', 'Launch an app or group'],
                    ['Mouse wheel / Page Up & Down', 'Switch donut faces'],
                    ['Tab + Enter', 'Focus and activate a slice'],
                    ['Esc', 'Close the donut'],
                    ['Ctrl + K', 'Search the application library'],
                  ].map(([action, description]) => (
                    <div className="setting-row" key={action}>
                      <span>{description}</span>
                      <kbd>{action}</kbd>
                    </div>
                  ))}
                </section>
              </div>
              <aside className="settings-aside">
                <div className="tip-card">
                  <Command size={25} />
                  <h3>A good place to start.</h3>
                  <p>
                    Try <b>Control + Shift + Space</b> for your donut, and <b>Control + Alt + 1</b>{' '}
                    for your favorite launch group.
                  </p>
                  <p>Leave a shortcut empty to turn it off.</p>
                </div>
              </aside>
            </div>
          )}
          {page === 'theme' && (
            <div className="settings-layout theme-layout">
              <div className="settings-main">
                <section className="card settings-card">
                  <h2>Choose your feel</h2>
                  <div className="theme-styles">
                    {[
                      ['soft', 'Orbit Soft', 'Gentle surfaces. A little warmth.'],
                      ['material', 'Material', 'Tonal surfaces. A little boldness.'],
                    ].map(([id, title, desc]) => (
                      <button
                        key={id}
                        className={`style-choice ${config.settings.style === id ? 'selected' : ''}`}
                        onClick={() => setting({ style: id as Preferences['style'] })}
                      >
                        <span className={`style-mini ${id}`}>
                          <i />
                          <i />
                          <i />
                        </span>
                        <strong>
                          {title}
                          {config.settings.style === id && <CheckCircle2 size={15} />}
                        </strong>
                        <p>{desc}</p>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="card settings-card">
                  <h2>Appearance</h2>
                  <div className="appearance-modes">
                    {[
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'system', label: 'System', icon: Monitor },
                    ].map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        className={config.settings.theme === id ? 'selected' : ''}
                        onClick={() => setting({ theme: id as Preferences['theme'] })}
                      >
                        <Icon size={19} />
                        {label}
                        {config.settings.theme === id && <span className="selected-dot" />}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="card settings-card">
                  <h2>A color that feels like you</h2>
                  <p className="card-description">A little personality, everywhere.</p>
                  <div className="swatches">
                    {accents.map(([name, color]) => (
                      <button
                        key={color}
                        aria-label={`${name} accent`}
                        title={name}
                        className={config.settings.accent === color ? 'selected' : ''}
                        style={{ background: color }}
                        onClick={() => setting({ accent: color })}
                      >
                        {config.settings.accent === color && <Check size={18} />}
                      </button>
                    ))}
                  </div>
                  <label className="custom-color">
                    Custom accent
                    <input
                      type="color"
                      aria-label="Custom accent"
                      value={config.settings.accent}
                      onChange={(e) => setting({ accent: e.target.value })}
                    />
                    <code>{config.settings.accent.toUpperCase()}</code>
                  </label>
                </section>
                <section className="card settings-card">
                  <Range
                    label="Corner softness"
                    min={0}
                    max={28}
                    value={config.settings.radius}
                    suffix=" px"
                    onChange={(radius) => setting({ radius })}
                  />
                  <Range
                    label="Donut opacity"
                    min={30}
                    max={100}
                    value={config.settings.opacity}
                    suffix="%"
                    onChange={(opacity) => setting({ opacity })}
                  />
                  <Toggle
                    label="Reduce motion"
                    description="Keep things calm with fewer animations."
                    checked={!config.settings.motion}
                    onChange={(v) => setting({ motion: !v })}
                  />
                </section>
                <button
                  className="text-button"
                  onClick={() =>
                    setting({
                      theme: 'light',
                      style: 'soft',
                      accent: '#7f77dd',
                      radius: 16,
                      opacity: 100,
                      motion: true,
                    })
                  }
                >
                  <RotateCcw size={14} />
                  Reset appearance
                </button>
              </div>
              <aside className="settings-aside theme-preview">
                <div className="card">
                  <div className="section-heading">
                    <h3>Live preview</h3>
                    <span className="live-badge">
                      <span className="online-dot" />
                      LIVE
                    </span>
                  </div>
                  <div className="preview-backdrop">
                    <Donut
                      entries={config.entries}
                      profile={profile}
                      settings={config.settings}
                      onActivate={() =>
                        notify(
                          'This is a theme preview. Launch apps from Home or the desktop donut.',
                        )
                      }
                      small
                    />
                  </div>
                  <div className="preview-buttons">
                    <button
                      className="button primary"
                      onClick={() => notify('Your theme saves automatically.')}
                    >
                      Looks good
                      <Check size={14} />
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setting({ theme: 'light', accent: '#7f77dd' })}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="preview-sample">
                    <EntryIcon entry={config.entries[0] ?? entry('Sample')} size={18} />
                    <div>
                      <strong>A little preview</strong>
                      <p>All the details, just right.</p>
                    </div>
                    <CheckCircle2 size={17} />
                  </div>
                </div>
                <p className="preview-caption">
                  Your theme follows you everywhere.
                  <br />
                  Settings, donut, and all.
                </p>
              </aside>
            </div>
          )}
          {page === 'about' && (
            <div className="about-content">
              <div className="card about-hero">
                <img src="./orbit.png" width="74" height="74" alt="Orbit logo" />
                <h2>
                  A little circle.
                  <br />A desktop that feels like yours.
                </h2>
                <p>
                  Orbit Launcher brings your applications, folders, websites,
                  <br />
                  and everyday routines together in one customizable donut.
                </p>
                <span className="pill">Version 1.0.0 · Windows 10 / 11 · x64</span>
              </div>
              <div className="card settings-card">
                <h2>Inspired by Filee. Built for launching.</h2>
                <p className="card-description">
                  Filee by KnifeLemon makes file conversion feel effortless. Orbit adapts its
                  MIT-licensed soft palette, settings layout, and radial editor into a dedicated
                  application launcher, using Electron and React.
                </p>
                <p className="card-description">
                  This is an independent project. It is not an official Filee release. The original
                  Filee license and source references are included with this application.
                </p>
                <div className="button-row">
                  <button
                    className="button secondary"
                    onClick={() => {
                      if (window.launcher)
                        notify(
                          'Filee source: https://github.com/KnifeLemon/Filee — see the included third-party notices.',
                        );
                      else
                        window.open(
                          'https://github.com/KnifeLemon/Filee',
                          '_blank',
                          'noopener,noreferrer',
                        );
                    }}
                  >
                    <ExternalLink size={15} />
                    Filee on GitHub
                  </button>
                  <button className="button secondary" onClick={() => setPage('general')}>
                    <Settings size={15} />
                    Make it yours
                  </button>
                </div>
              </div>
              <div className="about-features">
                <span>
                  <CheckCircle2 size={16} />
                  Local settings
                </span>
                <span>
                  <CheckCircle2 size={16} />
                  No account needed
                </span>
                <span>
                  <CheckCircle2 size={16} />
                  No telemetry
                </span>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <Orbit size={13} />
            <span>A little less searching. A little more doing.</span>
            <span>YOUR DESKTOP. YOUR ORBIT.</span>
          </footer>
        </main>
      </div>
      {editor && (
        <EntryEditor
          initial={editor}
          config={config}
          onSave={saveEntry}
          onClose={() => setEditor(null)}
          onDelete={
            config.entries.some((a) => a.id === editor.id) ? () => deleteEntry(editor) : undefined
          }
          notify={notify}
        />
      )}
      {profileEditor && (
        <Modal
          title={
            config.profiles.some((p) => p.id === profileEditor.id)
              ? 'Edit profile'
              : 'Create a profile'
          }
          description="A different orbit for every part of your day."
          onClose={() => setProfileEditor(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!profileEditor.name.trim()) return;
              update((c) => {
                const exists = c.profiles.some((p) => p.id === profileEditor.id);
                if (!exists && c.profiles.length >= 60)
                  throw new Error('You can create up to 60 profiles.');
                return {
                  ...c,
                  profiles: exists
                    ? c.profiles.map((p) => (p.id === profileEditor.id ? profileEditor : p))
                    : [...c.profiles, profileEditor],
                  activeProfile: profileEditor.id,
                };
              });
              setProfileEditor(null);
            }}
          >
            <label className="field">
              Profile name
              <input
                autoFocus
                required
                maxLength={80}
                value={profileEditor.name}
                onChange={(e) => setProfileEditor({ ...profileEditor, name: e.target.value })}
              />
            </label>
            <label className="field">
              Description
              <textarea
                maxLength={300}
                value={profileEditor.description}
                onChange={(e) =>
                  setProfileEditor({ ...profileEditor, description: e.target.value })
                }
                placeholder="What belongs in this orbit?"
              />
            </label>
            <footer className="modal-footer">
              <button
                className="button secondary"
                type="button"
                onClick={() => setProfileEditor(null)}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                <Check size={15} />
                Save profile
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="confirm-message">{confirm.message}</p>
          <footer className="modal-footer">
            <button className="button secondary" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button className="button danger-solid" onClick={confirm.action}>
              <Trash2 size={15} />
              Delete
            </button>
          </footer>
        </Modal>
      )}
      {preview && (
        <Modal
          title="Your orbit, ready to go"
          description="A live preview of your donut. The desktop shortcut opens it at your cursor."
          onClose={() => setPreview(false)}
        >
          <div className="preview-modal-donut">{donut}</div>
          <div className="info-note">
            <Info size={17} />
            <span>Native application launching is available in the Windows desktop app.</span>
          </div>
          <footer className="modal-footer">
            <button
              className="button secondary"
              onClick={() => {
                setPreview(false);
                setPage('donut');
              }}
            >
              Customize your donut
              <ArrowRight size={15} />
            </button>
          </footer>
        </Modal>
      )}
      {discovered && (
        <Modal
          title="Discover your applications"
          description="Applications from your Windows Start Menu. Select a few favorites to begin."
          wide
          onClose={() => setDiscovered(null)}
        >
          <div className="search">
            <Search size={17} />
            <input
              placeholder="Search installed applications…"
              aria-label="Search discovered applications"
              value={scanSearch}
              onChange={(e) => setScanSearch(e.target.value)}
            />
          </div>
          <div className="discovery-list">
            {discovered
              .filter((a) => a.name.toLowerCase().includes(scanSearch.toLowerCase()))
              .map((a) => (
                <label key={a.target} className="discovery-row">
                  <input
                    type="checkbox"
                    checked={scanSelected.has(a.target)}
                    onChange={(e) =>
                      setScanSelected((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(a.target);
                        else n.delete(a.target);
                        return n;
                      })
                    }
                  />
                  <EntryIcon
                    entry={{ name: a.name, icon: a.icon, glyph: 'app', color: '#7f77dd' }}
                    size={19}
                  />
                  <div>
                    <strong>{a.name}</strong>
                    <span>{a.target}</span>
                  </div>
                </label>
              ))}
            {discovered.length === 0 && (
              <div className="empty-state">
                <AppWindow size={30} />
                <h3>No Start Menu apps found</h3>
                <p>Use Add application to browse for an executable, shortcut, or folder.</p>
              </div>
            )}
          </div>
          <footer className="modal-footer">
            <span className="hint">{scanSelected.size} selected</span>
            <button
              className="button primary"
              disabled={!scanSelected.size}
              onClick={async () => {
                try {
                  await addDiscoveries(discovered.filter((a) => scanSelected.has(a.target)));
                  setDiscovered(null);
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <Plus size={15} />
              Add selected apps
            </button>
          </footer>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={17} />
          <span>{toast}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {launching ? 'Launching application…' : ''}
      </div>
    </div>
  );
}
function ShortcutInput({
  value,
  onSave,
  label,
}: {
  value: string;
  onSave: (value: string) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <form
      className="shortcut-input"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft.trim());
      }}
    >
      <label className="field">
        {label}
        <div className="input-action">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Control+Shift+Space"
          />
          <button className="button primary" type="submit">
            Apply
          </button>
        </div>
      </label>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setDraft('');
          onSave('');
        }}
      >
        Disable shortcut
      </button>
    </form>
  );
}
function CodeIcon({ size = 20 }: { size?: number }) {
  return <LayoutGrid size={size} />;
}
