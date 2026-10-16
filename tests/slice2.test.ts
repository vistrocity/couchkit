import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { explainInstallFailure } from '../src/main/adb/apk'
import { buildTextArg } from '../src/main/adb/text'
import { describeInstaller, parsePackageList, parseVersionNames } from '../src/main/adb/packages'
import { isRemoteKey, isValidPackageName } from '../src/shared/remote'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const serial = '192.168.0.105:5555'
const client = (): AdbClient => {
  process.env['FAKE_ADB_MODE'] = 'ok'
  return new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] })
}

describe('text quoting', () => {
  it('turns spaces into %s and wraps in single quotes', () => {
    expect(buildTextArg('hello world')).toEqual({ ok: true, arg: "'hello%sworld'" })
  })
  it('keeps shell characters inside the quotes as plain text', () => {
    const r = buildTextArg('a;rm -rf /;$(x)')
    expect(r).toEqual({ ok: true, arg: "'a;rm%s-rf%s/;$(x)'" })
  })
  it('escapes single quotes', () => {
    expect(buildTextArg("it's")).toEqual({ ok: true, arg: "'it'\\''s'" })
  })
  it('rejects empty, too long, non-ASCII and percent signs', () => {
    expect(buildTextArg('').ok).toBe(false)
    expect(buildTextArg('x'.repeat(301)).ok).toBe(false)
    expect(buildTextArg('café').ok).toBe(false)
    expect(buildTextArg('50%').ok).toBe(false)
  })
})

describe('validation', () => {
  it('accepts only known remote keys', () => {
    expect(isRemoteKey('home')).toBe(true)
    expect(isRemoteKey('KEYCODE_HOME; reboot')).toBe(false)
    expect(isRemoteKey(5)).toBe(false)
  })
  it('accepts only real package names', () => {
    expect(isValidPackageName('com.google.android.youtube.tv')).toBe(true)
    expect(isValidPackageName('com.x; reboot')).toBe(false)
    expect(isValidPackageName('nodots')).toBe(false)
    expect(isValidPackageName('-evil.flag')).toBe(false)
  })
})

describe('package parsing', () => {
  it('reads installer and version code', () => {
    const list = parsePackageList('package:com.a  installer=com.android.vending  versionCode:12\npackage:com.b\nnoise')
    expect(list).toEqual([
      { packageName: 'com.a', installer: 'com.android.vending', versionCode: '12' },
      { packageName: 'com.b' }
    ])
  })
  it('reads version names, first one wins', () => {
    expect(parseVersionNames('  Package [com.a] (x):\n    versionName=1.0\n    versionName=2.0\n  Package [com.b] (y):\n    versionName=3')).toEqual({
      'com.a': '1.0',
      'com.b': '3'
    })
  })
  it('names installers in plain words', () => {
    expect(describeInstaller('com.android.vending')).toBe('Play Store')
    expect(describeInstaller('null')).toBe('Sideloaded or preinstalled')
    expect(describeInstaller(undefined)).toBe('Unknown')
  })
})

describe('install failure wording', () => {
  it('explains known codes and falls back for unknown ones', () => {
    expect(explainInstallFailure('Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]').category).toBe('no_space')
    expect(explainInstallFailure('Failure [INSTALL_FAILED_VERSION_DOWNGRADE]').message).toContain('newer version')
    expect(explainInstallFailure('Failure [INSTALL_WEIRD_NEW_CODE]').message).toContain('INSTALL_WEIRD_NEW_CODE')
  })
})

describe('AdbClient on the TV', () => {
  it('sends a key as an adb keycode', async () => {
    const log = join(mkdtempSync(join(tmpdir(), 'ck-')), 'input.log')
    process.env['FAKE_ADB_LOG'] = log
    expect((await client().sendKey(serial, 'home')).ok).toBe(true)
    expect(readFileSync(log, 'utf8')).toContain('keyevent KEYCODE_HOME')
  })
  it('refuses an unknown key without running anything', async () => {
    expect((await client().sendKey(serial, 'reboot')).ok).toBe(false)
  })
  it('sends quoted text', async () => {
    const log = join(mkdtempSync(join(tmpdir(), 'ck-')), 'input.log')
    process.env['FAKE_ADB_LOG'] = log
    expect((await client().sendText(serial, 'hi there')).ok).toBe(true)
    expect(readFileSync(log, 'utf8')).toContain("text 'hi%sthere'")
  })
  it('lists apps with version, store, system and disabled flags', async () => {
    const result = await client().listApps(serial)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const byName = Object.fromEntries(result.apps.map((a) => [a.packageName, a]))
    expect(byName['com.example.user']).toMatchObject({ versionName: '1.2.3', versionCode: '12', installedFrom: 'Play Store', system: false, enabled: true })
    expect(byName['com.example.off']).toMatchObject({ enabled: false, system: true })
    expect(byName['com.android.tv']).toMatchObject({ system: true, versionName: '9' })
  })
  it('installs a good apk and explains a bad one', async () => {
    const good = await client().installApk(serial, '/x/app.apk', 'app.apk')
    expect(good.ok).toBe(true)
    const bad = await client().installApk(serial, '/x/bad.apk', 'bad.apk')
    expect(bad.ok).toBe(false)
    expect(bad.message).toContain('newer version')
  })
  it('uninstalls, disables and enables', async () => {
    expect((await client().uninstall(serial, 'com.example.user')).ok).toBe(true)
    expect((await client().uninstall(serial, 'com.android.tv')).ok).toBe(true)
    expect((await client().setEnabled(serial, 'com.example.user', false)).ok).toBe(true)
    expect((await client().setEnabled(serial, 'com.example.user', true)).ok).toBe(true)
  })
  it('rejects a hostile package name', async () => {
    expect((await client().uninstall(serial, 'com.x; reboot')).ok).toBe(false)
    expect((await client().uninstall(serial, 'com.android.settings')).ok).toBe(false)
    expect((await client().setEnabled(serial, 'com.android.systemui', false)).ok).toBe(false)
    expect((await client().setEnabled(serial, '--user', false)).ok).toBe(false)
  })
})
