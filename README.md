# BuddyDock

常駐桌面的虛擬寵物應用程式。動物角色以透明浮窗形式停留在螢幕角落，透過說話泡泡顯示你自訂的語錄、單字或提醒，並在固定時間發送系統通知。

版本：**v1.0.3** ｜ 開發者：Jessica Jarvis ｜ © 2026 BuddyDock

---

## 角色

| 角色 | 說明 |
|---|---|
| 🐱 **Black Cat**（黑貓） | idle / calm / alert / relax / scared / sleepy |
| 🐶 **Maltese**（馬爾濟斯） | idle / happy / angry / smile / tongue / wink / flower |
| 🐦 **Shimaenaga**（島嶼長尾雀） | idle / walk / sleep / excited / grumpy / love / heart / peek / side / cold / cup |

右鍵點擊角色 → **切換角色** 即可切換，即時生效。

---

## 主要功能

- **說話泡泡** — 隨機顯示語錄，靠近螢幕邊緣自動翻轉方向
- **語錄清單管理** — 新增 / 編輯 / 刪除語錄清單；支援語錄模式與單字模式（顯示單字＋解釋）
- **智慧背單字** — 看得少的單字出現機率更高（最多記錄 10 次看見次數）
- **收藏語錄** — 點 🤍 收藏，可開啟「只從收藏抽語錄」
- **定時提醒** — 每 N 分鐘觸發系統通知並換句
- **日程提醒** — 在指定時間發送特定訊息（一次性 / 每天 / 每週）
- **靜音時段** — 設定期間不發送任何通知（支援跨午夜）
- **匯入 / 匯出** — 語錄清單可匯出成 `.json` 備份，跨裝置還原
- **開機自動啟動**

---

## 下載

| 檔案 | 平台 | 連結 |
|---|---|---|
| `BuddyDock-1.0.3-ver.animals.dmg` | macOS 12+ | [下載](https://drive.google.com/open?id=17OYXdb0h9BQjWrlznUCBlR72vsQ6Xkw2) |
| `BuddyDock-1.0.3-setup.exe` | Windows 10/11 64-bit（安裝版） | [下載](https://drive.google.com/open?id=1KBTKDc-9oA5EESaKDTicd-dicgWKx1AW) |
| `BuddyDock-1.0.3-portable.exe` | Windows 10/11 64-bit（免安裝） | [下載](https://drive.google.com/open?id=1NxTmmziXK2eAWjCGYAfw05ZorsEp4OPT) |

---

## 安裝說明

### macOS

1. 下載 `BuddyDock-1.0.3-ver.animals.dmg`
2. 雙擊開啟 DMG，將 **BuddyDock.app** 拖曳到「應用程式」資料夾
3. 開啟應用程式即可

> 首次開啟若出現「無法驗證開發者」：系統偏好設定 → 安全性與隱私 → 點「仍要開啟」

### Windows

**安裝版（推薦長期使用）**

1. 下載 `BuddyDock-1.0.3-setup.exe`
2. 雙擊執行，程式將自動靜默安裝並開啟
3. 之後從開始選單搜尋「BuddyDock」開啟

**便攜版（免安裝）**

1. 下載 `BuddyDock-1.0.3-portable.exe`
2. 雙擊執行（首次解壓需 5–10 秒）
3. 桌面右下角出現動物角色即成功

> **Windows SmartScreen 警告**：點「更多資訊」→「仍要執行」即可。本程式未購買商業程式碼簽署憑證，與安全無關。

---

## 基本操作

| 操作 | 說明 |
|---|---|
| 左鍵拖曳角色 | 移動到任意位置（可半身探出螢幕邊緣） |
| 右鍵點擊角色 | 開啟主選單 |
| 系統匣圖示（工具列） | 左鍵顯示／聚焦；右鍵快捷選單 |

---

## 資料儲存位置

| 平台 | 位置 |
|---|---|
| macOS | `~/Library/Application Support/BuddyDock/` |
| Windows | `%AppData%\BuddyDock\` |

語錄清單和所有設定儲存在此，重新安裝不會遺失。

---

## 版本紀錄

| 版本 | 日期 | 更新內容 |
|---|---|---|
| 1.0.3 | 2026-04-12 | 設定頁清單區塊視覺重設計；新增清單改為 ＋ 按鈕；匯入功能修正 |
| 1.0.1 | 2026-04-10 | 收藏語錄功能；靜音時段；背單字智慧頻率演算法 |
| 1.0.0 | 2026-04-10 | 首次發佈 |
