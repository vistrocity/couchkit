import { Socket } from 'node:net'

export type ConnectFn = (host: string, port: number, timeoutMs: number) => Promise<boolean>

/** True if something accepts a connection on host:port. Never sends any data. */
export const realConnect: ConnectFn = (host, port, timeoutMs) =>
  new Promise<boolean>((resolve) => {
    const socket = new Socket()
    let settled = false
    const done = (open: boolean): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })

export interface SweepOptions {
  port: number
  timeoutMs?: number
  concurrency?: number
  connect?: ConnectFn
}

/** Checks one port on many hosts, a limited number at a time. Returns the hosts where it is open. */
export async function sweep(hosts: readonly string[], options: SweepOptions): Promise<string[]> {
  const connect = options.connect ?? realConnect
  const timeoutMs = options.timeoutMs ?? 600
  const concurrency = Math.max(1, options.concurrency ?? 64)
  const open: string[] = []
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const host = hosts[next++]
      if (host === undefined) return
      if (await connect(host, options.port, timeoutMs)) open.push(host)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, hosts.length) }, worker))
  return open
}
