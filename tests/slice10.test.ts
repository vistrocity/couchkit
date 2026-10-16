import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { SettingsStore, sanitizeSettings } from '../src/main/store/settings'
import { ActivityLog } from '../src/main/store/activity-log'
import { formatUptime, parseHardware } from '../src/shared/hardware'
import { APP_IDEAS, findIdea } from '../src/shared/ideas'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const serial = '192.168.0.105:5555'
const setup = (): { client: AdbClient; log: string; dir: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'ck-s10-'))
  const log = join(dir, 'cmd.log')
  process.env['FAKE_ADB_MODE'] = 'ok'
  process.env['FAKE_ADB_LOG'] = log
  return { client: new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] }), log, dir }
}

describe('hardware details', () => {
  it('reads RAM, storage, uptime, chip, patch', async () => {
    const { client } = setup()
    const r = await client.readHardware(serial)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.hardware.ramKb).toBe(1950340)
    expect(r.hardware.storage).toEqual({ totalKb: 8000000, freeKb: 2000000 })
    expect(r.hardware.uptimeSeconds).toBe(275400)
    expect(r.hardware.cpuAbi).toBe('arm64-v8a')
    expect(r.hardware.chip).toBe('mt8696')
    expect(r.hardware.securityPatch).toBe('2022-05-05')
  })
  it('copes with an empty answer', () => {
    expect(parseHardware('')).toEqual({ ramKb: null, storage: null, uptimeSeconds: null })
  })
  it('formats uptime', () => {
    expect(formatUptime(275400)).toBe('3 days 4 h')
    expect(formatUptime(3 * 3600 + 120)).toBe('3 h 2 min')
    expect(formatUptime(10)).toBe('1 min')
  })
})

describe('restart', () => {
  it('sends the right reboot mode', async () => {
    const { client, log } = setup()
    expect((await client.restart(serial, 'system')).ok).toBe(true)
    expect((await client.restart(serial, 'recovery')).ok).toBe(true)
    const text = readFileSync(log, 'utf8')
    expect(text).toContain('reboot \n')
    expect(text).toContain('reboot recovery')
  })
})

describe('settings and activity log', () => {
  it('defaults to off and keeps only known values', async () => {
    const { dir } = setup()
    const store = new SettingsStore(join(dir, 's.json'))
    expect((await store.load()).activityLog).toBe(false)
    expect((await store.save({ activityLog: true })).activityLog).toBe(true)
    expect((await new SettingsStore(join(dir, 's.json')).load()).activityLog).toBe(true)
    expect(sanitizeSettings({ activityLog: 'yes', junk: 1 })).toEqual({ activityLog: false })
    expect(sanitizeSettings(null)).toEqual({ activityLog: false })
  })
  it('clears the log', () => {
    const log = new ActivityLog()
    log.add({ command: 'x', ok: true, exitCode: 0, durationMs: 1, stdout: '', stderr: '', startedAt: 1 })
    expect(log.list()).toHaveLength(1)
    log.clear()
    expect(log.list()).toHaveLength(0)
  })
})

describe('app ideas', () => {
  it('only has https links and unique ids', () => {
    expect(new Set(APP_IDEAS.map((i) => i.id)).size).toBe(APP_IDEAS.length)
    for (const i of APP_IDEAS) expect(i.url.startsWith('https://')).toBe(true)
  })
  it('opens only listed ideas', () => {
    expect(findIdea('vlc')).toBeDefined()
    expect(findIdea('https://evil.example')).toBeUndefined()
    expect(findIdea(1)).toBeUndefined()
  })
})

import { findChoice, findTweak, parseTweakReads } from '../src/shared/tweaks'

describe('freeze cached apps tweak', () => {
  it('detects and applies each choice', async () => {
    const t = findTweak('freezer')!
    expect(t.group).toBe('Speed')
    const detect = (v: string): string | null => parseTweakReads(`@@freezer.mode\n${v}\n@@density\n`).tweaks.find((x) => x.id === 'freezer')!.choice
    expect(detect('enabled')).toBe('on')
    expect(detect('disabled')).toBe('off')
    expect(detect('null')).toBe('default')
    expect(detect('device_default')).toBe('default')
    expect(detect('weird')).toBeNull()
    const { client } = setup()
    process.env['FAKE_ADB_SETTINGS'] = join(mkdtempSync(join(tmpdir(), 'ck-fz-')), 's.json')
    expect((await client.runSettingsCommands(serial, findChoice(t, 'on')!.commands)).ok).toBe(true)
    expect((await client.runSettingsCommands(serial, findChoice(t, 'default')!.commands)).ok).toBe(true)
  })
})

describe('optimise apps', () => {
  it('runs the compile and the reset commands', async () => {
    const { client, log } = setup()
    expect((await client.optimiseApps(serial, false)).ok).toBe(true)
    expect((await client.optimiseApps(serial, true)).ok).toBe(true)
    const text = readFileSync(log, 'utf8')
    expect(text).toContain('cmd package compile -m speed-profile -a')
    expect(text).toContain('cmd package compile --reset -a')
  })
})
