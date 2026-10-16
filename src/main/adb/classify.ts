import type { ErrorCategory } from '@shared/types'

/**
 * Turns raw adb output into a category the UI can explain.
 * Order matters: more specific patterns are checked first.
 */
export function classifyAdbFailure(output: string): ErrorCategory {
  const text = output.toLowerCase()

  if (text.includes('unauthorized')) return 'unauthorized'
  if (text.includes('insufficient_storage') || text.includes('no space left')) return 'no_space'
  if (
    text.includes('install_failed') ||
    text.includes('install_parse_failed') ||
    text.includes('failed to parse') ||
    text.includes('not an apk')
  ) {
    return 'bad_apk'
  }
  if (
    text.includes('cannot connect') ||
    text.includes('failed to connect') ||
    text.includes('connection refused') ||
    text.includes('connection timed out') ||
    text.includes('no route to host') ||
    text.includes('network is unreachable') ||
    text.includes('unable to connect')
  ) {
    return 'unreachable'
  }
  if (
    text.includes('device offline') ||
    text.includes('no devices/emulators found') ||
    text.includes('device not found') ||
    text.includes('closed')
  ) {
    return 'offline'
  }
  return 'other'
}
