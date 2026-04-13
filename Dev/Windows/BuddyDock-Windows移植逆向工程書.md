# BuddyDock Windows 版移植逆向工程書

> 基於 `BuddyDock-1.0.3-ver.animals.dmg` 逆向分析，指導如何重建一個功能等效的 Windows 版本

---

## 零、Windows 開發環境需求與已知問題

> **在進行任何 build 之前，請先確認本節環境與閱讀已知問題，可避免重複踩坑。**

### 0.1 確認版本（實測可用組合）

| 工具 | 版本 | 備註 |
|---|---|---|
| Node.js | v25.9.0 | 低版本可能有相容性問題 |
| npm | 隨 Node.js | 無特殊版本要求 |
| electron-builder | 25.1.8 | `package.json` devDependencies 已鎖定 |
| Electron | 35.7.5 | 由 electron-builder 自動下載 |
| 作業系統 | Windows 10 / 11 64-bit | 測試環境：Windows 11 Pro 10.0.26200 |

### 0.2 首次 build 前必做：安裝依賴

clone 或複製專案後，**第一次** 必須先執行：

```bash
cd Dev/Windows
npm install
```

`node_modules/` 不入 git，省略此步驟會導致 `electron-builder is not recognized` 錯誤。

### 0.3 已知問題：winCodeSign symlink 失敗

**症狀：**
```
ERROR: Cannot create symbolic link : A required privilege is not held by the client.
  : .../winCodeSign-2.6.0/darwin/10.12/lib/libcrypto.dylib
  : .../winCodeSign-2.6.0/darwin/10.12/lib/libssl.dylib
```

**原因：** electron-builder 下載 `winCodeSign-2.6.0.7z` 時，解壓內含 macOS dylib symlink，Windows 在非管理員 / 非開發者模式下不允許建立 symlink。

**修法（每台新機器只需做一次）：**

1. 先跑一次 build 讓它失敗（目的是讓 electron-builder 下載並部分解壓到 temp dir）
2. 查看 Cache 目錄，會有數字命名的 temp dir：
   ```bash
   ls "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/"
   # 例如：307447019  307447019.7z  554076343  554076343.7z ...
   ```
3. 複製其中一個 temp dir 為正式目錄名，並補建兩個空 stub 檔：
   ```bash
   cp -r "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/307447019" \
          "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0"
   touch "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0/darwin/10.12/lib/libcrypto.dylib"
   touch "$LOCALAPPDATA/electron-builder/Cache/winCodeSign/winCodeSign-2.6.0/darwin/10.12/lib/libssl.dylib"
   ```
4. 再次執行 `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist`，即可成功

> 此 fix 永久有效（Cache 不會自動清除），下次 build 無需重做。

### 0.4 已知問題：`dist/assets/` 遭 `.gitignore` 排除導致 build 產物缺少資源

**症狀：** 打包後的 EXE 執行時寵物不顯示，或開啟空白視窗。

**原因：** `electron-builder` 除了讀取專案目錄的 `.gitignore`，也會往上讀取**父目錄**的 `.gitignore`。若根目錄的 `.gitignore` 含有 `Dev/Windows/dist/assets/`（因為 macOS 開發時常將 dist/ 排除），`electron-builder` 打包時就會跳過這些圖片資源。

**修法：** 在 `Dev/Windows/` 目錄建立 `.electronignore` 檔案，告訴 `electron-builder` 只以此檔為準，忽略父目錄 `.gitignore`：

```
# Dev/Windows/.electronignore
node_modules/
release/
electron/icon.iconset/
electron/icon.icns
```

`.electronignore` 存在時，`electron-builder` 不再往上查找 `.gitignore`，`dist/assets/` 因此被正確納入打包。

> 此檔已建立並納入版本控制。升版移植時無需再處理。

---

