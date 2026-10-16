import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { BUILT_IN_SHORTCUTS, isRisky, isValidCommand } from '../src/shared/console'
import { ShortcutStore, addShortcut, removeShortcut, sanitizeShortcuts } from '../src/main/store/shortcuts'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const serial = '192.168.0.105:5555'
const client = (): AdbClient => {
  process.env['FAKE_ADB_MODE'] = 'ok'
  return new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] })
}

describe('command rules', () => {
  it('accepts plain one-line commands only', () => {
    expect(isValidCommand('getprop ro.product.model')).toBe(true)
    expect(isValidCommand('')).toBe(false)
    expect(isValidCommand('   ')).toBe(false)
    expect(isValidCommand('a\nb')).toBe(false)
    expect(isValidCommand('a\u0000b')).toBe(false)
    expect(isValidCommand('x'.repeat(1001))).toBe(false)
    expect(isValidCommand(5)).toBe(false)
  })
  it('flags commands that can delete, change or restart', () => {
    for (const c of ['rm -rf /sdcard/x', 'reboot', 'pm uninstall com.a.b', 'pm clear com.a.b', 'setprop a b', 'settings put global x 1', 'am force-stop com.a.b', 'echo hi > /sdcard/x', 'su -c id', 'pm disable-user --user 0 com.a.b']) {
      expect(isRisky(c), c).toBe(true)
    }
  })
  it('lets read-only commands run without a question', () => {
    for (const c of ['getprop ro.product.model', 'dumpsys battery', 'df -h /sdcard', 'wm size', 'ls /sdcard', 'pm list packages -3', 'dumpsys wifi | grep -E "mWifiInfo|SSID"', 'am start -a android.settings.SETTINGS']) {
      expect(isRisky(c), c).toBe(false)
    }
  })
  it('every built-in shortcut is valid, and only the Power group asks first', () => {
    for (const s of BUILT_IN_SHORTCUTS) {
      expect(isValidCommand(s.command), s.label).toBe(true)
      expect(isRisky(s.command), s.label).toBe(s.group === 'Power')
    }
  })
})

describe('AdbClient.runShell', () => {
  it('sends the command as one argument and returns the output', async () => {
    const log = join(mkdtempSync(join(tmpdir(), 'ck-')), 'c.log')
    process.env['FAKE_ADB_LOG'] = log
    const r = await client().runShell(serial, 'dumpsys window | grep -E "mCurrentFocus"')
    expect(r.ok).toBe(true)
    expect(r.output).toContain('ran: dumpsys window | grep -E "mCurrentFocus"')
    expect(readFileSync(log, 'utf8')).toContain('shell dumpsys window | grep -E "mCurrentFocus"')
  })
  it('reports an error the TV printed', async () => {
    const r = await client().runShell(serial, 'fail now')
    expect(r.ok).toBe(false)
    expect(r.exitCode).toBe(127)
    expect(r.output).toContain('inaccessible or not found')
  })
  it('cuts very long output', async () => {
    const r = await client().runShell(serial, 'huge')
    expect(r.truncated).toBe(true)
    expect(r.output.length).toBe(200_000)
  })
  it('refuses empty or multi-line commands without running anything', async () => {
    expect((await client().runShell(serial, '')).ok).toBe(false)
    expect((await client().runShell(serial, 'a\nb')).message).toContain('single-line')
  })
})

describe('shortcut store', () => {
  it('adds, trims and removes', () => {
    const a = addShortcut([], '  Battery  ', ' dumpsys battery ')
    expect(a).not.toBeNull()
    expect(a?.[0]).toMatchObject({ name: 'Battery', command: 'dumpsys battery' })
    expect(removeShortcut(a ?? [], a?.[0]?.id ?? '')).toEqual([])
  })
  it('rejects empty names, bad commands and too many shortcuts', () => {
    expect(addShortcut([], '', 'ls')).toBeNull()
    expect(addShortcut([], 'x', 'a\nb')).toBeNull()
    const full = Array.from({ length: 50 }, (_, i) => ({ id: String(i), name: 'n', command: 'ls' }))
    expect(addShortcut(full, 'x', 'ls')).toBeNull()
  })
  it('survives damaged data', () => {
    expect(sanitizeShortcuts('nope')).toEqual([])
    expect(sanitizeShortcuts([{ id: 1 }, null, { id: 'a', name: 'ok', command: 'ls' }, { id: 'b', name: 'bad', command: 'x\ny' }])).toEqual([{ id: 'a', name: 'ok', command: 'ls' }])
  })
  it('saves and loads from a file; a missing file is an empty list', async () => {
    const store = new ShortcutStore(join(mkdtempSync(join(tmpdir(), 'ck-')), 'sub', 's.json'))
    expect(await store.load()).toEqual([])
    const list = addShortcut([], 'Up', 'uptime') ?? []
    await store.save(list)
    expect(await store.load()).toEqual(list)
  })
})
