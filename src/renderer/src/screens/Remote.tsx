import { useCallback, useEffect, useState, type FormEvent, type JSX } from 'react'
import type { ActionResult, DeviceInfo } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

type Failure = Extract<ActionResult, { ok: false }>

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
  const [pressEnter, setPressEnter] = useState(true)

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
    if (result.ok && pressEnter) {
      // Many TV apps (a search box, for example) only act once Enter is pressed.
      const enter = await window.couchkit.sendKey('enter')
      if (!enter.ok) setFailure(enter)
    }
    if (result.ok) {
      setText('')
      setSent(true)
      setTimeout(() => setSent(false), 1500)
    }
  }

  const btn = (key: string, label: string, title: string, extra = ''): JSX.Element => (
    <button
      key={key}
      type="button"
      className={`rbtn ${extra}`.trim()}
      title={title}
      aria-label={title}
      onClick={() => void press(key)}
    >
      {label}
    </button>
  )

  return (
    <>
      <h2>Remote</h2>
      <p className="muted">
        Click the buttons, or use the keyboard: arrow keys, <kbd>Enter</kbd> = OK, <kbd>Esc</kbd> = Back, <kbd>H</kbd> =
        Home, <kbd>M</kbd> = Menu, <kbd>Space</kbd> = Play/Pause.
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

      <div className="remote-layout">
        <section className="remote-body" aria-label="Remote control">
          <div className="power-row">
            {confirmPower ? (
              <div className="confirm-power">
                <span className="small">Toggle power?</span>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setConfirmPower(false)
                    void press('power')
                  }}
                >
                  Yes
                </button>
                <button type="button" onClick={() => setConfirmPower(false)}>
                  No
                </button>
              </div>
            ) : (
              <button type="button" className="rbtn power" title="Power" aria-label="Power" onClick={() => setConfirmPower(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 3v9" />
                  <path d="M6.3 6.8a8 8 0 1 0 11.4 0" />
                </svg>
              </button>
            )}
          </div>

          <div className="dpad-ring">
            {btn('up', '▲', 'Up', 'dp dp-up')}
            {btn('left', '◀', 'Left', 'dp dp-left')}
            {btn('right', '▶', 'Right', 'dp dp-right')}
            {btn('down', '▼', 'Down', 'dp dp-down')}
            <button type="button" className="dp-ok" title="OK / Select" aria-label="OK / Select" onClick={() => void press('ok')}>
              OK
            </button>
          </div>

          <div className="nav-row">
            {btn('back', '↩', 'Back', 'pill')}
            {btn('home', '⌂', 'Home', 'pill')}
            {btn('menu', '☰', 'Menu', 'pill')}
          </div>

          <div className="media-row">
            <div className="vol" role="group" aria-label="Volume">
              {btn('volumeUp', '+', 'Volume up', 'vol-btn')}
              <span className="vol-label">VOL</span>
              {btn('volumeDown', '−', 'Volume down', 'vol-btn')}
            </div>
            <div className="media-col">
              {btn('playPause', '⏯', 'Play / Pause', 'pill')}
              {btn('mute', '🔇', 'Mute', 'pill')}
            </div>
          </div>
        </section>

        <form className="card text-form" onSubmit={(e) => void sendText(e)}>
          <h3>Type on the TV</h3>
          <p className="muted small">
            First select a text box on the TV (a search field, for example), then type here and press Send. Letters, numbers and common
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
            <button type="button" title="Press Enter on the TV (submit a search)" onClick={() => void press('enter')}>
              Enter ↵
            </button>
            {sent && <span className="ok">Sent ✓</span>}
          </div>
          <label className="check small">
            <input type="checkbox" checked={pressEnter} onChange={(e) => setPressEnter(e.target.checked)} /> Press Enter on the TV
            after sending (starts the search)
          </label>
        </form>
      </div>
    </>
  )
}
