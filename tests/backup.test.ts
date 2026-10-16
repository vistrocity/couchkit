import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { scanBackupFolder } from '../src/main/backup'
import { backupFolderName, parseApkPaths } from '../src/shared/backup'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const serial = '192.168.0.105:5555'
const setup = (): { client: AdbClient; dir: string; log: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'ck-backup-'))
  const log = join(dir, 'cmd.log')
  process.env['FAKE_ADB_MODE'] = 'ok'
  process.env['FAKE_ADB_LOG'] = log
  return { client: new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] }), dir, log }
}

describe('apk path parsing', () => {
  it('accepts normal app paths and several parts', () => {
    const out = 'package:/data/app/~~abc==/com.x-1==/base.apk\npackage:/data/app/~~abc==/com.x-1==/split_config.en.apk\n'
    expect(parseApkPaths(out)).toHaveLength(2)
  })
  it('drops anything unexpected', () => {
    expect(parseApkPaths('package:/system/app/Foo/Foo.apk')).toEqual([])
    expect(parseApkPaths('package:/data/app/../../etc/x.apk')).toEqual([])
    expect(parseApkPaths('package:/data/app/a b/base.apk')).toEqual([])
    expect(parseApkPaths("package:/data/app/x/b';id;.apk")).toEqual([])
    expect(parseApkPaths('error')).toEqual([])
  })
  it('names folders by time', () => {
    expect(backupFolderName('20261016-180000')).toBe('Couchkit-backup-20261016-180000')
  })
})

describe('backup and restore through the fake TV', () => {
  it('saves apps, finds them again, and restores single and split apps', async () => {
    const { client, dir, log } = setup()
    const a = await client.pullApp(serial, 'com.example.one', dir)
    const b = await client.pullApp(serial, 'com.example.split', dir)
    expect(a.ok && b.ok).toBe(true)
    expect(existsSync(join(dir, 'com.example.one', 'base.apk'))).toBe(true)
    expect(readFileSync(join(dir, 'com.example.split', 'split_config.en.apk'), 'utf8')).toBe('fake apk bytes')

    const scan = scanBackupFolder(dir)
    expect(scan.map((x) => x.packageName)).toEqual(['com.example.one', 'com.example.split'])
    expect(scan[1]?.files).toEqual(['base.apk', 'split_config.en.apk'])

    const one = await client.installSaved(serial, 'com.example.one', scan[0]!.files.map((f) => join(dir, 'com.example.one', f)))
    const two = await client.installSaved(serial, 'com.example.split', scan[1]!.files.map((f) => join(dir, 'com.example.split', f)))
    expect(one.ok && two.ok).toBe(true)
    expect(readFileSync(log, 'utf8')).toContain('install-multiple -r')
  })
  it('reports an app with no files and refuses bad names', async () => {
    const { client, dir } = setup()
    const missing = await client.pullApp(serial, 'com.missing.app', dir)
    expect(missing.ok).toBe(false)
    expect(existsSync(join(dir, 'com.missing.app'))).toBe(false)
    expect((await client.pullApp(serial, 'x; reboot', dir)).ok).toBe(false)
  })
  it('explains a failed restore in plain words', async () => {
    const { client, dir } = setup()
    mkdirSync(join(dir, 'com.bad'))
    writeFileSync(join(dir, 'com.bad', 'bad.apk'), 'x')
    const r = await client.installSaved(serial, 'com.bad', [join(dir, 'com.bad', 'bad.apk')])
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/newer version/i)
  })
  it('ignores folders that are not apps when scanning', () => {
    const { dir } = setup()
    mkdirSync(join(dir, 'not a package'))
    writeFileSync(join(dir, 'not a package', 'x.apk'), 'x')
    mkdirSync(join(dir, 'com.empty'))
    writeFileSync(join(dir, 'stray.apk'), 'x')
    expect(scanBackupFolder(dir)).toEqual([])
  })
  it('clears one app cache', async () => {
    const { client } = setup()
    expect((await client.clearAppCache(serial, 'com.example.one')).ok).toBe(true)
    expect((await client.clearAppCache(serial, 'bad name')).ok).toBe(false)
  })
})
