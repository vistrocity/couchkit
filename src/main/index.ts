import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { platform } from './platform'

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
