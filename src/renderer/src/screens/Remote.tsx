import { useCallback, useEffect, useState, type FormEvent, type JSX } from 'react'
import type { ActionResult, DeviceInfo } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

type Failure = Extract<ActionResult, { ok: false }>

interface Button {
  key: string
  label: string
  title: string
}

const DPAD: Button[][] = [
  [{ key: 'up', label: '▲', title: 'Up' }],
  [
    { key: 'left', label: '◀', title: 'Left' },
    { key: 'ok', label: 'OK', title: 'OK / Select' },
    { key: 'right', label: '▶', title: 'Right' }
  ],
  [{ key: 'down', label: '▼', title: 'Down' }]
]

const NAV_BUTTONS: Button[] = [
  { key: 'back', label: 'Back', title: 'Back' },
  { key: 'home', label: 'Home', title: 'Home' },
  { key: 'menu', label: 'Menu', title: 'Menu' }
]

const MEDIA_BUTTONS: Button[] = [
  { key: 'playPause', label: '⏯', title: 'Play / Pause' },
  { key: 'volumeDown', label: 'Vol −', title: 'Volume down' },
  { key: 'volumeUp', label: 'Vol +', title: 'Volume up' },
  { key: 'mute', label: 'Mute', title: 'Mute' }
]

/** Keyboard keys that act like the remote while the Remote page is open and no text box is focused. */
const KEYBOARD: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'ok',
  Escape: 'back',
  Backspace: 'back',
  h: 'home',
  m: 'menu',
  ' ': 'playPause'
}

export function Remote({ connected, onGoToConnect }: Props): JSX.Element {
  const [failure, setFailure] = useState<Failure | null>(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const [confirmPower, setConfirmPower] = useState(false)

  const press = useCallback(async (key: string): Promise<void> => {
    const result = await window.couchkit.sendKey(key)
    setFailure(result.ok ? null : result)
  }, [])

  useEffect(() => {
    if (connected === null) return
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const typing = target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return
      // Space and Enter on a focused button already click it; do not press twice.
      if (target !== null && target.tagName === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')) return
      const key = KEYBOARD[event.key]
      if (key !== undefined) {
        event.preventDefault()
        void press(key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [connected, press])

  if (connected === null) {
    return (
      <>
        <h2>Remote</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const sendText = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const result = await window.couchkit.sendText(text)
    setFailure(result.ok ? null : result)
    if (result.ok) {
      setText('')
      setSent(true)
      setTimeout(() => setSent(false), 1500)
    }
  }

  const renderButton = (b: Button): JSX.Element => (
    <button key={b.key} type="button" className={b.key === 'ok' ? 'primary remote-btn' : 'remote-btn'} title={b.title} aria-label={b.title} onClick={() => void press(b.key)}>
      {b.label}
    </button>
  )

  return (
    <>
      <h2>Remote</h2>
      <p className="muted">
        Click the buttons, or use the keyboard: arrow keys, <kbd>Enter</kbd> = OK, <kbd>Esc</kbd> = Back, <kbd>H</kbd> = Home,{' '}
        <kbd>M</kbd> = Menu, <kbd>Space</kbd> = Play/Pause.
      </p>

      {failure !== null && (
        <div className="card error" role="alert">
          <p>
            <strong>{failure.message}</strong>
          </p>
          {failure.fix !== '' && <p>{failure.fix}</p>}
          {failure.detail !== '' && (
            <details>
              <summary>Technical details</summary>
              <pre>{failure.detail}</pre>
            </details>
          )}
        </div>
      )}

      <div className="remote">
        <div className="dpad">
          {DPAD.map((row, i) => (
            <div key={i} className="dpad-row">
              {row.map(renderButton)}
            </div>
          ))}
        </div>
        <div className="row">{NAV_BUTTONS.map(renderButton)}</div>
        <div className="row">{MEDIA_BUTTONS.map(renderButton)}</div>
        <div className="row">
          {confirmPower ? (
            <>
              <span>Turn the TV on or off?</span>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setConfirmPower(false)
                  void press('power')
                }}
              >
                Yes, send Power
              </button>
              <button type="button" onClick={() => setConfirmPower(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="remote-btn" onClick={() => setConfirmPower(true)}>
              Power
            </button>
          )}
        </div>
      </div>

      <form className="card text-form" onSubmit={(e) => void sendText(e)}>
        <h3>Type on the TV</h3>
        <p className="muted small">
          First select a text box on the TV (a search field, for example), then type here. Letters, numbers and common
          symbols only.
        </p>
        <div className="row">
          <label className="sr-only" htmlFor="tv-text">
            Text to type on the TV
          </label>
          <input id="tv-text" type="text" className="grow" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="primary" disabled={text === ''}>
            Send
          </button>
          {sent && <span className="ok">Sent ✓</span>}
        </div>
      </form>
    </>
  )
}
