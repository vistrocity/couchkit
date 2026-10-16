import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AdbClient } from '../src/main/adb/client'
import { captureFileName, isRecordingPreset, timeStamp } from '../src/main/adb/capture'

const fakeAdb = join(__dirname, 'fixtures', 'fake-adb.js')
const serial = '192.168.0.105:5555'
const client = (): AdbClient => {
  process.env['FAKE_ADB_MODE'] = 'ok'
  return new AdbClient({ binary: process.execPath, baseArgs: [fakeAdb] })
}
const sandbox = (): { dir: string; log: string; stop: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'ck-cap-'))
  const log = join(dir, 'cmd.log')
  const stop = join(dir, 'stop')
  process.env['FAKE_ADB_LOG'] = log
  process.env['FAKE_ADB_STOPFILE'] = stop
  delete process.env['FAKE_ADB_RECFAIL']
  return { dir, log, stop }
}

describe('capture names', () => {
  it('builds sortable local-time names', () => {
    const d = new Date(2026, 9, 16, 14, 30, 5)
    expect(timeStamp(d)).toBe('20261016-143005')
    expect(captureFileName('screenshot', d)).toBe('Couchkit-screenshot-20261016-143005.png')
    expect(captureFileName('recording', d)).toBe('Couchkit-recording-20261016-143005.mp4')
  })
  it('accepts only the two presets', () => {
    expect(isRecordingPreset('small')).toBe(true)
    expect(isRecordingPreset('full')).toBe(true)
    expect(isRecordingPreset('--size 1x1')).toBe(false)
  })
})

describe('screenshot', () => {
  it('captures, copies to the computer, and cleans up on the TV', async () => {
    const { dir, log } = sandbox()
    const file = join(dir, 'shot.png')
    expect((await client().screenshot(serial, file)).ok).toBe(true)
    expect(existsSync(file)).toBe(true)
    const text = readFileSync(log, 'utf8')
    expect(text).toContain('screencap -p /data/local/tmp/couchkit-shot.png')
    expect(text).toContain('rm -f /data/local/tmp/couchkit-shot.png')
  })
})

describe('recording', () => {
  it('starts, stops on request, saves the video', async () => {
    const { dir, log } = sandbox()
    const c = client()
    const handle = c.startRecording(serial, 'small')
    const file = join(dir, 'rec.mp4')
    const result = await c.finishRecording(serial, handle, file)
    expect(result.ok).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('fake mp4')
    const text = readFileSync(log, 'utf8')
    expect(text).toContain('screenrecord --time-limit 180 --size 1280x720 --bit-rate 4000000 /data/local/tmp/couchkit-rec.mp4')
    expect(text).toContain('rm -f /data/local/tmp/couchkit-rec.mp4')
  })
  it('uses the TV\'s own resolution for the full preset', async () => {
    const { dir, log } = sandbox()
    const c = client()
    await c.finishRecording(serial, c.startRecording(serial, 'full'), join(dir, 'r.mp4'))
    expect(readFileSync(log, 'utf8')).toContain('screenrecord --time-limit 180 /data/local/tmp/couchkit-rec.mp4')
  })
  it('explains a TV that cannot record', async () => {
    const { dir } = sandbox()
    process.env['FAKE_ADB_RECFAIL'] = '1'
    const c = client()
    const result = await c.finishRecording(serial, c.startRecording(serial, 'small'), join(dir, 'r.mp4'))
    delete process.env['FAKE_ADB_RECFAIL']
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('did not produce a recording')
      expect(result.detail).toContain('unable to configure encoder')
    }
  })
})
