// Types shared by the main process, the preload bridge, and the UI.
// This file must contain types only, so both sides agree at build time.

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

/** What the UI is allowed to ask the main process to do. */
export interface CouchkitApi {
  getAppInfo(): Promise<AppInfo>
  checkAdb(): Promise<AdbStatus>
}

declare global {
  interface Window {
    couchkit: CouchkitApi
  }
}
