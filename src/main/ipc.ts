import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { checkAdb, findAdb } from './adb/adb'
import { AdbClient } from './adb/client'
import { installPlatformTools, platformToolsUrl } from './adb/install'
import type { LogSink } from './adb/runner'
import { platform } from './platform'
import { ActivityLog } from './store/activity-log'
import { HistoryStore, removeEntry, renameEntry, upsertConnection } from './store/history'
import { explainFailure } from '@shared/explain'
import { parseHostPort } from '@shared/network'
import type {
  ActionResult,
  AdbStatus,
  ApkInstallResult,
  AppInfo,
  ListAppsResult,
  ConnectOutcome,
  DeviceInfo,
  ErrorCategory,
  HistoryEntry,
  InstallResult,
  LogEntry
} from '@shared/types'

/**
 * Connects the UI's requests (through the preload bridge) to the main-process services.
 * Every handler checks its input, because the UI is not trusted with free-form values.
 */
export function registerIpc(): void {
  const activityLog = new ActivityLog()
  const history = new HistoryStore(join(platform.dataDir(), 'history.json'))
  let connected: DeviceInfo | null = null
  let installing = false

  const sink: LogSink = (entry) => {
    activityLog.add(entry)
    console.log(`[adb] ${entry.ok ? 'ok  ' : 'fail'} ${entry.durationMs}ms  ${entry.command}`)
  }

  const toolsDir = (): string => join(platform.dataDir(), 'tools')
  const locateAdb = (): string | null =>
    findAdb({
      toolsDir: toolsDir(),
      binaryName: platform.toolBinaryName('adb'),
      pathEnv: process.env['PATH'] ?? ''
    })

  const failure = (category: ErrorCategory, message: string, fix: string, detail = ''): ConnectOutcome => ({
    ok: false,
    category,
    message,
    fix,
    detail
  })

  ipcMain.handle('app:info', (): AppInfo => platform.appInfo())

  ipcMain.handle('adb:check', (): Promise<AdbStatus> => checkAdb(locateAdb(), sink))

  ipcMain.handle('adb:install', async (event): Promise<InstallResult> => {
    if (installing) return { ok: false, message: 'A download is already running.' }
    installing = true
    try {
      const outcome = await installPlatformTools({
        url: platformToolsUrl(platform.os),
        toolsDir: toolsDir(),
        binaryName: platform.toolBinaryName('adb'),
        onProgress: (progress) => {
          if (!event.sender.isDestroyed()) event.sender.send('adb:install-progress', progress)
        }
      })
      if (!outcome.ok) return { ok: false, message: outcome.message }
      const status = await checkAdb(outcome.adbPath, sink)
      return { ok: status.found, message: status.message, status }
    } finally {
      installing = false
    }
  })

  ipcMain.handle('device:connect', async (_event, address: unknown): Promise<ConnectOutcome> => {
    if (typeof address !== 'string') {
      return failure('other', 'That does not look like a TV address.', 'Type the address shown on the TV.')
    }
    const target = parseHostPort(address)
    if (target === null) {
      return failure(
        'other',
        'That does not look like a TV address.',
        'Type the numbers shown on the TV, like 192.168.0.105. A port such as :5555 is optional.',
        address.slice(0, 100)
      )
    }
    const adbPath = locateAdb()
    if (adbPath === null) {
      return failure('tool_missing', ...failureText('tool_missing'))
    }

    const outcome = await new AdbClient({ binary: adbPath, log: sink }).connect(target)
    if (outcome.ok) {
      connected = outcome.device
      await history.save(upsertConnection(await history.load(), outcome.device, Date.now()))
    }
    return outcome
  })

  ipcMain.handle('device:disconnect', async (): Promise<void> => {
    const adbPath = locateAdb()
    if (connected !== null && adbPath !== null) {
      await new AdbClient({ binary: adbPath, log: sink }).disconnect({
        host: connected.host,
        port: connected.port
      })
    }
    connected = null
  })

  ipcMain.handle('device:current', (): DeviceInfo | null => connected)

  ipcMain.handle('history:list', (): Promise<HistoryEntry[]> => history.load())

  ipcMain.handle(
    'history:rename',
    async (_event, id: unknown, nickname: unknown): Promise<HistoryEntry[]> => {
      const current = await history.load()
      if (typeof id !== 'string' || typeof nickname !== 'string') return current
      const updated = renameEntry(current, id, nickname)
      await history.save(updated)
      return updated
    }
  )

  ipcMain.handle('history:remove', async (_event, id: unknown): Promise<HistoryEntry[]> => {
    const current = await history.load()
    if (typeof id !== 'string') return current
    const updated = removeEntry(current, id)
    await history.save(updated)
    return updated
  })

  ipcMain.handle('log:list', (): LogEntry[] => activityLog.list())

  // ---- Everything below needs a connected TV. ----

  /** The adb client and TV for the current connection, or the reason there is none. */
  const session = (): { client: AdbClient; serial: string } | ActionResult => {
    const adbPath = locateAdb()
    if (adbPath === null) return notReady('tool_missing')
    if (connected === null) return notReady('unreachable', 'Connect to your TV first (Connect page).')
    return { client: new AdbClient({ binary: adbPath, log: sink }), serial: connected.serial }
  }

  ipcMain.handle('remote:key', async (_event, key: unknown): Promise<ActionResult> => {
    const s = session()
    if (!('client' in s)) return s
    return s.client.sendKey(s.serial, typeof key === 'string' ? key : '')
  })

  ipcMain.handle('remote:text', async (_event, text: unknown): Promise<ActionResult> => {
    const s = session()
    if (!('client' in s)) return s
    return s.client.sendText(s.serial, typeof text === 'string' ? text : '')
  })

  ipcMain.handle('apps:list', async (): Promise<ListAppsResult> => {
    const s = session()
    if (!('client' in s)) {
      return { ok: false, category: s.ok ? 'other' : s.category, message: s.ok ? '' : s.message, fix: s.ok ? '' : s.fix, detail: '' }
    }
    return s.client.listApps(s.serial)
  })

  ipcMain.handle('apps:pick', async (event): Promise<string[]> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: 'Choose app files to install',
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      filters: [{ name: 'Android apps (.apk)', extensions: ['apk'] }]
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('apps:install', async (event, paths: unknown): Promise<ApkInstallResult[]> => {
    const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === 'string').slice(0, 50) : []
    const s = session()
    const results: ApkInstallResult[] = []
    for (const [i, path] of list.entries()) {
      const name = basename(path)
      if (!('client' in s)) {
        results.push({ path, name, ok: false, message: s.ok ? '' : s.message, ...(s.ok ? {} : { fix: s.fix }) })
        continue
      }
      if (!path.toLowerCase().endsWith('.apk') || !existsSync(path)) {
        results.push({
          path,
          name,
          ok: false,
          message: 'That is not an .apk file, or it could not be found.',
          fix: 'Choose a file that ends in .apk.'
        })
        continue
      }
      if (!event.sender.isDestroyed()) {
        event.sender.send('apps:install-progress', { index: i + 1, total: list.length, name })
      }
      results.push(await s.client.installApk(s.serial, path, name))
    }
    return results
  })

  ipcMain.handle('apps:uninstall', async (_event, packageName: unknown): Promise<ActionResult> => {
    const s = session()
    if (!('client' in s)) return s
    return s.client.uninstall(s.serial, typeof packageName === 'string' ? packageName : '')
  })

  ipcMain.handle(
    'apps:set-enabled',
    async (_event, packageName: unknown, enabled: unknown): Promise<ActionResult> => {
      const s = session()
      if (!('client' in s)) return s
      return s.client.setEnabled(s.serial, typeof packageName === 'string' ? packageName : '', enabled === true)
    }
  )
}

function failureText(category: ErrorCategory): [string, string] {
  const { message, fix } = explainFailure(category)
  return [message, fix]
}

function notReady(category: ErrorCategory, fixOverride?: string): ActionResult {
  const { message, fix } = explainFailure(category)
  return { ok: false, category, message, fix: fixOverride ?? fix, detail: '' }
}
