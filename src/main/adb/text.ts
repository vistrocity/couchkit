import { MAX_TYPED_TEXT } from '@shared/remote'

export type TextArg = { ok: true; arg: string } | { ok: false; message: string }

/**
 * Prepares text for `adb shell input text`.
 *
 * adb joins its arguments and hands them to a shell on the TV, which would treat characters
 * like ; & | $ ( ) as commands. So the whole text is wrapped in single quotes (with any single
 * quote inside escaped), which makes the TV's shell treat every character as plain text.
 * Android's `input text` itself uses %s for a space.
 *
 * Android's `input text` cannot type accented letters, other alphabets, or emoji.
 */
export function buildTextArg(text: string): TextArg {
  if (text === '') return { ok: false, message: 'There is nothing to send.' }
  if (text.length > MAX_TYPED_TEXT) {
    return { ok: false, message: `That is too long. Send at most ${MAX_TYPED_TEXT} characters at a time.` }
  }
  // Printable ASCII only (space to tilde).
  if (!/^[\x20-\x7e]+$/.test(text)) {
    return {
      ok: false,
      message: 'Only plain letters, numbers, and common symbols can be typed on the TV. Accents and emoji are not supported.'
    }
  }
  if (text.includes('%')) {
    return { ok: false, message: 'The % sign cannot be typed on the TV. Please leave it out.' }
  }
  const escaped = text.replace(/'/g, `'\\''`).replace(/ /g, '%s')
  return { ok: true, arg: `'${escaped}'` }
}
