# BuddyDock 產品開發說明書

> 版本：1.0.3 ｜ 開發者：Jessica Jarvis ｜ © 2026 BuddyDock

---

## 一、產品概覽

| 欄位 | 內容 |
|---|---|
| 產品名稱 | BuddyDock |
| 版本 | 1.0.3（ver.animals 組建） |
| Bundle ID | `com.jessica.buddydock` |
| 技術底層 | Electron + React 19 + Vite |
| 主平台 | macOS 12.0 Monterey 以上 |
| 次平台 | Windows 10 / 11 64-bit（移植版） |

BuddyDock 是一款常駐桌面的虛擬寵物應用程式。動物角色以透明浮窗形式停留在螢幕角落，透過說話泡泡顯示使用者自訂的語錄、單字或提醒，並在固定時間發送系統通知。

---

## 二、開發原則與規則

### 2.1 平台定位

| 平台 | 定位 | 說明 |
|---|---|---|
| **macOS** | 主動開發平台 | 所有新功能、設計迭代皆在 Mac 端進行 |
| **Windows** | 移植平台 | 不主動開發；跟隨 Mac 版完成後進行移植轉檔 |

**原則：Mac 完成 → Windows 移植 → 同步發佈。** 不接受僅在 Windows 端進行的獨立功能開發。

### 2.2 版本分離規則

- Mac 與 Windows 版本號保持一致（例如 v1.0.3）
- Mac 版本為「原始版本」；Windows 版本為「移植版本」，不額外遞增版號
- 若 Windows 移植出現 bug 修正，視為同版本的 patch，不另立版號，記錄於版本更新紀錄備註欄

### 2.3 跨平台相容性規範（開發時強制遵守）

開發 Mac 端時，**禁止**使用以下類型的 API 或功能，避免後續 Windows 移植困難：

| 禁止項目 | 原因 | 替代方案 |
|---|---|---|
| `nativeImage.setTemplateImage(true)` | macOS 專用，Windows 無此 API | 直接使用 PNG 圖示，不呼叫此方法 |
| macOS 原生選單 `systemPreferences` API | 部分 API 在 Windows 不存在 | 使用 Electron 跨平台 API |
| `app.dock.*` 系列 API | macOS Dock 專用 | 以 `if (process.platform === 'darwin')` 包裹，Windows 不執行 |
| `window.vibrancy` | macOS 毛玻璃效果，Windows 不支援 | 以 `backgroundColor` 搭配半透明色值替代 |
| macOS 原生字型名稱（如 `San Francisco`） | Windows 無此字型 | 使用 `system-ui` 或 `Noto Sans TC` 等跨平台字型 |
| 硬編碼的 macOS 路徑（`~/Library/...`） | 路徑結構不同 | 使用 `app.getPath()` 取得跨平台路徑 |

**原則：若某功能只有 macOS 才有，必須用 `process.platform === 'darwin'` 條件包裹，確保 Windows 可安全跳過。**

### 2.4 透明視窗注意事項

Windows 的透明視窗需要額外設定，開發時請確保：

```js
// BrowserWindow 建立時必須同時包含以下設定
{
  transparent: true,
  frame: false,
  backgroundColor: '#00000000',   // Windows 需要此項，否則透明區域顯示黑色
}
```

**⚠️ 禁止加入 `thickFrame: false`：** 此選項雖然可在部分 Electron 文件中看到，但在 `transparent: true` 組合下會導致 DWM 將 client area 計算為 0——renderer 畫面完全不顯示（寵物消失）。Windows 端的 DWM caption overlay 問題需透過 `WS_EX_NOACTIVATE` Win32 patch 解決，見開發手冊 0.6 節。

### 2.5 alwaysOnTop 設定

```js
// Windows 需要指定 level，才能覆蓋全螢幕應用
win.setAlwaysOnTop(true, 'screen-saver')  // 跨平台安全寫法
// 不要用：win.setAlwaysOnTop(true)       // 在 Windows 全螢幕下會被壓在下方
```

---

## 三、完整開發工作流程

