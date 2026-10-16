import type { AppPackage } from '@shared/types'

/**
 * Pure parsers for package information. Kept separate so they can be tested with
 * real-looking samples and no TV.
 */

export interface ListedPackage {
  packageName: string
  versionCode?: string
  installer?: string
}

/**
 * Reads `pm list packages` output. Depending on the flags used, lines look like
 *   package:com.example.app
 *   package:com.example.app  installer=com.android.vending  versionCode:123
 */
export function parsePackageList(stdout: string): ListedPackage[] {
  const result: ListedPackage[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const name = /^package:(\S+)/.exec(line.trim())?.[1]
    if (name === undefined) continue
    const installer = /installer=(\S+)/.exec(line)?.[1]
    const versionCode = /versionCode:(\d+)/.exec(line)?.[1]
    result.push({
      packageName: name,
      ...(installer !== undefined ? { installer } : {}),
      ...(versionCode !== undefined ? { versionCode } : {})
    })
  }
  return result
}

/** Just the package names, as a set. */
export function packageNameSet(stdout: string): Set<string> {
  return new Set(parsePackageList(stdout).map((p) => p.packageName))
}

/** The command that reads version names in one go (it runs on the TV, through its shell). */
export const VERSION_NAMES_COMMAND = "dumpsys package packages | grep -E 'Package \\[|versionName='"

/**
 * Reads the filtered `dumpsys package` output:
 *   Package [com.example.app] (abc123):
 *     versionName=1.2.3
 * The first version name seen for a package wins.
 */
export function parseVersionNames(stdout: string): Record<string, string> {
  const names: Record<string, string> = {}
  let current: string | null = null
  for (const line of stdout.split(/\r?\n/)) {
    const pkg = /Package \[([^\]]+)\]/.exec(line)?.[1]
    if (pkg !== undefined) {
      current = pkg
      continue
    }
    const version = /versionName=(\S.*)$/.exec(line.trim())?.[1]
    if (version !== undefined && current !== null && names[current] === undefined) {
      names[current] = version.trim()
    }
  }
  return names
}

const STORES: Record<string, string> = {
  'com.android.vending': 'Play Store',
  'com.amazon.venezia': 'Amazon Appstore',
  'com.sec.android.app.samsungapps': 'Galaxy Store',
  'dev.sanmer.aurora': 'Aurora Store',
  'com.aurora.store': 'Aurora Store'
}

const SIDELOAD_INSTALLERS = new Set([
  'null',
  'com.android.shell',
  'com.android.packageinstaller',
  'com.google.android.packageinstaller'
])

/** A friendly name for who installed an app. */
export function describeInstaller(installer: string | undefined): string {
  if (installer === undefined) return 'Unknown'
  const store = STORES[installer]
  if (store !== undefined) return store
  if (SIDELOAD_INSTALLERS.has(installer)) return 'Sideloaded or preinstalled'
  return installer
}

/** Puts the pieces together into the list the UI shows, sorted by package name. */
export function buildApps(input: {
  all: ListedPackage[]
  userPackages: Set<string>
  disabledPackages: Set<string>
  versionNames: Record<string, string>
}): AppPackage[] {
  return input.all
    .map((p): AppPackage => {
      const versionName = input.versionNames[p.packageName]
      return {
        packageName: p.packageName,
        installedFrom: describeInstaller(p.installer),
        system: !input.userPackages.has(p.packageName),
        enabled: !input.disabledPackages.has(p.packageName),
        ...(versionName !== undefined ? { versionName } : {}),
        ...(p.versionCode !== undefined ? { versionCode: p.versionCode } : {})
      }
    })
    .sort((a, b) => a.packageName.localeCompare(b.packageName))
}
