import { explainInstallFailure } from './apk'
import { classifyAdbFailure } from './classify'
import { KEYCODES } from './keys'
import { parseLs, shellQuote } from './files'
import { VERSION_NAMES_COMMAND, buildApps, packageNameSet, parsePackageList, parseVersionNames } from './packages'
import { buildTextArg } from './text'
import { parseConnectOutput, parseDevices, parseGetprop, parseWmSize } from './parse'
import { runCommand, type LogSink } from './runner'
import { explainFailure } from '@shared/explain'
import { formatHostPort, type HostPort } from '@shared/network'
import { isRemoteKey, isValidPackageName } from '@shared/remote'
import { isValidCommand } from '@shared/console'
import { LIST_SCREENSAVERS_COMMAND, READ_SCRIPT, isValidComponent, parseScreensavers, parseTweakReads, screensaverCommands } from '@shared/tweaks'
import { STORAGE_COMMAND, isProtectedPackage, parseStorage } from '@shared/cleanup'
import { isDeletablePath, isValidRemotePath, joinRemotePath, normalizeRemotePath } from '@shared/tvpath'
import type {
  ActionResult,
  ApkInstallResult,
  CommandResult,
  ConnectOutcome,
  DeviceInfo,
  ErrorCategory,
  ListAppsResult,
  ListFilesResult,
  ListScreensaversResult,
  ReadTweaksResult,
  StorageResult,
  TrimCachesResult,
  ShellResult,
  TransferResult
} from '@shared/types'

export interface AdbClientOptions {
  /** Path of the adb program. */
  binary: string
  /** Arguments placed before every command. Empty in the app; used by tests with a fake adb. */
  baseArgs?: readonly string[]
  log?: LogSink
  /** How long to wait for the user to accept the prompt on the TV. Default 25 s. */
  authWaitMs?: number
  /** How often to look again while waiting. Default 1 s. */
  authPollMs?: number
  /** Replaceable in tests so they do not really wait. */
  sleep?: (ms: number) => Promise<void>
}

const SHOT_REMOTE = '/data/local/tmp/couchkit-shot.png'
const REC_REMOTE = '/data/local/tmp/couchkit-rec.mp4'

export interface RecordingHandle {
  done: Promise<CommandResult>
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Everything the app asks adb to do about connecting to a TV. */
export class AdbClient {
  private readonly binary: string
  private readonly baseArgs: readonly string[]
  private readonly log: LogSink | undefined
  private readonly authWaitMs: number
  private readonly authPollMs: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(options: AdbClientOptions) {
    this.binary = options.binary
    this.baseArgs = options.baseArgs ?? []
    this.log = options.log
    this.authWaitMs = options.authWaitMs ?? 25_000
    this.authPollMs = options.authPollMs ?? 1_000
    this.sleep = options.sleep ?? realSleep
  }

  private run(args: readonly string[], timeoutMs = 15_000, sink: LogSink | undefined = this.log): Promise<CommandResult> {
    return runCommand(this.binary, [...this.baseArgs, ...args], { timeoutMs }, sink)
  }

  /**
   * `adb connect` exits with code 0 even when it fails, so the activity log would show a
   * failure as "ok". This marks such lines as failed, using the text adb printed.
   */
  private readonly connectSink: LogSink = (entry) => {
    const parsed = parseConnectOutput(entry.stdout, entry.stderr)
    if (entry.ok && !parsed.connected) {
      const category = classifyAdbFailure(parsed.text)
      this.log?.({ ...entry, ok: false, category: category === 'other' ? 'unreachable' : category })
    } else {
      this.log?.(entry)
    }
  }

  /** Connects to a TV and, if the TV accepts us, reads its details. */
  async connect(target: HostPort): Promise<ConnectOutcome> {
    const serial = formatHostPort(target)

    // The first adb call also starts adb's background server, which can take a few seconds.
    // A TV that has never seen this computer answers "failed to authenticate" and shows an
    // "Allow" prompt, so we keep trying for a while to give the user time to tap it.
    const deadline = Date.now() + this.authWaitMs
    for (;;) {
      const connectResult = await this.run(['connect', serial], 30_000, this.connectSink)
      if (!connectResult.ok) {
        return fail(connectResult.category ?? 'other', connectResult.stderr || connectResult.stdout)
      }
      const connected = parseConnectOutput(connectResult.stdout, connectResult.stderr)
      if (connected.connected) break

      const category = classifyAdbFailure(connected.text)
      if (category === 'unauthorized' && Date.now() < deadline) {
        await this.sleep(this.authPollMs)
        continue
      }
      return fail(category === 'other' ? 'unreachable' : category, connected.text)
    }

    // "Connected" is not enough: a new computer must also be allowed on the TV.
    const state = await this.waitForAuthorization(serial)
    if (state !== 'device') {
      const category: ErrorCategory = state === 'unauthorized' ? 'unauthorized' : 'offline'
      return fail(category, `Device state: ${state}`)
    }

    return { ok: true, device: await this.readDeviceInfo(target) }
  }

