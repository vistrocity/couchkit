import { networkInterfaces } from 'node:os'
import type { DiscoveredTv } from '@shared/types'
import { DEFAULT_ADB_PORT } from '@shared/network'
import { browseTvs, type NamedHost } from './mdns'
import { sweep } from './portscan'
import { ipToInt, localNetworks } from './subnet'

export interface DiscoveryResult {
  tvs: DiscoveredTv[]
  /** Things worth telling the person (a search method failed, nothing found, and so on). */
  notes: string[]
}

/** Combines what the two search methods found, one entry per address, ready TVs first. */
export function mergeFound(named: readonly NamedHost[], adbOpen: readonly string[]): DiscoveredTv[] {
  const byHost = new Map<string, DiscoveredTv>()
  for (const n of named) byHost.set(n.host, { host: n.host, name: n.name, adbOpen: false })
  for (const host of adbOpen) {
    const existing = byHost.get(host)
    byHost.set(host, { host, adbOpen: true, ...(existing?.name !== undefined ? { name: existing.name } : {}) })
  }
  return [...byHost.values()].sort((a, b) => Number(b.adbOpen) - Number(a.adbOpen) || ipToInt(a.host) - ipToInt(b.host))
}

/** Looks for TVs on the local network. Takes about 4 seconds. */
export async function findTvs(): Promise<DiscoveryResult> {
  const notes: string[] = []
  const networks = localNetworks(networkInterfaces())
  if (networks.length === 0) {
    return { tvs: [], notes: ['This computer does not seem to be on a home or office network. Connect to the same Wi-Fi as your TV.'] }
  }
  const hosts = [...new Set(networks.flatMap((n) => n.hosts))]

  const [named, open] = await Promise.all([
    browseTvs(3500).catch((error: unknown) => {
      notes.push(`Searching by network name did not work (${error instanceof Error ? error.message : String(error)}). Showing the address scan only.`)
      return [] as NamedHost[]
    }),
    sweep(hosts, { port: DEFAULT_ADB_PORT, timeoutMs: 700, concurrency: 96 })
  ])

  // TVs found by name may sit outside the scanned range, so check their debugging port too.
  const extra = named.map((n) => n.host).filter((h) => !hosts.includes(h))
  const extraOpen = extra.length > 0 ? await sweep(extra, { port: DEFAULT_ADB_PORT, timeoutMs: 700 }) : []

  const tvs = mergeFound(named, [...open, ...extraOpen])
  if (tvs.length === 0) {
    notes.push('No TV was found. Check that the TV is on and on the same Wi-Fi, and that USB debugging is turned on.')
  }
  return { tvs, notes }
}
