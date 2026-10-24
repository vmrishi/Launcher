# Development guide

## Architecture

The main settings window and the transparent floating donut load the same renderer bundle. `?donut=1` selects the floating UI. Both communicate through the allowlisted preload API. Node integration is disabled; context isolation and renderer sandboxing are enabled. New windows and renderer navigation are blocked.

The browser preview replaces native persistence with localStorage. It does not pretend to execute native launches. The main process validates every saved/imported config and only handles messages from the two owned main frames. Icons are embedded images, avoiding remote image loading and local path exposure in the renderer.

`Config` contains a version, entries, profiles, activeProfile, settings, and bounded history. Entries have stable IDs. A group contains IDs of ordinary entries; groups cannot contain groups. A profile contains entry IDs, including groups, up to 24. Removing an entry removes its profile references and group memberships; groups with no remaining members are removed too.

Writes from the settings UI are serialized. Native launch history is merged by the main process so a stale settings snapshot does not overwrite a just-completed launch record. Config updates broadcast to both windows. Runtime processes are not part of persistent settings.

## Native operation

- Executables: verify absolute path and file type, validate working directory, then spawn with an argument array, no shell, detached/ignored I/O, and unref after spawn.
- `.lnk` and `.url`: let Windows open the shortcut; no separate arguments/cwd are accepted.
- Folders: require an existing directory and use `shell.openPath`.
- Websites: restrict to HTTP/HTTPS and open externally.
- Groups: launch in order, optionally delay between entries, collect per-target errors, continue after failures.
- Global shortcuts: unregister/re-register transactionally when config changes; if a new shortcut fails, restore the previous registrations and settings. Shortcuts are released on application quit.
- Single instance: a second instance brings the existing settings window forward.

## Add a feature

1. Extend `src/types.ts`, the defaults, and `electron/schema.cjs` together.
2. Keep validation at the IPC boundary, not only in the React form.
3. Add a dedicated preload method rather than a generic command channel.
4. Keep browser preview behavior explicit when native APIs are unavailable.
5. Add a test for failure behavior as well as the normal user flow.
6. Run `npm run check`. For native-window checks, run `npm run test:desktop` with a display (Xvfb on Linux).

## Packaging

Electron-builder packages `dist`, the Electron main/preload modules, runtime dependencies, and notices. Do not put secrets into the source or configuration. Update the version in `package.json` for releases. Installer and portable targets are built for x64 Windows. The workflow builds artifacts on Windows; it does not publish automatically.

Cross-compilation can produce unsigned Windows packages on Linux; that does not validate Windows native integration. The final release checklist is in `VALIDATION.md`.
