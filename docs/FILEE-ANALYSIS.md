# Filee → Orbit: product and interface analysis

## Reference and scope

Reference repository: https://github.com/KnifeLemon/Filee, inspected at commit `e830916e7f02526bff6b7576edc22e51ecf9c126`. Filee is an MIT-licensed .NET/Avalonia file converter. Its README describes a donut at the cursor, drag-and-drop customization, multiple faces, profiles, shortcuts, presets, and local processing. The repository contains screenshots of Home and the donut editor and the actual Avalonia UI definitions.

The website https://filee.sh/ returned an HTTP 403 CONNECT denial in this environment. No claim is made to have inspected its live interactive demo. This analysis uses the repository's README, screenshots, `MainWindow.axaml`, `Soft.axaml`, and Home, Theme, Toolbar page definitions instead.

## What carries over

| Filee | Orbit launcher |
| --- | --- |
| 230 px white settings sidebar | Same sidebar structure and navigation rhythm |
| Cream `#F6F5F1` page, lavender `#7F77DD` accent | Ported palette, dark counterpart, adjustable accent |
| Rounded white cards, Segoe UI typography | CSS implementation with configurable corner radius |
| Home drop zone and recent conversions | Favorite applications, app drop zone, recent launches |
| File-type profiles | Everyday / Work / custom application profiles |
| Conversion format slices | Desktop apps, shortcuts, folders, URLs, launch groups |
| Available preset palette | Searchable application palette with drag/drop and accessible add/remove buttons |
| Front/back donut faces | Paged donut, 4–12 entries per face, maximum 24 per profile |
| Conversion presets | Launch groups: ordered apps, delay, global shortcut |
| Theme editor with live preview | Soft/Material style, light/dark/system, accent, corners, opacity, motion |

Orbit adds app discovery from Windows Start Menu shortcuts, custom native icons, favorite flags, executable arguments as a literal array, working directories, JSON backup/import, and native group launches. It removes conversion engines, file-type routing, converter presets, and watch-folder conversion.

## Implementation choice

This repository was initially empty. Orbit ports the relevant interface into React/TypeScript, with Electron handling native desktop features. It does not transplant Filee's large conversion codebase or modify upstream Filee. This keeps the launcher dedicated to applications and gives the UI an independently testable browser preview. Original Filee source snippets and MIT attribution are retained in `docs/reference` and `THIRD-PARTY-NOTICES.md`.

This is a faithful design adaptation, not a pixel-identical clone. Home includes a richer launcher dashboard while the requested menus, colors, soft styling, and donut-editor workflow remain recognizable.

## Interaction principles

1. Explicit action launches an app; adding/importing a target never runs it.
2. Changes save automatically; editors use Save/Cancel.
3. Donut editing and native launching have separate contexts: click a slice in the editor to edit it; click it in the floating donut to launch.
4. Drag/drop has keyboard-friendly button alternatives. Modal dialogs trap focus, return focus on close, and support Escape.
5. Everything persists locally. Website entries open in the user's browser; Orbit itself has no account, remote data service, or telemetry.