  async disconnect(target: HostPort): Promise<void> {
    await this.run(['disconnect', formatHostPort(target)])
  }

  /** Looks at `adb devices` until the TV is ready, or the wait runs out. */
  private async waitForAuthorization(serial: string): Promise<'device' | 'unauthorized' | 'offline'> {
    const deadline = Date.now() + this.authWaitMs
    for (;;) {
      const result = await this.run(['devices'])
      const listed = parseDevices(result.stdout).find((d) => d.serial === serial)
      if (listed?.state === 'device') return 'device'
      const waiting = listed?.state === 'unauthorized'
      if (!waiting || Date.now() >= deadline) {
        return waiting ? 'unauthorized' : 'offline'
      }
      await this.sleep(this.authPollMs)
    }
  }

  private shell(serial: string, args: readonly string[], timeoutMs = 15_000): Promise<CommandResult> {
    return this.run(['-s', serial, 'shell', ...args], timeoutMs)
  }

  /** Presses a remote button. */
  async sendKey(serial: string, key: string): Promise<ActionResult> {
    if (!isRemoteKey(key)) return actionFail('other', 'That button does not exist.', '', key)
    const result = await this.shell(serial, ['input', 'keyevent', KEYCODES[key]])
    return fromCommand(result, 'Sent.')
  }

  /** Types text into whatever field is focused on the TV. */
  async sendText(serial: string, text: string): Promise<ActionResult> {
    const built = buildTextArg(text)
    if (!built.ok) return actionFail('other', built.message, 'Change the text and try again.', '')
    const result = await this.shell(serial, ['input', 'text', built.arg])
    return fromCommand(result, 'Sent.')
  }

  /** Lists the apps on the TV. */
  async listApps(serial: string): Promise<ListAppsResult> {
    let all = await this.shell(serial, ['pm', 'list', 'packages', '-i', '--show-versioncode'], 30_000)
    if (!all.ok) all = await this.shell(serial, ['pm', 'list', 'packages', '-i'], 30_000)
    if (!all.ok) {
      const category = all.category ?? 'other'
      const { message, fix } = explainFailure(category)
      return { ok: false, category, message, fix, detail: (all.stderr || all.stdout).trim() }
    }
    const [user, disabled, versions] = await Promise.all([
      this.shell(serial, ['pm', 'list', 'packages', '-3'], 30_000),
      this.shell(serial, ['pm', 'list', 'packages', '-d'], 30_000),
      this.shell(serial, [VERSION_NAMES_COMMAND], 60_000)
    ])
    return {
      ok: true,
      apps: buildApps({
        all: parsePackageList(all.stdout),
        userPackages: packageNameSet(user.stdout),
        disabledPackages: packageNameSet(disabled.stdout),
        versionNames: versions.ok ? parseVersionNames(versions.stdout) : {}
      })
    }
  }

  /** Installs one APK file from this computer. */
  async installApk(serial: string, path: string, name: string): Promise<ApkInstallResult> {
    const result = await this.run(['-s', serial, 'install', '-r', path], 300_000)
    const text = `${result.stdout}\n${result.stderr}`
    if (result.ok && /\bSuccess\b/.test(text)) return { path, name, ok: true, message: 'Installed.' }
    if (!result.ok && result.category !== undefined && result.category !== 'other' && !/INSTALL_/.test(text)) {
      const { message, fix } = explainFailure(result.category)
      return { path, name, ok: false, message, fix }
    }
    const reason = explainInstallFailure(text)
    return { path, name, ok: false, message: reason.message, fix: reason.fix }
  }

