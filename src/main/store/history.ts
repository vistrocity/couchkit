import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { DeviceInfo, HistoryEntry } from '@shared/types'

/** Longest nickname we keep. */
export const MAX_NICKNAME = 40

/** Newest first. */
function sorted(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => b.lastConnectedAt - a.lastConnectedAt)
}

/** Adds a TV, or refreshes it if it is already in the list (keeping a nickname the user chose). */
export function upsertConnection(
  entries: readonly HistoryEntry[],
  device: DeviceInfo,
  now: number
): HistoryEntry[] {
  const id = `${device.host}:${device.port}`
  const existing = entries.find((e) => e.id === id)
  const entry: HistoryEntry = {
    id,
    host: device.host,
    port: device.port,
    nickname: existing?.nickname ?? device.model ?? device.host,
    lastConnectedAt: now,
    ...(device.model !== undefined ? { model: device.model } : existing?.model !== undefined ? { model: existing.model } : {}),
    ...(device.androidVersion !== undefined
      ? { androidVersion: device.androidVersion }
      : existing?.androidVersion !== undefined
        ? { androidVersion: existing.androidVersion }
        : {})
  }
  return sorted([...entries.filter((e) => e.id !== id), entry])
}

export function renameEntry(entries: readonly HistoryEntry[], id: string, nickname: string): HistoryEntry[] {
  const clean = nickname.trim().slice(0, MAX_NICKNAME)
  if (clean === '') return sorted(entries)
  return sorted(entries.map((e) => (e.id === id ? { ...e, nickname: clean } : e)))
}

export function removeEntry(entries: readonly HistoryEntry[], id: string): HistoryEntry[] {
  return sorted(entries.filter((e) => e.id !== id))
}

/** Keeps only well-formed entries, so a damaged file can never crash the app. */
export function sanitize(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return []
  const result: HistoryEntry[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const e = item as Record<string, unknown>
    if (
      typeof e['id'] !== 'string' ||
      typeof e['host'] !== 'string' ||
      typeof e['port'] !== 'number' ||
      typeof e['nickname'] !== 'string' ||
      typeof e['lastConnectedAt'] !== 'number'
    ) {
      continue
    }
    result.push({
      id: e['id'],
      host: e['host'],
      port: e['port'],
      nickname: e['nickname'].slice(0, MAX_NICKNAME),
      lastConnectedAt: e['lastConnectedAt'],
      ...(typeof e['model'] === 'string' ? { model: e['model'] } : {}),
      ...(typeof e['androidVersion'] === 'string' ? { androidVersion: e['androidVersion'] } : {})
    })
  }
  return sorted(result)
}

/** The history list, kept in a small JSON file in Couchkit's data folder. */
export class HistoryStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<HistoryEntry[]> {
    try {
      const text = await readFile(this.filePath, 'utf8')
      return sanitize(JSON.parse(text))
    } catch {
      // Missing or damaged file: start with an empty list.
      return []
    }
  }

  /** Writes to a temporary file first, so a crash cannot leave a half-written list. */
  async save(entries: readonly HistoryEntry[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.tmp`
    await writeFile(temp, JSON.stringify(entries, null, 2), 'utf8')
    await rename(temp, this.filePath)
  }
}
