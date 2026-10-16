import { ipcMain } from 'electron'
import { join } from 'node:path'
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
  AdbStatus,
  AppInfo,
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
}

function failureText(category: ErrorCategory): [string, string] {
  const { message, fix } = explainFailure(category)
  return [message, fix]
}