  /** Removes an app. Apps that came with the TV are only removed for the current user (reversible). */
  async uninstall(serial: string, packageName: string): Promise<ActionResult> {
    if (!isValidPackageName(packageName)) return actionFail('other', 'That is not a valid app name.', '', packageName)
    const user = await this.shell(serial, ['pm', 'list', 'packages', '-3'], 30_000)
    const isUserApp = packageNameSet(user.stdout).has(packageName)
    const result = isUserApp
      ? await this.run(['-s', serial, 'uninstall', packageName], 60_000)
      : await this.shell(serial, ['pm', 'uninstall', '--user', '0', packageName], 60_000)
    const text = `${result.stdout}\n${result.stderr}`
    if (/\bSuccess\b/.test(text)) return { ok: true, detail: 'Removed.' }
    return actionFail(
      result.category ?? 'other',
      'The TV did not remove the app.',
      'Some apps are protected by the TV. Try turning it off (Disable) instead.',
      text.trim()
    )
  }

  /** Turns an app off or on without removing it. */
  async setEnabled(serial: string, packageName: string, enabled: boolean): Promise<ActionResult> {
    if (!isValidPackageName(packageName)) return actionFail('other', 'That is not a valid app name.', '', packageName)
    const args = enabled
      ? ['pm', 'enable', packageName]
      : ['pm', 'disable-user', '--user', '0', packageName]
    const result = await this.shell(serial, args, 30_000)
    const text = `${result.stdout}\n${result.stderr}`
    if (result.ok && /new state/i.test(text)) return { ok: true, detail: enabled ? 'Enabled.' : 'Disabled.' }
    return actionFail(
      result.category ?? 'other',
      enabled ? 'The TV did not turn the app on.' : 'The TV did not turn the app off.',
      'Some apps are protected by the TV and cannot be changed.',
      text.trim()
    )
  }

  /** Lists a folder on the TV. */
  async listFiles(serial: string, path: string): Promise<ListFilesResult> {
    if (!isValidRemotePath(path)) {
      return { ok: false, category: 'other', message: 'That is not a valid folder path.', fix: 'Paths on the TV start with a slash, like /sdcard/Download.', detail: String(path).slice(0, 100) }
    }
    const dir = normalizeRemotePath(path)
    const result = await this.shell(serial, ['ls', '-la', shellQuote(dir === '/' ? '/' : `${dir}/`)], 30_000)
    const text = `${result.stdout}\n${result.stderr}`
    if (/No such file or directory/i.test(text)) {
      return { ok: false, category: 'other', message: 'That folder does not exist on the TV.', fix: 'Go back up and pick another folder.', detail: text.trim() }
    }
    if (/Permission denied/i.test(text)) {
      return { ok: false, category: 'other', message: 'The TV does not allow opening that folder.', fix: 'Folders outside the main storage are usually protected. Use Storage, Download, Movies or Pictures.', detail: text.trim() }
    }
    if (!result.ok && result.stdout.trim() === '') {
      const category = result.category ?? 'other'
      const { message, fix } = explainFailure(category)
      return { ok: false, category, message, fix, detail: text.trim() }
    }
    return { ok: true, path: dir, entries: parseLs(result.stdout, dir) }
  }

  /** Copies a file or folder from the TV into a folder on this computer. */
  async pull(serial: string, remotePath: string, localDir: string): Promise<ActionResult> {
    if (!isValidRemotePath(remotePath)) return actionFail('other', 'That is not a valid path on the TV.', '', String(remotePath).slice(0, 100))
    const result = await this.run(['-s', serial, 'pull', normalizeRemotePath(remotePath), localDir], 3_600_000)
    const text = `${result.stdout}\n${result.stderr}`.trim()
    if (result.ok && /\bpulled\b/.test(text)) return { ok: true, detail: lastLine(text) }
    return transferFailure(result.category, text, 'The file could not be copied from the TV.')
  }

  /** Copies a file or folder from this computer into a folder on the TV. */
  async push(serial: string, localPath: string, remoteDir: string, name: string): Promise<TransferResult> {
    if (!isValidRemotePath(remoteDir)) return { name, ok: false, message: 'That is not a valid folder on the TV.' }
    const dir = normalizeRemotePath(remoteDir)
    const result = await this.run(['-s', serial, 'push', localPath, dir === '/' ? '/' : `${dir}/`], 3_600_000)
    const text = `${result.stdout}\n${result.stderr}`.trim()
    if (result.ok && /\bpushed\b/.test(text)) return { name, ok: true, message: 'Copied to the TV.' }
    const failure = transferFailure(result.category, text, 'The file could not be copied to the TV.')
    return { name, ok: false, message: failure.ok ? '' : failure.message, ...(failure.ok ? {} : { fix: failure.fix }) }
  }

