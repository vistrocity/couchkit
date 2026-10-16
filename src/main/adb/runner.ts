import { spawn } from 'node:child_process'
import type { CommandResult } from '@shared/types'
import { classifyAdbFailure } from './classify'

/**
 * The command runner: the ONLY place in Couchkit that starts another program.
 *
 * Safety rules, enforced here so no feature can break them:
 *  - Programs are started with an argument list and shell: false, so text from the
 *    user (file names, typed text, IP addresses) is data and can never become a command.
 *  - Every call has a timeout and a cap on captured output.
 *  - Every call is reported to the activity log, success or failure.
 */

export interface RunOptions {
  /** Give up after this many milliseconds. Default 15 s. */
  timeoutMs?: number
  /** Keep at most this many characters of each output stream. Default 1,000,000. */
  maxOutputChars?: number
  /** Extra environment variables for this call. */
  env?: NodeJS.ProcessEnv
}

export type LogSink = (entry: CommandResult & { startedAt: number }) => void

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_OUTPUT = 1_000_000

/** Quote an argument only for display in the log. Never used to run anything. */
function displayArg(arg: string): string {
  return /^[\w./:=@%+-]+$/.test(arg) ? arg : JSON.stringify(arg)
}

export function describeCommand(binary: string, args: readonly string[]): string {
  return [binary, ...args].map(displayArg).join(' ')
}

export async function runCommand(
  binary: string,
  args: readonly string[],
  options: RunOptions = {},
  log?: LogSink
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxChars = options.maxOutputChars ?? DEFAULT_MAX_OUTPUT
  const command = describeCommand(binary, args)
  const startedAt = Date.now()

  const finish = (partial: Omit<CommandResult, 'command' | 'durationMs'>): CommandResult => {
    const result: CommandResult = {
      ...partial,
      command,
      durationMs: Date.now() - startedAt
    }
    log?.({ ...result, startedAt })
    return result
  }

  return new Promise<CommandResult>((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const settle = (result: CommandResult): void => {
      if (settled) return
      settled = true
      resolve(result)
    }

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(binary, [...args], {
        shell: false,
        windowsHide: true,
        env: { ...process.env, ...options.env }
      })
    } catch (error) {
      settle(
        finish({
          ok: false,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          exitCode: null,
          category: 'tool_missing'
        })
      )
      return
    }

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)

    const append = (current: string, chunk: Buffer): string =>
      current.length >= maxChars ? current : (current + chunk.toString('utf8')).slice(0, maxChars)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk)
    })

    // The program could not be started at all (missing file, no permission).
    child.on('error', (error) => {
      clearTimeout(timer)
      settle(
        finish({
          ok: false,
          stdout,
          stderr: error.message,
          exitCode: null,
          category: 'tool_missing'
        })
      )
    })

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      if (timedOut) {
        settle(finish({ ok: false, stdout, stderr, exitCode, category: 'timeout' }))
        return
      }
      if (exitCode === 0) {
        settle(finish({ ok: true, stdout, stderr, exitCode }))
        return
      }
      settle(
        finish({
          ok: false,
          stdout,
          stderr,
          exitCode,
          category: classifyAdbFailure(`${stdout}\n${stderr}`)
        })
      )
    })
  })
}
