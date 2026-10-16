import { useCallback, useEffect, useState, type JSX } from 'react'
import { Icon } from '../components/Icon'
import type { CaptureFailure, DeviceInfo, RecordingStatus } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

interface Saved {
  kind: 'screenshot' | 'recording'
  path: string
  dataUrl?: string
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function FailureCard({ failure }: { failure: CaptureFailure }): JSX.Element {
  return (
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
  )
}

export function Capture({ connected, onGoToConnect }: Props): JSX.Element {
  const [shotBusy, setShotBusy] = useState(false)
  const [preset, setPreset] = useState<'small' | 'full'>('small')
  const [status, setStatus] = useState<RecordingStatus>({ state: 'idle' })
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [failure, setFailure] = useState<CaptureFailure | null>(null)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [now, setNow] = useState(Date.now())

  const refreshStatus = useCallback(async (): Promise<void> => {
    setStatus(await window.couchkit.recordingStatus())
  }, [])

  useEffect(() => {
    void refreshStatus()
    const id = setInterval(() => {
      setNow(Date.now())
      void refreshStatus()
    }, 1000)
    return () => clearInterval(id)
  }, [refreshStatus])

  if (connected === null) {
    return (
      <>
        <h2>Capture</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const screenshot = async (): Promise<void> => {
    setShotBusy(true)
    setFailure(null)
    const result = await window.couchkit.takeScreenshot()
    setShotBusy(false)
    if (result.ok) setSaved({ kind: 'screenshot', path: result.path, dataUrl: result.dataUrl })
    else setFailure(result)
  }

  const start = async (): Promise<void> => {
    setStarting(true)
    setFailure(null)
    setSaved(null)
    const result = await window.couchkit.startRecording(preset)
    setStarting(false)
    if (!result.ok) setFailure({ ok: false, category: result.category, message: result.message, fix: result.fix, detail: result.detail })
    void refreshStatus()
  }

  const stop = async (): Promise<void> => {
    setSaving(true)
    setFailure(null)
    const result = await window.couchkit.stopRecording()
    setSaving(false)
    if (result.ok) setSaved({ kind: 'recording', path: result.path })
    else setFailure(result)
    void refreshStatus()
  }

  const recording = status.state !== 'idle'

  return (
    <>
      <h2>Capture</h2>
      <p className="muted">Take a screenshot of the TV, or record what is on its screen. Files are saved on this computer.</p>

      <section className="card capture-card">
        <h3>Screenshot</h3>
        <p className="muted small">Saves a picture of what the TV is showing right now.</p>
        <button type="button" className="primary" disabled={shotBusy || saving} onClick={() => void screenshot()}>
          <Icon name="camera" /> {shotBusy ? 'Taking…' : 'Take screenshot'}
        </button>
      </section>

      <section className="card capture-card">
        <h3>Screen recording</h3>
        <p className="muted small">Android limits one recording to 3 minutes. Stop whenever you like.</p>
        <div className="row">
          {!recording ? (
            <>
              <label className="sr-only" htmlFor="rec-preset">
                Video quality
              </label>
              <select id="rec-preset" value={preset} onChange={(e) => setPreset(e.target.value as 'small' | 'full')}>
                <option value="small">720p (smaller file)</option>
                <option value="full">TV&apos;s own resolution (bigger file)</option>
              </select>
              <button type="button" className="primary" disabled={starting} onClick={() => void start()}>
                <Icon name="record" /> {starting ? 'Starting…' : 'Start recording'}
              </button>
            </>
          ) : (
            <>
              <span className={status.state === 'recording' ? 'rec-dot' : 'muted'} aria-hidden="true">
                ●
              </span>
              <strong role="timer">
                {status.state === 'recording' ? 'Recording ' : 'Stopped by the TV after '}
                {formatClock(now - (status.startedAt ?? now))}
              </strong>
              <button type="button" className="primary" disabled={saving} onClick={() => void stop()}>
                <Icon name="stop" /> {saving ? 'Saving…' : status.state === 'recording' ? 'Stop and save' : 'Save recording'}
              </button>
            </>
          )}
        </div>
      </section>

      {failure !== null && <FailureCard failure={failure} />}

      {saved !== null && (
        <section className="card" role="status">
          <h3>{saved.kind === 'screenshot' ? 'Screenshot saved' : 'Recording saved'}</h3>
          <p className="small">
            <code>{saved.path}</code>
          </p>
          <button type="button" onClick={() => void window.couchkit.revealCapture(saved.path)}>
            <Icon name="open" /> Show in folder
          </button>
          {saved.kind === 'screenshot' && saved.dataUrl !== undefined && saved.dataUrl !== '' && (
            <img className="shot" src={saved.dataUrl} alt="Screenshot of the TV" />
          )}
        </section>
      )}

      <p className="muted small">
        Some apps (streaming services, for example) block screenshots and recordings. They show up as a black picture. That is the
        app&apos;s protection, and Couchkit does not try to get around it.
      </p>
    </>
  )
}