### 0.5 Build 指令（必加環境變數）

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist
```

`CSC_IDENTITY_AUTO_DISCOVERY=false` 是必要的。省略會觸發 **0.3** 的 winCodeSign 問題。

### 0.6 已知問題：失焦時出現 DWM caption overlay（完整 debug 紀錄）

**症狀：** app 失去焦點後，視窗頂部出現淺白/淺藍色標題列，顯示「BuddyDock」文字。

**根本原因：**  
Windows 11 DWM 在 `transparent: true` + `frame: false` 組合下，底層仍保留 `WS_THICKFRAME`（DWM 合成器需要此 bit 才能渲染透明視窗）。當視窗從 active → inactive 時，DWM 會繪製 non-client area（caption badge）。Caption 的出現本質上是**焦點轉換**觸發的，不是 window style 直接決定的。

---

#### 嘗試過但失敗的方法

| 方法 | 結果 | 原因 |
|---|---|---|
| `thickFrame: false`（BrowserWindow 選項） | **寵物完全消失** | Electron 透過此 option 移除 `WS_THICKFRAME`，DWM 將 client area 計算為 0，renderer 畫面不顯示 |
| `win.setTitle('')` | 無效 | `page-title-updated` 事件攔截後仍無法影響 DWM caption 繪製 |
| `type: 'toolbar'` + `frame: false` | 無效 | Electron 文件明確指出兩者不能同時使用，`type` 被靜默忽略 |
| `DwmSetWindowAttribute(DWMWA_CAPTION_COLOR, DWMWA_COLOR_NONE)` | 無效 | 此 API 僅還原 caption 顏色至系統預設，不會隱藏 caption |
| `SetWindowTheme(hwnd, '', '')` 單獨使用 | 無效 | 移除 visual theme，但 DWM caption 繪製由焦點轉換控制，不受 theme 影響 |
| 透過 `SetWindowLongW` 移除 `WS_MAXIMIZEBOX / WS_MINIMIZEBOX / WS_SYSMENU` | 無效（單獨使用） | Debug log 確認：原始 `GWL_STYLE = 0x14030000`，清除後 `0x14000000`。Caption 依然出現 |

**Debug log（失敗階段）：**
```
koffi: OK
hwnd: 5639042
GWL_STYLE before: 0x14030000
GWL_STYLE after:  0x14000000
GWL_EXSTYLE before: 0x00000008   ← WS_EX_TOPMOST only
```

---

#### 有效修法：`WS_EX_NOACTIVATE`

**關鍵洞察：** Caption badge 是「視窗成為 active window」後失去焦點時出現的。若視窗從未成為 active window，DWM 就不會繪製 caption。

**解法：** 透過 `koffi`（pure-JS FFI library，不需編譯原生模組）呼叫 Win32 API，在 Extended Window Style 加入 `WS_EX_NOACTIVATE (0x08000000)`：

```js
const koffi   = require('koffi')
const user32  = koffi.load('user32.dll')
const uxtheme = koffi.load('uxtheme.dll')

const GetWindowLongW = user32.func('int GetWindowLongW(uint64 hWnd, int nIndex)')
const SetWindowLongW = user32.func('int SetWindowLongW(uint64 hWnd, int nIndex, int dwNewLong)')
const SetWindowPos   = user32.func('int SetWindowPos(uint64 hWnd, uint64 hWndAfter, int x, int y, int cx, int cy, uint32 uFlags)')
const SetWindowTheme = uxtheme.func('int SetWindowTheme(uint64 hwnd, str16 pszSubAppName, str16 pszSubIdList)')

const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0)

