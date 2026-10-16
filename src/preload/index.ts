import { contextBridge, ipcRenderer } from 'electron'
import type { CouchkitApi } from '@shared/types'

/**
 * The bridge: the only things the UI is allowed to ask the main process to do.
 * Every function here maps to one named, typed request. Nothing else is exposed.
 */
const api: CouchkitApi = {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  checkAdb: () => ipcRenderer.invoke('adb:check')
}

contextBridge.exposeInMainWorld('couchkit', api)