```
Mac 開發
  └─ 功能開發 / 測試 / 確認
       └─ 打包 Mac 版（.dmg）
            └─ Windows 移植（更新 Dev/Windows/ 內容）
                 └─ 打包 Windows 版（.exe）
                      └─ 複製到 Release/
                           └─ rclone 上傳 Google Drive
                                └─ 更新 README 下載連結
                                     └─ git commit + push
```

### 步驟一：Mac 端開發完成，打包 DMG

```bash
# macOS 上執行
npm run build       # 編譯 React（產出 dist/）
npm run dist:mac    # electron-builder 打包 DMG
```

輸出：`release/BuddyDock-X.Y.Z-ver.animals.dmg`

### 步驟二：Windows 移植

> **必讀：** 開始前請先閱讀 `Dev/Windows/BuddyDock-Windows移植逆向工程書.md` **第零章**，其中記錄了 Windows 開發環境需求、已知的 build 問題與修法（winCodeSign symlink 錯誤、DWM caption overlay 等）。省略此步驟容易在 build 階段重複踩坑。

參閱 `Dev/Windows/CLAUDE.md` 的詳細移植步驟，核心流程：

```bash
# 1. 解壓新版 DMG，取出 app.asar
"/c/Program Files/7-Zip/7z.exe" x "BuddyDock-X.Y.Z.dmg" -o"dmg_raw" -y
npx @electron/asar extract "dmg_raw/BuddyDock/BuddyDock.app/Contents/Resources/app.asar" "asar_src"

# 2. 同步 renderer 和靜態資源
rm -rf Dev/Windows/dist && cp -r asar_src/dist Dev/Windows/dist

# 3. 合併 main.cjs（保留三處 Windows 修改，見下方說明）

# 4. 打包 Windows EXE
cd Dev/Windows
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist
```

**Windows 端必須保留的修改（勿覆蓋）：**

| 位置 | 修改內容 | 原因 |
|---|---|---|
| Tray 建立 | 移除 `icon.setTemplateImage(true)` | macOS 專用 API |
| BrowserWindow | 加入 `backgroundColor: '#00000000'` | Windows 透明視窗需要 |
| alwaysOnTop | 改為 `win.setAlwaysOnTop(true, 'screen-saver')` | 覆蓋全螢幕應用 |
| Win32 patch block | 啟動時套用 `WS_EX_NOACTIVATE` + `SetWindowTheme`；`blur` 事件 re-apply；`focus` 事件偵測 input 自動 blur | 防止失焦時 DWM 繪製 caption overlay（標題列鬼影）；需要 `koffi` 依賴 |
| `.electronignore` | 專案根目錄建立此檔 | 防止 electron-builder 讀取父目錄 `.gitignore` 而漏掉 `dist/assets/` |

> **⚠️ 注意：`thickFrame: false` 不是有效修法。** 此選項會導致 DWM 將 client area 計算為 0，寵物完全消失。禁止使用。詳見逆向工程書第 0.6 節。

### 步驟三：複製到 Release 資料夾

```bash
cp "path/to/BuddyDock-X.Y.Z-ver.animals.dmg" Release/
cp Dev/Windows/release/BuddyDock-X.Y.Z-setup.exe Release/
cp Dev/Windows/release/BuddyDock-X.Y.Z-portable.exe Release/
```

### 步驟四：rclone 上傳 Google Drive

```bash
# 上傳（自動跳過未變更的舊版檔案）
./Dev/rclone.exe copy Release/ gdrive:BuddyDock-Release/ --progress

# 取得三個分享連結
./Dev/rclone.exe link "gdrive:BuddyDock-Release/BuddyDock-X.Y.Z-ver.animals.dmg"
./Dev/rclone.exe link "gdrive:BuddyDock-Release/BuddyDock-X.Y.Z-setup.exe"
./Dev/rclone.exe link "gdrive:BuddyDock-Release/BuddyDock-X.Y.Z-portable.exe"
```

### 步驟五：更新 README 與版本控制

1. 用取得的連結更新 `README.md` 下載表格
2. 更新本文件的「版本更新紀錄」章節
3. Commit 並 push：