// 加入 WS_EX_NOACTIVATE，並呼叫 SetWindowPos 套用變更
const ex = GetWindowLongW(hwnd, -20)
SetWindowLongW(hwnd, -20, ex | 0x08000000)
SetWindowPos(hwnd, BigInt(0), 0, 0, 0, 0, 0x0037)   // SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER
SetWindowTheme(hwnd, '', '')                          // 停用 visual theme（清除殘留 DWM 繪製）
```

**Debug log（成功後）：**
```
koffi: OK
hwnd: 12586784
GWL_STYLE before: 0x14030000
GWL_STYLE after:  0x14000000
GWL_EXSTYLE before: 0x00000008   ← WS_EX_TOPMOST
GWL_EXSTYLE after:  0x08000008   ← WS_EX_TOPMOST + WS_EX_NOACTIVATE
```
結果：**「caption 消失了！」**✓

---

#### 邊緣情形：設定面板輸入框

**問題：** `WS_EX_NOACTIVATE` 防止大多數互動觸發焦點，但 Chromium 在 input/textarea 獲得游標時，內部會呼叫 `SetFocus()` / `SetActiveWindow()` 繞過此 style。結果：輸入框仍可正常使用，但完成輸入後點擊其他視窗時，caption 短暫出現。

**解法：** 在 `blur` / `focus` 事件中動態管理 WS_EX_NOACTIVATE：

```js
const applyNoActivate = () => {
  const ex = GetWindowLongW(hwnd, -20)
  SetWindowLongW(hwnd, -20, ex | 0x08000000)
  SetWindowPos(hwnd, BigInt(0), 0, 0, 0, 0, 0x0037)
}

// blur 時立即 re-apply，badge 一出現就消失
win.on('blur', applyNoActivate)

// focus 時若沒有 input 在作用中（非輸入點擊），立即 blur
win.on('focus', () => {
  setTimeout(async () => {
    if (win.isDestroyed()) return
    try {
      const inputActive = await win.webContents.executeJavaScript(
        '(document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA")'
      )
      if (!inputActive) win.blur()
    } catch (_) {}
  }, 50)
})
```

**結果：** 輸入框正常可用；點擊其他視窗時 caption badge 消失。✓

---

#### 相依套件

此修法需要 `koffi`（pure-JS Win32 FFI，不需編譯 native addon）：

```bash
npm install koffi
```

已加入 `package.json` 的 `dependencies`（非 devDependencies，因為 runtime 需要）。

> 升版移植時，此整個 `try { ... }` 區塊必須完整保留在 `electron/main.cjs` 中。

---

## 一、可行性評估

BuddyDock 的技術底層是 **Electron + React**，這是一個完全跨平台的組合。macOS 版本的限制僅在於：

| 限制點 | macOS 原版 | Windows 移植替代方案 |
|---|---|---|
| 開機自啟動 | `app.setLoginItemSettings()` macOS Login Items | 同一 Electron API，Windows 寫入 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` |
| 系統通知 | macOS Notification Center | Windows Action Center（Electron `Notification` API 相同） |
| Tray 圖示 | `icon.setTemplateImage(true)`（macOS 深/淺色） | 移除 `setTemplateImage`，直接使用 PNG 即可 |
| 透明視窗 | 依賴 macOS 合成器 | Windows 10+ 完整支援 `transparent: true` |
| 原生框架 | ReactiveObjC, Squirrel, Mantle | 不需要（這些是 macOS 原生層，app 邏輯不依賴它們） |
| 字型 | Noto Sans TC 內嵌 | 需確認 Windows 上字型可用，或透過 CSS 內嵌 |

**結論**：核心 JavaScript 邏輯幾乎 100% 可直接複用，移植難度極低。

---

## 二、技術棧分析

從 `app.asar` 提取後的目錄結構：

```
app.asar (解壓後)
├── package.json           # Electron 入口宣告
├── electron/
│   ├── main.cjs           # 主進程（Node.js）
│   ├── preload.cjs        # 預載腳本（contextBridge）
│   ├── tray.png           # 系統匣圖示
│   └── icon.iconset/      # 各尺寸應用程式圖示
├── dist/                  # Vite 建置產物（renderer）
│   ├── index.html
│   ├── favicon.svg
│   ├── icons.svg
│   └── assets/
│       ├── index-*.js     # React 應用（單一 bundle，~250 KB）
│       ├── index-*.css    # 樣式
│       └── *.png          # 角色動畫圖集
└── node_modules/
    ├── react/
    └── react-dom/
```

**`package.json`（原版）**
```json
{
  "name": "playground-mini-tool",
  "private": true,
  "version": "1.0.3",
  "type": "module",
  "main": "electron/main.cjs",
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  }
}
```

**建置工具**：Vite（輸出帶 content-hash 的 bundle）

---

## 三、主進程邏輯詳解（`electron/main.cjs`）

