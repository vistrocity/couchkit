import { parseStorage, type Storage } from './cleanup'

/** What the Connect page shows about the TV's hardware. */
export interface HardwareInfo {
  /** Total memory (RAM) in KB. */
  ramKb: number | null
  storage: Storage | null
  uptimeSeconds: number | null
  /** The processor family, such as "arm64-v8a". */
  cpuAbi?: string
  /** The chip or board name the maker reports. */
  chip?: string
  securityPatch?: string
}

/** One call that reads everything above. Markers split the answers apart. */
export const HARDWARE_SCRIPT = [
  "echo '@@mem'",
  "grep '^MemTotal' /proc/meminfo",
  "echo '@@disk'",
  'df -k /data',
  "echo '@@up'",
  'cat /proc/uptime',
  "echo '@@abi'",
  'getprop ro.product.cpu.abi',
  "echo '@@chip'",
  'getprop ro.board.platform',
  'getprop ro.hardware',
  "echo '@@patch'",
  'getprop ro.build.version.security_patch'
].join('; ')

function sections(output: string): Map<string, string> {
  const map = new Map<string, string>()
  let current: string | null = null
  let lines: string[] = []
  const flush = (): void => {
    if (current !== null) map.set(current, lines.join('\n').trim())
    lines = []
  }
  for (const line of output.split(/\r?\n/)) {
    const marker = /^@@(\w+)$/.exec(line.trim())
    if (marker !== null) {
      flush()
      current = marker[1] ?? null
    } else lines.push(line)
  }
  flush()
  return map
}

export function parseHardware(output: string): HardwareInfo {
  const s = sections(output)
  const ram = /MemTotal:\s*(\d+)\s*kB/i.exec(s.get('mem') ?? '')?.[1]
  const up = Number(/^(\d+(?:\.\d+)?)/.exec(s.get('up') ?? '')?.[1])
  const abi = (s.get('abi') ?? '').split('\n')[0]?.trim()
  const chips = (s.get('chip') ?? '').split('\n').map((c) => c.trim()).filter((c) => c !== '')
  const chip = [...new Set(chips)].join(' / ')
  const patch = /^\d{4}-\d{2}-\d{2}$/.exec((s.get('patch') ?? '').trim())?.[0]
  return {
    ramKb: ram !== undefined ? Number(ram) : null,
    storage: parseStorage(s.get('disk') ?? ''),
    uptimeSeconds: Number.isFinite(up) && up > 0 ? Math.floor(up) : null,
    ...(abi !== undefined && abi !== '' ? { cpuAbi: abi } : {}),
    ...(chip !== '' ? { chip } : {}),
    ...(patch !== undefined ? { securityPatch: patch } : {})
  }
}

/** "3 days 4 h", "5 h 12 min", "7 min". */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d} day${d === 1 ? '' : 's'} ${h} h`
  if (h > 0) return `${h} h ${m} min`
  return `${Math.max(m, 1)} min`
}