```bash
git add README.md "Dev/BuddyDock產品開發說明書.md"
git commit -m "Release vX.Y.Z"
git push
```

---

## 四、角色系統

應用程式內建三隻可選角色，每隻角色各有一套獨立的情緒動畫圖集：

### Black Cat（黑貓）
| 狀態圖 | 說明 |
|---|---|
| `idle` | 預設待機 |
| `calm` | 平靜 |
| `alert` | 警覺 |
| `relax` | 放鬆 |
| `scared1` / `scared2` | 驚嚇（兩幀） |
| `sleepy` | 昏昏欲睡 |

### Maltese（馬爾濟斯）
| 狀態圖 | 說明 |
|---|---|
| `idle` | 預設待機 |
| `happy` | 開心 |
| `angry` | 生氣 |
| `smile` | 微笑 |
| `tongue` | 吐舌 |
| `wink` | 眨眼 |
| `flower` | 花朵（特殊） |

### Shimaenaga（島嶼長尾雀）
| 狀態圖 | 說明 |
|---|---|
| `idle` | 預設待機 |
| `walk` | 散步 |
| `sleep` | 睡著 |
| `excited` | 興奮 |
| `grumpy` | 不高興 |
| `love` | 戀愛 |
| `heart` | 愛心 |
| `peek` | 偷看 |
| `side` | 側身 |
| `cold` | 寒冷 |
| `cup` / `cup2` | 杯子（兩幀） |

角色切換可從右鍵選單「切換角色」子選單操作，選擇後即時生效並持久儲存。

---

## 五、核心功能

### 5.1 說話泡泡（語錄顯示）

- 寵物頭頂出現半透明白色圓角泡泡
- 泡泡內容從當前啟用清單中隨機抽選
- 泡泡具備螢幕邊緣智慧定位（貼近螢幕邊緣時自動翻轉方向，避免被裁切）
- 字型：Noto Sans TC；字級分三段（小 / 中 / 大）

### 5.2 自動換句

- 設定每隔 N 分鐘自動替換泡泡內容
- 支援跨清單輪替

### 5.3 語錄清單管理

清單分兩種格式：

**語錄模式（預設）**
- 純文字句子，每行一條
- 隨機抽選顯示

**單字模式（`type: "word"`）**
- 格式：`單字｜解釋`（以全形豎線 `｜` 分隔）
- 寵物泡泡分兩行顯示（上行單字、下行解釋）
- 使用智慧頻率演算法：每個單字最多記錄 10 次看見次數（`seenCounts`），看得少的單字出現機率更高

**內建清單（預設）**

| ID | 名稱 | 類型 |
|---|---|---|
| `health` | 健康提醒 | 語錄 |
| `work` | 上班語錄 | 語錄 |
| `list-topik-full-beginner` | 韓檢初級高頻單字 | 單字 |

**清單操作**
- 新增：點選 ＋ 按鈕展開輸入欄
- 編輯：修改名稱、新增 / 刪除條目
- 刪除：點擊垃圾桶圖示
- 匯出：存成 `.json` 檔案（格式：`bunny-quotes-YYYY-MM-DD.json`）
- 匯入：讀取 `.json` 檔案，自動偵測語錄 / 單字類型，防重複 ID

**匯出 JSON 格式**
```json
{
  "version": 1,
  "lists": [
    {
      "id": "my-list",
      "name": "我的清單",
      "quotes": ["句子一", "句子二"]
    }
  ]
}
```

### 5.4 收藏功能

- 對任意語錄點選 🤍 加入收藏（`favorites` 陣列）
- 設定頁可開啟「只從收藏抽語錄」（`favoritesOnly`）
- 收藏為空時自動 fallback 回完整清單

### 5.5 提醒系統

#### 定時提醒（Interval Reminder）
- 每 N 分鐘觸發一次
- 同時觸發：① 寵物換句 ② 系統通知（顯示隨機語錄）
- 通知標題依角色不同：「Black Cat 提醒 🐱」/ 「Maltese 提醒 🐶」/ 「Shimaenaga 提醒 🐦」

