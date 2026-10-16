import { useCallback, useEffect, useState, type JSX } from 'react'
import { formatKb } from '@shared/cleanup'
import type { ActionResult, DeviceInfo, OptimiseState } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

type Outcome = { ok: true; text: string } | { ok: false; message: string; fix: string; detail: string }

function OutcomeCard({ outcome }: { outcome: Outcome }): JSX.Element {
  if (outcome.ok) return <p className="muted">{outcome.text}</p>
  return (
    <div className="card error" role="alert">
      <p>
        <strong>{outcome.message}</strong>
      </p>
      {outcome.fix !== '' && <p>{outcome.fix}</p>}
      {outcome.detail !== '' && (
        <details>
          <summary>Technical details</summary>
          <pre>{outcome.detail}</pre>
        </details>
      )}
    </div>
  )
}

const fromAction = (r: ActionResult, okText: string): Outcome =>
  r.ok ? { ok: true, text: okText } : { ok: false, message: r.message, fix: r.fix, detail: r.detail }

export function Cleanup({ connected, onGoToConnect }: Props): JSX.Element {
  const [storage, setStorage] = useState<{ totalKb: number; freeKb: number } | null>(null)
  const [storageNote, setStorageNote] = useState('')
  const [busy, setBusy] = useState<'caches' | 'background' | null>(null)
  const [cacheOutcome, setCacheOutcome] = useState<Outcome | null>(null)
  const [bgOutcome, setBgOutcome] = useState<Outcome | null>(null)
  const [opt, setOpt] = useState<OptimiseState | null>(null)
  const [optConfirm, setOptConfirm] = useState(false)
  const [now, setNow] = useState(Date.now())

  const refreshStorage = useCallback(async (): Promise<void> => {
    const r = await window.couchkit.readStorage()
    if (r.ok) {
      setStorage({ totalKb: r.totalKb, freeKb: r.freeKb })
      setStorageNote('')
    } else {
      setStorage(null)
      setStorageNote(r.message)
    }
  }, [])

  useEffect(() => {
    if (connected !== null) void refreshStorage()
  }, [connected, refreshStorage])

  // The optimise job runs in the background of the app; check on it while this page is open.
  useEffect(() => {
    if (connected === null) return
    void window.couchkit.optimiseStatus().then(setOpt)
  }, [connected])

  const optRunning = opt?.running === true
  useEffect(() => {
    if (!optRunning) return
    const id = setInterval(() => {
      setNow(Date.now())
      void window.couchkit.optimiseStatus().then(setOpt)
    }, 2000)
    return () => clearInterval(id)
  }, [optRunning])

  if (connected === null) {
    return (
      <>
        <h2>Cleanup</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const clearCaches = async (): Promise<void> => {
    setBusy('caches')
    setCacheOutcome(null)
    const r = await window.couchkit.clearCaches()
    if (r.ok) {
      const { freeBeforeKb: b, freeAfterKb: a } = r
      const freed = b !== null && a !== null ? a - b : null
      setCacheOutcome({
        ok: true,
        text:
          freed !== null && freed > 0
            ? `Done. About ${formatKb(freed)} was freed.`
            : 'Done. The TV did not report any extra free space, which can mean there was little to clear.'
      })
    } else {
      setCacheOutcome({ ok: false, message: r.message, fix: r.fix, detail: r.detail })
    }
    await refreshStorage()
    setBusy(null)
  }

  const closeBackground = async (): Promise<void> => {
    setBusy('background')
    setBgOutcome(fromAction(await window.couchkit.closeBackgroundApps(), 'Done. Apps that were running in the background were closed.'))
    setBusy(null)
  }

  const startOptimise = async (reset: boolean): Promise<void> => {
    setOptConfirm(false)
    setOpt(await window.couchkit.optimiseApps(reset))
  }

  const minutes = opt !== null && opt.running ? Math.max(0, Math.floor((now - opt.startedAt) / 60000)) : 0

  const usedPct = storage === null ? 0 : Math.round(((storage.totalKb - storage.freeKb) / storage.totalKb) * 100)

  return (
    <>
      <h2>Cleanup</h2>
      <p className="muted">Free up space and memory on the TV. None of these remove your apps, logins or settings.</p>

      <div className="card tweak">
        <p>
          <strong>Storage</strong>
        </p>
        {storage !== null ? (
          <>
            <p>
              {formatKb(storage.freeKb)} free of {formatKb(storage.totalKb)} ({usedPct}% used)
            </p>
            <progress value={usedPct} max={100} aria-label="Storage used" />
          </>
        ) : (
          <p className="muted">{storageNote !== '' ? storageNote : 'Reading…'}</p>
        )}
        <div className="row">
          <button type="button" onClick={() => void refreshStorage()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card tweak">
        <p>
          <strong>Clear app caches</strong>
        </p>
        <p className="muted">
          Throws away the temporary files apps keep to load faster. Apps may open a little slower the first time afterwards. Logins and saved data are not touched.
        </p>
        <div className="row">
          <button type="button" className="primary" disabled={busy !== null} onClick={() => void clearCaches()}>
            {busy === 'caches' ? 'Clearing…' : 'Clear caches'}
          </button>
        </div>
        {cacheOutcome !== null && <OutcomeCard outcome={cacheOutcome} />}
      </div>

      <div className="card tweak">
        <p>
          <strong>Close background apps</strong>
        </p>
        <p className="muted">Closes apps that are running but not on screen, which frees memory. Android may start some of them again by itself.</p>
        <div className="row">
          <button type="button" className="primary" disabled={busy !== null} onClick={() => void closeBackground()}>
            {busy === 'background' ? 'Closing…' : 'Close background apps'}
          </button>
        </div>
        {bgOutcome !== null && <OutcomeCard outcome={bgOutcome} />}
      </div>

      <div className="card tweak">
        <p>
          <strong>Optimise apps</strong>
        </p>
        <p className="muted">
          Prepares your apps so they can start a little faster. The gain is usually modest. It can take 5 to 30 minutes or more, and the TV may feel slow meanwhile. Keep the TV on and connected until it says it is done. "Put apps back" returns them to the TV's own settings.
        </p>
        {optRunning ? (
          <p>
            <strong>Working…</strong> {minutes < 1 ? 'less than a minute so far.' : `${minutes} minute${minutes === 1 ? '' : 's'} so far.`} You can look at other pages meanwhile.
          </p>
        ) : optConfirm ? (
          <div className="row">
            <span className="warn">Start now? Keep the TV on until it finishes.</span>
            <button type="button" className="primary" onClick={() => void startOptimise(false)}>
              Yes, start
            </button>
            <button type="button" onClick={() => setOptConfirm(false)}>
              No
            </button>
          </div>
        ) : (
          <div className="row">
            <button type="button" className="primary" onClick={() => setOptConfirm(true)}>
              Optimise apps
            </button>
            <button type="button" onClick={() => void startOptimise(true)}>
              Put apps back
            </button>
          </div>
        )}
        {opt !== null && !opt.running && opt.last !== null && <OutcomeCard outcome={fromAction(opt.last, opt.last.ok ? opt.last.detail : '')} />}
      </div>

      <div className="card tweak">
        <p>
          <strong>Clear one app's data</strong>
        </p>
        <p className="muted">
          This is done per app on the Apps page (button "Clear data"), because it deletes that app's logins and settings and cannot be undone.
        </p>
      </div>
    </>
  )
}
