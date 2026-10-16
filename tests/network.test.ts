import { describe, expect, it } from 'vitest'
import { formatHostPort, parseHostPort } from '@shared/network'

describe('parseHostPort', () => {
  it('accepts an IP and uses the default port', () => {
    expect(parseHostPort('192.168.0.105')).toEqual({ host: '192.168.0.105', port: 5555 })
  })
  it('accepts an explicit port and trims spaces', () => {
    expect(parseHostPort('  10.0.0.2:5556 ')).toEqual({ host: '10.0.0.2', port: 5556 })
  })
  it.each([
    '',
    'tv.local',
    '192.168.0',
    '192.168.0.256',
    '192.168.0.1:0',
    '192.168.0.1:70000',
    '192.168.0.1:abc',
    '192.168.0.1:5555:1',
    '192.168.0.1; rm -rf /',
    '-s emulator-5554'
  ])('rejects %j', (input) => {
    expect(parseHostPort(input)).toBeNull()
  })
  it('formats back to host:port', () => {
    expect(formatHostPort({ host: '10.0.0.2', port: 5555 })).toBe('10.0.0.2:5555')
  })
})
