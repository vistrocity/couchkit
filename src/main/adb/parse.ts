/**
 * Pure parsers for the text that adb prints. Kept separate so they can be tested
 * with real-looking samples and no TV.
 */

/**
 * `adb connect` exits with code 0 even when it fails, so success must be read
 * from the text: "connected to X" or "already connected to X".
 */
export function parseConnectOutput(stdout: string, stderr: string): { connected: boolean; text: string } {
  const text = `${stdout}\n${stderr}`.trim()
  return { connected: /^(already )?connected to /im.test(text), text }
}

export type DeviceState = 'device' | 'unauthorized' | 'offline' | 'other'

export interface ListedDevice {
  serial: string
  state: DeviceState
}

/** Reads `adb devices` output. Ignores adb's own "* daemon ..." messages. */
export function parseDevices(stdout: string): ListedDevice[] {
  const devices: ListedDevice[] = []
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('*') || line.startsWith('List of devices')) continue
    const [serial, state] = line.split(/\s+/)
    if (serial === undefined || state === undefined) continue
    devices.push({
      serial,
      state: state === 'device' || state === 'unauthorized' || state === 'offline' ? state : 'other'
    })
  }
  return devices
}

/** Reads `adb shell getprop` output: lines like "[ro.product.model]: [Chromecast]". */
export function parseGetprop(stdout: string): Record<string, string> {
  const props: Record<string, string> = {}
  for (const match of stdout.matchAll(/^\[([^\]]+)\]: \[(.*)\]\s*$/gm)) {
    const key = match[1]
    const value = match[2]
    if (key !== undefined && value !== undefined) props[key] = value
  }
  return props
}

/** Reads `wm size`. A user-set "Override size" wins over the physical one. */
export function parseWmSize(stdout: string): string | undefined {
  const override = /Override size:\s*(\d+x\d+)/i.exec(stdout)?.[1]
  const physical = /Physical size:\s*(\d+x\d+)/i.exec(stdout)?.[1]
  return override ?? physical
}
