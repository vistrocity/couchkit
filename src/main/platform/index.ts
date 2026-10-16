import { app, shell } from 'electron'
import { homedir } from 'node:os'
import type { AppInfo } from '@shared/types'
import {
  networkPermissionHint,
  normalizeOs,
  shortcutModifier,
  toolBinaryName,
  userDataDir
} from './paths'

/**
 * The platform layer: the only module that knows which operating system we are on.
 * Other modules import `platform` and call these functions.
 */
const os = process.platform

export const platform = {
  isMac: os === 'darwin',
  isWindows: os === 'win32',
  os: normalizeOs(os),
  shortcutModifier: shortcutModifier(os),

  /** Folder for history, logs, and downloaded tools. */
  dataDir: (): string => userDataDir(os, process.env, homedir(), 'Couchkit'),

  /** "adb" or "adb.exe". */
  toolBinaryName: (tool: string): string => toolBinaryName(os, tool),

  /** Opens the system file browser with this file selected. */
  revealInFolder: (path: string): void => shell.showItemInFolder(path),

  networkPermissionHint: (): string => networkPermissionHint(os),

  appInfo: (): AppInfo => ({
    appName: 'Couchkit',
    appVersion: app.getVersion(),
    os: normalizeOs(os),
    shortcutModifier: shortcutModifier(os)
  })
}
