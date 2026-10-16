// The Tune-ups: settings Couchkit can change on the TV.
//
// Everything here is fixed data written by us. The screen only ever sends "tweak id + choice id"
// (or one validated density number); the commands that run come from this table, never from the screen.

export type TweakGroup = 'Speed' | 'Display' | 'System' | 'Network'

export interface TweakChoice {
  id: string
  label: string
  /** Shell commands (run on the TV) that apply this choice. */
  commands: readonly string[]
}

export interface Tweak {
  id: string
  group: TweakGroup
  title: string
  /** Tweaks with the same card name are shown together in one block. */
  card?: string
  help: string
  /** Read-only commands that show the current state. The keys name the results. */
  reads: Readonly<Record<string, string>>
  choices: readonly TweakChoice[]
  /** Works out which choice is active from what the TV reported. null = something else (a custom value). */
  detect: (values: Readonly<Record<string, string>>) => string | null
  /**
   * Present on changes that could make the TV hard to use if they go wrong (text size, rotation).
   * Gives the commands that put things back exactly as they were; the app undoes the change
   * after 15 seconds unless you press "Keep".
   */
  restore?: (values: Readonly<Record<string, string>>) => string[]
}

const num = (value: string | undefined): number | null => {
  if (value === undefined || value === '' || value === 'null') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Puts a value back: writes it, or removes the setting if it had no value before. */
function putOrDelete(namespace: 'system' | 'global' | 'secure', key: string, value: string | undefined): string {
  return value === undefined || value === '' || value === 'null' ? `settings delete ${namespace} ${key}` : `settings put ${namespace} ${key} ${value}`
}

const animationChoice = (id: string, label: string, scale: string): TweakChoice => ({
  id,
  label,
  commands: [
    `settings put global window_animation_scale ${scale}`,
    `settings put global transition_animation_scale ${scale}`,
    `settings put global animator_duration_scale ${scale}`
  ]
})

const fontChoice = (id: string, label: string, scale: string): TweakChoice => ({
  id,
  label,
  commands: [`settings put system font_scale ${scale}`]
})

const rotationChoice = (id: string, label: string, rotation: number): TweakChoice => ({
  id,
  label,
  commands: ['settings put system accelerometer_rotation 0', `settings put system user_rotation ${rotation}`]
})

const timeoutChoice = (id: string, label: string, ms: number): TweakChoice => ({
  id,
  label,
  commands: [`settings put system screen_off_timeout ${ms}`]
})

const dnsChoice = (id: string, label: string, host: string): TweakChoice => ({
  id,
  label,
  commands: ['settings put global private_dns_mode hostname', `settings put global private_dns_specifier ${host}`]
})

const DNS_HOSTS: Readonly<Record<string, string>> = {
  adguard: 'dns.adguard-dns.com',
  cloudflare: 'one.one.one.one',
  google: 'dns.google',
  quad9: 'dns.quad9.net'
}

const ntpChoice = (id: string, label: string, host: string | null): TweakChoice => ({
  id,
  label,
  commands: [host === null ? 'settings delete global ntp_server' : `settings put global ntp_server ${host}`]
})

export const TWEAKS: readonly Tweak[] = [
  {
    id: 'animations',
    group: 'Speed',
    title: 'Animation speed',
    help: 'Menus and screens move faster when animations are shorter. The number is the length of each animation compared with normal (1×). "Off" removes the motion completely.',
    reads: { scale: 'settings get global window_animation_scale' },
    choices: [animationChoice('off', 'Off · 0', '0'), animationChoice('fast', 'Fast · 0.5×', '0.5'), animationChoice('normal', 'Normal · 1×', '1'), animationChoice('slow', 'Slow · 1.5×', '1.5')],
    detect: (v) => {
      const n = num(v['scale']) ?? 1
      return n === 0 ? 'off' : n === 0.5 ? 'fast' : n === 1 ? 'normal' : n === 1.5 ? 'slow' : null
    }
  },
  {
    id: 'freezer',
    group: 'Speed',
    title: 'Freeze cached apps',
    help: 'Lets Android 11 and newer pause apps you are not using, which can free memory on TVs with little RAM. It needs support from the TV\'s system, so on many TVs it changes nothing. Restart the TV afterwards for it to take effect. "TV default" removes the setting.',
    reads: { mode: 'settings get global cached_apps_freezer' },
    choices: [
      { id: 'default', label: 'TV default', commands: ['settings delete global cached_apps_freezer'] },
      { id: 'on', label: 'On', commands: ['settings put global cached_apps_freezer enabled'] },
      { id: 'off', label: 'Off', commands: ['settings put global cached_apps_freezer disabled'] }
    ],
    detect: (v) => {
      const m = (v['mode'] ?? 'null').trim()
      return m === 'enabled' ? 'on' : m === 'disabled' ? 'off' : m === 'null' || m === '' || m === 'device_default' ? 'default' : null
    }
  },
  {
    id: 'font',
    group: 'Display',
    title: 'Text size',
    help: 'Makes text across the TV smaller or larger.',
    reads: { scale: 'settings get system font_scale' },
    choices: [fontChoice('small', 'Small', '0.85'), fontChoice('normal', 'Normal', '1.0'), fontChoice('large', 'Large', '1.15'), fontChoice('xlarge', 'Extra large', '1.3')],
    detect: (v) => {
      const n = num(v['scale']) ?? 1
      return n === 0.85 ? 'small' : n === 1 ? 'normal' : n === 1.15 ? 'large' : n === 1.3 ? 'xlarge' : null
    },
    restore: (v) => [putOrDelete('system', 'font_scale', v['scale'])]
  },
  {
    id: 'rotation',
    group: 'Display',
    title: 'Rotate the screen',
    help: 'For a TV mounted sideways or upside down. The TV picture turns by the angle you choose.',
    reads: { rotation: 'settings get system user_rotation', auto: 'settings get system accelerometer_rotation' },
    choices: [rotationChoice('0', 'Normal', 0), rotationChoice('1', '90°', 1), rotationChoice('2', '180°', 2), rotationChoice('3', '270°', 3)],
    detect: (v) => {
      const n = num(v['rotation']) ?? 0
      return n >= 0 && n <= 3 && Number.isInteger(n) ? String(n) : null
    },
    restore: (v) => [putOrDelete('system', 'accelerometer_rotation', v['auto']), putOrDelete('system', 'user_rotation', v['rotation'])]
  },
  {
    id: 'timeout',
    group: 'System',
    card: 'Screen off and screen saver',
    title: 'Screen timeout',
    help: 'How long the TV waits before the screen turns off. Some TVs ignore this setting.',
    reads: { ms: 'settings get system screen_off_timeout' },
    choices: [
      timeoutChoice('15s', '15 s', 15_000),
      timeoutChoice('30s', '30 s', 30_000),
      timeoutChoice('1m', '1 min', 60_000),
      timeoutChoice('2m', '2 min', 120_000),
      timeoutChoice('5m', '5 min', 300_000),
      timeoutChoice('10m', '10 min', 600_000),
      timeoutChoice('30m', '30 min', 1_800_000),
      timeoutChoice('never', 'Never', 2_147_483_647)
    ],
    detect: (v) => {
      const n = num(v['ms'])
      if (n === null) return null
      const map: Record<number, string> = { 15000: '15s', 30000: '30s', 60000: '1m', 120000: '2m', 300000: '5m', 600000: '10m', 1800000: '30m', 2147483647: 'never' }
      return map[n] ?? null
    }
  },
  {
    id: 'screensaver',
    group: 'System',
    card: 'Screen off and screen saver',
    title: 'Screen saver',
    help: 'The pictures or clock shown when the TV is idle.',
    reads: { on: 'settings get secure screensaver_enabled', component: 'settings get secure screensaver_components' },
    choices: [
      { id: 'on', label: 'On', commands: ['settings put secure screensaver_enabled 1'] },
      { id: 'off', label: 'Off', commands: ['settings put secure screensaver_enabled 0'] }
    ],
    detect: (v) => (num(v['on']) === 0 ? 'off' : num(v['on']) === 1 ? 'on' : null)
  },
  {
    id: 'devoptions',
    group: 'System',
    title: 'Developer options menu',
    help: 'Shows or hides the Developer options entry in the TV settings. Hiding it does not turn off debugging, so Couchkit keeps working.',
    reads: { on: 'settings get global development_settings_enabled' },
    choices: [
      { id: 'shown', label: 'Shown', commands: ['settings put global development_settings_enabled 1'] },
      { id: 'hidden', label: 'Hidden', commands: ['settings put global development_settings_enabled 0'] }
    ],
    detect: (v) => (num(v['on']) === 0 ? 'hidden' : num(v['on']) === 1 ? 'shown' : null)
  },
  {
    id: 'location',
    group: 'System',
    title: 'Location',
    help: 'Lets apps on the TV know roughly where it is (for weather, for example).',
    reads: { mode: 'settings get secure location_mode' },
    choices: [
      { id: 'on', label: 'On', commands: ['settings put secure location_mode 3'] },
      { id: 'off', label: 'Off', commands: ['settings put secure location_mode 0'] }
    ],
    detect: (v) => {
      const n = num(v['mode'])
      return n === null ? null : n === 0 ? 'off' : 'on'
    }
  },
  {
    id: 'autotime',
    group: 'System',
    card: 'Date and time',
    title: 'Set date and time automatically',
    help: 'Keeps the clock right using the network. Turn it Off if you want to set the clock yourself (below).',
    reads: { on: 'settings get global auto_time' },
    choices: [
      { id: 'on', label: 'On', commands: ['settings put global auto_time 1', 'settings put global auto_time_zone 1'] },
      { id: 'off', label: 'Off', commands: ['settings put global auto_time 0', 'settings put global auto_time_zone 0'] }
    ],
    detect: (v) => (num(v['on']) === 0 ? 'off' : num(v['on']) === 1 ? 'on' : null)
  },
  {
    id: 'ntp',
    group: 'System',
    card: 'Date and time',
    title: 'Time server',
    help: 'Try another time server if the TV shows the wrong time even with automatic time on.',
    reads: { host: 'settings get global ntp_server' },
    choices: [ntpChoice('default', 'TV default', null), ntpChoice('pool', 'pool.ntp.org', 'pool.ntp.org'), ntpChoice('google', 'time.google.com', 'time.google.com'), ntpChoice('cloudflare', 'time.cloudflare.com', 'time.cloudflare.com')],
    detect: (v) => {
      const h = v['host'] ?? 'null'
      return h === 'null' || h === '' ? 'default' : h === 'pool.ntp.org' ? 'pool' : h === 'time.google.com' ? 'google' : h === 'time.cloudflare.com' ? 'cloudflare' : null
    }
  },
  {
    id: 'dns',
    group: 'Network',
    title: 'Private DNS',
    help: 'The DNS service the TV uses. AdGuard blocks many ad and tracker addresses used by apps and the home screen. It cannot block ads that are part of the video itself (YouTube, for example).',
    reads: { mode: 'settings get global private_dns_mode', host: 'settings get global private_dns_specifier' },
    choices: [
      { id: 'auto', label: 'Automatic', commands: ['settings put global private_dns_mode opportunistic'] },
      { id: 'off', label: 'Off', commands: ['settings put global private_dns_mode off'] },
      dnsChoice('adguard', 'AdGuard (blocks ads)', DNS_HOSTS['adguard'] ?? ''),
      dnsChoice('cloudflare', 'Cloudflare', DNS_HOSTS['cloudflare'] ?? ''),
      dnsChoice('google', 'Google', DNS_HOSTS['google'] ?? ''),
      dnsChoice('quad9', 'Quad9', DNS_HOSTS['quad9'] ?? '')
    ],
    detect: (v) => {
      const mode = v['mode'] ?? 'null'
      if (mode === 'null' || mode === '' || mode === 'opportunistic') return 'auto'
      if (mode === 'off') return 'off'
      if (mode === 'hostname') {
        const host = v['host'] ?? ''
        return Object.entries(DNS_HOSTS).find(([, h]) => h === host)?.[0] ?? null
      }
      return null
    }
  }
]

export function findTweak(id: unknown): Tweak | undefined {
  return typeof id === 'string' ? TWEAKS.find((t) => t.id === id) : undefined
}

export function findChoice(tweak: Tweak, choiceId: unknown): TweakChoice | undefined {
  return typeof choiceId === 'string' ? tweak.choices.find((c) => c.id === choiceId) : undefined
}

// ---- Screen density (a number, so it has its own rules) ----

export const MIN_DENSITY = 120
export const MAX_DENSITY = 720

export function isValidDensity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_DENSITY && value <= MAX_DENSITY
}

