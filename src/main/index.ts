import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'node:path'
import { checkAdb, findAdb } from './adb/adb'
import { buildMenu } from './menu'
import { platform } from './platform'
import type { AdbStatus, AppInfo } from '@shared/types'

// Activity log: slice 1 will persist this; for now it just prints in the terminal.
const logCommand = (entry: { command: string; ok: boolean; durationMs: number }): void => {
  console.log(`[adb] ${entry.ok ? 'ok ' : 'fail'} ${entry.durationMs}ms  ${entry.command}`)
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1000,
    height: 680,
    minWidth: 760,
    minHeight: 520,
    title: 'Couchkit',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Security defaults: the UI cannot reach Node or the file system directly.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => window.show())

  // The UI never opens other windows or navigates away.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('app:info', (): AppInfo => platform.appInfo())

  ipcMain.handle('adb:check', async (): Promise<AdbStatus> => {
    const adbPath = findAdb({
      toolsDir: join(platform.dataDir(), 'tools'),
      binaryName: platform.toolBinaryName('adb'),
      pathEnv: process.env['PATH'] ?? ''
    })
    return checkAdb(adbPath, logCommand)
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu())
  registerIpc()
  createWindow()

  app.on('activate', () => {
    // macOS: re-open a window when the dock icon is clicked and none are open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // macOS apps stay running until the user quits; other systems quit.
  if (!platform.isMac) app.quit()
})
