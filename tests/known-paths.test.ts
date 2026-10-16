import { describe, expect, it } from 'vitest'
import { KnownPaths } from '../src/main/known-paths'

describe('KnownPaths', () => {
  it('only knows what it was told', () => {
    const k = new KnownPaths()
    k.add('/home/a/app.apk')
    expect(k.has('/home/a/app.apk')).toBe(true)
    expect(k.has('/etc/passwd')).toBe(false)
  })
  it('ignores junk', () => {
    const k = new KnownPaths()
    k.add(42)
    k.add('')
    k.add('x'.repeat(5000))
    expect(k.has('')).toBe(false)
    expect(k.has('x'.repeat(5000))).toBe(false)
  })
  it('forgets the oldest when full', () => {
    const k = new KnownPaths(2)
    k.addAll(['/a', '/b', '/c'])
    expect(k.has('/a')).toBe(false)
    expect(k.has('/c')).toBe(true)
  })
})
