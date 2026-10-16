import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LOCAL_APK_NAME, type BackupApp } from '@shared/backup'
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