#### 日程提醒（Scheduled Reminder）
- 在指定時間點發送特定文字的通知
- 重複模式：不重複（`none`）/ 每天（`daily`）/ 每週（`weekly`，指定星期幾）
- 可個別開關每條日程

#### 靜音時段（Quiet Hours）
- 設定起訖時間（例如 22:00 → 08:00），期間不發送任何通知
- 支援跨午夜時段

### 5.6 視窗行為

| 特性 | 描述 |
|---|---|
| 視窗尺寸 | 220 × 300–345 px（依字型大小動態調整高度） |
| 透明框 | 透明背景、無邊框、無陰影 |
| 永遠置頂 | `alwaysOnTop: true` |
| 隱藏工作列 | `skipTaskbar: true`（不出現在 macOS Dock / Windows 工作列） |
| 拖曳移動 | 左鍵拖曳寵物本體可移動；允許半個視窗探出螢幕邊緣 |
| 落地動畫 | 放開後寵物播放落地動畫 |

### 5.7 系統匣（Tray）

- 選單列 / 工作列顯示小圖示（16×16）
- 左鍵點擊：若視窗已顯示則聚焦，否則顯示視窗
- 右鍵點擊：彈出快捷選單（顯示 / 詳細設定 / 關閉）

### 5.8 右鍵選單（主視窗）

- 切換角色（子選單，radio 樣式）
- 勾選清單（子選單，checkbox 樣式，可同時啟用多個清單）
- 詳細設定 / 說明書 / 開發者的話 / 隱藏 / 關閉

### 5.9 設定頁（三個分頁）

| 分頁 | 內容 |
|---|---|
| 清單（lists） | 新增 / 編輯 / 刪除清單；收藏管理；匯入 / 匯出 |
| 互動（interaction） | 自動換句開關 + 間隔；定時提醒開關 + 間隔；字型大小；開機自啟動；靜音時段 |
| 日程（schedule） | 新增 / 管理日程提醒 |

### 5.10 開機自動啟動

- macOS：使用 `app.setLoginItemSettings()` 寫入 Login Items
- Windows：寫入登錄機碼 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
- 可在設定頁「互動」分頁開啟 / 關閉

---

## 六、資料儲存

| 鍵名 | 儲存位置 | 內容 |
|---|---|---|
| `buddydock-animals-v1` | `localStorage` | 所有應用程式狀態（清單、提醒設定、看見次數等） |
| `buddydock-pet` | `localStorage` | 當前選擇的角色 ID |

### 完整狀態結構（預設值）

```json
{
  "lists": [],
  "activeListIds": ["work"],
  "favorites": [],
  "favoritesOnly": false,
  "autoSwitch": false,
  "autoSwitchMinutes": 10,
  "reminderEnabled": false,
  "reminderListId": "health",
  "reminderIntervalMinutes": 60,
  "quietHoursEnabled": false,
  "quietStart": "22:00",
  "quietEnd": "08:00",
  "fontSize": "medium",
  "scheduledReminders": [],
  "seenCounts": {}
}
```

---

## 七、視覺設計規格

### 色彩配置（暖土色系）

| Token | 色值 | 用途 |
|---|---|---|
| `bg` | `rgba(228,233,242,0.96)` | 主視窗背景（藍灰半透明） |
| `card` | `rgba(255,255,255,0.55)` | 卡片背景 |
| `accent` | `#8C7549` | 強調色（暖褐） |
| `text` | `#403B39` | 主文字 |
| `muted` | `rgba(64,59,57,0.45)` | 次要文字 |
| `surface1` | `rgba(64,59,57,0.05)` | 淺背景層 |
| `border` | `rgba(140,117,73,0.18)` | 邊框 |
| `optionBg` | `#d9cdbf` | 選項背景 |

### 字型規格

- 字型家族：`"Noto Sans TC", system-ui, sans-serif`（跨平台均可用）
- 三段字型大小：

| 模式 | 內文 | 次要 | 極小 |
|---|---|---|---|
| small | 11px | 10px | 9px |
| medium | 12px | 11px | 10px |
| large | 14px | 12px | 11px |

### 視窗高度（依字型大小）

