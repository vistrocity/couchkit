import { isValidComponent } from './tweaks'

/** Lists the home-screen apps (launchers) installed on the TV. */
export const LIST_LAUNCHERS_COMMAND = 'cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.HOME'

/** Asks which launcher the Home button opens right now. */
export const RESOLVE_LAUNCHER_COMMAND = 'cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME'

/** Launchers that come with Google TV / Android TV. Turning these off is optional and reversible. */
export const STOCK_LAUNCHER_PACKAGES: readonly string[] = [
  'com.google.android.tvlauncher',
  'com.google.android.apps.tv.launcherx',
  'com.google.android.leanbacklauncher'
]

export interface LauncherInfo {
  component: string
  packageName: string
  /** Came with the TV. */
  system: boolean
  isDefault: boolean
  /** Has a running process right now. */
  running: boolean
  /** Is the one in charge of the home screen right now. */
  isActive: boolean
  /** Exempt from battery saving, so Android is less likely to close it. */
  keepAlive: boolean
}

export interface LauncherStatus {
  launchers: LauncherInfo[]
  /** The launcher Android lists as the default for the Home button, or null when none is chosen. */
  defaultComponent: string | null
  /**
   * The launcher that is actually in charge of the home screen right now (read from the running system).
   * Some launchers take over Home themselves, so this can differ from the default above.
   */
  activeHomePackage: string | null
  /** Stock launchers that were turned off (so they can be turned back on). */
  turnedOff: string[]
}

export const MAX_LAUNCHERS = 20

/**
 * Some system apps list themselves for the Home button (settings, first-time setup) but are not launchers.
 * Making one of them the default would break the home screen, so they are never shown.
 */
export function isNotALauncher(packageName: string): boolean {
  return /^com\.android\.(tv\.)?settings$/.test(packageName) || /provision|setup|wizard/i.test(packageName)
}

/** Reads `mHomeProcess=ProcessRecord{abc 1234:com.pkg/u0a95}` from the system's activity dump. */
export function parseActiveHome(output: string): string | null {
  return /mHomeProcess=ProcessRecord\{[^}]*?\s\d+:([A-Za-z][\w.]*)\//.exec(output)?.[1] ?? null
}

/** Component names (package/class) from the TV's answer, in order, without repeats. */
export function parseComponents(output: string): string[] {
  const seen: string[] = []
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim()
    if (isValidComponent(line) && !seen.includes(line)) seen.push(line)
  }
  return seen
}

export const packageOf = (component: string): string => component.split('/')[0] ?? component

/** The chosen launcher, or null if the answer is the "choose an app" box. */
export function parseDefaultLauncher(output: string): string | null {
  const first = parseComponents(output)[0]
  if (first === undefined || first.startsWith('android/')) return null
  return first
}

/** `dumpsys deviceidle whitelist` lines look like "user,com.pkg,10123". */
export function parseWhitelist(output: string): Set<string> {
  const set = new Set<string>()
  for (const line of output.split(/\r?\n/)) {
    const m = /^(?:user|system|system-excidle),([A-Za-z][\w.]*),\d+/.exec(line.trim())
    if (m?.[1] !== undefined) set.add(m[1])
  }
  return set
}

/** The package names listed by `pm list packages`. */
export function parsePackageNames(output: string): Set<string> {
  const set = new Set<string>()
  for (const line of output.split(/\r?\n/)) {
    const m = /^package:(\S+)/.exec(line.trim())
    if (m?.[1] !== undefined) set.add(m[1])
  }
  return set
}

/** First read: everything except which processes run. */
export const LAUNCHER_READ_SCRIPT = [
  "echo '@@lh-list'",
  LIST_LAUNCHERS_COMMAND,
  "echo '@@lh-home'",
  'dumpsys activity activities | grep mHomeProcess',
  "echo '@@lh-default'",
  RESOLVE_LAUNCHER_COMMAND,
  "echo '@@lh-idle'",
  'dumpsys deviceidle whitelist',
  "echo '@@lh-disabled'",
  'pm list packages -d',
  "echo '@@lh-system'",
  'pm list packages -s'
].join('; ')

/** Second read: one line per launcher package, "@@lh-pid <package> <pids>". */
export function pidScript(packages: readonly string[]): string {
  return packages.map((p) => `echo @@lh-pid ${p} $(pidof ${p})`).join('; ')
}

export function parsePids(output: string): Set<string> {
  const running = new Set<string>()
  for (const line of output.split(/\r?\n/)) {
    const m = /^@@lh-pid (\S+)\s+\d+/.exec(line.trim())
    if (m?.[1] !== undefined) running.add(m[1])
  }
  return running
}

export function splitMarked(output: string): Map<string, string> {
  const map = new Map<string, string>()
  let current: string | null = null
  let lines: string[] = []
  const flush = (): void => {
    if (current !== null) map.set(current, lines.join('\n'))
    lines = []
  }
  for (const line of output.split(/\r?\n/)) {
    const m = /^@@(lh-[a-z]+)$/.exec(line.trim())
    if (m !== null) {
      flush()
      current = m[1] ?? null
    } else lines.push(line)
  }
  flush()
  return map
}

/** Commands that keep a launcher alive: no battery saving, background use allowed. */
export const keepAliveCommands = (pkg: string, on: boolean): string[] =>
  on
    ? [`dumpsys deviceidle whitelist +${pkg}`, `cmd appops set ${pkg} RUN_IN_BACKGROUND allow`, `cmd appops set ${pkg} RUN_ANY_IN_BACKGROUND allow`]
    : [`dumpsys deviceidle whitelist -${pkg}`, `cmd appops set ${pkg} RUN_IN_BACKGROUND default`, `cmd appops set ${pkg} RUN_ANY_IN_BACKGROUND default`]

export const setDefaultCommand = (component: string): string => `cmd package set-home-activity '${component}'`

/** What is on screen right now. Used after pressing Home to see which launcher answered. */
export const FOREGROUND_COMMAND = 'dumpsys activity activities | grep -E "ResumedActivity|topResumedActivity"'

/** Reads the app on screen from lines like "mResumedActivity: ActivityRecord{1a2 u0 com.pkg/.Main t12}". */
export function parseForeground(output: string): string | null {
  return /\bu\d+\s+([A-Za-z][\w.]*)\//.exec(output)?.[1] ?? null
}
