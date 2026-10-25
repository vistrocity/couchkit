import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOCAL_APK_NAME, explainFolderError, type BackupApp } from '@shared/backup'
import { isValidPackageName } from '@shared/remote'

const MAX_APPS = 500

/** Looks inside a backup folder: one sub-folder per app, each holding that app's .apk files. */
export function scanBackupFolder(folder: string): BackupApp[] {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) return []
  const apps: BackupApp[] = []
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isValidPackageName(entry.name)) continue
    const dir = join(folder, entry.name)
    const files = readdirSync(dir, { withFileTypes: true })
      .filter((f) => f.isFile() && LOCAL_APK_NAME.test(f.name))
      .map((f) => f.name)
      .sort((a, b) => (a === 'base.apk' ? -1 : b === 'base.apk' ? 1 : a.localeCompare(b)))
    if (files.length === 0) continue
    const sizeBytes = files.reduce((sum, f) => sum + statSync(join(dir, f)).size, 0)
    apps.push({ packageName: entry.name, files, sizeBytes })
    if (apps.length >= MAX_APPS) break
  }
  return apps.sort((a, b) => a.packageName.localeCompare(b.packageName))
}

export type PreparedFolder = { ok: true; folder: string } | { ok: false; message: string; fix: string }

/** Creates the new backup folder and checks that files can really be written into it. */
export function prepareBackupFolder(root: string, name: string): PreparedFolder {
  const folder = join(root, name)
  try {
    mkdirSync(folder, { recursive: true })
    const probe = join(folder, '.couchkit-write-test')
    writeFileSync(probe, 'ok')
    rmSync(probe, { force: true })
    return { ok: true, folder }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return { ok: false, ...explainFolderError(code, root) }
  }
}

/** Plain words for any unexpected error while saving one app. */
export function describeSaveError(error: unknown): { message: string; fix: string } {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  const detail = error instanceof Error ? error.message : String(error)
  const known = code !== undefined ? explainFolderError(code, 'the backup folder') : null
  return known ?? { message: `This app could not be saved (${detail}).`, fix: 'Try again, or choose another folder with "Save to…".' }
}
