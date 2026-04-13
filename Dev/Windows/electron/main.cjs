const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, Notification, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'

let appLists = []
let activeListIds = []
let reminderTimer = null
let tray = null
let currentPetId = 'black-cat'
let quietHoursEnabled = false
let quietStart = '22:00'
let quietEnd = '08:00'
let scheduledReminders = []
let scheduledTimer = null

function isQuietTime() {
  if (!quietHoursEnabled) return false
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = quietStart.split(':').map(Number)
  const [eh, em] = quietEnd.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em
  if (start <= end) return cur >= start && cur < end
  return cur >= start || cur < end  // 跨夜（例如 22:00 - 08:00）
}

const PET_LIST = [
  { id: 'black-cat',   name: 'Black Cat',   notifyTitle: 'Black Cat 提醒 🐱' },
  { id: 'maltese',     name: 'Maltese',     notifyTitle: 'Maltese 提醒 🐶' },
  { id: 'shimaenaga',  name: 'Shimaenaga',  notifyTitle: 'Shimaenaga 提醒 🐦' },
]

function checkScheduledReminders(win) {
  if (!Notification.isSupported() || isQuietTime()) return
  const now = new Date()
  const curH = now.getHours()
  const curM = now.getMinutes()
  const curDay = now.getDay()
  const todayStr = now.toISOString().slice(0, 10)
  const pet = PET_LIST.find(p => p.id === currentPetId)
  const title = pet?.notifyTitle ?? '桌寵提醒'

  scheduledReminders.forEach(r => {
    if (!r.enabled) return
    const [h, m] = r.time.split(':').map(Number)
    if (h !== curH || m !== curM) return

    if (r.repeat === 'none' && r.date === todayStr) {
      new Notification({ title, body: r.text }).show()
      win.webContents.send('scheduled-reminder', r.text)
    } else if (r.repeat === 'daily') {
      new Notification({ title, body: r.text }).show()
      win.webContents.send('scheduled-reminder', r.text)
    } else if (r.repeat === 'weekly' && r.weekday === curDay) {
      new Notification({ title, body: r.text }).show()
      win.webContents.send('scheduled-reminder', r.text)
    }
  })
}

function startScheduledChecker(win) {
  if (scheduledTimer) clearInterval(scheduledTimer)
  const now = new Date()
  const msToNextMin = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
  setTimeout(() => {
    checkScheduledReminders(win)
    scheduledTimer = setInterval(() => checkScheduledReminders(win), 60 * 1000)
  }, msToNextMin)
}

function startReminder(win, intervalMinutes, listId) {
  if (reminderTimer) { clearInterval(reminderTimer); reminderTimer = null }
  if (!intervalMinutes || intervalMinutes <= 0) return
  reminderTimer = setInterval(() => {
    win.webContents.send('reminder-tick', listId)
    if (Notification.isSupported() && !isQuietTime()) {
      const list = appLists.find(l => l.id === listId)
      const quotes = list?.quotes ?? []
      const msg = quotes[Math.floor(Math.random() * quotes.length)] ?? '該休息一下囉！'
      const pet = PET_LIST.find(p => p.id === currentPetId)
      const title = pet?.notifyTitle ?? '桌寵提醒'
      new Notification({ title, body: msg }).show()
    }
  }, intervalMinutes * 60 * 1000)
}

function buildContextMenu(win) {
  const listSubmenu = appLists.map(l => ({
    label: l.name,
    type: 'checkbox',
    checked: activeListIds.includes(l.id),
    click: () => win.webContents.send('toggle-list', l.id),
  }))

  const petSubmenu = PET_LIST.map(p => ({
    label: p.name,
    type: 'checkbox',
    checked: currentPetId === p.id,
    click: () => win.webContents.send('switch-pet', p.id),
  }))

  return Menu.buildFromTemplate([
    {
      label: '切換角色',
      submenu: petSubmenu,
    },
    {
      label: '勾選清單',
      submenu: listSubmenu.length > 0 ? listSubmenu : [{ label: '（無清單）', enabled: false }],
    },
    {
      label: '詳細設定',
      click: () => { win.show(); win.webContents.send('open-settings') },
    },
    {
      label: '說明書',
      click: () => { win.show(); win.webContents.send('open-guide') },
    },
    {
      label: '開發者的話',
      click: () => { win.show(); win.webContents.send('open-about') },
    },
    { type: 'separator' },
    { label: '隱藏', click: () => win.hide() },
    { label: '關閉', click: () => app.quit() },
  ])
}

