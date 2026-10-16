import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { formatKb, isProtectedPackage, parseStorage } from '../src/shared/cleanup'
import { clockCommands, isValidComponent, isValidTimeZone, parseScreensavers, screensaverCommands, TWEAKS } from '../src/shared/tweaks'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const serial = '192.168.0.105:5555'
const setup = (): { client: AdbClient; log: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'ck-clean-'))
  const log = join(dir, 'cmd.log')
  process.env['FAKE_ADB_MODE'] = 'ok'
  process.env['FAKE_ADB_LOG'] = log
  process.env['FAKE_ADB_DF'] = join(dir, 'df.json')
  process.env['FAKE_ADB_SETTINGS'] = join(dir, 'settings.json')
  return { client: new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] }), log }
}

describe('storage parsing', () => {
  it('reads a normal df line', () => {
    expect(parseStorage('Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/block/dm-12 8000000 6000000 2000000 75% /data')).toEqual({ totalKb: 8000000, freeKb: 2000000 })
  })
  it('reads a wrapped line', () => {
    expect(parseStorage('Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/block/by-name/userdata\n 8000000 6000000 2000000 75% /data')?.freeKb).toBe(2000000)
  })
  it('rejects nonsense', () => {
    expect(parseStorage('ran: df')).toBeNull()
    expect(parseStorage('')).toBeNull()
  })
  it('formats sizes', () => {
    expect(formatKb(512)).toBe('512 KB')
    expect(formatKb(2_000_000)).toBe('1.9 GB')
  })
})

describe('protected apps', () => {
  it('blocks the parts the TV itself depends on', () => {
    expect(isProtectedPackage('com.android.providers.settings')).toBe(true)
    expect(isProtectedPackage('com.android.systemui')).toBe(true)
    expect(isProtectedPackage('android')).toBe(true)
    expect(isProtectedPackage('com.example.app')).toBe(false)
  })
})

describe('clock and screen saver helpers', () => {
  it('builds clock commands only from sane values', () => {
    expect(clockCommands(1_790_000_000_000, 'Asia/Calcutta')).toEqual(['cmd alarm set-timezone Asia/Calcutta', 'cmd alarm set-time 1790000000000'])
    expect(clockCommands(1_790_000_000_000, null)).toEqual(['cmd alarm set-time 1790000000000'])
    expect(clockCommands('1790000000000', null)).toBeNull()
    expect(clockCommands(5, null)).toBeNull()
    expect(clockCommands(1_790_000_000_000, 'UTC; reboot')).toBeNull()
    expect(isValidTimeZone('America/Argentina/Buenos_Aires')).toBe(true)
    expect(isValidTimeZone('$(id)')).toBe(false)
  })
  it('validates and parses screen saver components', () => {
    expect(isValidComponent('com.neilturner.aerialviews/.service.DreamActivity')).toBe(true)
    expect(isValidComponent("a.b/c'; reboot")).toBe(false)
    expect(isValidComponent('nonsense')).toBe(false)
    const list = parseScreensavers('priority=0 isDefault=false\ncom.a.b/.X\ncom.a.b/.X\ncom.c.d/.Y$Z')
    expect(list.map((o) => o.component)).toEqual(['com.a.b/.X', 'com.c.d/.Y$Z'])
    expect(screensaverCommands('com.a.b/.X')[0]).toBe("settings put secure screensaver_components 'com.a.b/.X'")
  })
  it('shows date/time and screen-off settings in single cards', () => {
    expect(TWEAKS.filter((t) => t.card === 'Date and time').map((t) => t.id)).toEqual(['autotime', 'ntp'])
    expect(TWEAKS.filter((t) => t.card === 'Screen off and screen saver').map((t) => t.id)).toEqual(['timeout', 'screensaver'])
  })
})

describe('cleanup through the fake TV', () => {
  it('reports freed space after clearing caches', async () => {
    const { client } = setup()
    const r = await client.clearCaches(serial)
    expect(r.ok).toBe(true)
    if (r.ok) expect((r.freeAfterKb ?? 0) - (r.freeBeforeKb ?? 0)).toBe(300000)
  })
  it('closes background apps', async () => {
    const { client, log } = setup()
    expect((await client.closeBackgroundApps(serial)).ok).toBe(true)
    expect(readFileSync(log, 'utf8')).toContain('shell am kill-all')
  })
  it('clears app data but refuses invalid and protected names', async () => {
    const { client } = setup()
    expect((await client.clearAppData(serial, 'com.example.app')).ok).toBe(true)
    expect((await client.clearAppData(serial, 'com.android.providers.settings')).ok).toBe(false)
    expect((await client.clearAppData(serial, 'x; reboot')).ok).toBe(false)
  })
  it('lists and sets only installed screen savers', async () => {
    const { client, log } = setup()
    const list = await client.listScreensavers(serial)
    expect(list.ok && list.options.map((o) => o.packageName)).toEqual(['com.android.deskclock', 'com.neilturner.aerialviews'])
    expect((await client.setScreensaver(serial, 'com.neilturner.aerialviews/.service.DreamActivity')).ok).toBe(true)
    expect(readFileSync(log, 'utf8')).toContain("screensaver_components 'com.neilturner.aerialviews/.service.DreamActivity'")
    expect((await client.setScreensaver(serial, 'com.evil.app/.Dream')).ok).toBe(false)
  })
  it('reads storage', async () => {
    const { client } = setup()
    const r = await client.readStorage(serial)
    expect(r.ok && r.freeKb).toBe(2000000)
  })
})
