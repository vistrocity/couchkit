import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { parseLs, shellQuote } from '../src/main/adb/files'
import { breadcrumbs, formatSize, isDeletablePath, isValidRemotePath, joinRemotePath, normalizeRemotePath, parentRemotePath } from '../src/shared/tvpath'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const serial = '192.168.0.105:5555'
const client = (): AdbClient => {
  process.env['FAKE_ADB_MODE'] = 'ok'
  return new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] })
}
const logFile = (): string => {
  const f = join(mkdtempSync(join(tmpdir(), 'ck-')), 'cmd.log')
  process.env['FAKE_ADB_LOG'] = f
  return f
}

describe('TV paths', () => {
  it('normalizes, joins and finds parents', () => {
    expect(normalizeRemotePath('/sdcard//Download/./x/../')).toBe('/sdcard/Download')
    expect(joinRemotePath('/sdcard', 'a b')).toBe('/sdcard/a b')
    expect(parentRemotePath('/sdcard/Download')).toBe('/sdcard')
    expect(parentRemotePath('/sdcard')).toBe('/')
    expect(parentRemotePath('/')).toBe('/')
  })
  it('builds breadcrumbs', () => {
    expect(breadcrumbs('/sdcard/Download')).toEqual([
      { name: 'sdcard', path: '/sdcard' },
      { name: 'Download', path: '/sdcard/Download' }
    ])
  })
  it('validates paths', () => {
    expect(isValidRemotePath('/sdcard/My Movies')).toBe(true)
    expect(isValidRemotePath('sdcard')).toBe(false)
    expect(isValidRemotePath('/a\nb')).toBe(false)
    expect(isValidRemotePath(5)).toBe(false)
  })
  it('never allows deleting storage roots or system places', () => {
    expect(isDeletablePath('/sdcard/Download/x.mp4')).toBe(true)
    expect(isDeletablePath('/sdcard')).toBe(false)
    expect(isDeletablePath('/sdcard/')).toBe(false)
    expect(isDeletablePath('/')).toBe(false)
    expect(isDeletablePath('/system/bin')).toBe(false)
    expect(isDeletablePath('/sdcard/Android')).toBe(false)
    // ".." tricks cannot climb out of the allowed area
    expect(isDeletablePath('/sdcard/Download/../..')).toBe(false)
    expect(isDeletablePath('/sdcard/../system')).toBe(false)
  })
  it('formats sizes', () => {
    expect(formatSize(500)).toBe('500 B')
    expect(formatSize(1536000)).toBe('1.5 MB')
  })
})

describe('shell quoting', () => {
  it('keeps everything as plain text', () => {
    expect(shellQuote('/sdcard/a b')).toBe("'/sdcard/a b'")
    expect(shellQuote('/sdcard/$(reboot);x')).toBe("'/sdcard/$(reboot);x'")
    expect(shellQuote("/sdcard/it's")).toBe("'/sdcard/it'\\''s'")
  })
})

describe('ls parsing', () => {
  const sample = `total 12
drwxrwx--x  4 root sdcard_rw 3452 2026-10-16 10:03 Android
drwxrwx---  2 u0_a1 media_rw 4096 2026-10-15 09:00 My Movies
-rw-rw----  1 u0_a1 media_rw 1536000 2026-10-14 18:30 holiday video.mp4
lrwxrwxrwx  1 root root 21 2026-01-01 00:00 link -> /storage/self/primary
drwxr-xr-x root root 2020-01-01 10:00 OldStyle`
  it('reads names with spaces, sizes, links and the older layout, folders first', () => {
    const e = parseLs(sample, '/sdcard')
    expect(e.map((x) => x.name)).toEqual(['Android', 'link', 'My Movies', 'OldStyle', 'holiday video.mp4'])
    const video = e.find((x) => x.name === 'holiday video.mp4')
    expect(video).toMatchObject({ kind: 'file', size: 1536000, path: '/sdcard/holiday video.mp4', modified: '2026-10-14 18:30' })
    expect(e.find((x) => x.name === 'link')).toMatchObject({ kind: 'link' })
    expect(e.find((x) => x.name === 'link')?.size).toBeUndefined()
    expect(e.find((x) => x.name === 'OldStyle')?.kind).toBe('dir')
  })
  it('ignores the total line, dot entries and junk', () => {
    expect(parseLs('total 0\nsomething odd\n', '/sdcard')).toEqual([])
  })
})

describe('AdbClient files', () => {
  it('lists a folder', async () => {
    const r = await client().listFiles(serial, '/sdcard')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.entries.some((x) => x.name === 'notes.txt')).toBe(true)
  })
  it('explains missing and protected folders', async () => {
    const missing = await client().listFiles(serial, '/sdcard/nope')
    expect(!missing.ok && missing.message).toContain('does not exist')
    const locked = await client().listFiles(serial, '/sdcard/locked')
    expect(!locked.ok && locked.message).toContain('does not allow')
  })
  it('rejects a bad path without running anything', async () => {
    expect((await client().listFiles(serial, 'sdcard')).ok).toBe(false)
  })
  it('pulls and pushes', async () => {
    const log = logFile()
    expect((await client().pull(serial, '/sdcard/notes.txt', '/tmp/out')).ok).toBe(true)
    expect((await client().push(serial, '/tmp/a.txt', '/sdcard/Download', 'a.txt')).ok).toBe(true)
    const text = readFileSync(log, 'utf8')
    expect(text).toContain('pull /sdcard/notes.txt /tmp/out')
    expect(text).toContain('push /tmp/a.txt /sdcard/Download/')
  })
  it('explains a full TV', async () => {
    const r = await client().push(serial, '/tmp/toobig.bin', '/sdcard', 'toobig.bin')
    expect(r.ok).toBe(false)
    expect(r.message).toContain('not enough free space')
  })
  it('makes a quoted folder and refuses bad names', async () => {
    const log = logFile()
    expect((await client().makeFolder(serial, '/sdcard', "My 'x' dir; reboot")).ok).toBe(true)
    expect(readFileSync(log, 'utf8')).toContain("mkdir '/sdcard/My '\\''x'\\'' dir; reboot'")
    expect((await client().makeFolder(serial, '/sdcard', 'a/b')).ok).toBe(false)
    expect((await client().makeFolder(serial, '/sdcard', '..')).ok).toBe(false)
    expect((await client().makeFolder(serial, '/sdcard', '  ')).ok).toBe(false)
  })
  it('deletes inside storage only', async () => {
    const log = logFile()
    expect((await client().remove(serial, '/sdcard/Download/old.apk')).ok).toBe(true)
    expect(readFileSync(log, 'utf8')).toContain("rm -r '/sdcard/Download/old.apk'")
    expect((await client().remove(serial, '/sdcard')).ok).toBe(false)
    expect((await client().remove(serial, '/sdcard/..')).ok).toBe(false)
    expect((await client().remove(serial, '/system')).ok).toBe(false)
  })
})
