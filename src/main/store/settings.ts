import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AppSettings } from '@shared/types'

export const DEFAULT_SETTINGS: AppSettings = { activityLog: false }

/** Keeps only known, well-formed values, so a damaged file can never crash the app. */
export function sanitizeSettings(value: unknown): AppSettings {
  const v = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return { activityLog: v['activityLog'] === true }
}

export class SettingsStore {
  private cache: AppSettings | null = null

  constructor(private readonly filePath: string) {}

  async load(): Promise<AppSettings> {
    if (this.cache !== null) return this.cache
    try {
      this.cache = sanitizeSettings(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch {
      this.cache = { ...DEFAULT_SETTINGS }
    }
    return this.cache
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    this.cache = sanitizeSettings(settings)
    await mkdir(dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.tmp`
    await writeFile(temp, JSON.stringify(this.cache, null, 2), 'utf8')
    await rename(temp, this.filePath)
    return this.cache
  }
}