  async makeFolder(serial: string, parent: string, name: string): Promise<ActionResult> {
    const clean = name.trim()
    // eslint-disable-next-line no-control-regex
    if (clean === '' || clean.length > 200 || clean === '.' || clean === '..' || /[\/\u0000-\u001f]/.test(clean)) {
      return actionFail('other', 'That is not a valid folder name.', 'Use letters, numbers, spaces and dashes. No slashes.', clean.slice(0, 100))
    }
    if (!isValidRemotePath(parent)) return actionFail('other', 'That is not a valid folder on the TV.', '', String(parent).slice(0, 100))
    const result = await this.shell(serial, ['mkdir', shellQuote(joinRemotePath(parent, clean))])
    const text = `${result.stdout}\n${result.stderr}`.trim()
    if (result.ok && text === '') return { ok: true, detail: 'Folder created.' }
    return actionFail('other', /exists/i.test(text) ? 'A folder with that name already exists.' : 'The TV could not create the folder.', 'Pick another name, or another location.', text)
  }

  /** Deletes a file or folder inside the TV's user storage. */
  async remove(serial: string, path: string): Promise<ActionResult> {
    if (!isDeletablePath(path)) {
      return actionFail('other', 'Couchkit will not delete that.', 'Only files and folders inside Storage can be deleted, not Storage itself.', String(path).slice(0, 100))
    }
    const result = await this.shell(serial, ['rm', '-r', shellQuote(normalizeRemotePath(path))], 120_000)
    const text = `${result.stdout}\n${result.stderr}`.trim()
    if (result.ok && text === '') return { ok: true, detail: 'Deleted.' }
    return actionFail('other', 'The TV did not delete it.', 'It may be protected, or already gone. Refresh and look again.', text)
  }

  /** Takes a screenshot and saves it as `localPath` on this computer. */
  async screenshot(serial: string, localPath: string): Promise<ActionResult> {
    const cap = await this.shell(serial, ['screencap', '-p', SHOT_REMOTE], 30_000)
    if (!cap.ok) return fromCommand(cap, '')
    const pull = await this.run(['-s', serial, 'pull', SHOT_REMOTE, localPath], 60_000)
    await this.shell(serial, ['rm', '-f', SHOT_REMOTE])
    const text = `${pull.stdout}\n${pull.stderr}`.trim()
    if (pull.ok && /\bpulled\b/.test(text)) return { ok: true, detail: 'Saved.' }
    return transferFailure(pull.category, text, 'The screenshot could not be copied from the TV.')
  }

  /**
   * Starts recording the TV screen. Returns at once; `done` finishes when the TV stops
   * (after the 3 minute limit Android applies, or when finishRecording is called).
   */
  startRecording(serial: string, preset: 'small' | 'full'): RecordingHandle {
    const sizeArgs = preset === 'small' ? ['--size', '1280x720', '--bit-rate', '4000000'] : []
    const done = this.run(['-s', serial, 'shell', 'screenrecord', '--time-limit', '180', ...sizeArgs, REC_REMOTE], 200_000)
    return { done }
  }

  /** Stops a recording, copies the video to `localPath`, and cleans up on the TV. */
  async finishRecording(serial: string, handle: RecordingHandle, localPath: string): Promise<ActionResult> {
    // Ctrl+C for the recorder on the TV: it then finishes writing a playable file.
    await this.shell(serial, ['kill -2 $(pidof screenrecord)'])
    const ended = await handle.done
    const pull = await this.run(['-s', serial, 'pull', REC_REMOTE, localPath], 600_000)
    await this.shell(serial, ['rm', '-f', REC_REMOTE])
    const pullText = `${pull.stdout}\n${pull.stderr}`.trim()
    if (pull.ok && /\bpulled\b/.test(pullText)) return { ok: true, detail: 'Saved.' }
    const recorderText = `${ended.stdout}\n${ended.stderr}`.trim()
    return actionFail(
      'other',
      'The TV did not produce a recording.',
      'Some TVs do not allow screen recording. Protected apps (such as streaming services) also block it.',
      recorderText !== '' ? recorderText : pullText
    )
  }

