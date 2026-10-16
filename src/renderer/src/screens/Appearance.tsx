import type { JSX } from 'react'
import { ACCENTS, THEMES, type ThemeId } from '@shared/appearance'

interface Props {
  theme: ThemeId
  accent: string
  onChange: (theme: ThemeId, accent: string) => void
}

const THEME_LABELS: Record<ThemeId, string> = { system: 'Match my computer', light: 'Light', dark: 'Dark' }

export function Appearance({ theme, accent, onChange }: Props): JSX.Element {
  return (
    <>
      <h2>Appearance</h2>
      <p className="muted">Pick how Couchkit looks. Your choice is remembered.</p>

      <div className="card wide">
        <h3>Theme</h3>
        <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {THEMES.map((t) => (
            <button type="button" key={t} className={t === theme ? 'primary' : undefined} aria-pressed={t === theme} onClick={() => onChange(t, accent)}>
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="card wide">
        <h3>Accent colour</h3>
        <div className="swatches">
          {ACCENTS.map((a) => (
            <button
              type="button"
              key={a.id}
              className="swatch"
              style={{ background: a.swatch }}
              aria-label={a.name}
              title={a.name}
              aria-pressed={a.id === accent}
              onClick={() => onChange(theme, a.id)}
            />
          ))}
        </div>
      </div>
    </>
  )
}
