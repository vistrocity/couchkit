import { describe, expect, it } from 'vitest'
import { parseConnectOutput, parseDevices, parseGetprop, parseWmSize } from '../src/main/adb/parse'

describe('parseConnectOutput', () => {
  it('recognises success', () => {
    expect(parseConnectOutput('connected to 192.168.0.105:5555\n', '').connected).toBe(true)
    expect(parseConnectOutput('already connected to 192.168.0.105:5555', '').connected).toBe(true)
  })
  it('does not treat failures as success even though adb exits 0', () => {
    expect(parseConnectOutput("failed to connect to '192.168.0.9:5555': Connection refused", '').connected).toBe(false)
    expect(parseConnectOutput('cannot connect to 192.168.0.9:5555: timed out (10060)', '').connected).toBe(false)
  })
})

describe('parseDevices', () => {
  it('reads states and skips daemon messages', () => {
    const text = [
      '* daemon not running; starting now at tcp:5037',
      '* daemon started successfully',
      'List of devices attached',
      '192.168.0.105:5555\tdevice product:a model:b',
      '192.168.0.106:5555\tunauthorized',
      '192.168.0.107:5555\toffline',
      'emulator-5554\tweird'
    ].join('\r\n')
    expect(parseDevices(text)).toEqual([
      { serial: '192.168.0.105:5555', state: 'device' },
      { serial: '192.168.0.106:5555', state: 'unauthorized' },
      { serial: '192.168.0.107:5555', state: 'offline' },
      { serial: 'emulator-5554', state: 'other' }
    ])
  })
  it('returns nothing for an empty list', () => {
    expect(parseDevices('List of devices attached\n\n')).toEqual([])
  })
})

describe('parseGetprop', () => {
  it('reads properties, including empty values and Windows line endings', () => {
    const props = parseGetprop('[ro.product.model]: [Chromecast]\r\n[ro.empty]: []\r\n[a.b]: [with: colon [x]]\r\n')
    expect(props['ro.product.model']).toBe('Chromecast')
    expect(props['ro.empty']).toBe('')
    expect(props['a.b']).toBe('with: colon [x]')
  })
})

describe('parseWmSize', () => {
  it('uses the physical size', () => {
    expect(parseWmSize('Physical size: 3840x2160')).toBe('3840x2160')
  })
  it('prefers a user override', () => {
    expect(parseWmSize('Physical size: 3840x2160\nOverride size: 1920x1080')).toBe('1920x1080')
  })
  it('returns undefined when absent', () => {
    expect(parseWmSize('error')).toBeUndefined()
  })
})
