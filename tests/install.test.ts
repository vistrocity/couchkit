import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import AdmZip from 'adm-zip'
import { createServer, type Server } from 'node:http'
import { mkdtemp, readdir, stat } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { parsePlatformToolsArchive } from '../src/main/adb/checksum'
import { installPlatformTools, platformToolsUrl, zipEntriesAreSafe } from '../src/main/adb/install'
import type { DownloadProgress } from '../src/shared/types'
import { rawZip } from './fixtures/rawzip'

function goodZip(): Buffer {
  const zip = new AdmZip()
  zip.addFile('platform-tools/adb', Buffer.from('#!/bin/sh\necho fake adb\n'), '', 0o755)
  zip.addFile('platform-tools/adb.exe', Buffer.from('MZ fake'))
  zip.addFile('platform-tools/fastboot', Buffer.from('fake'), '', 0o755)
  return zip.toBuffer()
}

function evilZip(): Buffer {
  return rawZip([
    ['platform-tools/adb', 'x'],
    ['../escaped.txt', 'gotcha']
  ])
}

function absolutePathZip(): Buffer {
  return rawZip([
    ['platform-tools/adb', 'x'],
    ['/tmp/couchkit-absolute.txt', 'gotcha']
  ])
}

let server: Server
let base = ''
const routes: Record<string, { status: number; body: Buffer }> = {}