export interface DensityInfo {
  physical: number
  /** The density now in use (the physical one unless it was changed). */
  current: number
  changed: boolean
}

/** Reads `wm density`: "Physical density: 240" and, if changed, "Override density: 213". */
export function parseDensity(text: string): DensityInfo | null {
  const physical = /Physical density:\s*(\d+)/i.exec(text)?.[1]
  if (physical === undefined) return null
  const override = /Override density:\s*(\d+)/i.exec(text)?.[1]
  return { physical: Number(physical), current: Number(override ?? physical), changed: override !== undefined }
}

/** Commands that put the density back as it was. */
export function densityRestore(info: DensityInfo): string[] {
  return [info.changed ? `wm density ${info.current}` : 'wm density reset']
}

// ---- Reading everything in one go ----

/** The command that reads every tweak (and the density) in one call. Markers split the answers apart. */
export const READ_SCRIPT: string = [
  ...TWEAKS.flatMap((t) => Object.entries(t.reads).flatMap(([key, command]) => [`echo '@@${t.id}.${key}'`, command])),
  "echo '@@density'",
  'wm density'
].join('; ')

export interface TweakState {
  id: string
  /** The active choice id, or null if it is something else (custom or unknown). */
  choice: string | null
  values: Record<string, string>
}

export interface TweakSnapshot {
  tweaks: TweakState[]
  density: DensityInfo | null
}

