import type { ErrorCategory } from '@shared/types'

export interface InstallFailure {
  category: ErrorCategory
  message: string
  fix: string
}

/** Turns adb's install error code into plain words and a next step. */
export function explainInstallFailure(output: string): InstallFailure {
  const code = /INSTALL_[A-Z_]+/.exec(output)?.[0] ?? ''
  switch (code) {
    case 'INSTALL_FAILED_VERSION_DOWNGRADE':
      return {
        category: 'bad_apk',
        message: 'A newer version of this app is already on the TV.',
        fix: 'Uninstall the app from the TV first if you really want the older version.'
      }
    case 'INSTALL_FAILED_UPDATE_INCOMPATIBLE':
    case 'INSTALL_FAILED_SHARED_USER_INCOMPATIBLE':
      return {
        category: 'bad_apk',
        message: 'The app on the TV was signed by someone else, so it cannot be updated.',
        fix: 'Uninstall the existing app first. Its saved data will be lost.'
      }
    case 'INSTALL_FAILED_INSUFFICIENT_STORAGE':
      return {
        category: 'no_space',
        message: 'The TV does not have enough free storage.',
        fix: 'Free up space on the TV (uninstall apps you do not use) and try again.'
      }
    case 'INSTALL_FAILED_OLDER_SDK':
      return {
        category: 'bad_apk',
        message: 'This app needs a newer version of Android than your TV has.',
        fix: 'Look for an older release of the app that supports your TV.'
      }
    case 'INSTALL_FAILED_NO_MATCHING_ABIS':
      return {
        category: 'bad_apk',
        message: 'This app was built for a different type of processor than your TV has.',
        fix: 'Download the version of the app made for your TV (often "arm" or "armeabi-v7a").'
      }
    case 'INSTALL_PARSE_FAILED_NOT_APK':
    case 'INSTALL_PARSE_FAILED_NO_CERTIFICATES':
    case 'INSTALL_PARSE_FAILED_MANIFEST_MALFORMED':
    case 'INSTALL_PARSE_FAILED_UNEXPECTED_EXCEPTION':
      return {
        category: 'bad_apk',
        message: 'That file is not a valid app.',
        fix: 'Download it again, and check that it is a .apk file (not a .zip, .apks, or .xapk).'
      }
    case 'INSTALL_FAILED_ALREADY_EXISTS':
      return {
        category: 'bad_apk',
        message: 'This app is already installed.',
        fix: 'Nothing to do, or uninstall it first to reinstall.'
      }
    default:
      return {
        category: 'bad_apk',
        message: code === '' ? 'The TV could not install that file.' : `The TV refused the app (${code}).`,
        fix: 'Open the Activity page to see the full message from the TV.'
      }
  }
}
