import type { CommandResult, LogEntry } from '@shared/types'

/** Longest stretch of command output kept per log line. */
const MAX_OUTPUT = 2000

/** The most recent commands, kept in memory only and never sent anywhere. */
export class ActivityLog {
  private readonly entries: LogEntry[] = []
  private nextId = 1

  constructor(private readonly capacity = 500) {}

  add(result: CommandResult & { startedAt: number }): void {
    const output = [result.stdout.trim(), result.stderr.trim()].filter((t) => t !== '').join('\n')
    const entry: LogEntry = {
      id: this.nextId++,
      startedAt: result.startedAt,
      command: result.command,
      ok: result.ok,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      output: output.length > MAX_OUTPUT ? `${output.slice(0, MAX_OUTPUT)}\n…(cut)` : output,
      ...(result.category !== undefined ? { category: result.category } : {})
    }
    this.entries.push(entry)
    if (this.entries.length > this.capacity) this.entries.shift()
  }

  /** Newest first. */
  list(): LogEntry[] {
    return [...this.entries].reverse()
  }
}
