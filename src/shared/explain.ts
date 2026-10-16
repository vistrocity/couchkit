import type { ErrorCategory } from './types'

/**
 * Plain-language message and suggested fix for each kind of failure.
 * Used by the main process (to fill in connect results) and by the tests.
 */
export function explainFailure(category: ErrorCategory): { message: string; fix: string } {
  switch (category) {
    case 'unreachable':
      return {
        message: 'Could not reach the TV at that address.',
        fix:
          'Check that the TV is on and on the same Wi-Fi as this computer, that the address is right ' +
          '(Settings > Network on the TV), and that USB debugging or Wireless debugging is turned on.'
      }
    case 'unauthorized':
      return {
        message: 'The TV has not allowed this computer yet.',
        fix:
          'Look at the TV screen and choose Allow on the "Allow USB debugging?" prompt ' +
          '(tick "Always allow from this computer"), then press Connect again.'
      }
    case 'offline':
      return {
        message: 'The TV is listed but is not responding.',
        fix: 'Restart the TV, or turn USB debugging off and on again in Developer options, then try again.'
      }
    case 'timeout':
      return {
        message: 'The TV took too long to answer.',
        fix: 'Make sure the TV is awake and on the same network, then try again.'
      }
    case 'tool_missing':
      return {
        message: 'The adb tool is missing or could not start.',
        fix: 'Use the "Download adb" button on the Home page, then try again.'
      }
    case 'no_space':
      return {
        message: 'The TV does not have enough free storage.',
        fix: 'Free up space on the TV (uninstall apps you do not use) and try again.'
      }
    case 'bad_apk':
      return {
        message: 'The TV rejected that app file.',
        fix: 'Check that it is an APK made for Android TV and for this TV\'s Android version.'
      }
    default:
      return {
        message: 'Something went wrong.',
        fix: 'Open the Activity page to see exactly what happened.'
      }
  }
}
