import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ApkInstallProgress, CouchkitApi, DownloadProgress, TransferProgress } from '@shared/types'

/**
 * The bridge: the only things the UI is allowed to ask the main process to do.
 * Every function here maps to one named, typed request. Nothing else is exposed.
 */
const api: CouchkitApi = {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  checkAdb: () => ipcRenderer.invoke('adb:check'),
  installAdb: () => ipcRenderer.invoke('adb:install'),
  onInstallProgress: (listener) => {
    const handler = (_event: unknown, progress: DownloadProgress): void => listener(progress)
    ipcRenderer.on('adb:install-progress', handler)
    return () => {
      ipcRenderer.removeListener('adb:install-progress', handler)
    }
  },
  connect: (address) => ipcRenderer.invoke('device:connect', address),
  disconnect: () => ipcRenderer.invoke('device:disconnect'),
  getConnected: () => ipcRenderer.invoke('device:current'),
  listHistory: () => ipcRenderer.invoke('history:list'),
  renameHistory: (id, nickname) => ipcRenderer.invoke('history:rename', id, nickname),
  removeHistory: (id) => ipcRenderer.invoke('history:remove', id),
  listLog: () => ipcRenderer.invoke('log:list'),
  sendKey: (key) => ipcRenderer.invoke('remote:key', key),
  sendText: (text) => ipcRenderer.invoke('remote:text', text),
  isElevated: () => ipcRenderer.invoke('app:elevated'),
  listApps: () => ipcRenderer.invoke('apps:list'),
  pickApks: () => ipcRenderer.invoke('apps:pick'),
  pathForFile: (file) => {
    const path = webUtils.getPathForFile(file)
    // Only a file the person really dropped has a path; tell the main process so it will accept it.
    if (path !== '') ipcRenderer.send('drop:register', path)
    return path
  },
  installApks: (paths) => ipcRenderer.invoke('apps:install', paths),
  onApkProgress: (listener) => {
    const handler = (_event: unknown, progress: ApkInstallProgress): void => listener(progress)
    ipcRenderer.on('apps:install-progress', handler)
    return () => {
      ipcRenderer.removeListener('apps:install-progress', handler)
    }
  },
  uninstallApp: (packageName) => ipcRenderer.invoke('apps:uninstall', packageName),
  setAppEnabled: (packageName, enabled) => ipcRenderer.invoke('apps:set-enabled', packageName, enabled),
  listFiles: (path) => ipcRenderer.invoke('files:list', path),
  downloadFromTv: (path) => ipcRenderer.invoke('files:download', path),
  pickUploads: (kind) => ipcRenderer.invoke('files:pick', kind),
  uploadToTv: (remoteDir, localPaths) => ipcRenderer.invoke('files:upload', remoteDir, localPaths),
  onTransferProgress: (listener) => {
    const handler = (_event: unknown, progress: TransferProgress): void => listener(progress)
    ipcRenderer.on('files:progress', handler)
    return () => {
      ipcRenderer.removeListener('files:progress', handler)
    }
  },
  makeFolder: (parent, name) => ipcRenderer.invoke('files:mkdir', parent, name),
  deleteFromTv: (path) => ipcRenderer.invoke('files:delete', path),
  takeScreenshot: () => ipcRenderer.invoke('capture:screenshot'),
  startRecording: (preset) => ipcRenderer.invoke('capture:record-start', preset),
  recordingStatus: () => ipcRenderer.invoke('capture:record-status'),
  stopRecording: () => ipcRenderer.invoke('capture:record-stop'),
  revealCapture: (path) => ipcRenderer.invoke('capture:reveal', path),
  runShell: (command) => ipcRenderer.invoke('console:run', command),
  listShortcuts: () => ipcRenderer.invoke('console:shortcuts-list'),
  saveShortcut: (name, command) => ipcRenderer.invoke('console:shortcuts-save', name, command),
  removeShortcut: (id) => ipcRenderer.invoke('console:shortcuts-remove', id),
  findTvs: () => ipcRenderer.invoke('discover:find'),
  readTweaks: () => ipcRenderer.invoke('tweaks:read'),
  applyTweak: (tweakId, choiceId) => ipcRenderer.invoke('tweaks:apply', tweakId, choiceId),
  applyDensity: (value) => ipcRenderer.invoke('tweaks:density', value),
  pendingChange: () => ipcRenderer.invoke('tweaks:pending'),
  keepChange: () => ipcRenderer.invoke('tweaks:keep'),
  undoChange: () => ipcRenderer.invoke('tweaks:undo'),
  setClockFromComputer: () => ipcRenderer.invoke('tweaks:set-clock'),
  listScreensavers: () => ipcRenderer.invoke('tweaks:screensavers'),
  setScreensaver: (component) => ipcRenderer.invoke('tweaks:set-screensaver', component),
  optimiseApps: (reset) => ipcRenderer.invoke('cleanup:optimise', reset),
  optimiseStatus: () => ipcRenderer.invoke('cleanup:optimise-status'),
  launcherStatus: () => ipcRenderer.invoke('launcher:status'),
  testHome: () => ipcRenderer.invoke('launcher:test-home'),
  setDefaultLauncher: (component) => ipcRenderer.invoke('launcher:set-default', component),
  setLauncherKeepAlive: (packageName, on) => ipcRenderer.invoke('launcher:keep-alive', packageName, on),
  setStockLauncherEnabled: (packageName, enabled) => ipcRenderer.invoke('launcher:stock-enabled', packageName, enabled),
  readHardware: () => ipcRenderer.invoke('device:hardware'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setActivityLog: (enabled) => ipcRenderer.invoke('settings:activity-log', enabled),
  clearLog: () => ipcRenderer.invoke('log:clear'),
  restartTv: (mode) => ipcRenderer.invoke('device:restart', mode),
  openIdea: (id) => ipcRenderer.invoke('ideas:open', id),
  readStorage: () => ipcRenderer.invoke('cleanup:storage'),
  clearCaches: () => ipcRenderer.invoke('cleanup:caches'),
  closeBackgroundApps: () => ipcRenderer.invoke('cleanup:background'),
  clearAppData: (packageName) => ipcRenderer.invoke('cleanup:app-data', packageName),
  openApp: (packageName) => ipcRenderer.invoke('apps:open', packageName),
  forceStopApp: (packageName) => ipcRenderer.invoke('apps:force-stop', packageName),
  clearAppCache: (packageName) => ipcRenderer.invoke('cleanup:app-cache', packageName),
  backupApps: (packageNames) => ipcRenderer.invoke('backup:run', packageNames),
  pickBackupFolder: () => ipcRenderer.invoke('backup:pick'),
  restoreApps: (packageNames) => ipcRenderer.invoke('backup:restore', packageNames),
  onBackupProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof listener>[0]): void => listener(progress)
    ipcRenderer.on('backup:progress', handler)
    return () => ipcRenderer.removeListener('backup:progress', handler)
  },
  revealBackups: () => ipcRenderer.invoke('backup:reveal')
}

contextBridge.exposeInMainWorld('couchkit', api)
