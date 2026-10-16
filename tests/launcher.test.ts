import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { keepAliveCommands, parseDefaultLauncher, parsePids, parseWhitelist, pidScript, setDefaultCommand } from '../src/shared/launcher'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const serial = '192.168.0.105:5555'
const STOCK = 'com.google.android.tvlauncher/.MainActivity'
const OTHER = 'com.spocky.projengmenu/.ui.home.MainActivity'
const setup = (state?: object): { client: AdbClient; log: string; file: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'ck-lh-'))
  const log = join(dir, 'cmd.log')
  const file = join(dir, 'launcher.json')
  if (state) writeFileSync(file, JSON.stringify(state))
  process.env['FAKE_ADB_MODE'] = 'ok'
  process.env['FAKE_ADB_LOG'] = log
  process.env['FAKE_ADB_LAUNCHER'] = file
  delete process.env['FAKE_ADB_LAUNCHER_REFUSE']
  return { client: new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] }), log, file }
}

describe('launcher parsing', () => {
  it('reads the default and ignores the chooser box', () => {
    expect(parseDefaultLauncher('priority=0 isDefault=true\ncom.a.b/.Main')).toBe('com.a.b/.Main')
    expect(parseDefaultLauncher('priority=0\nandroid/com.android.internal.app.ResolverActivity')).toBeNull()
    expect(parseDefaultLauncher('')).toBeNull()
  })
  it('reads the whitelist and the process lines', () => {
    expect([...parseWhitelist('system-excidle,com.android.shell,2000\nuser,com.x.y,10001')]).toEqual(['com.android.shell', 'com.x.y'])
    expect([...parsePids('@@lh-pid com.a 123\n@@lh-pid com.b ')]).toEqual(['com.a'])
  })
  it('builds only well-formed commands', () => {
    expect(setDefaultCommand('com.a/.B')).toBe("cmd package set-home-activity 'com.a/.B'")
    expect(keepAliveCommands('com.a', true)[0]).toBe('dumpsys deviceidle whitelist +com.a')
    expect(pidScript(['com.a'])).toBe('echo @@lh-pid com.a $(pidof com.a)')
  })
})

describe('launcher helper through the fake TV', () => {
  it('reads launchers, default, running and keep-alive state', async () => {
    const { client } = setup({ default: STOCK, disabled: [], idle: ['com.spocky.projengmenu'], stopped: [] })
    const r = await client.launcherStatus(serial)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.status.launchers.map((l) => l.packageName)).toEqual(['com.google.android.tvlauncher', 'com.spocky.projengmenu'])
    expect(r.status.defaultComponent).toBe(STOCK)
    expect(r.status.launchers[0]).toMatchObject({ system: true, isDefault: true, running: true, keepAlive: false })
    expect(r.status.launchers[1]).toMatchObject({ system: false, isDefault: false, keepAlive: true })
  })
  it('sets the default launcher and checks it stuck', async () => {
    const { client } = setup()
    expect((await client.setDefaultLauncher(serial, OTHER)).ok).toBe(true)
    const r = await client.launcherStatus(serial)
    expect(r.ok && r.status.defaultComponent).toBe(OTHER)
  })
  it('says so when the TV ignores the change', async () => {
    const { client } = setup()
    process.env['FAKE_ADB_LAUNCHER_REFUSE'] = '1'
    const r = await client.setDefaultLauncher(serial, OTHER)
    expect(r.ok).toBe(false)
  })
  it('refuses a launcher that is not installed', async () => {
    const { client } = setup()
    expect((await client.setDefaultLauncher(serial, 'com.evil/.Home')).ok).toBe(false)
  })
  it('turns keep-alive on and off', async () => {
    const { client } = setup()
    expect((await client.setLauncherKeepAlive(serial, 'com.spocky.projengmenu', true)).ok).toBe(true)
    let r = await client.launcherStatus(serial)
    expect(r.ok && r.status.launchers[1]?.keepAlive).toBe(true)
    await client.setLauncherKeepAlive(serial, 'com.spocky.projengmenu', false)
    r = await client.launcherStatus(serial)
    expect(r.ok && r.status.launchers[1]?.keepAlive).toBe(false)
    expect((await client.setLauncherKeepAlive(serial, 'x; reboot', true)).ok).toBe(false)
  })
  it('will not turn off the stock launcher while it is still the default', async () => {
    const { client, log } = setup()
    const refused = await client.setStockLauncherEnabled(serial, 'com.google.android.tvlauncher', false)
    expect(refused.ok).toBe(false)
    expect(readFileSync(log, 'utf8')).not.toContain('disable-user')
  })
  it('turns the stock launcher off once another is the default, and back on', async () => {
    const { client } = setup({ default: OTHER, disabled: [], idle: [], stopped: [] })
    expect((await client.setStockLauncherEnabled(serial, 'com.google.android.tvlauncher', false)).ok).toBe(true)
    let r = await client.launcherStatus(serial)
    expect(r.ok && r.status.turnedOff).toEqual(['com.google.android.tvlauncher'])
    expect((await client.setStockLauncherEnabled(serial, 'com.google.android.tvlauncher', true)).ok).toBe(true)
    r = await client.launcherStatus(serial)
    expect(r.ok && r.status.turnedOff).toEqual([])
  })
  it('only touches known stock launchers', async () => {
    const { client } = setup({ default: OTHER, disabled: [], idle: [], stopped: [] })
    expect((await client.setStockLauncherEnabled(serial, 'com.spocky.projengmenu', false)).ok).toBe(false)
  })
})

import { parseTweakReads } from '../src/shared/tweaks'

describe('HDMI-CEC tweaks', () => {
  it('treats an unset value as on and 0 as off', () => {
    const pick = (v: string, id: string): string | null =>
      parseTweakReads(`@@${id}.on\n${v}\n@@density\n`).tweaks.find((t) => t.id === id)!.choice
    expect(pick('null', 'cec')).toBe('on')
    expect(pick('1', 'cecwake')).toBe('on')
    expect(pick('0', 'cecoff')).toBe('off')
  })
})

describe('open and force stop', () => {
  it('opens an app and reports one with no screen', async () => {
    const { client } = setup()
    expect((await client.openApp(serial, 'com.example.app')).ok).toBe(true)
    expect((await client.openApp(serial, 'com.noscreen.svc')).ok).toBe(false)
    expect((await client.openApp(serial, 'x; reboot')).ok).toBe(false)
  })
  it('force-stops apps but not protected ones', async () => {
    const { client, log } = setup()
    expect((await client.forceStopApp(serial, 'com.example.app')).ok).toBe(true)
    expect(readFileSync(log, 'utf8')).toContain('am force-stop com.example.app')
    expect((await client.forceStopApp(serial, 'com.android.systemui')).ok).toBe(false)
  })
})
