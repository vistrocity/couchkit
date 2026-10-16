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

/** The result of something done on the TV (a key press, an install, and so on). */
export type ActionResult =
  | { ok: true; detail: string }
  | { ok: false; category: ErrorCategory; message: string; fix: string; detail: string }

/** One app on the TV. */
export interface AppPackage {
  packageName: string
  versionName?: string
  versionCode?: string
  /** Who installed it: a store name, "Sideloaded", or the raw installer id. */
  installedFrom: string
  /** True for apps that came with the TV. */
  system: boolean
  /** False if the app has been turned off. */
  enabled: boolean
}

export type ListAppsResult =
  | { ok: true; apps: AppPackage[] }
  | { ok: false; category: ErrorCategory; message: string; fix: string; detail: string }

/** The outcome of installing one APK file. */
export interface ApkInstallResult {
  path: string
  /** File name only, for display. */
  name: string
  ok: boolean
  message: string
  fix?: string
}

export interface ApkInstallProgress {
  /** 1-based position of the file being installed. */
  index: number
  total: number
  name: string
}

/** One file or folder on the TV. */
export interface FileEntry {
  name: string
  /** Full path on the TV. */
  path: string
  /** "link" is a shortcut to another place; it can be opened like a folder. */
  kind: 'dir' | 'file' | 'link'
  /** Bytes (files only). */
  size?: number
  /** "2026-10-16 10:03" */
  modified?: string
}

export type ListFilesResult =
  | { ok: true; path: string; entries: FileEntry[] }
  | { ok: false; category: ErrorCategory; message: string; fix: string; detail: string }

export interface TransferProgress {
  /** 1-based position of the item being sent. */
  index: number
  total: number
  name: string
}

export interface TransferResult {
  name: string
  ok: boolean
  message: string
  fix?: string
}

export type CaptureFailure = { ok: false; category: ErrorCategory; message: string; fix: string; detail: string }

export type ScreenshotResult =
  | { ok: true; /** Where the picture was saved on this computer. */ path: string; /** A small copy for showing in the window ("" if too big). */ dataUrl: string }
  | CaptureFailure

export type SaveRecordingResult = { ok: true; path: string } | CaptureFailure

export interface RecordingStatus {
  /** "ended" means the TV stopped by itself (time limit or an error) and the video is not saved yet. */
  state: 'idle' | 'recording' | 'ended'
  /** Milliseconds since 1970. */
  startedAt?: number
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

  /** Press a remote button on the connected TV. */
  sendKey(key: string): Promise<ActionResult>
  /** Type text into the field that is focused on the TV. */
  sendText(text: string): Promise<ActionResult>

  /** True if Couchkit was started as Administrator on Windows (this blocks drag and drop from Explorer). */
  isElevated(): Promise<boolean>

  listApps(): Promise<ListAppsResult>
  /** Opens the system file picker for APK files. Returns the chosen paths (empty if cancelled). */
  pickApks(): Promise<string[]>
  /** Turns a file the user dropped onto the window into its path on this computer. */
  pathForFile(file: File): string
  installApks(paths: string[]): Promise<ApkInstallResult[]>
  onApkProgress(listener: (progress: ApkInstallProgress) => void): () => void
  uninstallApp(packageName: string): Promise<ActionResult>
  setAppEnabled(packageName: string, enabled: boolean): Promise<ActionResult>

  listFiles(path: string): Promise<ListFilesResult>
  /** Asks where to save, then copies a file or folder from the TV. Cancelling gives ok:false with category "other" and an empty message. */
  downloadFromTv(path: string): Promise<ActionResult>
  /** Opens the system picker for files or for a folder. Returns the chosen paths (empty if cancelled). */
  pickUploads(kind: 'files' | 'folder'): Promise<string[]>
  /** Copies files or folders from this computer into a folder on the TV. */
  uploadToTv(remoteDir: string, localPaths: string[]): Promise<TransferResult[]>
  onTransferProgress(listener: (progress: TransferProgress) => void): () => void
  makeFolder(parent: string, name: string): Promise<ActionResult>
  deleteFromTv(path: string): Promise<ActionResult>

  takeScreenshot(): Promise<ScreenshotResult>
  /** preset: "small" (720p, smaller file) or "full" (the TV's own resolution). */
  startRecording(preset: string): Promise<ActionResult>
  recordingStatus(): Promise<RecordingStatus>
  /** Stops the recording and saves the video on this computer. */
  stopRecording(): Promise<SaveRecordingResult>
  /** Shows a saved screenshot or video in the system file manager. */
  revealCapture(path: string): Promise<void>
}

declare global {
  interface Window {
    couchkit: CouchkitApi
  }
}
