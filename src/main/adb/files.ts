import type { FileEntry } from '@shared/types'
import { joinRemotePath } from '@shared/tvpath'

/**
 * Wraps a value in single quotes for the TV's shell, so every character is plain text.
 * A single quote inside the value is written as '\'' (close quote, escaped quote, reopen).
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Reads `ls -la` output from the TV. Two layouts exist, depending on the Android version:
 *   drwxrwx--x  4 root sdcard_rw 3452 2026-10-16 10:03 Android      (with link count)
 *   drwxrwx--x root sdcard_rw 2026-10-16 10:03 Android              (older, no count or size)
 * A name can contain spaces, so everything after the time is the name.
 */
const LINE = /^([-dlbcps][-rwxsStT]{9}[.+]?)\s+(?:\d+\s+)?(\S+)\s+(\S+)\s+(?:(\d+)\s+)?(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/

export function parseLs(stdout: string, dir: string): FileEntry[] {
  const entries: FileEntry[] = []
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trimEnd()
    const m = LINE.exec(line)
    if (m === null) continue
    const typeChar = m[1]?.[0]
    let name = m[7] ?? ''
    if (typeChar === 'l') name = name.split(' -> ')[0] ?? name
    if (name === '' || name === '.' || name === '..') continue
    const size = m[4] !== undefined ? Number(m[4]) : undefined
    entries.push({
      name,
      path: joinRemotePath(dir, name),
      kind: typeChar === 'd' ? 'dir' : typeChar === 'l' ? 'link' : 'file',
      ...(size !== undefined && typeChar !== 'd' && typeChar !== 'l' ? { size } : {}),
      modified: `${m[5]} ${m[6]}`
    })
  }
  return entries.sort((a, b) => {
    const aDir = a.kind !== 'file' ? 0 : 1
    const bDir = b.kind !== 'file' ? 0 : 1
    return aDir - bDir || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}