| 模式 | 高度 |
|---|---|
| small | 300px |
| medium | 320px |
| large | 345px |

### 視覺風格

- 背景模糊：`backdrop-filter: blur(14px)`
- 圓角：14px
- 泡泡：白色半透明（`rgba(255,255,255,0.85)`），底部三角箭頭指向寵物

---

## 八、發行版本管理（rclone + Google Drive）

`Dev/rclone.exe` 為 Windows 版 rclone CLI（v1.73.4），用於將 `Release/` 內的安裝檔上傳至 Google Drive 並取得公開分享連結。

### 8.1 首次設定（只需做一次）

在專案根目錄執行：

```bash
./Dev/rclone.exe config
```

依序輸入：

| 提示 | 輸入 |
|---|---|
| `n/s/q>` | `n` |
| `name>` | `gdrive` |
| Storage type | `drive` |
| client_id / client_secret | Enter（留空） |
| scope | `1`（Full access） |
| root_folder_id / service_account_file | Enter（留空） |
| Edit advanced config? | `n` |
| Use auto config? | `y`（瀏覽器開啟，登入 Google 帳號授權） |
| Configure as team drive? | `n` |
| Keep this remote? | `y` |
| 完成後 | `q` |

授權資料儲存在 `~/.config/rclone/rclone.conf`，之後無需重複授權。

### 8.2 上傳新版本檔案

將新版安裝檔放入 `Release/` 後執行：

```bash
./Dev/rclone.exe copy Release/ gdrive:BuddyDock-Release/ --progress
```

- `--progress` 顯示即時進度
- rclone 自動跳過已上傳且未變更的檔案（依大小＋修改時間比對）
- 若同名檔案已存在且內容相同，不會重複上傳

### 8.3 取得分享連結

上傳完成後，逐一取得公開連結：

```bash
./Dev/rclone.exe link "gdrive:BuddyDock-Release/BuddyDock-X.Y.Z-ver.animals.dmg"
./Dev/rclone.exe link "gdrive:BuddyDock-Release/BuddyDock-X.Y.Z-setup.exe"
./Dev/rclone.exe link "gdrive:BuddyDock-Release/BuddyDock-X.Y.Z-portable.exe"
```

輸出格式：`https://drive.google.com/open?id=XXXXXXXX`

### 8.4 更新 README 下載連結

取得連結後，更新專案根目錄的 `README.md`，替換下載表格內對應版本的連結，再 commit 並 push：

```bash
git add README.md
git commit -m "Update download links for vX.Y.Z"
git push
```

### 8.5 查看與管理 Drive 上的檔案

```bash
# 列出所有已上傳檔案（含大小）
./Dev/rclone.exe ls gdrive:BuddyDock-Release/

# 刪除舊版本檔案
./Dev/rclone.exe deletefile "gdrive:BuddyDock-Release/BuddyDock-1.0.0-setup.exe"
```

---

## 九、版本更新紀錄

| 版本 | 日期 | 更新內容 | 備註 |
|---|---|---|---|
| 1.0.0 | 2026-04-10 | 首次發佈；語錄清單建立 / 編輯 / 匯入匯出；定時提醒與日程提醒；自動換句；心情動畫；螢幕邊緣智慧泡泡定位；關於開發者頁面 | |
| 1.0.1 | 2026-04-10 | 修正設定頁三分頁高度不一致；右鍵選單文案調整；收藏語錄功能；靜音時段；背單字記憶功能（智慧頻率演算法） | |
| 1.0.3 | 2026-04-12 | 設定頁清單區塊視覺重設計（卡片分區、垃圾桶圖示）；新增清單改為 ＋ 按鈕；匯入功能修正（自動偵測類型、修復重複 ID） | Windows 移植同步發佈 |
| 1.0.3 | 2026-04-14 | — | Windows patch：修正失焦時 DWM caption overlay（標題列鬼影）；根因為 focus 轉換觸發；透過 WS_EX_NOACTIVATE + blur/focus 事件管理解決；新增 koffi 依賴；新增 `.electronignore` 修正 dist/assets 遭父目錄 .gitignore 排除問題 |
