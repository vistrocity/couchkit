import { useState, type JSX } from 'react'
import type { DeviceInfo, RestartMode } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
  /** Called when the TV has been told to restart, because the connection ends. */
  onRestarted: () => void
}

interface Option {
  mode: RestartMode
  title: string
  help: string
  warning: string
  button: string
}

const OPTIONS: readonly Option[] = [
  {
    mode: 'system',
    title: 'Restart the TV',
    help: 'A normal restart. This often fixes a slow or frozen TV.',
    warning: 'The TV will restart and Couchkit will disconnect. Reconnect from the Connect page when the TV is back (about a minute).',
    button: 'Restart'
  },
  {
    mode: 'recovery',
    title: 'Restart into recovery',
    help: 'Opens the TV\'s recovery menu, used for factory resets and system updates from a file.',
    warning:
      'The TV will show a recovery menu that you control with the TV remote or its buttons. Couchkit cannot control it. Do not pick "wipe data" or "factory reset" unless you really want to erase the TV. If the TV just restarts normally, that is fine.',
    button: 'Restart into recovery'
  },
  {
    mode: 'bootloader',
    title: 'Restart into bootloader',
    help: 'For advanced users who flash their TV. Most people never need this.',
    warning:
      'Many TVs show a blank screen in this mode and may need the power plug pulled to get back to normal. Only continue if you know why you need it.',
    button: 'Restart into bootloader'
  }
]

export function Restart({ connected, onGoToConnect, onRestarted }: Props): JSX.Element {
  const [confirm, setConfirm] = useState<RestartMode | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string; fix: string } | null>(null)

  if (connected === null && message === null) {
    return (
      <>
        <h2>Restart</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const run = async (mode: RestartMode): Promise<void> => {
    setBusy(true)
    const r = await window.couchkit.restartTv(mode)
    setBusy(false)
    setConfirm(null)
    if (r.ok) {
      setMessage({ ok: true, text: 'The TV is restarting. Couchkit has disconnected; reconnect from the Connect page when the TV is back.', fix: '' })
      onRestarted()
    } else {
      setMessage({ ok: false, text: r.message, fix: r.fix })
    }
  }

  return (
    <>
      <h2>Restart</h2>
      <p className="muted">Restart the TV from your computer.</p>
      {message !== null && (
        <div className={`card ${message.ok ? '' : 'error'}`} role="status">
          <p>{message.text}</p>
          {message.fix !== '' && <p>{message.fix}</p>}
          {message.ok && (
            <button type="button" className="primary" onClick={onGoToConnect}>
              Go to Connect
            </button>
          )}
        </div>
      )}
      {connected !== null &&
        OPTIONS.map((o) => (
          <div className="card tweak" key={o.mode}>
            <p>
              <strong>{o.title}</strong>
            </p>
            <p className="muted">{o.help}</p>
            {confirm === o.mode ? (
              <>
                <p className={o.mode === 'system' ? '' : 'warn'}>{o.warning}</p>
                <div className="row">
                  <span>Are you sure?</span>
                  <button type="button" className={o.mode === 'system' ? 'primary' : 'danger'} disabled={busy} onClick={() => void run(o.mode)}>
                    Yes
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirm(null)}>
                    No
                  </button>
                </div>
              </>
            ) : (
              <div className="row">
                <button type="button" disabled={busy} onClick={() => setConfirm(o.mode)}>
                  {o.button}
                </button>
              </div>
            )}
          </div>
        ))}
    </>
  )
}
