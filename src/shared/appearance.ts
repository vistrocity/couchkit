/** Colour choices for the app. Only these exact ids are ever stored or applied. */
export const THEMES = ['system', 'light', 'dark'] as const
export type ThemeId = (typeof THEMES)[number]

export interface AccentOption {
  id: string
  name: string
  /** Swatch colour shown on the picker (the real colours live in the stylesheet). */
  swatch: string
}

export const ACCENTS: readonly AccentOption[] = [
  { id: 'blue', name: 'Blue', swatch: '#2563eb' },
  { id: 'teal', name: 'Teal', swatch: '#0f766e' },
  { id: 'green', name: 'Green', swatch: '#15803d' },
  { id: 'purple', name: 'Purple', swatch: '#7c3aed' },
  { id: 'orange', name: 'Orange', swatch: '#c2410c' },
  { id: 'rose', name: 'Rose', swatch: '#be123c' }
]

export type AccentId = string

export const DEFAULT_THEME: ThemeId = 'system'
export const DEFAULT_ACCENT: AccentId = 'blue'

export function isTheme(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v)
}

export function isAccent(v: unknown): v is AccentId {
  return typeof v === 'string' && ACCENTS.some((a) => a.id === v)
}