function createTray(win) {
  const iconPath = path.join(__dirname, 'tray.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  // NOTE: setTemplateImage(true) 僅限 macOS，Windows 上不呼叫

  tray = new Tray(icon)
  tray.setToolTip('BuddyDock 桌寵')

  // Windows 左鍵單擊顯示/聚焦視窗
  tray.on('click', () => {
    if (win.isVisible()) {
      win.focus()
    } else {
      win.show()
    }
  })

  // 右鍵快捷選單
  tray.on('right-click', () => {
    tray.popUpContextMenu(Menu.buildFromTemplate([
      { label: '顯示', click: () => win.show() },
      { label: '詳細設定', click: () => { win.show(); win.webContents.send('open-settings') } },
      { type: 'separator' },
      { label: '關閉', click: () => app.quit() },
    ]))
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 220,
    height: 320,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    thickFrame: false,              // 停用 DWM thick frame，避免失焦時出現 caption overlay
    backgroundColor: '#00000000',   // Windows 透明視窗需明確指定
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  // Windows 上設較高的置頂層級，避免被全螢幕視窗蓋住
  win.setAlwaysOnTop(true, 'screen-saver')

  // 防止 HTML <title> 更新視窗標題（避免 Windows DWM caption 顯示原開發者的內部命名）
  win.webContents.on('page-title-updated', (e) => {
    e.preventDefault()
  })

  const { screen } = require('electron')
  const { workArea } = screen.getPrimaryDisplay()
  win.setPosition(workArea.x + workArea.width - 240, workArea.y + workArea.height - 340)

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  createTray(win)
  startScheduledChecker(win)

  // 拖曳：左右允許探出一半視窗，頂部完全夾住
  ipcMain.on('window-drag', (_e, { deltaX, deltaY }) => {
    const { workArea: wa } = screen.getPrimaryDisplay()
    const [x, y] = win.getPosition()
    const [w, h] = win.getSize()
    const sideMargin = Math.floor(w / 2)
    const nx = Math.max(wa.x - sideMargin, Math.min(wa.x + wa.width - sideMargin, x + deltaX))
    const ny = Math.max(wa.y, Math.min(wa.y + wa.height - sideMargin, y + deltaY))
    win.setPosition(nx, ny)
  })

  // 右鍵選單
  ipcMain.on('show-context-menu', () => {
    buildContextMenu(win).popup({ window: win })
  })

  // 調整視窗高度
  ipcMain.on('resize-window', (_e, height) => {
    const [x, y] = win.getPosition()
    win.setSize(220, height)
    win.setPosition(x, y)
  })

  // 同步清單資料與提醒設定
  ipcMain.on('sync-data', (_e, payload) => {
    appLists = payload.lists ?? []
    activeListIds = payload.activeListIds ?? []
    quietHoursEnabled = payload.quietHoursEnabled ?? false
    quietStart = payload.quietStart ?? '22:00'
    quietEnd = payload.quietEnd ?? '08:00'
    scheduledReminders = payload.scheduledReminders ?? []
    if (payload.reminderEnabled) {
      startReminder(win, payload.reminderIntervalMinutes, payload.reminderListId)
    } else {
      if (reminderTimer) { clearInterval(reminderTimer); reminderTimer = null }
    }
  })

  // 開機自啟動（Windows 寫入 HKCU 登錄機碼）
  ipcMain.handle('get-login-item', () => {
    try { return app.getLoginItemSettings().openAtLogin }
    catch { return false }
  })
  ipcMain.on('set-login-item', (_e, enable) => {
    try { app.setLoginItemSettings({ openAtLogin: enable }) }
    catch { /* 部分便攜模式下可能不支援 */ }
  })

  // 匯出清單
  ipcMain.handle('export-lists', async (_e, lists) => {
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: '匯出語錄清單',
      defaultPath: `bunny-quotes-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { ok: false }
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, lists }, null, 2), 'utf-8')
    return { ok: true }
  })

  // 匯入清單
  ipcMain.handle('import-lists', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: '匯入語錄清單',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths[0]) return { ok: false }
    try {
      const raw = fs.readFileSync(filePaths[0], 'utf-8')
      const parsed = JSON.parse(raw)
      const lists = parsed.lists ?? parsed
      if (!Array.isArray(lists)) return { ok: false, error: '格式錯誤' }
      return { ok: true, lists }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.on('sync-pet', (_e, petId) => { currentPetId = petId })

  ipcMain.on('window-close', () => app.quit())
}

Menu.setApplicationMenu(null)   // 移除 Electron 預設選單列（避免 Windows 顯示選單列）
app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
