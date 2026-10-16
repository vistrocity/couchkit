/**
 * App permissions: reading what an app may do and switching the changeable ones.
 * Only "runtime" permissions (the ones Android asks the person about) can be changed.
 */

export interface PermissionEntry {
  /** Android's name, such as "android.permission.CAMERA". */
  permission: string
  /** Plain-words name. */
  label: string
  granted: boolean
  /** True when the TV's maker or an admin fixed it, so it cannot be changed here. */
  locked: boolean
}

export interface CommonPermission {
  id: string
  label: string
  permission: string
}

/** The permissions people ask about most. The list of apps holding one is built from this fixed table. */
export const COMMON_PERMISSIONS: readonly CommonPermission[] = [
  { id: 'camera', label: 'Camera', permission: 'android.permission.CAMERA' },
  { id: 'microphone', label: 'Microphone', permission: 'android.permission.RECORD_AUDIO' },
  { id: 'location', label: 'Location', permission: 'android.permission.ACCESS_FINE_LOCATION' },
  { id: 'storage', label: 'Files and storage', permission: 'android.permission.READ_EXTERNAL_STORAGE' },
  { id: 'contacts', label: 'Contacts', permission: 'android.permission.READ_CONTACTS' },
  { id: 'phone', label: 'Phone state', permission: 'android.permission.READ_PHONE_STATE' },
  { id: 'notifications', label: 'Notifications', permission: 'android.permission.POST_NOTIFICATIONS' },
  { id: 'nearby', label: 'Nearby devices (Bluetooth)', permission: 'android.permission.BLUETOOTH_CONNECT' }
]

export function findCommonPermission(id: unknown): CommonPermission | undefined {
  return typeof id === 'string' ? COMMON_PERMISSIONS.find((p) => p.id === id) : undefined
}

export function isValidPermissionName(name: unknown): name is string {
  return typeof name === 'string' && name.length <= 200 && /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(name)
}

const KNOWN_LABELS: Record<string, string> = {
  CAMERA: 'Camera',
  RECORD_AUDIO: 'Microphone',
  ACCESS_FINE_LOCATION: 'Precise location',
  ACCESS_COARSE_LOCATION: 'Approximate location',
  ACCESS_BACKGROUND_LOCATION: 'Location in the background',
  READ_EXTERNAL_STORAGE: 'Read files and storage',
  WRITE_EXTERNAL_STORAGE: 'Change files and storage',
  READ_MEDIA_AUDIO: 'Read music and audio',
  READ_MEDIA_VIDEO: 'Read videos',
  READ_MEDIA_IMAGES: 'Read photos',
  READ_CONTACTS: 'Read contacts',
  WRITE_CONTACTS: 'Change contacts',
  READ_PHONE_STATE: 'Phone state',
  POST_NOTIFICATIONS: 'Show notifications',
  BLUETOOTH_CONNECT: 'Connect to nearby devices',
  BLUETOOTH_SCAN: 'Look for nearby devices',
  NEARBY_WIFI_DEVICES: 'Nearby Wi-Fi devices',
  READ_CALENDAR: 'Read calendar',
  WRITE_CALENDAR: 'Change calendar'
}

export function permissionLabel(permission: string): string {
  const last = permission.split('.').at(-1) ?? permission
  return KNOWN_LABELS[last] ?? last.toLowerCase().split('_').map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ')
}

/**
 * Reads the "runtime permissions:" part of `dumpsys package <name>`. Lines look like
 * `android.permission.CAMERA: granted=true, flags=[ USER_SET|USER_FIXED]`.
 */
export function parsePermissions(dump: string): PermissionEntry[] {
  const lines = dump.split(/\r?\n/)
  const start = lines.findIndex((l) => /^\s*runtime permissions:\s*$/.test(l))
  if (start === -1) return []
  const headerIndent = (/^(\s*)/.exec(lines[start] ?? '')?.[1] ?? '').length
  const found: PermissionEntry[] = []
  for (const line of lines.slice(start + 1)) {
    const indent = (/^(\s*)/.exec(line)?.[1] ?? '').length
    if (line.trim() === '' || indent <= headerIndent) break
    const m = /^\s+([A-Za-z][\w.]*): granted=(true|false)(?:, flags=\[([^\]]*)\])?/.exec(line)
    if (m === null) break
    const permission = m[1] ?? ''
    const flags = m[3] ?? ''
    found.push({
      permission,
      label: permissionLabel(permission),
      granted: m[2] === 'true',
      locked: /SYSTEM_FIXED|POLICY_FIXED/.test(flags)
    })
  }
  return found
}

export function dumpPackageCommand(packageName: string): string {
  return `dumpsys package ${packageName}`
}

/** One call that checks every user-installed app for one permission. Only ever built from the fixed table above. */
export function holdersScript(permission: string): string {
  return `for p in $(pm list packages -3 | cut -d: -f2); do if dumpsys package $p | grep -qF '${permission}: granted=true'; then echo "@@holder $p"; fi; done`
}

export function parseHolders(output: string): string[] {
  const names: string[] = []
  for (const line of output.split(/\r?\n/)) {
    const m = /^@@holder ([A-Za-z][\w]*(?:\.[\w]+)+)\s*$/.exec(line.trim())
    if (m?.[1] !== undefined) names.push(m[1])
  }
  return [...new Set(names)].sort()
}
