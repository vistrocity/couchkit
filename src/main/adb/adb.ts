import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import type { AdbStatus } from '@shared/types'
import { runCommand, type LogSink } from './runner'

/**
 * Finds and checks adb. Later slices add connect, device info, and the
 * download of Google's platform-tools; this slice only answers
 * "is adb available, and which version?".
 */

/** Looks for the adb program in the app's own tools folder first, then the PATH. */
export function findAdb(options: {
  toolsDir: string
  binaryName: string
  pathEnv?: string
  exists?: (path: string) => boolean
}): string | null {
  const exists = options.exists ?? existsSync
  const candidates = [
    join(options.toolsDir, 'platform-tools', options.binaryName),
    ...(options.pathEnv ?? '')
      .split(delimiter)
      .filter((dir) => dir.length > 0)
      .map((dir) => join(dir, options.binaryName))
  ]
  return candidates.find((candidate) => exists(candidate)) ?? null
}

/** Pulls "1.0.41" and similar out of `adb version` output. */
export function parseAdbVersion(output: string): string | undefined {
  return /Android Debug Bridge version\s+([\d.]+)/i.exec(output)?.[1]
}

export async function checkAdb(
  adbPath: string | null,
  log?: LogSink
): Promise<AdbStatus> {
  if (adbPath === null) {
    return {
      found: false,
      message: 'adb was not found. Couchkit can download it for you (coming in the next update).'
    }
  }
  const result = await runCommand(adbPath, ['version'], { timeoutMs: 5000 }, log)
  if (!result.ok) {
    return {
      found: false,
      path: adbPath,
      message: `adb was found but could not run: ${result.stderr.trim() || 'unknown error'}`
    }
  }
  const version = parseAdbVersion(result.stdout)
  return {
    found: true,
    path: adbPath,
    ...(version !== undefined ? { version } : {}),
    message: version !== undefined ? `adb ${version} is ready.` : 'adb is ready.'
  }
}
