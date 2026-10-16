import { describe, expect, it } from 'vitest'
import { classifyAdbFailure } from '../src/main/adb/classify'

describe('classifyAdbFailure', () => {
  it.each([
    ['failed to connect to 192.168.0.9:5555', 'unreachable'],
    ['cannot connect to 192.168.0.9:5555: Connection refused', 'unreachable'],
    ['error: device unauthorized.', 'unauthorized'],
    ['failed to authenticate to 192.168.1.190:5555', 'unauthorized'],
    ['error: device offline', 'offline'],
    ['adb: error: no devices/emulators found', 'offline'],
    ['Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]', 'no_space'],
    ['Failure [INSTALL_FAILED_OLDER_SDK]', 'bad_apk'],
    ['Failure [INSTALL_PARSE_FAILED_NOT_APK]', 'bad_apk'],
    ['something unexpected', 'other']
  ])('%j -> %s', (output, expected) => {
    expect(classifyAdbFailure(output)).toBe(expected)
  })
})
