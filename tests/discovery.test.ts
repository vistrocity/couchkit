import { describe, expect, it } from 'vitest'
import { createServer } from 'node:net'
import type { NetworkInterfaceInfo } from 'node:os'
import { hostsToProbe, intToIp, ipToInt, isPrivateIpv4, localNetworks } from '../src/main/discovery/subnet'
import { realConnect, sweep } from '../src/main/discovery/portscan'
import { browseTvs, type MdnsLike } from '../src/main/discovery/mdns'
import { mergeFound } from '../src/main/discovery'

const iface = (address: string, netmask: string, extra: Partial<NetworkInterfaceInfo> = {}): NetworkInterfaceInfo =>
  ({ address, netmask, family: 'IPv4', internal: false, mac: '00', cidr: null, ...extra }) as NetworkInterfaceInfo

describe('subnets', () => {
  it('converts addresses both ways', () => {
    expect(ipToInt('192.168.1.190')).toBe(3232235966)
    expect(intToIp(3232235966)).toBe('192.168.1.190')
  })
  it('knows private ranges', () => {
    for (const ip of ['10.0.0.5', '172.16.0.1', '172.31.9.9', '192.168.1.1']) expect(isPrivateIpv4(ip)).toBe(true)
    for (const ip of ['8.8.8.8', '172.32.0.1', '169.254.1.1', '100.64.0.1']) expect(isPrivateIpv4(ip)).toBe(false)
  })
  it('lists the other 253 hosts of a /24, never the computer itself', () => {
    const hosts = hostsToProbe('192.168.1.50', '255.255.255.0')
    expect(hosts).toHaveLength(253)
    expect(hosts).not.toContain('192.168.1.50')
    expect(hosts).not.toContain('192.168.1.0')
    expect(hosts).not.toContain('192.168.1.255')
    expect(hosts[0]).toBe('192.168.1.1')
  })
  it('limits a big network (/16) to the /24 around the computer', () => {
    const hosts = hostsToProbe('10.1.2.3', '255.255.0.0')
    expect(hosts.every((h) => h.startsWith('10.1.2.'))).toBe(true)
    expect(hosts).toHaveLength(253)
  })
  it('uses the whole network when it is smaller than a /24', () => {
    expect(hostsToProbe('192.168.1.130', '255.255.255.192')).toHaveLength(61)
  })
  it('keeps private, non-internal IPv4 networks only, at most three', () => {
    const nets = localNetworks({
      lo: [iface('127.0.0.1', '255.0.0.0', { internal: true })],
      wifi: [iface('192.168.1.50', '255.255.255.0'), iface('fe80::1', 'ffff::', { family: 'IPv6' })],
      vpn: [iface('8.8.4.4', '255.255.255.0')],
      a: [iface('10.0.0.2', '255.255.255.0')],
      b: [iface('172.16.5.5', '255.255.255.0')],
      c: [iface('192.168.50.2', '255.255.255.0')]
    })
    expect(nets.map((n) => n.address)).toEqual(['192.168.1.50', '10.0.0.2', '172.16.5.5'])
  })
})

describe('port sweep', () => {
  it('returns hosts that answer, respecting a fake connect', async () => {
    const open = await sweep(['a', 'b', 'c', 'd'], { port: 5555, concurrency: 2, connect: async (h) => h === 'b' || h === 'd' })
    expect(open.sort()).toEqual(['b', 'd'])
  })
  it('never runs more than the allowed number at once', async () => {
    let running = 0
    let peak = 0
    await sweep(Array.from({ length: 20 }, (_, i) => String(i)), {
      port: 1,
      concurrency: 4,
      connect: async () => {
        running++
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 5))
        running--
        return false
      }
    })
    expect(peak).toBeLessThanOrEqual(4)
  })
  it('really detects an open and a closed port on this computer', async () => {
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address !== null ? address.port : 0
    expect(await realConnect('127.0.0.1', port, 500)).toBe(true)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    expect(await realConnect('127.0.0.1', port, 500)).toBe(false)
  })
})

describe('name browsing', () => {
  const fake = (services: Array<{ type: string; name: string; addresses: string[] }>): { create: () => MdnsLike; destroyed: () => boolean } => {
    let destroyed = false
    return {
      destroyed: () => destroyed,
      create: () => ({
        find: (opts, onUp) => {
          for (const s of services.filter((x) => x.type === opts.type)) onUp({ name: s.name, addresses: s.addresses })
          return {}
        },
        destroy: () => {
          destroyed = true
        }
      })
    }
  }
  it('collects IPv4 addresses with names, ignores IPv6, and closes the browser', async () => {
    const f = fake([
      { type: 'androidtvremote2', name: 'Living room', addresses: ['192.168.1.190', 'fe80::1'] },
      { type: 'adb-tls-connect', name: 'Other', addresses: ['192.168.1.190', '192.168.1.60'] },
      { type: 'googlecast', name: 'Speaker', addresses: ['192.168.1.99'] }
    ])
    const found = await browseTvs(5, f.create)
    expect(found).toEqual([
      { host: '192.168.1.190', name: 'Living room' },
      { host: '192.168.1.60', name: 'Other' }
    ])
    expect(f.destroyed()).toBe(true)
  })
  it('reports a failure to start', async () => {
    await expect(
      browseTvs(5, () => {
        throw new Error('port 5353 in use')
      })
    ).rejects.toThrow('5353')
  })
})

describe('merging results', () => {
  it('puts ready TVs first, keeps names, sorts by address', () => {
    const tvs = mergeFound([{ host: '192.168.1.190', name: 'Living room' }, { host: '192.168.1.60', name: 'Old box' }], ['192.168.1.190', '192.168.1.7'])
    expect(tvs).toEqual([
      { host: '192.168.1.7', adbOpen: true },
      { host: '192.168.1.190', name: 'Living room', adbOpen: true },
      { host: '192.168.1.60', name: 'Old box', adbOpen: false }
    ])
  })
})
