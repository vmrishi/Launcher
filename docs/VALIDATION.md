# Validation and release notes

## Verified in the cloud workspace

Host: Debian 13 x64, Node.js 24.19.0, npm 11.9.0, Electron 40.10.6. Tests use Chromium and a locally extracted Debian Xvfb package for native Electron windows. Package downloads retained TLS and artifact/package verification.

| Check | Result |
| --- | --- |
| TypeScript check and Vite production bundle | Passed |
| Existing core test suite | 10 passed, 0 skipped |
| Browser integration suite | 9 passed, 0 skipped |
| Native Electron smoke workflow on Linux/Xvfb | Passed |
| Production browser bundle and three screenshots | Rendered without JavaScript errors |
| `npm audit --omit=dev --audit-level=high` | 0 production vulnerabilities reported |
| Windows x64 portable packaging | Generated successfully; unsigned |
| Windows NSIS installer cross-build | Blocked by Wine runtime; no incomplete installer retained |
| Real Windows install/uninstall and native integrations | Not run in this Linux environment |

The Electron smoke workflow verifies both real windows, a sandboxed/context-isolated preload, Node unavailable in the renderer, config validation over IPC, disk persistence after reload, an actual spawned process that writes a result file, launch history, synchronized theme, donut show/hide, and shortcut rollback after an induced registration failure.

Browser tests verify all requested navigation sections; add/edit/delete/search; app and theme persistence after reload; launch-group ordering and delays; profile CRUD; accessible donut add/remove; internal drop handling; actual mouse-driven slice reordering/removal; dropped URL entry creation; modal focus trapping; theme/style/motion; deletion reference cleanup; and narrow layouts.

## What packaging establishes

The portable EXE is a generated Windows artifact containing the production renderer, Electron runtime, native launch code, app metadata/icon, and licenses. It was not executed on a Windows desktop here. A packaged executable alone does not establish Windows runtime readiness.

NSIS packaging reached its uninstaller-generation stage but could not execute a working Wine helper. The bundled Wine 11 helper failed loading ntdll; a locally extracted Wine prerequisite also could not provide a working full runtime. This is a cross-build limitation, not a failing application test. The incomplete installer was removed. `npm run dist:win` and the Windows workflow build the installer on Windows without Wine.

## Windows validation before public release

Run `.github/workflows/windows.yml`, or run these commands locally:

```powershell
npm ci
npx playwright install chromium
npm run check
npm run test:desktop
npm run dist:win
```

Install Playwright's Chromium with `npx playwright install chromium` before UI tests when needed. Inspect the workflow results; its presence does not mean it has run.

Then check on an actual Windows 10/11 desktop:

1. Installer completes, creates the chosen shortcuts, launches Orbit, and uninstalls cleanly.
2. Portable EXE opens and shares the expected profile storage behavior.
3. Ctrl+Shift+Space opens the donut at the cursor and clamps it to each monitor's work area at mixed DPI.
4. Close-to-tray, tray menu, double-click settings, second-instance focus, and Quit behave correctly.
5. File pickers, `.exe/.com/.lnk/.url`, folder drops, Start Menu discovery, and custom icon loading work.
6. One-click groups launch the intended apps in order; a missing app is reported without stopping the group.
7. Conflicting shortcuts are rejected and the previous registrations remain active.
8. Sign-in startup and start-minimized behavior work after a real Windows sign-out/sign-in.
9. Import/export round trip preserves layouts and themes and does not execute imported targets.
10. Configure Windows code signing and validate the final signed artifacts before broad distribution.

No GitHub release was published, no source was pushed, and no Windows-specific behavior is represented as tested on this Linux host. The full source and a Windows build workflow are included for that next stage.
