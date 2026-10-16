import { classifyAdbFailure } from './classify'
import { parseConnectOutput, parseDevices, parseGetprop, parseWmSize } from './parse'
import { runCommand, type LogSink } from './runner'
import { explainFailure } from '@shared/explain'
import { formatHostPort, type HostPort } from '@shared/network'
import type { CommandResult, ConnectOutcome, DeviceInfo, ErrorCategory } from '@shared/types'

export interface AdbClientOptions {
  /** Path of the adb program. */
  binary: string
  /** Arguments placed before every command. Empty in the app; used by tests with a fake adb. */
  baseArgs?: readonly string[]
  log?: LogSink
  /** How long to wait for the user to accept the prompt on the TV. Default 25 s. */
  authWaitMs?: number
  /** How often to look again while waiting. Default 1 s. */
  authPollMs?: number
  /** Replaceable in tests so they do not really wait. */
  sleep?: (ms: number) => Promise<void>
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Everything the app asks adb to do about connecting to a TV. */
export class AdbClient {
  private readonly binary: string
  private readonly baseArgs: readonly string[]
  private readonly log: LogSink | undefined
  private readonly authWaitMs: number
  private readonly authPollMs: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(options: AdbClientOptions) {
    this.binary = options.binary
    this.baseArgs = options.baseArgs ?? []
    this.log = options.log
    this.authWaitMs = options.authWaitMs ?? 25_000
    this.authPollMs = options.authPollMs ?? 1_000
    this.sleep = options.sleep ?? realSleep
  }

  private run(args: readonly string[], timeoutMs = 15_000): Promise<CommandResult> {
    return runCommand(this.binary, [...this.baseArgs, ...args], { timeoutMs }, this.log)
  }

  /** Connects to a TV and, if the TV accepts us, reads its details. */
  async connect(target: HostPort): Promise<ConnectOutcome> {
    const serial = formatHostPort(target)

    // The first adb call also starts adb's background server, which can take a few seconds.
    const connectResult = await this.run(['connect', serial], 30_000)
    if (!connectResult.ok) {
      return fail(connectResult.category ?? 'other', connectResult.stderr || connectResult.stdout)
    }
    const connected = parseConnectOutput(connectResult.stdout, connectResult.stderr)
    if (!connected.connected) {
      const category = classifyAdbFailure(connected.text)
      return fail(category === 'other' ? 'unreachable' : category, connected.text)
    }

    // "Connected" is not enough: a new computer must also be allowed on the TV.
    const state = await this.waitForAuthorization(serial)
    if (state !== 'device') {
      const category: ErrorCategory = state === 'unauthorized' ? 'unauthorized' : 'offline'
      return fail(category, `Device state: ${state}`)
    }

    return { ok: true, device: await this.readDeviceInfo(target) }
  }

  async disconnect(target: HostPort): Promise<void> {
    await this.run(['disconnect', formatHostPort(target)])
  }

  /** Looks at `adb devices` until the TV is ready, or the wait runs out. */
  private async waitForAuthorization(serial: string): Promise<'device' | 'unauthorized' | 'offline'> {
    const deadline = Date.now() + this.authWaitMs
    for (;;) {
      const result = await this.run(['devices'])
      const listed = parseDevices(result.stdout).find((d) => d.serial === serial)
      if (listed?.state === 'device') return 'device'
      const waiting = listed?.state === 'unauthorized'
      if (!waiting || Date.now() >= deadline) {
        return waiting ? 'unauthorized' : 'offline'
      }
      await this.sleep(this.authPollMs)
    }
  }

  private async readDeviceInfo(target: HostPort): Promise<DeviceInfo> {
    const serial = formatHostPort(target)
    const [props, size] = await Promise.all([
      this.run(['-s', serial, 'shell', 'getprop']),
      this.run(['-s', serial, 'shell', 'wm', 'size'])
    ])
    const p = props.ok ? parseGetprop(props.stdout) : {}
    const resolution = size.ok ? parseWmSize(size.stdout) : undefined

    const info: DeviceInfo = { serial, host: target.host, port: target.port }
    const set = <K extends keyof DeviceInfo>(key: K, value: DeviceInfo[K] | undefined): void => {
      if (value !== undefined && value !== '') info[key] = value as DeviceInfo[K]
    }
    set('manufacturer', p['ro.product.manufacturer'])
    set('model', p['ro.product.model'])
    set('androidVersion', p['ro.build.version.release'])
    set('sdkLevel', p['ro.build.version.sdk'])
    set('resolution', resolution)
    set('buildId', p['ro.build.display.id'])
    set('hardwareSerial', p['ro.serialno'])
    return info
  }
}

function fail(category: ErrorCategory, detail: string): ConnectOutcome {
  const { message, fix } = explainFailure(category)
  return { ok: false, category, message, fix, detail: detail.trim() }
}
