import Bonjour from 'bonjour-service'

export interface NamedHost {
  host: string
  name: string
}

/** The small part of the mDNS library that we use, so tests can replace it. */
export interface MdnsLike {
  find(options: { type: string }, onUp: (service: { name: string; addresses?: string[] }) => void): unknown
  destroy(): void
}

/**
 * Android TV and Google TV devices announce themselves on the local network under these names
 * ("androidtvremote2" is the remote-control service almost every one of them runs).
 */
export const TV_SERVICE_TYPES = ['androidtvremote2', 'adb-tls-connect'] as const

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

export function browseTvs(durationMs: number, create: () => MdnsLike = () => new Bonjour() as unknown as MdnsLike): Promise<NamedHost[]> {
  return new Promise<NamedHost[]>((resolve, reject) => {
    let bonjour: MdnsLike
    try {
      bonjour = create()
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
      return
    }
    const found = new Map<string, NamedHost>()
    for (const type of TV_SERVICE_TYPES) {
      bonjour.find({ type }, (service) => {
        for (const address of service.addresses ?? []) {
          if (IPV4.test(address) && !found.has(address)) found.set(address, { host: address, name: service.name })
        }
      })
    }
    setTimeout(() => {
      try {
        bonjour.destroy()
      } catch {
        // Nothing useful to do if closing fails.
      }
      resolve([...found.values()])
    }, durationMs)
  })
}
