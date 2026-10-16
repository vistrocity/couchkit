import { describe, expect, it } from 'vitest'
import { runCommand, describeCommand } from '../src/main/adb/runner'

// The current Node program stands in for adb, so the tests need no TV and no adb.
const node = process.execPath

describe('runCommand', () => {
  it('captures output and reports success', async () => {
    const result = await runCommand(node, ['-e', 'console.log("hello")'])
    expect(result.ok).toBe(true)
    expect(result.stdout.trim()).toBe('hello')
    expect(result.exitCode).toBe(0)
  })

  it('reports a non-zero exit with a category', async () => {
    const result = await runCommand(node, [
      '-e',
      'console.error("failed to connect to 10.0.0.1:5555"); process.exit(1)'
    ])
    expect(result.ok).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(result.category).toBe('unreachable')
  })

  it('passes hostile text as data, never as a command', async () => {
    const nasty = '"; echo INJECTED; $(echo INJECTED) `echo INJECTED` & echo INJECTED #'
    const result = await runCommand(node, ['-e', 'console.log(process.argv[1])', nasty])
    expect(result.ok).toBe(true)
    // The text came back exactly as typed; nothing was executed.
    expect(result.stdout.trim()).toBe(nasty)
  })

  it('handles file names with spaces and accents', async () => {
    const name = 'Mon film été 2026 😀.mp4'
    const result = await runCommand(node, ['-e', 'console.log(process.argv[1])', name])
    expect(result.stdout.trim()).toBe(name)
  })

  it('gives up after the timeout', async () => {
    const result = await runCommand(node, ['-e', 'setTimeout(()=>{}, 10000)'], { timeoutMs: 300 })
    expect(result.ok).toBe(false)
    expect(result.category).toBe('timeout')
  })

  it('reports a missing program as tool_missing', async () => {
    const result = await runCommand('/definitely/not/here/adb', ['version'])
    expect(result.ok).toBe(false)
    expect(result.category).toBe('tool_missing')
  })

  it('caps captured output', async () => {
    const result = await runCommand(node, ['-e', 'console.log("x".repeat(5000))'], {
      maxOutputChars: 100
    })
    expect(result.stdout.length).toBeLessThanOrEqual(100)
  })

  it('writes every call to the log', async () => {
    const entries: string[] = []
    await runCommand(node, ['-e', '0'], {}, (entry) => entries.push(entry.command))
    expect(entries).toHaveLength(1)
  })

  it('quotes odd arguments in the log text only', () => {
    expect(describeCommand('adb', ['push', 'my file.txt'])).toBe('adb push "my file.txt"')
  })
})
