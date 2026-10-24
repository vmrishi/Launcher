import ShortcutField from './ShortcutField';
import { useState } from 'react';
import {
  FolderOpen,
  ImagePlus,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { EntryIcon, glyphs } from './Icon';
import { Modal } from './Controls';
import type { Entry, Config, EntryType } from '../types';
import { desktop } from '../bridge';
export default function EntryEditor({
  initial,
  config,
  onSave,
  onClose,
  onDelete,
  notify,
}: {
  initial: Entry;
  config: Config;
  onSave: (entry: Entry) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
  notify: (message: string) => void;
}) {
  const [value, setValue] = useState(initial),
    [args, setArgs] = useState(JSON.stringify(initial.args)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const group = value.type === 'group';
  async function dropTarget(e: React.DragEvent) {
    e.preventDefault();
    setError('');
    try {
      const files = Array.from(e.dataTransfer.files);
      if (files.length) {
        if (!window.launcher)
          throw new Error('Drop files in the desktop app, or enter a path below.');
        const paths = files.map((f) => window.launcher!.filePath(f)).filter(Boolean);
        const found = await window.launcher.describe(paths.slice(0, 1));
        if (found[0])
          setValue((v) => ({
            ...v,
            name: v.name === 'New application' ? found[0].name : v.name,
            target: found[0].target,
            icon: found[0].icon,
            type: found[0].type ?? 'app',
          }));
      } else {
        const target = (
          e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
        ).trim();
        const url = new URL(target);
        if (!['http:', 'https:'].includes(url.protocol))
          throw new Error('Drop an HTTP or HTTPS link.');
        setValue((v) => ({ ...v, target, type: 'url', glyph: 'globe' }));
      }
    } catch (error) {
      setError((error as Error).message);
    }
  }
  const update = (patch: Partial<Entry>) => setValue((v) => ({ ...v, ...patch }));
  async function browse(kind: 'app' | 'folder' | 'icon') {
    if (!window.launcher) {
      notify('File browsing is available in the desktop app.');
      return;
    }
    try {
      const picked = await window.launcher.browse(kind);
      if (picked)
        update(
          kind === 'icon'
            ? { icon: picked.icon }
            : {
                target: picked.target,
                name: value.name === 'New application' ? picked.name : value.name,
                icon: picked.icon,
                type: picked.type ?? value.type,
              },
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const parsed = JSON.parse(args);
      if (!Array.isArray(parsed) || parsed.some((a) => typeof a !== 'string'))
        throw new Error('Arguments must be a JSON array of strings, for example ["--new-window"].');
      if (!value.name.trim()) throw new Error('Give this application a name.');
      if (group && !value.members.length)
        throw new Error('Choose at least one application for this group.');
      if (!group && !value.target.trim())
        throw new Error('Choose an application, folder or website.');
      if (value.type === 'url') {
        const u = new URL(value.target);
        if (!['http:', 'https:'].includes(u.protocol))
          throw new Error('Use an HTTP or HTTPS website address.');
      }
      setBusy(true);
      await onSave({
        ...value,
        name: value.name.trim(),
        target: value.target.trim(),
        args: parsed,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, direction: number) {
    const list = [...value.members];
    const next = index + direction;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    update({ members: list });
  }
  return (
    <Modal
      title={
        config.entries.some((a) => a.id === value.id)
          ? `Edit ${group ? 'launch group' : 'application'}`
          : `Add ${group ? 'launch group' : 'application'}`
      }
      description={
        group ? 'One click. Your whole workspace.' : 'Make it yours, down to the last detail.'
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div
          className="editor-identity"
          onDragOver={(e) => {
            if (!group) e.preventDefault();
          }}
          onDrop={(e) => {
            if (!group) void dropTarget(e);
          }}
        >
          <EntryIcon entry={value} size={34} />
          <div>
            <strong>{value.name || 'Your application'}</strong>
            <span>
              {group
                ? `${value.members.length} apps in this group`
                : value.target || 'Choose a destination below'}
            </span>
          </div>
          <button type="button" className="button secondary" onClick={() => browse('icon')}>
            <ImagePlus size={15} />
            Custom icon
          </button>
          {value.icon && (
            <button
              type="button"
              className="icon-button"
              title="Remove custom icon"
              aria-label="Remove custom icon"
              onClick={() => update({ icon: undefined })}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
        <div className="form-grid">
          <label className="field">
            Name
            <input
              autoFocus
              maxLength={100}
              value={value.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Visual Studio Code"
              required
            />
          </label>
          {!group && (
            <label className="field">
              Type
              <select
                aria-label="Type"
                value={value.type}
                onChange={(e) =>
                  update({
                    type: e.target.value as EntryType,
                    target: '',
                    args: [],
                    cwd: '',
                    glyph:
                      e.target.value === 'folder'
                        ? 'folder'
                        : e.target.value === 'url'
                          ? 'globe'
                          : 'app',
                  })
                }
              >
                <option value="app">Application / shortcut</option>
                <option value="url">Website</option>
                <option value="folder">Folder</option>
              </select>
            </label>
          )}
        </div>
        {!group && (
          <>
            <p className="editor-drop-hint">
              Drop an application, shortcut, folder, or website link onto the card above to fill its
              details.
            </p>
            <label className="field">
              {value.type === 'url' ? 'Website address' : 'Application or folder path'}
              <div className="input-action">
                <input
                  value={value.target}
                  onChange={(e) => update({ target: e.target.value })}
                  placeholder={
                    value.type === 'url' ? 'https://example.com' : 'C:\\Path\\Application.exe'
                  }
                  required
                />
                {value.type !== 'url' && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => browse(value.type === 'folder' ? 'folder' : 'app')}
                  >
                    <FolderOpen size={15} />
                    Browse
                  </button>
                )}
              </div>
            </label>
            {value.type === 'app' && (
              <details className="advanced">
                <summary>Advanced launch options</summary>
                <label className="field">
                  Arguments (JSON array)
                  <input
                    value={args}
                    onChange={(e) => setArgs(e.target.value)}
                    placeholder={'["--new-window"]'}
                  />
                </label>
                <label className="field">
                  Working directory
                  <div className="input-action">
                    <input
                      value={value.cwd}
                      onChange={(e) => update({ cwd: e.target.value })}
                      placeholder="Optional — defaults to inherited directory"
                    />
                    <button
                      type="button"
                      className="button secondary"
                      onClick={async () => {
                        const p = await window.launcher?.browse('folder');
                        if (p) update({ cwd: p.target });
                      }}
                    >
                      Browse
                    </button>
                  </div>
                </label>
                <p className="hint">
                  Shortcut (.lnk/.url) files use their own arguments and working directory.
                </p>
              </details>
            )}
          </>
        )}
        {group && (
          <div className="group-editor">
            <div className="section-heading">
              <h3>Applications to launch</h3>
              <span>{value.members.length} selected</span>
            </div>
            <div className="member-list">
              {value.members.map((id, i) => {
                const a = config.entries.find((x) => x.id === id);
                return a ? (
                  <div key={id} className="member-row">
                    <GripVertical size={14} />
                    <EntryIcon entry={a} size={16} />
                    <span>{a.name}</span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move ${a.name} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move ${a.name} down`}
                      disabled={i === value.members.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${a.name} from group`}
                      onClick={() => update({ members: value.members.filter((m) => m !== id) })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null;
              })}
            </div>
            <select
              aria-label="Add application to group"
              value=""
              onChange={(e) => {
                if (e.target.value) update({ members: [...value.members, e.target.value] });
              }}
            >
              <option value="">+ Add an application…</option>
              {config.entries
                .filter((a) => a.type !== 'group' && !value.members.includes(a.id))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
            <label className="field">
              Delay between applications
              <select
                value={value.delay}
                onChange={(e) => update({ delay: Number(e.target.value) })}
              >
                {[0, 250, 500, 1000, 2000, 5000, 10000].map((ms) => (
                  <option key={ms} value={ms}>
                    {ms === 0 ? 'No delay' : `${ms / 1000} seconds`}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">
              Apps launch in this order. If one is missing, the remaining apps still launch.
            </p>
          </div>
        )}
        <div className="form-grid">
          <label className="field">
            Icon color
            <input
              type="color"
              value={value.color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </label>
          <label className="field">
            Global shortcut
            <ShortcutField value={value.hotkey} onChange={(hotkey) => update({ hotkey })} />
            <span className="hint">Optional · leave empty to disable</span>
          </label>
        </div>
        <label className="field">Icon</label>
        <div className="glyph-picker">
          {glyphs.map((g) => (
            <button
              type="button"
              key={g}
              className={`glyph-choice ${value.glyph === g ? 'selected' : ''}`}
              aria-label={`${g} icon`}
              onClick={() => update({ glyph: g, icon: undefined })}
            >
              <EntryIcon entry={{ ...value, icon: undefined, glyph: g }} bare size={19} />
            </button>
          ))}
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={value.favorite}
            onChange={(e) => update({ favorite: e.target.checked })}
          />
          Show in favorites
        </label>
        {!desktop && (
          <p className="hint">
            Browser preview saves locally. Desktop integration is available in the installed app.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="modal-footer">
          {onDelete && (
            <button type="button" className="button danger" onClick={onDelete}>
              <Trash2 size={15} />
              Delete
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {config.entries.some((a) => a.id === value.id) ? (
              <Save size={15} />
            ) : (
              <Plus size={15} />
            )}{' '}
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