### 3.1 全域狀態

```js
let appLists = []           // 語錄清單陣列
let activeListIds = []      // 當前啟用的清單 IDs
let reminderTimer = null    // 定時提醒的 setInterval 控制
let tray = null
let currentPetId = 'black-cat'
let quietHoursEnabled = false
let quietStart = '22:00'
let quietEnd = '08:00'
let scheduledReminders = []
let scheduledTimer = null   // 日程掃描用 setInterval
```

### 3.2 視窗建立

```js
new BrowserWindow({
  width: 220,
  height: 320,
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  hasShadow: false,
  resizable: false,
  skipTaskbar: true,   // 不出現在工作列
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.cjs'),
  },
})
```

**初始位置**：右下角（`workAreaSize.width - 240, workAreaSize.height - 340`）

### 3.3 拖曳限制算法

允許視窗半個身子探出螢幕左右邊緣，但頂部完全夾住：

```js
const sideMargin = Math.floor(w / 2)
const nx = clamp(workArea.x - sideMargin, workArea.x + workArea.width - sideMargin, x + deltaX)
const ny = clamp(workArea.y, workArea.y + workArea.height - sideMargin, y + deltaY)
```

### 3.4 靜音時段判斷

支援跨午夜：

```js
function isQuietTime() {
  const cur = now.getHours() * 60 + now.getMinutes()
  if (start <= end) return cur >= start && cur < end        // 同一天
  return cur >= start || cur < end                          // 跨午夜
}
```

### 3.5 日程提醒掃描

對齊到下一分鐘整點後，每 60 秒掃描一次：

```js
const msToNextMin = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
setTimeout(() => {
  checkScheduledReminders(win)
  scheduledTimer = setInterval(() => checkScheduledReminders(win), 60_000)
}, msToNextMin)
```

### 3.6 IPC 通道一覽

| 通道 | 方向 | 說明 |
|---|---|---|
| `window-drag` | Renderer → Main | `{deltaX, deltaY}` 拖曳差值 |
| `window-close` | Renderer → Main | 退出應用 |
| `show-context-menu` | Renderer → Main | 彈出右鍵選單 |
| `resize-window` | Renderer → Main | 調整視窗高度（height: number） |
| `sync-data` | Renderer → Main | 同步完整狀態（清單、提醒設定等） |
| `set-login-item` | Renderer → Main | 開啟/關閉開機自啟（boolean） |
| `sync-pet` | Renderer → Main | 同步角色 ID |
| `get-login-item` | Renderer ↔ Main（invoke） | 查詢當前開機自啟狀態 |
| `export-lists` | Renderer ↔ Main（invoke） | 開啟儲存對話框，寫出 JSON |
| `import-lists` | Renderer ↔ Main（invoke） | 開啟開啟對話框，讀取 JSON |
| `open-settings` | Main → Renderer | 開啟設定面板 |
| `open-about` | Main → Renderer | 開啟關於頁 |
| `open-guide` | Main → Renderer | 開啟說明書頁 |
| `scheduled-reminder` | Main → Renderer | 日程提醒觸發，傳遞提醒文字 |
| `toggle-list` | Main → Renderer | 切換清單啟用狀態（listId） |
| `reminder-tick` | Main → Renderer | 定時提醒觸發（listId） |
| `switch-pet` | Main → Renderer | 切換角色（petId） |

---

## 四、Preload 腳本（`electron/preload.cjs`）

透過 `contextBridge.exposeInMainWorld` 將 `window.electronAPI` 暴露給 React：

