const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
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

  onOpenSettings:       (cb) => ipcRenderer.on('open-settings', cb),
  onOpenAbout:          (cb) => ipcRenderer.on('open-about', cb),
  onOpenGuide:          (cb) => ipcRenderer.on('open-guide', cb),
  onScheduledReminder:  (cb) => ipcRenderer.on('scheduled-reminder', cb),
  onToggleList:    (cb) => ipcRenderer.on('toggle-list', cb),
  onReminderTick:  (cb) => ipcRenderer.on('reminder-tick', cb),
  onSwitchPet:     (cb) => ipcRenderer.on('switch-pet', cb),
})
