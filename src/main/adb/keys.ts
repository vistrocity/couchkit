import type { RemoteKey } from '@shared/remote'

/** adb's names for the remote's buttons. */
export const KEYCODES: Record<RemoteKey, string> = {
  up: 'KEYCODE_DPAD_UP',
  down: 'KEYCODE_DPAD_DOWN',
  left: 'KEYCODE_DPAD_LEFT',
  right: 'KEYCODE_DPAD_RIGHT',
  ok: 'KEYCODE_DPAD_CENTER',
  back: 'KEYCODE_BACK',
  home: 'KEYCODE_HOME',
  menu: 'KEYCODE_MENU',
  playPause: 'KEYCODE_MEDIA_PLAY_PAUSE',
  volumeUp: 'KEYCODE_VOLUME_UP',
  volumeDown: 'KEYCODE_VOLUME_DOWN',
  mute: 'KEYCODE_VOLUME_MUTE',
  power: 'KEYCODE_POWER'
}