```js
window.electronAPI = {
  dragWindow:      (delta) => ipcRenderer.send('window-drag', delta),
  closeWindow:     () => ipcRenderer.send('window-close'),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  resizeWindow:    (height) => ipcRenderer.send('resize-window', height),
  syncData:        (payload) => ipcRenderer.send('sync-data', payload),
  getLoginItem:    () => ipcRenderer.invoke('get-login-item'),
  setLoginItem:    (enable) => ipcRenderer.send('set-login-item', enable),
  exportLists:     (lists) => ipcRenderer.invoke('export-lists', lists),
  importLists:     () => ipcRenderer.invoke('import-lists'),
  syncPet:         (petId) => ipcRenderer.send('sync-pet', petId),
  onOpenSettings:      (cb) => ipcRenderer.on('open-settings', cb),
  onOpenAbout:         (cb) => ipcRenderer.on('open-about', cb),
  onOpenGuide:         (cb) => ipcRenderer.on('open-guide', cb),
  onScheduledReminder: (cb) => ipcRenderer.on('scheduled-reminder', cb),
  onToggleList:        (cb) => ipcRenderer.on('toggle-list', cb),
  onReminderTick:      (cb) => ipcRenderer.on('reminder-tick', cb),
  onSwitchPet:         (cb) => ipcRenderer.on('switch-pet', cb),
}
```

---

## 五、Renderer 架構（React）

### 5.1 資料層

- **持久化**：`localStorage`
  - 主資料 key：`buddydock-animals-v1`
  - 角色選擇 key：`buddydock-pet`
- **載入**：`ve()` 函式 — 讀取 localStorage，合併預設值
- **儲存**：`ye(state)` 函式 — 序列化整個 state 寫入 localStorage

### 5.2 角色元件映射

```js
const PET_LIST = [
  { id: 'black-cat',  name: 'Black Cat',  component: BlackCatComponent  },
  { id: 'maltese',    name: 'Maltese',    component: MalteseComponent   },
  { id: 'shimaenaga', name: 'Shimaenaga', component: ShimaenagaComponent},
]
```

### 5.3 單字記憶頻率演算法

降低已熟悉單字的出現頻率：

```js
function pickWord(wordIds, seenCounts) {
  const maxSeen = Math.max(...wordIds.map(id => seenCounts[id] ?? 0))
  const weights = wordIds.map(id => Math.max(1, maxSeen - (seenCounts[id] ?? 0) + 1))
  // 加權隨機抽選
  // 每個單字最多記錄 10 次（上限）
}
```

### 5.4 泡泡邊緣定位邏輯

透過 `window.innerWidth` 和視窗位置計算泡泡應顯示在左方還是右方，避免泡泡超出螢幕邊界。

### 5.5 設定面板 Tab 結構

```
Settings
├── Tab: lists       → 清單管理
├── Tab: interaction → 互動設定
└── Tab: schedule    → 日程提醒
```

---

## 六、Windows 移植步驟

### 步驟 1：建立專案骨架

```bash
mkdir BuddyDock-Windows && cd BuddyDock-Windows
npm init -y
npm install electron react react-dom
npm install -D vite @vitejs/plugin-react electron-builder
```

推薦目錄結構（與原版一致）：

```
BuddyDock-Windows/
├── package.json
├── vite.config.js
├── electron/
│   ├── main.cjs      # 從原版複製並修改
│   └── preload.cjs   # 從原版直接複製
├── src/              # React 原始碼（需反混淆重建）
│   ├── main.jsx
│   ├── App.jsx
│   └── ...
└── public/
    └── assets/       # 動物圖片（從 asar 複製）
```

### 步驟 2：直接複製可用資源

以下資源可從解壓的 asar 直接複製，**無需修改**：

- `electron/preload.cjs` — 完全跨平台，可直接使用
- `dist/assets/*.png` — 所有動物圖片（46 張）
- `dist/assets/index-*.css` — 樣式表
- `dist/icons.svg` / `dist/favicon.svg`

### 步驟 3：修改主進程（`electron/main.cjs`）

需要針對 Windows 做的修改：

#### 3a. 移除 macOS 專用的 Tray 選項

```js
// 原版（macOS 限定）
icon.setTemplateImage(true)

// Windows 版本：直接移除這行，使用 PNG 即可
const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
tray = new Tray(icon)
```

#### 3b. 調整 Tray 事件（Windows 左鍵單擊行為不同）

```js
// Windows 上 Tray 左鍵單擊不直接觸發，改用 double-click 或保留 click
tray.on('double-click', () => {
  if (win.isVisible()) win.focus()
  else win.show()
})
```

#### 3c. 開機自啟動（`set-login-item`）

