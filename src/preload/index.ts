import { contextBridge, ipcRenderer } from 'electron'
import type { CouchkitApi, DownloadProgress } from '@shared/types'

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
  listLog: () => ipcRenderer.invoke('log:list')
}

contextBridge.exposeInMainWorld('couchkit', api)
