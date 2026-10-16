// Types shared by the main process, the preload bridge, and the UI.
// Keep this file to types only, so both sides agree at build time.

/** Why a command failed, in terms the UI can turn into a plain message and a fix. */
export type ErrorCategory =
  | 'unreachable' // TV not found at that address / connection refused / timed out
  | 'unauthorized' // TV has not accepted this computer's key yet
  | 'offline' // adb sees the device but it is not responding
  | 'no_space' // not enough storage on the TV
  | 'bad_apk' // app file is invalid, wrong architecture, or too old
  | 'tool_missing' // adb (or another tool) could not be started
  | 'timeout' // we gave up waiting
  | 'other'

/** The one result shape every command returns. */
export interface CommandResult {
  ok: boolean
  /** Human-readable command line, for the activity log only (never re-executed). */
  command: string
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
  /** Present when ok is false. */
  category?: ErrorCategory
}

export interface AppInfo {
  appName: string
  appVersion: string
  os: 'darwin' | 'win32' | 'linux'
  /** Label for the primary shortcut key on this system. */
  shortcutModifier: 'Cmd' | 'Ctrl'
}

export interface AdbStatus {
  found: boolean
  version?: string
  path?: string
  message: string
}

/** Progress of the adb download, shown as a bar in the UI. */
export interface DownloadProgress {
  phase: 'downloading' | 'extracting' | 'done'
  receivedBytes: number
  /** null when the server does not say how big the file is. */
  totalBytes: number | null
}

export interface InstallResult {
  ok: boolean
  message: string
  status?: AdbStatus
}

/** Facts about a connected TV. Fields the TV does not report are left out. */
export interface DeviceInfo {
  /** adb's name for the device, "192.168.0.105:5555". */
  serial: string
  host: string
  port: number
  manufacturer?: string
  model?: string
  androidVersion?: string
  sdkLevel?: string
  resolution?: string
  buildId?: string
  /** The TV's own serial number, if it reports one. */
  hardwareSerial?: string
}

/** A TV the user has connected to before. */
export interface HistoryEntry {
  /** "host:port" */
  id: string
  host: string
  port: number
  nickname: string
  model?: string
  androidVersion?: string
  /** Milliseconds since 1970. */
  lastConnectedAt: number
}

export type ConnectOutcome =
  | { ok: true; device: DeviceInfo }
  | { ok: false; category: ErrorCategory; message: string; fix: string; detail: string }

/** One line of the activity log. */
export interface LogEntry {
  id: number
  startedAt: number
  command: string
  ok: boolean
  exitCode: number | null
  durationMs: number
  category?: ErrorCategory
  /** stdout and stderr, truncated. */
  output: string
}

/** What the UI is allowed to ask the main process to do. */
export interface CouchkitApi {
  getAppInfo(): Promise<AppInfo>
  checkAdb(): Promise<AdbStatus>
  installAdb(): Promise<InstallResult>
  /** Subscribe to download progress. Returns a function that unsubscribes. */
  onInstallProgress(listener: (progress: DownloadProgress) => void): () => void
  connect(address: string): Promise<ConnectOutcome>
  disconnect(): Promise<void>
  getConnected(): Promise<DeviceInfo | null>
  listHistory(): Promise<HistoryEntry[]>
  renameHistory(id: string, nickname: string): Promise<HistoryEntry[]>
  removeHistory(id: string): Promise<HistoryEntry[]>
  listLog(): Promise<LogEntry[]>
}

declare global {
  interface Window {
    couchkit: CouchkitApi
  }
}
