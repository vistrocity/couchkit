// Rules for the Console page, shared by the UI (to ask before running) and the main process (to refuse bad input).

export const MAX_COMMAND_LENGTH = 1000
export const MAX_SHORTCUTS = 50
export const MAX_SHORTCUT_NAME = 40

/** A command is plain single-line text. Line breaks and control characters are never sent to the TV. */
export function isValidCommand(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    value.length <= MAX_COMMAND_LENGTH &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f\u007f]/.test(value)
  )
}

/**
 * Words that can delete data, change settings, or restart the TV. A command containing one of
 * them is not blocked (this is the user's own TV), but the screen asks "are you sure?" first.
 * A false alarm only costs one extra click.
 */
const RISKY: ReadonlyArray<RegExp> = [
  /\brm\b/,
  /\brmdir\b/,
  /\bmv\b/,
  /\bdd\b/,
  /\bmkfs/,
  /\bformat\b/,
  /\bwipe\b/,
  /\breboot\b/,
  /\bshutdown\b/,
  /\bpoweroff\b/,
  /\brecovery\b/,
  /\bbootloader\b/,
  /\bfactory/,
  /\bsu\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bkill(all)?\b/,
  /\bpkill\b/,
  /\bsetprop\b/,
  /\bsettings\s+put\b/,
  /\bsvc\b/,
  /\bpm\s+(clear|uninstall|disable|disable-user|hide|suspend|revoke|grant)\b/,
  /\bcmd\s+package\s+(uninstall|clear)\b/,
  /\bam\s+(force-stop|kill|kill-all|crash)\b/,
  /\bpm\s+install\b/,
  /\bcmd\s+\w+\s+(reset|disable)\b/,
  /(^|[^>])>\s*[^&\s]/ // writing output into a file
]

export function isRisky(command: string): boolean {
  return RISKY.some((pattern) => pattern.test(command))
}

export interface BuiltInShortcut {
  label: string
  command: string
  group: 'Info' | 'Network' | 'Apps and screen' | 'Power'
}

/** Ready-made commands that only read information, except where the group says Power. */
export const BUILT_IN_SHORTCUTS: readonly BuiltInShortcut[] = [
  { group: 'Info', label: 'Android version', command: 'getprop ro.build.version.release' },
  { group: 'Info', label: 'Security patch date', command: 'getprop ro.build.version.security_patch' },
  { group: 'Info', label: 'Battery and power', command: 'dumpsys battery' },
  { group: 'Info', label: 'Free storage', command: 'df -h /sdcard' },
  { group: 'Info', label: 'Memory', command: 'cat /proc/meminfo' },
  { group: 'Info', label: 'Uptime', command: 'uptime' },
  { group: 'Info', label: 'TV name', command: 'settings get global device_name' },
  { group: 'Network', label: 'IP address', command: 'ip addr show wlan0' },
  { group: 'Network', label: 'Wi-Fi details', command: 'dumpsys wifi | grep -E "mWifiInfo|SSID"' },
  { group: 'Apps and screen', label: 'App on screen now', command: 'dumpsys window | grep -E "mCurrentFocus"' },
  { group: 'Apps and screen', label: 'Screen size', command: 'wm size' },
  { group: 'Apps and screen', label: 'Screen density', command: 'wm density' },
  { group: 'Apps and screen', label: 'Open Settings', command: 'am start -a android.settings.SETTINGS' },
  { group: 'Apps and screen', label: 'Open Developer options', command: 'am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS' },
  { group: 'Power', label: 'Restart the TV', command: 'reboot' }
]

/** A shortcut the user saved. */
export interface SavedShortcut {
  id: string
  name: string
  command: string
}
