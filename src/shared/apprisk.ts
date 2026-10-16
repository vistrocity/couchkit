import { isProtectedPackage } from './cleanup'

export type RiskyAction = 'disable' | 'uninstall' | 'clear'

export const RISK_VERBS: Record<RiskyAction, string> = {
  disable: 'turn off (freeze)',
  uninstall: 'remove',
  clear: 'erase the data of'
}

/** What can go wrong, in plain words, for each action on a system app. */
export const RISK_CONSEQUENCES: Record<RiskyAction, string> = {
  disable: 'The TV, other apps or the home screen may stop working or show a black screen. It can be turned back on here with Enable, unless the TV can no longer show this page.',
  uninstall: 'The app is removed for your user. Parts of the TV (home screen, settings, remote, Wi-Fi, updates) may stop working. Getting it back usually needs a factory reset.',
  clear: 'All of the app\'s saved settings and data are erased and cannot be brought back. The TV may forget its setup, accounts or channels.'
}

/**
 * Why Couchkit refuses to disable, remove or wipe this app at all, or null if it may be changed
 * after the warning. `activeHome` is the package that currently answers the Home button, if known.
 */
export function blockedReason(packageName: string, activeHome: string | null): string | null {
  if (isProtectedPackage(packageName)) return 'Couchkit protects this core system app: changing it could stop the TV from working.'
  if (activeHome !== null && packageName === activeHome) return 'This app is your TV\'s home screen right now. Switch to another launcher on the Launcher page first.'
  return null
}
