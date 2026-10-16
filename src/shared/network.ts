// Pure helpers for validating what the user types as a TV address.
// Kept free of Node/Electron imports so both sides and the tests can use it.

export interface HostPort {
  host: string
  port: number
}

export const DEFAULT_ADB_PORT = 5555

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** True if every octet is 0-255. */
function isValidIpv4(text: string): boolean {
  const m = IPV4.exec(text)
  if (!m) return false
  return m.slice(1, 5).every((part) => Number(part) <= 255)
}

/**
 * Parses "192.168.0.105" or "192.168.0.105:5555".
 * Returns null for anything else, so nothing odd is ever passed on to adb.
 * (IPv6 and host names are not supported in v0.1.)
 */
export function parseHostPort(input: string): HostPort | null {
  const text = input.trim()
  if (text.length === 0) return null

  const [host, portText, ...rest] = text.split(':')
  if (rest.length > 0 || host === undefined || !isValidIpv4(host)) return null

  if (portText === undefined) return { host, port: DEFAULT_ADB_PORT }
  if (!/^\d{1,5}$/.test(portText)) return null
  const port = Number(portText)
  if (port < 1 || port > 65535) return null
  return { host, port }
}

/** "192.168.0.105:5555" - the form adb uses to name a network device. */
export function formatHostPort({ host, port }: HostPort): string {
  return `${host}:${port}`
}
