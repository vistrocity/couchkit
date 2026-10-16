import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import { checkAdb, findAdb } from './adb/adb'
import { AdbClient, type RecordingHandle } from './adb/client'
import { captureFileName, isRecordingPreset } from './adb/capture'
import { installPlatformTools, platformToolsUrl } from './adb/install'
import { runCommand, type LogSink } from './adb/runner'
import { platform } from './platform'
import { ActivityLog } from './store/activity-log'
import { ShortcutStore, addShortcut, removeShortcut } from './store/shortcuts'
import { HistoryStore, removeEntry, renameEntry, upsertConnection } from './store/history'
import { explainFailure } from '@shared/explain'
import { parseHostPort } from '@shared/network'
import type {
  ActionResult,
  AdbStatus,
  ApkInstallResult,
  AppInfo,
  ListAppsResult,
  ListFilesResult,
  RecordingStatus,
  SaveRecordingResult,
  ScreenshotResult,
  ShellResult,
  TransferResult,
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
  const shortcuts = new ShortcutStore(join(platform.dataDir(), 'shortcuts.json'))
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

  // `fltmc` only succeeds when run as Administrator, which makes it a simple check.
  ipcMain.handle('app:elevated', async (): Promise<boolean> => {
    if (!platform.isWindows) return false
    return (await runCommand('fltmc', [], { timeoutMs: 5_000 })).ok
  })

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

  // ---- Files ----

  ipcMain.handle('files:list', async (_event, path: unknown): Promise<ListFilesResult> => {
    const s = session()
    if (!('client' in s)) {
      return { ok: false, category: s.ok ? 'other' : s.category, message: s.ok ? '' : s.message, fix: s.ok ? '' : s.fix, detail: '' }
    }
    return s.client.listFiles(s.serial, typeof path === 'string' ? path : '')
  })

  ipcMain.handle('files:download', async (event, path: unknown): Promise<ActionResult> => {
    const s = session()
    if (!('client' in s)) return s
    if (typeof path !== 'string') return notReady('other', 'That is not a valid path on the TV.')
    const window = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: 'Choose where to save it on this computer',
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    }
    const picked = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    const target = picked.filePaths[0]
    if (picked.canceled || target === undefined) {
      // The person cancelled; the screen shows nothing for an empty message.
      return { ok: false, category: 'other', message: '', fix: '', detail: '' }
    }
    return s.client.pull(s.serial, path, target)
  })

  ipcMain.handle('files:pick', async (event, kind: unknown): Promise<string[]> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const folder = kind === 'folder'
    const options = {
      title: folder ? 'Choose a folder to copy to the TV' : 'Choose files to copy to the TV',
      properties: (folder ? ['openDirectory'] : ['openFile', 'multiSelections']) as Array<'openDirectory' | 'openFile' | 'multiSelections'>
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('files:upload', async (event, remoteDir: unknown, paths: unknown): Promise<TransferResult[]> => {
    const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === 'string').slice(0, 50) : []
    const s = session()
    const results: TransferResult[] = []
    for (const [i, path] of list.entries()) {
      const name = basename(path)
      if (!('client' in s)) {
        results.push({ name, ok: false, message: s.ok ? '' : s.message, ...(s.ok ? {} : { fix: s.fix }) })
        continue
      }
      if (!isAbsolute(path) || !existsSync(path)) {
        results.push({ name, ok: false, message: 'That file or folder could not be found on this computer.' })
        continue
      }
      if (!event.sender.isDestroyed()) event.sender.send('files:progress', { index: i + 1, total: list.length, name })
      results.push(await s.client.push(s.serial, path, typeof remoteDir === 'string' ? remoteDir : '', name))
    }
    return results
  })

  ipcMain.handle('files:mkdir', async (_event, parent: unknown, name: unknown): Promise<ActionResult> => {
    const s = session()
    if (!('client' in s)) return s
    return s.client.makeFolder(s.serial, typeof parent === 'string' ? parent : '', typeof name === 'string' ? name : '')
  })

  ipcMain.handle('files:delete', async (_event, path: unknown): Promise<ActionResult> => {
    const s = session()
    if (!('client' in s)) return s
    return s.client.remove(s.serial, typeof path === 'string' ? path : '')
  })

  // ---- Capture ----

  const captureDir = (kind: 'screenshot' | 'recording'): string => {
    const dir = join(app.getPath(kind === 'screenshot' ? 'pictures' : 'videos'), 'Couchkit')
    mkdirSync(dir, { recursive: true })
    return dir
  }

  let recording: { client: AdbClient; serial: string; handle: RecordingHandle; startedAt: number; ended: boolean } | null = null

  ipcMain.handle('capture:screenshot', async (): Promise<ScreenshotResult> => {
    const s = session()
    if (!('client' in s)) return { ok: false, category: s.ok ? 'other' : s.category, message: s.ok ? '' : s.message, fix: s.ok ? '' : s.fix, detail: '' }
    const file = join(captureDir('screenshot'), captureFileName('screenshot', new Date()))
    const result = await s.client.screenshot(s.serial, file)
    if (!result.ok) return result
    // A small copy for the window. Very large pictures are shown only as a saved file.
    const size = statSync(file).size
    const dataUrl = size <= 15_000_000 ? `data:image/png;base64,${readFileSync(file).toString('base64')}` : ''
    return { ok: true, path: file, dataUrl }
  })

  ipcMain.handle('capture:record-start', async (_event, preset: unknown): Promise<ActionResult> => {
    const s = session()
    if (!('client' in s)) return s
    if (recording !== null) return notReady('other', 'A recording is already running. Stop it first.')
    const chosen = isRecordingPreset(preset) ? preset : 'small'
    const handle = s.client.startRecording(s.serial, chosen)
    const current = { client: s.client, serial: s.serial, handle, startedAt: Date.now(), ended: false }
    recording = current
    void handle.done.then(() => {
      current.ended = true
    })
    return { ok: true, detail: 'Recording started.' }
  })

  ipcMain.handle('capture:record-status', (): RecordingStatus => {
    if (recording === null) return { state: 'idle' }
    return { state: recording.ended ? 'ended' : 'recording', startedAt: recording.startedAt }
  })

  ipcMain.handle('capture:record-stop', async (): Promise<SaveRecordingResult> => {
    const current = recording
    if (current === null) {
      const { message, fix } = explainFailure('other')
      return { ok: false, category: 'other', message: 'No recording is running.', fix, detail: message }
    }
    try {
      const file = join(captureDir('recording'), captureFileName('recording', new Date(current.startedAt)))
      const result = await current.client.finishRecording(current.serial, current.handle, file)
      return result.ok ? { ok: true, path: file } : result
    } finally {
      recording = null
    }
  })

  ipcMain.handle('capture:reveal', (_event, path: unknown): void => {
    if (typeof path !== 'string') return
    const allowed = [join(app.getPath('pictures'), 'Couchkit'), join(app.getPath('videos'), 'Couchkit')]
    if (allowed.some((dir) => path.startsWith(dir)) && existsSync(path)) platform.revealInFolder(path)
  })

  // ---- Console ----

  ipcMain.handle('console:run', async (_event, command: unknown): Promise<ShellResult> => {
    const s = session()
    if (!('client' in s)) {
      return { ok: false, output: '', truncated: false, exitCode: null, durationMs: 0, category: s.ok ? 'other' : s.category, message: s.ok ? '' : `${s.message} ${s.fix}` }
    }
    return s.client.runShell(s.serial, typeof command === 'string' ? command : '')
  })

  ipcMain.handle('console:shortcuts-list', () => shortcuts.load())

  ipcMain.handle('console:shortcuts-save', async (_event, name: unknown, command: unknown) => {
    const current = await shortcuts.load()
    const updated = addShortcut(current, typeof name === 'string' ? name : '', typeof command === 'string' ? command : '')
    if (updated === null) return current
    await shortcuts.save(updated)
    return updated
  })

  ipcMain.handle('console:shortcuts-remove', async (_event, id: unknown) => {
    const current = await shortcuts.load()
    if (typeof id !== 'string') return current
    const updated = removeShortcut(current, id)
    await shortcuts.save(updated)
    return updated
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
