import { useEffect, useState } from 'react';
import { Toggle } from './Controls';
import type { Settings, UpdateStatus } from '../types';
export default function UpdatePanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const [status, setStatus] = useState<UpdateStatus | null>(null),
    [token, setToken] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!window.launcher) return;
    let active = true;
    const refresh = () =>
      void window
        .launcher!.updateAction('status')
        .then((s) => {
          if (active) setStatus(s);
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function action(kind: 'check' | 'install') {
    if (!window.launcher) {
      setStatus({
        state: 'error',
        message: 'Update checks are available in the Windows desktop app.',
        currentVersion: '1.0.2',
        tokenStored: false,
      });
      return;
    }
    setBusy(true);
    try {
      setStatus(await window.launcher.updateAction(kind));
    } catch (e) {
      setStatus({
        state: 'error',
        message: (e as Error).message,
        currentVersion: '1.0.2',
        tokenStored: false,
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card settings-card">
      <h2>Software updates</h2>
      <p className="card-description">
        Current version: {status?.currentVersion ?? '1.0.2'}. Updates come from vmrishi/Launcher on
        GitHub. Downloaded executables are checked against the release SHA-256 checksums before
        installation.
      </p>
      <div className="button-row">
        <button className="button primary" disabled={busy} onClick={() => void action('check')}>
          {busy ? 'Working…' : 'Check for updates now'}
        </button>
        {status?.state === 'available' && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void action('install')}
          >
            Install update and restart
          </button>
        )}
      </div>
      {status && (
        <p className="update-status" role="status">
          {status.message}
        </p>
      )}
      <Toggle
        label="Check for updates automatically"
        description="Check at startup and every six hours while Orbit is running."
        checked={settings.autoCheckUpdates}
        onChange={(autoCheckUpdates) => onChange({ autoCheckUpdates })}
      />
      <Toggle
        label="Install updates automatically"
        description="When enabled with automatic checks, download verified updates and restart Orbit to install them."
        checked={settings.autoInstallUpdates}
        onChange={(autoInstallUpdates) => onChange({ autoInstallUpdates })}
      />
      <details className="update-token">
        <summary>GitHub access for private repository</summary>
        <p className="card-description">
          This repository is private. Supply a fine-grained GitHub token with read-only Contents
          access to vmrishi/Launcher. It is stored using Windows encryption and excluded from
          settings backups.
        </p>
        <label className="field">
          GitHub token
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={
              status?.tokenStored ? 'A token is securely saved' : 'Enter a read-only GitHub token'
            }
          />
        </label>
        <div className="button-row">
          <button
            className="button secondary"
            disabled={!token || !window.launcher}
            onClick={async () => {
              try {
                setStatus(await window.launcher!.saveUpdateToken(token));
                setToken('');
              } catch (e) {
                setStatus({
                  state: 'error',
                  message: (e as Error).message,
                  currentVersion: '1.0.2',
                  tokenStored: false,
                });
              }
            }}
          >
            Save GitHub access
          </button>
          <button
            className="button secondary"
            disabled={!status?.tokenStored}
            onClick={async () => setStatus(await window.launcher!.saveUpdateToken(''))}
          >
            Remove saved access
          </button>
        </div>
      </details>
    </section>
  );
}
