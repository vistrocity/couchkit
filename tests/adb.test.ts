import { describe, expect, it } from 'vitest'
import { join, delimiter } from 'node:path'
import { checkAdb, findAdb, parseAdbVersion } from '../src/main/adb/adb'

describe('findAdb', () => {
  it('prefers the app-managed copy over the PATH', () => {
    const managed = join('/data/tools', 'platform-tools', 'adb')
    const found = findAdb({
      toolsDir: '/data/tools',
      binaryName: 'adb',
      pathEnv: ['/usr/bin', '/opt/bin'].join(delimiter),
      exists: () => true
    })
    expect(found).toBe(managed)
  })
  it('falls back to the PATH', () => {
    const found = findAdb({
      toolsDir: '/data/tools',
      binaryName: 'adb',
      pathEnv: ['/usr/bin', '/opt/bin'].join(delimiter),
      exists: (p) => p === join('/opt/bin', 'adb')
    })
    expect(found).toBe(join('/opt/bin', 'adb'))
  })
  it('returns null when nothing is found', () => {
    expect(findAdb({ toolsDir: '/x', binaryName: 'adb', pathEnv: '', exists: () => false })).toBeNull()
  })
})

describe('adb version', () => {
  it('parses the version line', () => {
    expect(parseAdbVersion('Android Debug Bridge version 1.0.41\nVersion 35.0.2')).toBe('1.0.41')
  })
  it('reports adb as missing without trying to run it', async () => {
    const status = await checkAdb(null)
    expect(status.found).toBe(false)
  })
  it('reports a program that cannot run', async () => {
    const status = await checkAdb('/definitely/not/here/adb')
    expect(status.found).toBe(false)
    expect(status.message).toContain('could not run')
  })
})