  /** Runs a command on the TV's shell and returns what it printed. Never runs anything on this computer. */
  async runShell(serial: string, command: string): Promise<ShellResult> {
    if (!isValidCommand(command)) {
      return { ok: false, output: '', truncated: false, exitCode: null, durationMs: 0, category: 'other', message: 'Type a single-line command.' }
    }
    const result = await this.shell(serial, [command.trim()], 30_000)
    const combined = result.stdout + (result.stdout !== '' && !result.stdout.endsWith('\n') && result.stderr !== '' ? '\n' : '') + result.stderr
    const limit = 200_000
    const truncated = combined.length > limit
    const category = result.category
    return {
      ok: result.ok,
      output: truncated ? combined.slice(0, limit) : combined,
      truncated,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      ...(category !== undefined ? { category } : {}),
      ...(category === 'timeout'
        ? { message: 'The command did not finish within 30 seconds, so it was stopped.' }
        : category === 'tool_missing' || category === 'unauthorized' || category === 'offline' || category === 'unreachable'
          ? { message: explainFailure(category).message }
          : {})
    }
  }

  /** Reads every Tune-up setting in one call. */
  async readTweaks(serial: string): Promise<ReadTweaksResult> {
    const result = await this.shell(serial, [READ_SCRIPT], 30_000)
    if (!result.ok && result.stdout.trim() === '') {
      const category = result.category ?? 'other'
      const { message, fix } = explainFailure(category)
      return { ok: false, category, message, fix, detail: (result.stderr || result.stdout).trim() }
    }
    return { ok: true, snapshot: parseTweakReads(result.stdout) }
  }

  /** Runs fixed settings commands from the Tune-ups table, in one call. */
  async runSettingsCommands(serial: string, commands: readonly string[]): Promise<ActionResult> {
    const result = await this.shell(serial, [commands.join('; ')], 30_000)
    const text = `${result.stdout}\n${result.stderr}`.trim()
    if (result.ok && !/exception|error|denied|not found|invalid|unknown/i.test(text)) return { ok: true, detail: 'Done.' }
    return actionFail(
      result.category ?? 'other',
      'The TV did not accept that change.',
      'Some TVs do not allow certain settings to be changed this way. The technical details below show what the TV said.',
      text
    )
  }

  /** Lists the screen saver apps installed on the TV. */
  async listScreensavers(serial: string): Promise<ListScreensaversResult> {
    const result = await this.shell(serial, [LIST_SCREENSAVERS_COMMAND], 30_000)
    if (!result.ok) {
      const category = result.category ?? 'other'
      const { message, fix } = explainFailure(category)
      return { ok: false, category, message, fix, detail: (result.stderr || result.stdout).trim() }
    }
    return { ok: true, options: parseScreensavers(result.stdout) }
  }

  /** Chooses a screen saver, but only one the TV just reported as installed. */
  async setScreensaver(serial: string, component: string): Promise<ActionResult> {
    if (!isValidComponent(component)) return actionFail('other', 'That screen saver name is not valid.', '', String(component).slice(0, 100))
    const list = await this.listScreensavers(serial)
    if (!list.ok) return list
    if (!list.options.some((o) => o.component === component)) return actionFail('other', 'That screen saver is not installed on the TV.', 'Press Refresh and choose again.', component)
    return this.runSettingsCommands(serial, screensaverCommands(component))
  }

  /** Free and total space of the TV's main storage. */
  async readStorage(serial: string): Promise<StorageResult> {
    const result = await this.shell(serial, [STORAGE_COMMAND], 30_000)
    const parsed = result.ok ? parseStorage(result.stdout) : null
    if (parsed !== null) return { ok: true, ...parsed }
    const category = result.category ?? 'other'
    const { message, fix } = result.ok
      ? { message: 'The TV did not report its free space.', fix: 'This TV may not support the storage check.' }
      : explainFailure(category)
    return { ok: false, category, message, fix, detail: (result.stderr || result.stdout).trim() }
  }

  /** Asks the TV to throw away the temporary files (caches) of all apps. Saved data and logins stay. */
  async clearCaches(serial: string): Promise<TrimCachesResult> {
    const before = await this.readStorage(serial)
    const result = await this.shell(serial, ['pm trim-caches 999G'], 120_000)
    const text = `${result.stdout}\n${result.stderr}`.trim()
    if (!result.ok || /exception|error|denied|unknown|not found/i.test(text)) {
      const failure = actionFail(
        result.category ?? 'other',
        'The TV did not clear its caches.',
        'Some TVs do not allow this from a computer. You can clear one app at a time in the TV settings instead.',
        text
      )
      return failure.ok ? { ok: true, freeBeforeKb: null, freeAfterKb: null } : failure
    }
    const after = await this.readStorage(serial)
    return { ok: true, freeBeforeKb: before.ok ? before.freeKb : null, freeAfterKb: after.ok ? after.freeKb : null }
  }

