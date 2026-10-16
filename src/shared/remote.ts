// Pure helpers shared by the main process, the UI, and the tests.

/** The buttons of the on-screen remote. Only these names are ever accepted from the UI. */
export const REMOTE_KEY_IDS = [
  'up',
  'down',
  'left',
  'right',
  'ok',
  'enter',
  'back',
  'home',
  'menu',
  'playPause',
  'volumeUp',
  'volumeDown',
  'mute',
  'power'
] as const

export type RemoteKey = (typeof REMOTE_KEY_IDS)[number]

export function isRemoteKey(value: unknown): value is RemoteKey {
  return typeof value === 'string' && (REMOTE_KEY_IDS as readonly string[]).includes(value)
}

/** Longest text we send to the TV in one go. */
export const MAX_TYPED_TEXT = 300

/** Android package names look like "com.example.app". */
const PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/

export function isValidPackageName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 255 && PACKAGE_NAME.test(value)
}
