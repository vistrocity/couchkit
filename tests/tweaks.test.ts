import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { TWEAKS, densityRestore, findChoice, findTweak, isValidDensity, parseDensity, parseTweakReads } from '../src/shared/tweaks'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const serial = '192.168.0.105:5555'
const setup = (): { client: AdbClient; state: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'ck-tune-'))
  const state = join(dir, 'settings.json')
  process.env['FAKE_ADB_MODE'] = 'ok'
  process.env['FAKE_ADB_SETTINGS'] = state
  process.env['FAKE_ADB_LOG'] = join(dir, 'cmd.log')
  return { client: new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] }), state }
}

describe('tweak table', () => {
  it('has unique ids and every choice has commands', () => {
    expect(new Set(TWEAKS.map((t) => t.id)).size).toBe(TWEAKS.length)
    for (const t of TWEAKS) {
      expect(t.choices.length).toBeGreaterThan(1)
      for (const c of t.choices) expect(c.commands.length).toBeGreaterThan(0)
    }
  })
  it('looks up only known ids', () => {
    const t = findTweak('animations')
    expect(t).toBeDefined()
    expect(findTweak('rm -rf /')).toBeUndefined()
    expect(findTweak(5)).toBeUndefined()
    expect(t && findChoice(t, 'fast')).toBeDefined()
    expect(t && findChoice(t, '; reboot')).toBeUndefined()
  })
})

describe('density', () => {
  it('parses plain and changed density', () => {
    expect(parseDensity('Physical density: 320')).toEqual({ physical: 320, current: 320, changed: false })
    expect(parseDensity('Physical density: 320\nOverride density: 256')).toEqual({ physical: 320, current: 256, changed: true })
    expect(parseDensity('garbage')).toBeNull()
  })
  it('validates range and type', () => {
    expect(isValidDensity(240)).toBe(true)
    expect(isValidDensity(119)).toBe(false)
    expect(isValidDensity(721)).toBe(false)
    expect(isValidDensity(240.5)).toBe(false)
    expect(isValidDensity('240; reboot')).toBe(false)
  })
  it('builds the right restore command', () => {
    expect(densityRestore({ physical: 320, current: 320, changed: false })).toEqual(['wm density reset'])
    expect(densityRestore({ physical: 320, current: 256, changed: true })).toEqual(['wm density 256'])
  })
})

describe('reading and applying through the fake TV', () => {
  it('reads defaults and detects the animation choice after applying', async () => {
    const { client } = setup()
    const first = await client.readTweaks(serial)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.snapshot.density?.physical).toBe(320)
    const fast = findChoice(findTweak('animations')!, 'fast')!
    expect((await client.runSettingsCommands(serial, fast.commands)).ok).toBe(true)
    const after = await client.readTweaks(serial)
    if (!after.ok) throw new Error('read failed')
    expect(after.snapshot.tweaks.find((t) => t.id === 'animations')?.choice).toBe('fast')
  })
  it('restores font size exactly, including deleting a value that was never set', async () => {
    const { client } = setup()
    const font = findTweak('font')!
    const before = await client.readTweaks(serial)
    if (!before.ok) throw new Error('read failed')
    const restore = font.restore!(before.snapshot.tweaks.find((t) => t.id === 'font')!.values)
    await client.runSettingsCommands(serial, findChoice(font, 'xlarge')!.commands)
    let mid = await client.readTweaks(serial)
    if (!mid.ok) throw new Error('read failed')
    expect(mid.snapshot.tweaks.find((t) => t.id === 'font')?.choice).toBe('xlarge')
    await client.runSettingsCommands(serial, restore)
    mid = await client.readTweaks(serial)
    if (!mid.ok) throw new Error('read failed')
    expect(mid.snapshot.tweaks.find((t) => t.id === 'font')?.values['scale']).toBe('null')
  })
  it('changes and resets density', async () => {
    const { client, state } = setup()
    await client.runSettingsCommands(serial, ['wm density 256'])
    expect(JSON.parse(readFileSync(state, 'utf8')).density.override).toBe(256)
    await client.runSettingsCommands(serial, ['wm density reset'])
    expect(JSON.parse(readFileSync(state, 'utf8')).density.override).toBeUndefined()
  })
  it('reports a failure when the TV rejects a command', async () => {
    const { client } = setup()
    const r = await client.runSettingsCommands(serial, ['settings bogus'])
    expect(r.ok).toBe(false)
  })
  it('parses a stored snapshot too', () => {
    const { state } = setup()
    writeFileSync(state, JSON.stringify({ settings: { 'global.window_animation_scale': '0' }, density: { physical: 213 } }))
    expect(parseTweakReads("@@animations.scale\n0\n@@density\nPhysical density: 213").tweaks.find((t) => t.id === 'animations')?.choice).toBe('off')
  })
})

describe('custom private DNS', () => {
  it('accepts host names and rejects anything else', async () => {
    const { isValidDnsHostname, customDnsCommands, findTweak } = await import('../src/shared/tweaks')
    for (const ok of ['dns.example.com', 'abc123.dns.nextdns.io', 'one.one.one.one']) expect(isValidDnsHostname(ok)).toBe(true)
    for (const bad of ['', 'localhost', '8.8.8.8', 'dns.example.com; reboot', 'a b.com', '-x.com', 'x..com', 'x.com/', '$(id).com', 'a.'.repeat(130) + 'com', 42, null]) expect(isValidDnsHostname(bad)).toBe(false)
    expect(customDnsCommands('dns.example.com')).toEqual(['settings put global private_dns_mode hostname', 'settings put global private_dns_specifier dns.example.com'])
    // A change can always be put back.
    const restore = findTweak('dns')!.restore!
    expect(restore({ mode: 'hostname', host: 'dns.google' })).toEqual(['settings put global private_dns_mode hostname', 'settings put global private_dns_specifier dns.google'])
    expect(restore({ mode: 'null', host: 'null' })).toEqual(['settings delete global private_dns_mode', 'settings delete global private_dns_specifier'])
  })
})
