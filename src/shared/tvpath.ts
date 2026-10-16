// Helpers for paths on the TV (always forward slashes, whatever computer you are on).

export const FILES_ROOT = '/sdcard'

/** The quick-jump shortcuts shown on the Files page. */
export const FILE_SHORTCUTS: ReadonlyArray<{ label: string; path: string }> = [
  { label: 'Storage', path: '/sdcard' },
  { label: 'Download', path: '/sdcard/Download' },
  { label: 'Movies', path: '/sdcard/Movies' },
  { label: 'Pictures', path: '/sdcard/Pictures' },
  { label: 'DCIM', path: '/sdcard/DCIM' }
]

/** A path we are willing to hand to the TV: absolute, sane length, no control characters. */
export function isValidRemotePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    value.length <= 1024 &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f]/.test(value)
  )
}

/** Cleans up "//", trailing slashes and "." / ".." parts. */
export function normalizeRemotePath(value: string): string {
  const parts: string[] = []
  for (const part of value.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return '/' + parts.join('/')
}

export function joinRemotePath(dir: string, name: string): string {
  return normalizeRemotePath(`${dir}/${name}`)
}

export function parentRemotePath(path: string): string {
  const parts = normalizeRemotePath(path).split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/')
}

/** Clickable pieces of a path: "/sdcard/Download" -> [{name:"sdcard",path:"/sdcard"}, ...] */
export function breadcrumbs(path: string): Array<{ name: string; path: string }> {
  const parts = normalizeRemotePath(path).split('/').filter(Boolean)
  return parts.map((name, i) => ({ name, path: '/' + parts.slice(0, i + 1).join('/') }))
}

/** Places that are never allowed to be deleted, even by mistake. */
const PROTECTED = new Set([
  '/',
  '/sdcard',
  '/storage',
  '/storage/emulated',
  '/storage/emulated/0',
  '/storage/self',
  '/storage/self/primary',
  '/sdcard/Android',
  '/storage/emulated/0/Android'
])

/**
 * Deleting is limited to files and folders inside the TV's user storage, never the storage root
 * itself. (The TV's own protections block system folders as well; this is a second lock.)
 */
export function isDeletablePath(value: unknown): value is string {
  if (!isValidRemotePath(value)) return false
  const path = normalizeRemotePath(value)
  if (PROTECTED.has(path)) return false
  return path.startsWith('/sdcard/') || path.startsWith('/storage/')
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}
