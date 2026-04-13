# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a reverse engineering workspace. The current target is:

- **File**: `BuddyDock-1.0.3-ver.animals.dmg`
- **Type**: macOS disk image (zlib-compressed DMG)
- **Application**: BuddyDock v1.0.3 — a macOS dock/sidebar utility

No source code is present; all analysis starts from the compiled distribution artifact.

## Extracting the DMG

On Windows, 7-Zip can extract DMG contents directly:

```
7z x "BuddyDock-1.0.3-ver.animals.dmg"
```

On macOS, mount natively:

```
hdiutil attach "BuddyDock-1.0.3-ver.animals.dmg"
```

## Typical Analysis Entry Points

After extraction, the `.app` bundle structure to focus on:

- `Contents/MacOS/<binary>` — main Mach-O executable (primary RE target)
- `Contents/Info.plist` — bundle metadata, entitlements, URL schemes
- `Contents/Frameworks/` — embedded private frameworks and dylibs
- `Contents/Resources/` — assets, NIBs, localization strings

## Common RE Tooling

- **Ghidra** — static disassembly/decompilation of Mach-O binaries
- **class-dump / dsdump** — Objective-C class/method headers from a Mach-O
- **otool** — inspect load commands, linked libraries (`otool -L <binary>`)
- **strings** — quick surface scan for embedded literals
- **binwalk** — entropy analysis and embedded file detection

---

## BuddyDock Analysis & Windows Port (Completed)

BuddyDock is an **Electron + React 19 + Vite** app. Source code is inside `app.asar`.

### Produced documents

| File | Contents |
|---|---|
| `BuddyDock-產品說明書.md` | Full product spec: characters, features, data model, visual design, changelog |
| `BuddyDock-Windows移植逆向工程書.md` | Pre-analysis porting guide: IPC channels, component architecture, Windows differences |

### Windows port

Built output lives at: `C:\Users\lolz_\Desktop\Reverse Engineering\BuddyWindows\`  
See **`BuddyWindows\CLAUDE.md`** (in this folder) for:
- Exact build commands (including the mandatory `CSC_IDENTITY_AUTO_DISCOVERY=false`)
- The three code changes made to `main.cjs` for Windows
- Step-by-step upgrade process for future versions
- Full debug history (winCodeSign symlink issue + fix)

### Extracting app.asar

```bash
"/c/Program Files/7-Zip/7z.exe" x "BuddyDock-X.Y.Z.dmg" -o"dmg_raw" -y
npx @electron/asar extract "dmg_raw/BuddyDock/BuddyDock.app/Contents/Resources/app.asar" "asar_src"
```

Key files inside asar:
- `electron/main.cjs` — main process (Node.js, all IPC logic)
- `electron/preload.cjs` — contextBridge → exposes `window.electronAPI`
- `dist/assets/index-*.js` — bundled React app (~250 KB, minified)
- `dist/assets/*.png` — 46 animal sprite images (3 characters)
