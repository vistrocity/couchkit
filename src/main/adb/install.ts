import AdmZip from 'adm-zip'
import { createWriteStream } from 'node:fs'
import { chmod, mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { DownloadProgress } from '@shared/types'

/**
 * Downloads Google's Android SDK Platform-Tools (which contains adb) from Google's
 * own server into Couchkit's tools folder. Nothing is installed system-wide.
 *
 * Note: Google does not publish a checksum for the "latest" links, so the file cannot be
 * checksum-verified. We rely on HTTPS to Google's server, check that the zip is valid and
 * safe to unpack, and the app then runs `adb version` to confirm the result works.
 */

export type SupportedOs = 'darwin' | 'win32' | 'linux'

export function platformToolsUrl(os: SupportedOs): string {
  const name = os === 'win32' ? 'windows' : os === 'darwin' ? 'darwin' : 'linux'
  return `https://dl.google.com/android/repository/platform-tools-latest-${name}.zip`
}

export type InstallOutcome = { ok: true; adbPath: string } | { ok: false; message: string }

export interface InstallOptions {
  url: string
  /** Couchkit's tools folder. The result ends up in <toolsDir>/platform-tools. */
  toolsDir: string
  /** "adb" or "adb.exe". */
  binaryName: string
  onProgress?: (progress: DownloadProgress) => void
  /** Allow a plain http:// address. Only the tests use this. */
  allowInsecureUrl?: boolean
  fetchImpl?: typeof fetch
}

/** True if every entry of the zip stays inside the target folder. */
export function zipEntriesAreSafe(zip: AdmZip, targetDir: string): boolean {
  const root = resolve(targetDir) + sep
  return zip.getEntries().every((entry) => {
    const destination = resolve(targetDir, entry.entryName)
    return destination.startsWith(root)
  })
}

export async function installPlatformTools(options: InstallOptions): Promise<InstallOutcome> {
  const { url, toolsDir, binaryName, onProgress } = options
  const doFetch = options.fetchImpl ?? fetch

  if (!url.startsWith('https://') && !options.allowInsecureUrl) {
    return { ok: false, message: 'Refusing to download over an insecure connection.' }
  }

  const zipPath = join(toolsDir, 'platform-tools.zip.part')
  const stagingDir = join(toolsDir, 'staging')
  const finalDir = join(toolsDir, 'platform-tools')

  try {
    await mkdir(toolsDir, { recursive: true })
    await rm(stagingDir, { recursive: true, force: true })

    // 1. Download
    const response = await doFetch(url)
    if (!response.ok || response.body === null) {
      return { ok: false, message: `The download failed (server answered ${response.status}).` }
    }
    const lengthHeader = response.headers.get('content-length')
    const totalBytes = lengthHeader !== null && Number(lengthHeader) > 0 ? Number(lengthHeader) : null
    let receivedBytes = 0
    onProgress?.({ phase: 'downloading', receivedBytes, totalBytes })

    const source = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>)
    source.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length
      onProgress?.({ phase: 'downloading', receivedBytes, totalBytes })
    })
    await pipeline(source, createWriteStream(zipPath))

    // 2. Check and unpack into a staging folder
    onProgress?.({ phase: 'extracting', receivedBytes, totalBytes })
    let zip: AdmZip
    try {
      zip = new AdmZip(zipPath)
    } catch {
      return { ok: false, message: 'The downloaded file is not a valid zip. Please try again.' }
    }
    if (!zipEntriesAreSafe(zip, stagingDir)) {
      return { ok: false, message: 'The downloaded file contains unsafe paths and was not opened.' }
    }
    zip.extractAllTo(stagingDir, true)

    const stagedAdb = join(stagingDir, 'platform-tools', binaryName)
    if (!(await exists(stagedAdb))) {
      return { ok: false, message: 'The download did not contain adb. Please try again.' }
    }

    // 3. Make the programs runnable (not needed on Windows)
    if (process.platform !== 'win32') {
      for (const tool of ['adb', 'fastboot']) {
        const toolPath = join(stagingDir, 'platform-tools', tool)
        if (await exists(toolPath)) await chmod(toolPath, 0o755)
      }
    }

    // 4. Swap into place
    await rm(finalDir, { recursive: true, force: true })
    await mkdir(dirname(finalDir), { recursive: true })
    await rename(join(stagingDir, 'platform-tools'), finalDir)

    onProgress?.({ phase: 'done', receivedBytes, totalBytes })
    return { ok: true, adbPath: join(finalDir, binaryName) }
  } catch (error) {
    return {
      ok: false,
      message: `Could not download adb: ${error instanceof Error ? error.message : String(error)}`
    }
  } finally {
    await rm(zipPath, { force: true }).catch(() => undefined)
    await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
