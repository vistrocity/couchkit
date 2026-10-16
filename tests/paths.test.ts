import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import {
  networkPermissionHint,
  shortcutModifier,
  toolBinaryName,
  userDataDir
} from '../src/main/platform/paths'

describe('platform paths', () => {
  it('uses Application Support on macOS', () => {
    expect(userDataDir('darwin', {}, '/Users/a', 'Couchkit')).toBe(
      join('/Users/a', 'Library', 'Application Support', 'Couchkit')
    )
  })
  it('uses APPDATA on Windows, with a fallback', () => {
    expect(userDataDir('win32', { APPDATA: 'C:\\Users\\a\\AppData\\Roaming' }, 'C:\\Users\\a', 'Couchkit')).toBe(
      join('C:\\Users\\a\\AppData\\Roaming', 'Couchkit')
    )
    expect(userDataDir('win32', {}, 'C:\\Users\\a', 'Couchkit')).toBe(
      join('C:\\Users\\a', 'AppData', 'Roaming', 'Couchkit')
    )
  })
  it('adds .exe only on Windows', () => {
    expect(toolBinaryName('win32', 'adb')).toBe('adb.exe')
    expect(toolBinaryName('darwin', 'adb')).toBe('adb')
  })
  it('picks Cmd on macOS and Ctrl elsewhere', () => {
    expect(shortcutModifier('darwin')).toBe('Cmd')
    expect(shortcutModifier('win32')).toBe('Ctrl')
  })
  it('gives each system its own network hint', () => {
    expect(networkPermissionHint('darwin')).toContain('Local Network')
    expect(networkPermissionHint('win32')).toContain('firewall')
  })
})
