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

/** Turns a file-system error code into plain words about a folder we could not use. */
export function explainFolderError(code: string | undefined, folder: string): { message: string; fix: string } {
  switch (code) {
    case 'EPERM':
    case 'EACCES':
      return {
        message: `Couchkit is not allowed to save into ${folder}.`,
        fix: 'Press "Save to…" and choose another folder, for example one on your Desktop. Windows security (Controlled folder access) or a synced Documents folder can block it.'
      }
    case 'ENOSPC':
      return { message: 'This computer has no free space left to save the apps.', fix: 'Free up some space, or press "Save to…" and choose a drive with more room.' }
    case 'EROFS':
      return { message: `The folder ${folder} is read-only.`, fix: 'Press "Save to…" and choose a folder you can write to.' }
    case 'ENOENT':
    case 'ENOTDIR':
    case 'EEXIST':
      return { message: `The folder ${folder} could not be created.`, fix: 'Press "Save to…" and choose another folder.' }
    default:
      return { message: `Couchkit could not save into ${folder}${code !== undefined ? ` (${code})` : ''}.`, fix: 'Press "Save to…" and choose another folder, then try again.' }
  }
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
