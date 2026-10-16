import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const target = { host: '192.168.0.105', port: 5555 }

function client(mode: string): AdbClient {
  process.env['FAKE_ADB_MODE'] = mode
  return new AdbClient({
    binary: process.execPath,
    baseArgs: [fakeAdb],
    authWaitMs: 50,
    authPollMs: 10,
    sleep: () => Promise.resolve()
  })
}

describe('AdbClient.connect', () => {
  it('connects and reads device details', async () => {
    const outcome = await client('ok').connect(target)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.device).toMatchObject({
      serial: '192.168.0.105:5555',
      manufacturer: 'Google',
      model: 'Chromecast',
      androidVersion: '12',
      sdkLevel: '31',
      resolution: '1920x1080',
      hardwareSerial: 'ABC123'
    })
    // An empty property is left out rather than shown as blank.
    expect('ro.empty' in outcome.device).toBe(false)
  })

  it('reports a refused connection even though adb exits 0', async () => {
    const outcome = await client('refused').connect(target)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.category).toBe('unreachable')
    expect(outcome.fix.length).toBeGreaterThan(10)
  })

  it('recognises the Windows wording for a refused connection', async () => {
    const outcome = await client('winrefused').connect(target)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.category).toBe('unreachable')
  })

  it('tells the user to accept the prompt when the TV has not allowed us', async () => {
    const outcome = await client('unauthorized').connect(target)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.category).toBe('unauthorized')
      expect(outcome.fix).toContain('Allow')
    }
  })

  it('reports an offline device', async () => {
    const outcome = await client('offline').connect(target)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.category).toBe('offline')
  })

  it('reports offline when the device never appears in the list', async () => {
    const outcome = await client('missing').connect(target)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.category).toBe('offline')
  })

  it('reports a missing adb program', async () => {
    const outcome = await new AdbClient({ binary: '/not/here/adb' }).connect(target)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.category).toBe('tool_missing')
  })

  it('logs every command it runs', async () => {
    process.env['FAKE_ADB_MODE'] = 'ok'
    const commands: string[] = []
    const c = new AdbClient({
      binary: process.execPath,
      baseArgs: [fakeAdb],
      log: (entry) => commands.push(entry.command),
      sleep: () => Promise.resolve()
    })
    await c.connect(target)
    expect(commands.length).toBeGreaterThanOrEqual(4)
  })
})