Electron 的 `app.setLoginItemSettings` 在 Windows 上同樣有效，直接操作 `HKCU` 登錄機碼：

```js
// 無需修改，Electron API 已處理跨平台
app.setLoginItemSettings({ openAtLogin: enable })
```

#### 3d. 視窗定位（Windows 工作列通常在底部）

```js
const { workArea } = screen.getPrimaryDisplay()
// 原版邏輯在 Windows 上仍然適用，workArea 已排除工作列
win.setPosition(workArea.x + workArea.width - 240, workArea.y + workArea.height - 340)
```

#### 3e. 透明視窗在 Windows 的額外設定

部分 Windows 版本需要加上 `backgroundColor`：

```js
new BrowserWindow({
  // ...原有設定...
  transparent: true,
  backgroundColor: '#00000000',  // 新增：確保 Windows 正確處理透明
})
```

### 步驟 4：Vite 設定

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',           // 關鍵：Electron 載入本地檔案需要相對路徑
  build: {
    outDir: 'dist',
  },
})
```

### 步驟 5：重建 React 前端

由於原版 JS bundle 已被 Vite 最小化混淆，需根據分析結果重建原始碼。以下是各主要模組的重建要點：

#### 5a. 根元件 `App.jsx`

```jsx
// 關鍵初始化邏輯
const [petId, setPetId] = useState(() => 
  localStorage.getItem('buddydock-pet') ?? 'black-cat'
)
const [state, setState] = useState(() => loadState())

// 電子橋接初始化（僅在 Electron 環境）
const isElectron = typeof window !== 'undefined' && 'electronAPI' in window

useEffect(() => {
  if (!isElectron) return
  window.electronAPI.onSwitchPet((_, id) => {
    setPetId(id)
    localStorage.setItem('buddydock-pet', id)
  })
  window.electronAPI.onReminderTick((_, listId) => { /* 換句 */ })
  window.electronAPI.onScheduledReminder((_, text) => { /* 顯示泡泡 */ })
  window.electronAPI.onOpenSettings(() => { /* 開啟設定 */ })
  // ...
}, [])
```

#### 5b. 資料持久化 hook

```js
const STORAGE_KEY = 'buddydock-animals-v1'
const PET_KEY = 'buddydock-pet'

