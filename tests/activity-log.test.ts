import { describe, expect, it } from 'vitest'
import { ActivityLog } from '../src/main/store/activity-log'

const result = (command: string, extra: Partial<Parameters<ActivityLog['add']>[0]> = {}) => ({
  ok: true,
  command,
  stdout: '',
  stderr: '',
  exitCode: 0,
  durationMs: 5,
  startedAt: 1,
  ...extra
})

describe('ActivityLog', () => {
  it('lists newest first', () => {
    const log = new ActivityLog()
    log.add(result('first'))
    log.add(result('second'))
    expect(log.list().map((e) => e.command)).toEqual(['second', 'first'])
  })
  it('keeps only the most recent entries', () => {
    const log = new ActivityLog(3)
    for (let i = 1; i <= 5; i++) log.add(result(`c${i}`))
    expect(log.list().map((e) => e.command)).toEqual(['c5', 'c4', 'c3'])
  })
  it('combines and truncates output', () => {
    const log = new ActivityLog()
    log.add(result('x', { stdout: 'out', stderr: 'err' }))
    expect(log.list()[0]?.output).toBe('out\nerr')
    log.add(result('y', { stdout: 'z'.repeat(5000) }))
    expect(log.list()[0]?.output.length).toBeLessThan(2100)
  })
})