export function parseTweakReads(output: string): TweakSnapshot {
  const sections = new Map<string, string>()
  let current: string | null = null
  const lines: string[] = []
  const flush = (): void => {
    if (current !== null) sections.set(current, lines.join('\n').trim())
    lines.length = 0
  }
  for (const line of output.split(/\r?\n/)) {
    const marker = /^@@(\S+)$/.exec(line.trim())
    if (marker !== null) {
      flush()
      current = marker[1] ?? null
    } else {
      lines.push(line)
    }
  }
  flush()

  const tweaks = TWEAKS.map((t): TweakState => {
    const values: Record<string, string> = {}
    for (const key of Object.keys(t.reads)) values[key] = sections.get(`${t.id}.${key}`) ?? 'null'
    return { id: t.id, choice: t.detect(values), values }
  })
  return { tweaks, density: parseDensity(sections.get('density') ?? '') }
}


// ---- Setting the clock by hand ----

const TIME_ZONE = /^[A-Za-z]+(?:[/_+-][A-Za-z0-9]+){0,3}$/

/** True for a time zone name such as "Asia/Kolkata". */
export function isValidTimeZone(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && TIME_ZONE.test(value)
}

/** Commands that set the TV clock (and, if given, the time zone). Only works while automatic time is off. */
export function clockCommands(nowMs: unknown, zone: unknown): string[] | null {
  if (typeof nowMs !== 'number' || !Number.isInteger(nowMs) || nowMs < 1_600_000_000_000 || nowMs > 4_000_000_000_000) return null
  const commands: string[] = []
  if (zone !== null && zone !== undefined) {
    if (!isValidTimeZone(zone)) return null
    commands.push(`cmd alarm set-timezone ${zone}`)
  }
  commands.push(`cmd alarm set-time ${nowMs}`)
  return commands
}

// ---- Screen saver apps ----

export interface ScreensaverOption {
  /** package/class, as the TV names it. */
  component: string
  /** The app's package name, shown to the person. */
  packageName: string
}

const COMPONENT = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*\/[A-Za-z0-9_.$]+$/

export function isValidComponent(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 255 && COMPONENT.test(value)
}

/** The command that lists every screen saver app installed on the TV. */
export const LIST_SCREENSAVERS_COMMAND = 'cmd package query-services --brief -a android.service.dreams.DreamService'

/** Reads the component names out of the TV's answer (one per line, "package/class"). */
export function parseScreensavers(output: string): ScreensaverOption[] {
  const seen = new Set<string>()
  const options: ScreensaverOption[] = []
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim()
    if (!isValidComponent(line)) continue
    if (seen.has(line)) continue
    seen.add(line)
    options.push({ component: line, packageName: line.split('/')[0] ?? line })
  }
  return options
}

/** Commands that choose a screen saver app and make sure screen savers are on. */
export function screensaverCommands(component: string): string[] {
  return [`settings put secure screensaver_components '${component}'`, 'settings put secure screensaver_enabled 1']
}
