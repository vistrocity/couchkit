import type { NetworkInterfaceInfo } from 'node:os'

export function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  return (((parts[0] ?? 0) << 24) >>> 0) + ((parts[1] ?? 0) << 16) + ((parts[2] ?? 0) << 8) + (parts[3] ?? 0)
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

/** Home and office networks only: 10.x, 172.16-31.x, 192.168.x. We never probe public addresses. */
export function isPrivateIpv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  if (a === undefined || b === undefined) return false
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function prefixLength(netmask: string): number {
  return ipToInt(netmask)
    .toString(2)
    .split('')
    .filter((bit) => bit === '1').length
}

/**
 * The addresses worth probing on one network: every host in the /24 around the computer's own address
 * (or the whole network if it is smaller than that), except the computer itself.
 */
export function hostsToProbe(address: string, netmask: string): string[] {
  const bits = Math.max(24, prefixLength(netmask))
  const size = 2 ** (32 - bits)
  const own = ipToInt(address)
  const network = Math.floor(own / size) * size
  const hosts: string[] = []
  for (let n = network + 1; n < network + size - 1; n++) {
    if (n !== own) hosts.push(intToIp(n))
  }
  return hosts
}

export interface LocalNetwork {
  address: string
  hosts: string[]
}

/** The private IPv4 networks this computer is on (at most 3, so odd virtual adapters cannot make a long scan). */
export function localNetworks(interfaces: Record<string, NetworkInterfaceInfo[] | undefined>): LocalNetwork[] {
  const result: LocalNetwork[] = []
  for (const infos of Object.values(interfaces)) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal || !isPrivateIpv4(info.address)) continue
      if (result.some((n) => n.address === info.address)) continue
      result.push({ address: info.address, hosts: hostsToProbe(info.address, info.netmask) })
    }
  }
  return result.slice(0, 3)
}
