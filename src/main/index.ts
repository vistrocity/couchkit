import { app, BrowserWindow, Menu, screen, session } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { platform } from './platform'

function createWindow(): void {
  // Open big enough to show the whole Home page without a scroll bar, but never larger than the screen.
  const area = screen.getPrimaryDisplay().workAreaSize
  const window = new BrowserWindow({
    width: Math.min(1120, Math.floor(area.width * 0.92)),
    height: Math.min(1160, Math.floor(area.height * 0.92)),
    minWidth: 760,
    minHeight: 520,
    title: 'Couchkit',
    icon: join(__dirname, '../../build/icon.png'),
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
  window.webContents.on('will-redirect', (event) => event.preventDefault())
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // macOS shows the Dock icon from the app bundle when installed; when run from source, set it here.
  if (platform.isMac && !app.isPackaged) app.dock?.setIcon(join(__dirname, '../../build/icon.png'))
  // Couchkit never needs the camera, microphone, location and so on: refuse every permission request.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
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
