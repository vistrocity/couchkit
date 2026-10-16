import { describe, expect, it, beforeEach } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { holdersScript, isValidPermissionName, parseHolders, parsePermissions, permissionLabel } from '../src/shared/permissions'

const DUMP = `Packages:
  Package [com.example.user] (abc):
    userId=10123
    declared permissions:
      com.example.user.PRIVATE: prot=signature
    requested permissions:
      android.permission.CAMERA
    install permissions:
      android.permission.INTERNET: granted=true
    User 0: ceDataInode=1 installed=true
      gids=[3003]
      runtime permissions:
        android.permission.CAMERA: granted=true, flags=[ USER_SET]
        android.permission.RECORD_AUDIO: granted=false, flags=[ USER_FIXED|USER_SET]
        android.permission.READ_CONTACTS: granted=true, flags=[ SYSTEM_FIXED]
    installed: true
`

describe('permissions parsing', () => {
  it('reads only the runtime permissions of the first user', () => {
    const p = parsePermissions(DUMP)
    expect(p.map((x) => [x.permission, x.granted, x.locked])).toEqual([
      ['android.permission.CAMERA', true, false],
      ['android.permission.RECORD_AUDIO', false, false],
      ['android.permission.READ_CONTACTS', true, true]
    ])
    expect(p[0]?.label).toBe('Camera')
  })
  it('copes with no runtime permissions', () => {
    expect(parsePermissions('Packages:\n  Package [x]\n    requested permissions:\n')).toEqual([])
    expect(parsePermissions('')).toEqual([])
  })
  it('labels unknown permissions in plain words', () => {
    expect(permissionLabel('com.vendor.permission.USE_MAGIC_BOX')).toBe('Use magic box')
  })
  it('validates permission names', () => {
    expect(isValidPermissionName('android.permission.CAMERA')).toBe(true)
    for (const bad of ['', 'CAMERA', 'a.b;reboot', 'a b.c', '$(x).y', 42, null]) expect(isValidPermissionName(bad)).toBe(false)
  })
  it('parses the holders list', () => {
    expect(parseHolders('@@holder com.b.app\n@@holder com.a.app\nnoise\n@@holder com.a.app\n@@holder bad;name')).toEqual(['com.a.app', 'com.b.app'])
    expect(holdersScript('android.permission.CAMERA')).toContain("'android.permission.CAMERA: granted=true'")
  })
})

describe('permissions through the client', () => {
  const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
  let state = ''
  beforeEach(() => {
    process.env['FAKE_ADB_MODE'] = 'ok'
    process.env['FAKE_ADB_LOG'] = join(mkdtempSync(join(tmpdir(), 'ck-pm-')), 'log.txt')
    state = join(mkdtempSync(join(tmpdir(), 'ck-pm-')), 'perms.json')
    writeFileSync(
      state,
      JSON.stringify({
        'com.example.user': { 'android.permission.CAMERA': { granted: true }, 'android.permission.READ_CONTACTS': { granted: true, locked: true } },
        'com.other.app': { 'android.permission.CAMERA': { granted: false } }
      })
    )
    process.env['FAKE_ADB_PERMS'] = state
  })
  const client = (): AdbClient => new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] })
  const read = (): Record<string, Record<string, { granted: boolean }>> => JSON.parse(readFileSync(state, 'utf8'))

  it('lists, blocks and re-allows a permission and checks the result', async () => {
    const c = client()
    const first = await c.readPermissions('S', 'com.example.user')
    expect(first.ok && first.permissions.length).toBe(2)
    expect((await c.setPermission('S', 'com.example.user', 'android.permission.CAMERA', false)).ok).toBe(true)
    expect(read()['com.example.user']?.['android.permission.CAMERA']?.granted).toBe(false)
    expect((await c.setPermission('S', 'com.example.user', 'android.permission.CAMERA', true)).ok).toBe(true)
    expect(read()['com.example.user']?.['android.permission.CAMERA']?.granted).toBe(true)
  })
  it('refuses locked, unknown, protected and malformed requests without sending a change', async () => {
    const c = client()
    const locked = await c.setPermission('S', 'com.example.user', 'android.permission.READ_CONTACTS', false)
    expect(!locked.ok && locked.message).toContain('fixed')
    expect((await c.setPermission('S', 'com.example.user', 'android.permission.SEND_SMS', true)).ok).toBe(false)
    expect((await c.setPermission('S', 'com.android.settings', 'android.permission.CAMERA', false)).ok).toBe(false)
    expect((await c.setPermission('S', 'com.example.user', 'x;reboot', true)).ok).toBe(false)
    expect((await c.setPermission('S', 'bad name;', 'android.permission.CAMERA', true)).ok).toBe(false)
    expect(read()['com.example.user']?.['android.permission.READ_CONTACTS']?.granted).toBe(true)
  })
  it('reports an unknown app', async () => {
    const r = await client().readPermissions('S', 'com.nobody.here')
    expect(r.ok).toBe(false)
  })
  it('finds the apps that hold a permission', async () => {
    const r = await client().appsWithPermission('S', 'camera')
    expect(r.ok && r.packages).toEqual(['com.example.user'])
    expect((await client().appsWithPermission('S', 'rm -rf')).ok).toBe(false)
  })
})
