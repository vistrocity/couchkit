import { useEffect, useState, type JSX } from 'react'
import type { AdbStatus, DownloadProgress } from '@shared/types'

interface Props {
  adb: AdbStatus | null
  /** Called after a download so the page can look again. */
  onChanged: () => void
}

/** Shows whether adb is ready, and lets the user download it. */
export function AdbCard({ adb, onChanged }: Props): JSX.Element {
  const [verifyNote, setVerifyNote] = useState<string | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => window.couchkit.onInstallProgress(setProgress), [])

  const download = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setProgress(null)
    const result = await window.couchkit.installAdb()
    setBusy(false)
    setProgress(null)
    if (!result.ok) setError(result.message)
    else setVerifyNote(result.verified === true ? "Checked against the checksum Google publishes: it matched." : "Downloaded over a secure connection, but Google's checksum could not be fetched, so it was not checked.")
    onChanged()
  }

  return (
    <section className="card" aria-labelledby="adb-heading">
      <h3 id="adb-heading">adb (the tool that talks to your TV)</h3>
      {adb === null ? (
        <p>Checking…</p>
      ) : (
        <p className={adb.found ? 'ok' : 'warn'}>{adb.message}</p>
      )}

      {adb !== null && !adb.found && (
        <>
          <p className="muted small">
            Couchkit downloads Google&apos;s own Platform-Tools from dl.google.com into its own folder.
            Nothing is installed on your system.
          </p>
          <button type="button" className="primary" onClick={() => void download()} disabled={busy}>
            {busy ? 'Downloading…' : 'Download adb'}
          </button>
        </>
      )}

      {progress !== null && <ProgressBar progress={progress} />}
      {error !== null && <p className="warn">{error}</p>}
      {verifyNote !== null && adb?.found === true && <p className="muted small">{verifyNote}</p>}
    </section>
  )
}

function ProgressBar({ progress }: { progress: DownloadProgress }): JSX.Element {
  const known = progress.totalBytes !== null && progress.totalBytes > 0
  const percent = known ? Math.min(100, Math.round((progress.receivedBytes / (progress.totalBytes ?? 1)) * 100)) : null
  const label =
    progress.phase === 'extracting'
      ? 'Unpacking…'
      : percent !== null
        ? `Downloading… ${percent}%`
        : `Downloading… ${(progress.receivedBytes / 1_000_000).toFixed(1)} MB`
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuenow={percent ?? undefined}>
      <div className="bar" style={{ width: `${percent ?? (progress.phase === 'extracting' ? 100 : 30)}%` }} />
      <span className="small muted">{label}</span>
    </div>
  )
}
