import { join } from 'node:path'

/**
 * Pure, testable OS rules. Nothing here imports Electron.
 * Everything else in Couchkit calls `platform/index.ts` and never checks the OS itself.
 */

export type SupportedOs = 'darwin' | 'win32' | 'linux'

export function normalizeOs(os: NodeJS.Platform): SupportedOs {
  return os === 'darwin' || os === 'win32' ? os : 'linux'
}

/** Name of a command-line tool's file on this OS: "adb" or "adb.exe". */
export function toolBinaryName(os: NodeJS.Platform, tool: string): string {
  return os === 'win32' ? `${tool}.exe` : tool
}

/** Label for the primary shortcut key. */
export function shortcutModifier(os: NodeJS.Platform): 'Cmd' | 'Ctrl' {
  return os === 'darwin' ? 'Cmd' : 'Ctrl'
}

/**
 * Where Couchkit keeps its own data (history, logs, downloaded tools).
 * Follows each system's convention; paths are always built with `join`,
 * never with a typed "/" or "\".
 */
export function userDataDir(
  os: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  home: string,
  appName: string
): string {
  switch (os) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', appName)
    case 'win32':
      return join(env['APPDATA'] ?? join(home, 'AppData', 'Roaming'), appName)
    default:
      return join(env['XDG_DATA_HOME'] ?? join(home, '.local', 'share'), appName)
  }
}

/** A hint shown when TV discovery finds nothing, specific to each system. */
export function networkPermissionHint(os: NodeJS.Platform): string {
  if (os === 'darwin') {
    return 'On macOS, allow Couchkit under System Settings > Privacy & Security > Local Network.'
  }
  if (os === 'win32') {
    return 'On Windows, allow Couchkit through the firewall when Windows asks, or enter the TV address by hand.'
  }
  return 'Check that your firewall allows local network access, or enter the TV address by hand.'
}