  /** Closes apps running in the background (the ones you are not using). */
  async closeBackgroundApps(serial: string): Promise<ActionResult> {
    const result = await this.shell(serial, ['am kill-all'], 30_000)
    const text = `${result.stdout}\n${result.stderr}`.trim()
    if (result.ok && !/exception|error|denied|unknown|not found/i.test(text)) return { ok: true, detail: 'Background apps closed.' }
    return actionFail(result.category ?? 'other', 'The TV did not close its background apps.', 'Try again, or restart the TV.', text)
  }

  /** Wipes an app's saved data and settings (like a fresh install). Cannot be undone. */
  async clearAppData(serial: string, packageName: string): Promise<ActionResult> {
    if (!isValidPackageName(packageName)) return actionFail('other', 'That is not a valid app name.', '', String(packageName).slice(0, 100))
    if (isProtectedPackage(packageName)) {
      return actionFail('other', 'Couchkit will not clear this app.', 'Clearing it could break the TV\'s settings or screen.', packageName)
    }
    const result = await this.shell(serial, ['pm', 'clear', packageName], 60_000)
    const text = `${result.stdout}\n${result.stderr}`.trim()
    if (/\bSuccess\b/.test(text)) return { ok: true, detail: 'Data cleared.' }
    return actionFail(result.category ?? 'other', 'The TV did not clear the app.', 'Some apps are protected by the TV.', text)
  }

  private async readDeviceInfo(target: HostPort): Promise<DeviceInfo> {
    const serial = formatHostPort(target)
    const [props, size] = await Promise.all([
      this.run(['-s', serial, 'shell', 'getprop']),
      this.run(['-s', serial, 'shell', 'wm', 'size'])
    ])
    const p = props.ok ? parseGetprop(props.stdout) : {}
    const resolution = size.ok ? parseWmSize(size.stdout) : undefined

    const info: DeviceInfo = { serial, host: target.host, port: target.port }
    const set = <K extends keyof DeviceInfo>(key: K, value: DeviceInfo[K] | undefined): void => {
      if (value !== undefined && value !== '') info[key] = value as DeviceInfo[K]
    }
    set('manufacturer', p['ro.product.manufacturer'])
    set('model', p['ro.product.model'])
    set('androidVersion', p['ro.build.version.release'])
    set('sdkLevel', p['ro.build.version.sdk'])
    set('resolution', resolution)
    set('buildId', p['ro.build.display.id'])
    set('hardwareSerial', p['ro.serialno'])
    return info
  }
}

function fail(category: ErrorCategory, detail: string): ConnectOutcome {
  const { message, fix } = explainFailure(category)
  return { ok: false, category, message, fix, detail: detail.trim() }
}

function actionFail(category: ErrorCategory, message: string, fix: string, detail: string): ActionResult {
  return { ok: false, category, message, fix, detail }
}

function fromCommand(result: CommandResult, okDetail: string): ActionResult {
  if (result.ok) return { ok: true, detail: okDetail }
  const category = result.category ?? 'other'
  const { message, fix } = explainFailure(category)
  return actionFail(category, message, fix, (result.stderr || result.stdout).trim())
}

function lastLine(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  return lines[lines.length - 1] ?? ''
}

function transferFailure(category: ErrorCategory | undefined, text: string, fallback: string): ActionResult {
  if (/no space left|insufficient/i.test(text)) {
    return actionFail('no_space', 'There is not enough free space.', 'Free up space on the TV (or on this computer) and try again.', text)
  }
  if (/permission denied|read-only file system/i.test(text)) {
    return actionFail('other', 'The TV does not allow writing there.', 'Choose a folder inside Storage, like Download.', text)
  }
  if (/does not exist|no such file/i.test(text)) {
    return actionFail('other', 'That file or folder was not found.', 'Refresh the list and try again.', text)
  }
  const cat = category ?? 'other'
  if (cat !== 'other') {
    const { message, fix } = explainFailure(cat)
    return actionFail(cat, message, fix, text)
  }
  return actionFail('other', fallback, 'Open the Activity page to see the full message from the TV.', text)
}