const DEFAULT_STATE = {
  lists: [
    { id: 'health', name: '健康提醒', quotes: ['站起來走走吧💗', ...] },
    { id: 'work', name: '上班語錄', quotes: ['工作沒有一杯水重要', ...] },
  ],
  activeListIds: ['work'],
  favorites: [],
  favoritesOnly: false,
  autoSwitch: false,
  autoSwitchMinutes: 10,
  reminderEnabled: false,
  reminderListId: 'health',
  reminderIntervalMinutes: 60,
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '08:00',
  fontSize: 'medium',
  scheduledReminders: [],
  seenCounts: {},
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
```

#### 5c. 單字頻率選取演算法

```js
function pickByWeight(wordIds, seenCounts) {
  if (wordIds.length === 1) return wordIds[0]
  const maxSeen = Math.max(...wordIds.map(id => seenCounts[id] ?? 0))
  const weights = wordIds.map(id => Math.max(1, maxSeen - (seenCounts[id] ?? 0) + 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (let i = 0; i < wordIds.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return wordIds[i]
  }
  return wordIds[wordIds.length - 1]
}

function recordSeen(seenCounts, wordId) {
  const current = seenCounts[wordId] ?? 0
  return { ...seenCounts, [wordId]: Math.min(10, current + 1) } // 上限 10
}
```

### 步驟 6：圖示資源準備（Windows）

Windows 打包需要 `.ico` 格式的圖示。從 `electron/icon.iconset/` 中取出 PNG 後轉換：

```bash
# 使用 ImageMagick
convert icon_256x256.png icon_256x256@2x.png icon_128x128.png icon_32x32.png icon_16x16.png icon.ico
```

或使用線上工具（如 convertio.co）將 `icon_256x256@2x.png` 轉為 `icon.ico`。

### 步驟 7：打包設定

**`package.json`（Windows 版）**

```json
{
  "name": "buddydock",
  "version": "1.0.3",
  "main": "electron/main.cjs",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron": "electron .",
    "package": "npm run build && electron-builder"
  },
  "build": {
    "appId": "com.jessica.buddydock",
    "productName": "BuddyDock",
    "win": {
      "icon": "electron/icon.ico",
      "target": "nsis"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    },
    "files": [
      "dist/**",
      "electron/**",
      "node_modules/**"
    ]
  },
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "electron": "^35.0.0",
    "electron-builder": "^25.0.0"
  }
}
```

---

## 七、Windows 特有注意事項

### 7.1 透明視窗閃爍

Windows 上透明 Electron 視窗在某些 GPU 驅動下可能閃爍。解法：

```js
new BrowserWindow({
  transparent: true,
  backgroundColor: '#00000000',
  // 在 win32 上加這個可改善
  ...(process.platform === 'win32' && { vibrancy: undefined }),
})
```

### 7.2 Tray 圖示模板色

macOS 的 `setTemplateImage(true)` 讓系統自動反轉顏色以配合深/淺色。Windows 沒有此功能，需準備一個在深色背景上清晰可見的圖示（建議白色或淺色圖示，16×16 PNG）。

### 7.3 右鍵選單的 `popup()`

在 Windows 上，Tray 的 `right-click` 事件觸發方式與 macOS 一致，但 `tray.popUpContextMenu()` 在部分版本有 bug，可改用：

```js
tray.on('right-click', () => {
  tray.popUpContextMenu(buildTrayMenu())
})
```

### 7.4 `skipTaskbar` 行為

Windows 上 `skipTaskbar: true` 效果相同，視窗不會出現在工作列，但仍可從 Tray 呼叫。

### 7.5 `alwaysOnTop` 層級

若使用者有全螢幕應用程式，`alwaysOnTop` 在 Windows 上預設無法穿越全螢幕。可選：

```js
win.setAlwaysOnTop(true, 'screen-saver')  // 最高層級
```

### 7.6 字型可用性

Noto Sans TC 在 Windows 上不一定預裝。可在 CSS 中補充 fallback：

```css
font-family: "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", system-ui, sans-serif;
```

或將字型檔案一起打包進 asar。

---

## 八、直接執行（不重建前端）

若只需要讓原版 dist bundle 在 Windows 上運行，而不重建 React 原始碼，可採用以下最簡移植路徑：

1. 解壓 `app.asar`
2. 複製整個解壓目錄
3. 只修改 `electron/main.cjs`（移除 `setTemplateImage`、調整 Tray 事件）
4. 在目錄內執行：
   ```bash
   npm install electron --save-dev
   npx electron .
   ```
5. 打包：
   ```bash
   npx electron-builder --win
   ```

> **注意**：此方式跳過原始碼重建，直接使用混淆的 bundle，可運作但不可修改前端邏輯。

---

## 九、資源清單

從 `app.asar` 可直接取得的所有動物圖片：

| 角色 | 圖片文件 |
|---|---|
| Black Cat | `BlackCat_alert.png`, `BlackCat_calm.png`, `BlackCat_idle.png`, `BlackCat_relax.png`, `BlackCat_scared1.png`, `BlackCat_scared2.png`, `BlackCat_sleepy.png` |
| Maltese | `Maltese_angry.png`, `Maltese_flower.png`, `Maltese_happy.png`, `Maltese_idle.png`, `Maltese_smile.png`, `Maltese_tongue.png`, `Maltese_wink.png` |
| Shimaenaga | `Shimaenaga_cold.png`, `Shimaenaga_cup.png`, `Shimaenaga_cup2.png`, `Shimaenaga_excited.png`, `Shimaenaga_grumpy.png`, `Shimaenaga_heart.png`, `Shimaenaga_love.png`, `Shimaenaga_peek.png`, `Shimaenaga_side.png`, `Shimaenaga_sleep.png`, `Shimaenaga_walk.png` |

（原始碼中的 content-hash 後綴在 build 時重新生成，參考 hash 值無需保留）
