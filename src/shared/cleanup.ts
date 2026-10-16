/** Helpers for the Cleanup page. */

/** Reads the free space of the TV's main storage. */
export const STORAGE_COMMAND = 'df -k /data'

export interface Storage {
  totalKb: number
  freeKb: number
}

/** Understands the output of `df -k /data` (the long name may wrap onto its own line). */
export function parseStorage(output: string): Storage | null {
  const tokens = output.split(/\s+/).filter((t) => t !== '')
  const headerEnd = tokens.findIndex((t) => /^Mounted$/i.test(t))
  const rest = headerEnd >= 0 ? tokens.slice(headerEnd + (tokens[headerEnd + 1] === 'on' ? 2 : 1)) : tokens
  // Last six values are: filesystem, total, used, available, use%, mount point.
  const row = rest.slice(-6)
  if (row.length < 6) return null
  const total = Number(row[1])
  const free = Number(row[3])
  if (!Number.isInteger(total) || !Number.isInteger(free) || total <= 0 || free < 0 || free > total) return null
  return { totalKb: total, freeKb: free }
}

export function formatKb(kb: number): string {
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = Math.abs(kb)
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

/** Apps whose saved data should never be wiped from here: doing so can break the TV's settings or screen. */
export function isProtectedPackage(packageName: string): boolean {
  return (
    packageName === 'android' ||
    packageName.startsWith('com.android.providers.') ||
    ['com.android.systemui', 'com.android.settings', 'com.android.shell', 'com.google.android.gms', 'com.google.android.gsf', 'com.android.inputmethod.latin'].includes(packageName)
  )
}
