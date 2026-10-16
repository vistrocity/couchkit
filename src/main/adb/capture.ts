/** "20261016-143005" in the computer's local time. */
export function timeStamp(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

export function captureFileName(kind: 'screenshot' | 'recording', date: Date): string {
  return `Couchkit-${kind}-${timeStamp(date)}.${kind === 'screenshot' ? 'png' : 'mp4'}`
}

export function isRecordingPreset(value: unknown): value is 'small' | 'full' {
  return value === 'small' || value === 'full'
}
