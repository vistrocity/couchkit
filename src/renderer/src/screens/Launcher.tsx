import { useCallback, useEffect, useState, type JSX } from 'react'
import { STOCK_LAUNCHER_PACKAGES, type LauncherStatus } from '@shared/launcher'
import type { ActionResult, DeviceInfo } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

export function Launcher({ connected, onGoToConnect }: Props): JSX.Element {
  const [status, setStatus] = useState<LauncherStatus | null>(null)
  const [error, setError] = useState<{ message: string; fix: string; detail: string } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOff, setConfirmOff] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const r = await window.couchkit.launcherStatus()
    if (r.ok) {
      setStatus(r.status)
      setError(null)
    } else {
      setError({ message: r.message, fix: r.fix, detail: r.detail })
    }
  }, [])

  useEffect(() => {
    if (connected !== null) void refresh()
  }, [connected, refresh])

  if (connected === null) {
    return (
      <>
        <h2>Launcher</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const run = async (action: () => Promise<ActionResult>): Promise<void> => {
    setBusy(true)
    setNote('')
    const r = await action()
    if (r.ok) {
      setError(null)
      setNote(r.detail)
    } else {
      setError({ message: r.message, fix: r.fix, detail: r.detail })
    }
    setConfirmOff(null)
    await refresh()
    setBusy(false)
  }

  const inCharge = status?.launchers.find((l) => l.isActive) ?? status?.launchers.find((l) => l.isDefault)
  const stockInCharge = inCharge?.system ?? true
  const disagree =
    status !== null &&
    status.activeHomePackage !== null &&
    status.defaultComponent !== null &&
    status.defaultComponent.split('/')[0] !== status.activeHomePackage
  const stockOn = status?.launchers.filter((l) => STOCK_LAUNCHER_PACKAGES.includes(l.packageName)) ?? []
  const otherAvailable = status?.launchers.some((l) => !l.system) ?? false

  return (
    <>
      <h2>Launcher</h2>
      <p className="muted">
        Helps a home-screen app (launcher) you installed stay in charge. Press Home on the TV remote to test. If your launcher keeps falling back to the stock one, the usual causes are: the TV runs low on memory and closes it, the TV maker's launcher takes over the Home button, or Android's battery saving stops it.
      </p>

      {error !== null && (
        <div className="card error" role="alert">
          <p>
            <strong>{error.message}</strong>
          </p>
          {error.fix !== '' && <p>{error.fix}</p>}
          {error.detail !== '' && (
            <details>
              <summary>Technical details</summary>
              <pre>{error.detail}</pre>
            </details>
          )}
        </div>
      )}
      {note !== '' && <p className="muted">{note}</p>}

      <div className="row">
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {status === null && error === null && <p className="muted">Reading…</p>}

      {status !== null && (
        <>
          {!otherAvailable && (
            <div className="card">
              <p>
                Only the TV's own launcher is installed. Install the launcher you want first (drop its .apk on the Apps page, or see App ideas), then come back and press Refresh.
              </p>
            </div>
          )}

          {disagree && (
            <div className="card">
              <p>
                Your TV shows <strong>{status.activeHomePackage}</strong> when you press Home, although Android's list names a different default. That is common with launchers that take over the Home button themselves. It means "Make this the default" may not be needed; "Keep it running" is the setting that matters.
              </p>
            </div>
          )}

          {status.launchers.map((l) => (
            <div className="card tweak" key={l.component}>
              <p>
                <strong>{l.packageName}</strong>{' '}
                <span className="muted small">
                  {l.system ? 'Came with the TV' : 'Installed by you'}
                  {l.isActive ? ' · Home button shows this now' : l.isDefault && status.activeHomePackage === null ? ' · Home button opens this' : l.isDefault ? ' · Android\'s default' : ''}
                  {l.running ? ' · running now' : ' · not running now'}
                </span>
              </p>
              <div className="row">
                <button type="button" className={l.isDefault || l.isActive ? 'primary' : ''} disabled={busy || l.isDefault || l.isActive} onClick={() => void run(() => window.couchkit.setDefaultLauncher(l.component))}>
                  {l.isActive ? 'In charge of Home' : l.isDefault ? (status.activeHomePackage === null ? 'This is the default' : 'Android\'s default') : 'Make this the default'}
                </button>
                <button
                  type="button"
                  className={l.keepAlive ? 'primary' : ''}
                  aria-pressed={l.keepAlive}
                  disabled={busy}
                  onClick={() => void run(() => window.couchkit.setLauncherKeepAlive(l.packageName, !l.keepAlive))}
                >
                  Keep it running: {l.keepAlive ? 'On' : 'Off'}
                </button>
              </div>
              <p className="muted small">
                "Keep it running" asks Android not to close this launcher to save battery or memory.
              </p>
            </div>
          ))}

          {stockOn.length > 0 && (
            <div className="card tweak">
              <p>
                <strong>Turn off the stock launcher (optional)</strong>
              </p>
              <p className="muted">
                The strongest fix when the TV keeps going back to its own home screen. It is only offered after your own launcher is the default. Some TV features that rely on the stock launcher (for example parts of the settings or input switching) may stop working while it is off. You can turn it back on here at any time.
              </p>
              {stockOn.map((l) =>
                confirmOff === l.packageName ? (
                  <div className="row" key={l.packageName}>
                    <span className="warn">Turn off {l.packageName}? If the home screen misbehaves, come back here and turn it on again.</span>
                    <button type="button" className="danger" disabled={busy} onClick={() => void run(() => window.couchkit.setStockLauncherEnabled(l.packageName, false))}>
                      Yes, turn off
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirmOff(null)}>
                      No
                    </button>
                  </div>
                ) : (
                  <div className="row" key={l.packageName}>
                    <button type="button" disabled={busy || stockInCharge || !otherAvailable} onClick={() => setConfirmOff(l.packageName)}>
                      Turn off {l.packageName}
                    </button>
                    {stockInCharge && <span className="muted small">Your own launcher must be in charge of Home first.</span>}
                  </div>
                )
              )}
            </div>
          )}

          {status.turnedOff.length > 0 && (
            <div className="card tweak">
              <p>
                <strong>Stock launchers that are turned off</strong>
              </p>
              {status.turnedOff.map((p) => (
                <div className="row" key={p}>
                  <span>{p}</span>
                  <button type="button" className="primary" disabled={busy} onClick={() => void run(() => window.couchkit.setStockLauncherEnabled(p, true))}>
                    Turn back on
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
