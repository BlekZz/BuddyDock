# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Windows port of **BuddyDock v1.0.3** (macOS virtual pet desktop app).  
Source: `C:\Users\lolz_\Desktop\Reverse Engineering\BuddyDock-1.0.3-ver.animals.dmg`  
Produced from: extracted `app.asar` inside the DMG → adapted for Windows.

Tech stack: **Electron 35 + React 19 (pre-built Vite bundle)** — no frontend rebuild needed.

---

## Project Structure

```
BuddyWindows/
├── electron/
│   ├── main.cjs          ← Windows-modified main process (only changed file vs original)
│   ├── preload.cjs       ← copied verbatim from asar
│   ├── tray.png          ← system tray icon (16×16 works on Windows as-is)
│   └── icon.iconset/     ← source PNGs (used during build only)
├── dist/                 ← pre-built React renderer (copied verbatim from asar)
│   ├── index.html
│   └── assets/           ← bundled JS, CSS, all 46 animal PNGs
├── build/
│   └── icon.png          ← 512×512 PNG (electron-builder converts to ICO)
├── package.json
└── release/              ← build output (git-ignored)
    ├── BuddyDock-1.0.3-portable.exe   (85 MB, run without install)
    └── BuddyDock-1.0.3-setup.exe      (85 MB, one-click silent installer)
```

---

## Build Commands

```bash
# Install dependencies (first time only — downloads Electron ~120 MB)
npm install

# Build both portable EXE + NSIS installer  ← THIS IS THE WORKING COMMAND
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist

# Output: release/BuddyDock-1.0.3-portable.exe
#         release/BuddyDock-1.0.3-setup.exe
```

> **`CSC_IDENTITY_AUTO_DISCOVERY=false` is mandatory.** Without it, electron-builder
> attempts to download and extract `winCodeSign-2.6.0.7z`, which contains macOS
> symlinks (libcrypto.dylib / libssl.dylib) that fail to create on Windows without
> admin privileges. This env var tells electron-builder there is no code-signing
> certificate, skipping the Authenticode signing step.

---

## Porting Changes from macOS Original (`electron/main.cjs`)

Only three changes were made. Everything else was copied verbatim.

| Line | Change | Reason |
|---|---|---|
| Tray creation | Removed `icon.setTemplateImage(true)` | macOS-only API; throws on Windows |
| BrowserWindow | Added `backgroundColor: '#00000000'` | Transparent windows on Windows need explicit transparent background colour |
| alwaysOnTop | Changed to `win.setAlwaysOnTop(true, 'screen-saver')` | Raises the window above full-screen apps on Windows |

---

## Upgrading to a New BuddyDock Version

When a new macOS `.dmg` appears, the Windows port process is:

### Step 1 — Extract app contents

```bash
# Extract DMG (7-Zip at C:\Program Files\7-Zip\7z.exe on this machine)
"/c/Program Files/7-Zip/7z.exe" x "BuddyDock-X.Y.Z.dmg" -o"dmg_raw" -y

# Extract asar (Node.js must be available)
npx @electron/asar extract "dmg_raw/BuddyDock/BuddyDock.app/Contents/Resources/app.asar" "asar_src"
```

### Step 2 — Sync changed files

```bash
# Replace renderer and static assets (always do this)
rm -rf dist && cp -r asar_src/dist ./dist

# Replace preload (do this unless you've made local changes)
cp asar_src/electron/preload.cjs electron/preload.cjs

# Sync tray icon if changed
cp asar_src/electron/tray.png electron/tray.png

# Sync app icon
cp asar_src/electron/icon.iconset/icon_256x256@2x.png build/icon.png
```

### Step 3 — Merge `electron/main.cjs` changes

**Do NOT blindly overwrite `electron/main.cjs`.** Instead:
1. Open `asar_src/electron/main.cjs` and compare with `electron/main.cjs`
2. Apply any new features/fixes from the original
3. Preserve the three Windows-specific modifications (see table above)

### Step 4 — Update version and rebuild

```bash
# Update version in package.json to match new release
# Then rebuild:
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist
```

---

## Known Issues & Debug History (v1.0.3 Port)

### Issue 1: winCodeSign extraction fails with "Cannot create symbolic link"

**Symptom:**
```
⨯ cannot execute cause=exit status 2
ERROR: Cannot create symbolic link : A required privilege is not held by the client.
  : .../winCodeSign-2.6.0/darwin/10.12/lib/libcrypto.dylib
  : .../winCodeSign-2.6.0/darwin/10.12/lib/libssl.dylib
```
electron-builder retries 4 times then fails.

**Root cause:**  
electron-builder downloads `winCodeSign-2.6.0.7z` (contains cross-platform signing tools including macOS dylibs with symlinks). Windows does not allow creating symlinks without the "Create Symbolic Links" privilege (requires admin or Developer Mode).

**Fix applied:**
1. electron-builder actually extracts most of the archive successfully (rcedit-x64.exe, Windows signing tools all present). Only the two macOS dylib symlinks fail.
2. The 4 failed extraction attempts are left in the cache as numbered temp dirs (e.g. `268073231/`, `434085075/`).
3. Copy one of them to the expected name and stub the missing files:

```bash
cp -r "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/268073231" \
       "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0"
touch "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0/darwin/10.12/lib/libcrypto.dylib"
touch "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0/darwin/10.12/lib/libssl.dylib"
```

4. Re-run with `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist`

**On a fresh machine** (no cache at all), run the build once to let it fail and populate the temp dirs, then apply the fix above before retrying.

> If the cache has already been fixed from a previous build, subsequent builds will
> succeed immediately without needing this step again.

---

### Issue 2: NSIS download also needed (handled automatically)

After winCodeSign is fixed, electron-builder also downloads:
- `nsis-3.0.4.1.7z` (~1.3 MB) — the NSIS compiler
- `nsis-resources-3.4.1.7z` (~731 KB) — NSIS installer resources

Both download cleanly (no symlinks). This is automatic and requires no intervention.

---

## electron-builder Version Notes

Tested and confirmed working:
- **electron-builder**: `25.1.8`
- **electron**: `35.7.5` (downloaded automatically)
- **Node.js**: `v25.9.0`
- **Platform**: Windows 11 Home 10.0.26200

Icon format: provide `build/icon.png` (512×512 PNG). electron-builder auto-converts to ICO for Windows. No external converter needed.
