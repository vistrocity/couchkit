import type { SupportedOs } from './install'

/** Where Google lists every Android SDK download together with its checksum. */
export const SDK_MANIFEST_URL = 'https://dl.google.com/android/repository/repository2-3.xml'

export interface ArchiveInfo {
  /** Address of the zip, relative to the manifest's folder (or absolute). */
  url: string
  /** Lower-case hex digest and which kind it is. */
  hash: { type: 'sha1' | 'sha256'; value: string }
  size: number | null
}

const HOST_OS: Record<SupportedOs, string> = { win32: 'windows', darwin: 'macosx', linux: 'linux' }

/**
 * Finds the stable platform-tools zip for this computer's system in Google's SDK list.
 * Returns null when the list does not have what we need, so the caller can say the
 * download could not be checked.
 */
export function parsePlatformToolsArchive(xml: string, os: SupportedOs): ArchiveInfo | null {
  const packages = xml.match(/<remotePackage\b[^>]*\bpath="platform-tools"[^>]*>[\s\S]*?<\/remotePackage>/g) ?? []
  // Prefer the stable channel when the list marks one.
  const stable = packages.filter((p) => /<channelRef\b[^>]*ref="channel-0"/.test(p))
  for (const pkg of stable.length > 0 ? stable : packages) {
    for (const archive of pkg.match(/<archive>[\s\S]*?<\/archive>/g) ?? []) {
      const host = /<host-os>\s*([^<\s]+)\s*<\/host-os>/.exec(archive)?.[1]
      if (host !== HOST_OS[os]) continue
      const url = /<url>\s*([^<\s]+)\s*<\/url>/.exec(archive)?.[1]
      const checksum = /<checksum\b[^>]*type="(sha1|sha256)"[^>]*>\s*([0-9a-fA-F]+)\s*<\/checksum>/.exec(archive)
      if (url === undefined || checksum === null) continue
      const type = checksum[1] === 'sha256' ? 'sha256' : 'sha1'
      const value = (checksum[2] ?? '').toLowerCase()
      if (value.length !== (type === 'sha256' ? 64 : 40)) continue
      const size = Number(/<size>\s*(\d+)\s*<\/size>/.exec(archive)?.[1])
      return { url, hash: { type, value }, size: Number.isFinite(size) && size > 0 ? size : null }
    }
  }
  return null
}

/** A zip name from the list must be a plain file name, never a path or another site. */
export function isPlainZipName(url: string): boolean {
  return /^[A-Za-z0-9._-]+\.zip$/.test(url)
}
