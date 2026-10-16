/** Helpers for saving installed apps to this computer and putting them back. */

/** Where the TV keeps the files of installed apps. Only these are copied. */
const REMOTE_APK = /^\/data\/app\/[A-Za-z0-9_.=~+\-/]+\.apk$/

/** A file name we are willing to create on this computer. */
export const LOCAL_APK_NAME = /^[A-Za-z0-9_.-]{1,120}\.apk$/

export function remoteApkName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/**
 * Reads `pm path <app>` output ("package:/data/app/.../base.apk", one line per file;
 * apps made of several parts have several lines). Anything unexpected is dropped.
 */
export function parseApkPaths(output: string): string[] {
  const paths: string[] = []
  for (const raw of output.split(/\r?\n/)) {
    const path = /^package:(\S+)$/.exec(raw.trim())?.[1]
    if (path === undefined || path.includes('..') || !REMOTE_APK.test(path)) continue
    if (!LOCAL_APK_NAME.test(remoteApkName(path))) continue
    if (!paths.includes(path)) paths.push(path)
  }
  return paths
}

export function backupFolderName(stamp: string): string {
  return `Couchkit-backup-${stamp}`
}

/** One app found inside a backup folder. */
export interface BackupApp {
  packageName: string
  /** The .apk files of the app (one, or several when the app comes in parts). */
  files: string[]
  sizeBytes: number
}

/** The outcome for one app in a backup or restore. */
export interface BackupItemResult {
  packageName: string
  ok: boolean
  message: string
  fix?: string
}

export interface BackupScan {
  folder: string
  apps: BackupApp[]
}

export interface BackupRunResult {
  /** The new folder on this computer, or null if nothing could be saved. */
  folder: string | null
  results: BackupItemResult[]
}

export interface BackupProgress {
  phase: 'backup' | 'restore'
  index: number
  total: number
  name: string
}