beforeAll(async () => {
  routes['/good.zip'] = { status: 200, body: goodZip() }
  routes['/evil.zip'] = { status: 200, body: evilZip() }
  routes['/abs.zip'] = { status: 200, body: absolutePathZip() }
  routes['/bad.zip'] = { status: 200, body: Buffer.from('this is not a zip file') }
  routes['/empty.zip'] = { status: 200, body: new AdmZip().toBuffer() }
  server = createServer((req, res) => {
    const route = routes[req.url ?? '']
    if (!route) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(route.status, { 'content-length': route.body.length })
    res.end(route.body)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

const run = async (path: string, binaryName = 'adb') => {
  const toolsDir = await mkdtemp(join(tmpdir(), 'couchkit-tools-'))
  const progress: DownloadProgress[] = []
  const outcome = await installPlatformTools({
    url: base + path,
    toolsDir,
    binaryName,
    allowInsecureUrl: true,
    onProgress: (p) => progress.push(p)
  })
  return { toolsDir, outcome, progress }
}

describe('installPlatformTools', () => {
  it('downloads, unpacks, and reports progress', async () => {
    const { toolsDir, outcome, progress } = await run('/good.zip')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.adbPath).toBe(join(toolsDir, 'platform-tools', 'adb'))
    expect((await stat(outcome.adbPath)).isFile()).toBe(true)
    expect(progress.at(0)?.phase).toBe('downloading')
    expect(progress.at(-1)?.phase).toBe('done')
    expect(progress.some((p) => p.phase === 'extracting')).toBe(true)
    // The temporary files are cleaned up.
    expect((await readdir(toolsDir)).sort()).toEqual(['platform-tools'])
  })

  it('makes adb runnable on macOS and Linux', async () => {
    if (process.platform === 'win32') return
    const { outcome } = await run('/good.zip')
    if (!outcome.ok) throw new Error('install failed')
    expect((await stat(outcome.adbPath)).mode & 0o111).not.toBe(0)
  })

  it('uses the .exe name when asked', async () => {
    const { outcome } = await run('/good.zip', 'adb.exe')
    expect(outcome.ok).toBe(true)
  })

  it('replaces an older copy', async () => {
    const first = await run('/good.zip')
    const second = await installPlatformTools({
      url: base + '/good.zip',
      toolsDir: first.toolsDir,
      binaryName: 'adb',
      allowInsecureUrl: true
    })
    expect(second.ok).toBe(true)
  })

  it('refuses a plain http address by default', async () => {
    const toolsDir = await mkdtemp(join(tmpdir(), 'couchkit-tools-'))
    const outcome = await installPlatformTools({ url: base + '/good.zip', toolsDir, binaryName: 'adb' })
    expect(outcome.ok).toBe(false)
  })

  it('reports a server error', async () => {
    const { outcome } = await run('/missing.zip')
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toContain('404')
  })

  it('reports a file that is not a zip', async () => {
    const { outcome } = await run('/bad.zip')
    expect(outcome.ok).toBe(false)
  })

  it('refuses a zip that tries to write outside its folder', async () => {
    const { toolsDir, outcome } = await run('/evil.zip')
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toContain('unsafe')
    expect((await readdir(toolsDir)).includes('escaped.txt')).toBe(false)
  })

  it('refuses a zip with an absolute path', async () => {
    const { outcome } = await run('/abs.zip')
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toContain('unsafe')
  })

  it('reports a zip without adb inside', async () => {
    const { outcome } = await run('/empty.zip')
    expect(outcome.ok).toBe(false)
  })
})

describe('zipEntriesAreSafe', () => {
  it('accepts normal paths and rejects traversal', () => {
    expect(zipEntriesAreSafe(new AdmZip(goodZip()), join(tmpdir(), 'x'))).toBe(true)
    expect(zipEntriesAreSafe(new AdmZip(evilZip()), join(tmpdir(), 'x'))).toBe(false)
  })
})

describe('platformToolsUrl', () => {
  it('points at Google over https for each system', () => {
    expect(platformToolsUrl('win32')).toBe('https://dl.google.com/android/repository/platform-tools-latest-windows.zip')
    expect(platformToolsUrl('darwin')).toContain('latest-darwin.zip')
    expect(platformToolsUrl('linux')).toContain('latest-linux.zip')
  })
})

describe('checksum check', () => {
  const sha1 = (b: Buffer): string => createHash('sha1').update(b).digest('hex')
  const manifest = (zipName: string, hash: string, os = 'linux'): string => `<?xml version="1.0"?>
<sdk:sdk-repository xmlns:sdk="x"><channel id="channel-0">stable</channel>
<remotePackage path="platform-tools"><channelRef ref="channel-0"/><archives>
<archive><complete><size>1</size><checksum type="sha1">${'0'.repeat(40)}</checksum><url>other.zip</url></complete><host-os>windows</host-os></archive>
<archive><complete><size>${routes['/good.zip']!.body.length}</size><checksum type="sha1">${hash}</checksum><url>${zipName}</url></complete><host-os>${os}</host-os></archive>
</archives></remotePackage></sdk:sdk-repository>`

  const install = async (manifestPath: string | undefined) => {
    const toolsDir = await mkdtemp(join(tmpdir(), 'couchkit-tools-'))
    const outcome = await installPlatformTools({
      url: base + '/good.zip',
      toolsDir,
      binaryName: 'adb',
      allowInsecureUrl: true,
      os: 'linux',
      ...(manifestPath !== undefined ? { manifestUrl: base + manifestPath } : {})
    })
    return { toolsDir, outcome }
  }

  it('reads the right archive from the list', () => {
    const info = parsePlatformToolsArchive(manifest('p.zip', 'a'.repeat(40)), 'linux')
    expect(info?.url).toBe('p.zip')
    expect(info?.hash).toEqual({ type: 'sha1', value: 'a'.repeat(40) })
    expect(parsePlatformToolsArchive(manifest('p.zip', 'a'.repeat(40)), 'darwin')).toBeNull()
    expect(parsePlatformToolsArchive('<nothing/>', 'linux')).toBeNull()
    expect(parsePlatformToolsArchive(manifest('p.zip', 'short'), 'linux')).toBeNull()
  })

  it('installs and says verified when the checksum matches', async () => {
    routes['/m-ok.xml'] = { status: 200, body: Buffer.from(manifest('good.zip', sha1(routes['/good.zip']!.body))) }
    const { outcome } = await install('/m-ok.xml')
    expect(outcome.ok && outcome.verified).toBe(true)
  })

  it('refuses a download whose checksum does not match, and installs nothing', async () => {
    routes['/m-bad.xml'] = { status: 200, body: Buffer.from(manifest('good.zip', 'f'.repeat(40))) }
    const { toolsDir, outcome } = await install('/m-bad.xml')
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.message).toContain('checksum')
    expect(await readdir(toolsDir)).toEqual([])
  })

  it('carries on, marked unverified, when the list is missing', async () => {
    const { outcome } = await install('/no-such-list.xml')
    expect(outcome.ok && outcome.verified).toBe(false)
  })

  it('ignores a list entry that points somewhere other than a plain zip name', async () => {
    routes['/m-evil.xml'] = { status: 200, body: Buffer.from(manifest('../../evil.zip', sha1(routes['/good.zip']!.body))) }
    const { outcome } = await install('/m-evil.xml')
    expect(outcome.ok && outcome.verified).toBe(false)
  })
})
