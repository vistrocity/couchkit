import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { MAX_SHORTCUTS, MAX_SHORTCUT_NAME, isValidCommand, type SavedShortcut } from '@shared/console'

export function addShortcut(list: readonly SavedShortcut[], name: string, command: string): SavedShortcut[] | null {
  const cleanName = name.trim().slice(0, MAX_SHORTCUT_NAME)
  if (cleanName === '' || !isValidCommand(command) || list.length >= MAX_SHORTCUTS) return null
  return [...list, { id: randomUUID(), name: cleanName, command: command.trim() }]
}

export function removeShortcut(list: readonly SavedShortcut[], id: string): SavedShortcut[] {
  return list.filter((s) => s.id !== id)
}

/** Keeps only well-formed entries, so a damaged file can never crash the app. */
export function sanitizeShortcuts(value: unknown): SavedShortcut[] {
  if (!Array.isArray(value)) return []
  const result: SavedShortcut[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const e = item as Record<string, unknown>
    if (typeof e['id'] !== 'string' || typeof e['name'] !== 'string' || !isValidCommand(e['command'])) continue
    result.push({ id: e['id'], name: e['name'].slice(0, MAX_SHORTCUT_NAME), command: e['command'] })
    if (result.length >= MAX_SHORTCUTS) break
  }
  return result
}

export class ShortcutStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<SavedShortcut[]> {
    try {
      return sanitizeShortcuts(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch {
      return []
    }
  }

  async save(list: readonly SavedShortcut[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.tmp`
    await writeFile(temp, JSON.stringify(list, null, 2), 'utf8')
    await rename(temp, this.filePath)
  }
}
