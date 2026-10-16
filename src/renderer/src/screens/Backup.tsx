import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import { formatKb } from '@shared/cleanup'
import type { BackupApp, BackupItemResult, BackupProgress } from '@shared/backup'
import type { AppPackage, DeviceInfo } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

function Results({ results }: { results: BackupItemResult[] }): JSX.Element {
  const failed = results.filter((r) => !r.ok)
  return (
    <div>
      <p>
        <strong>
          {results.length - failed.length} of {results.length} done.
        </strong>
      </p>
      {failed.length > 0 && (
        <ul className="plain">
          {failed.map((r) => (
            <li key={r.packageName} className="warn">
              {r.packageName}: {r.message} {r.fix ?? ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Backup({ connected, onGoToConnect }: Props): JSX.Element {
  const [apps, setApps] = useState<AppPackage[] | null>(null)
  const [listError, setListError] = useState('')
  const [sideloadedOnly, setSideloadedOnly] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [progress, setProgress] = useState<BackupProgress | null>(null)
  const [backupDone, setBackupDone] = useState<{ folder: string | null; results: BackupItemResult[] } | null>(null)

  const [folder, setFolder] = useState<string | null>(null)
  const [saved, setSaved] = useState<BackupApp[]>([])
  const [restorePicked, setRestorePicked] = useState<Set<string>>(new Set())
  const [restoreDone, setRestoreDone] = useState<BackupItemResult[] | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const r = await window.couchkit.listApps()
    if (r.ok) {
      setApps(r.apps.filter((a) => !a.system))
      setListError('')
    } else {
      setListError(r.message)
    }
  }, [])

  useEffect(() => {
    if (connected !== null) void refresh()
  }, [connected, refresh])

  useEffect(() => window.couchkit.onBackupProgress(setProgress), [])

  const visible = useMemo(
    () => (apps ?? []).filter((a) => !sideloadedOnly || a.installedFrom !== 'Play Store'),
    [apps, sideloadedOnly]
  )

  if (connected === null) {
    return (
      <>
        <h2>Backup</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, name: string): void => {
    const next = new Set(set)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setter(next)
  }

  const chosen = visible.filter((a) => picked.has(a.packageName)).map((a) => a.packageName)

  const runBackup = async (): Promise<void> => {
    setBusy('backup')
    setBackupDone(null)
    setBackupDone(await window.couchkit.backupApps(chosen))
    setProgress(null)
    setBusy(null)
  }

  const chooseFolder = async (): Promise<void> => {
    const scan = await window.couchkit.pickBackupFolder()
    if (scan === null) return
    setFolder(scan.folder)
    setSaved(scan.apps)
    setRestorePicked(new Set(scan.apps.map((a) => a.packageName)))
    setRestoreDone(null)
  }

  const runRestore = async (): Promise<void> => {
    setBusy('restore')
    setRestoreDone(null)
    setRestoreDone(await window.couchkit.restoreApps([...restorePicked]))
    setProgress(null)
    setBusy(null)
  }

  const working = progress !== null && busy !== null ? `${progress.index} of ${progress.total}: ${progress.name}` : ''

  return (
    <>
      <h2>Backup</h2>
      <p className="muted">
        Saves the apps you installed (the app files only, not their logins or settings) to this computer, and puts them back later. Keep the backups for your own TVs: paid apps should not be shared.
      </p>

      <div className="card tweak">
        <p>
          <strong>Save apps from the TV</strong>
        </p>
        {listError !== '' && <p className="warn">{listError}</p>}
        <div className="row">
          <label>
            <input type="checkbox" checked={sideloadedOnly} onChange={(e) => setSideloadedOnly(e.target.checked)} /> Only apps not from the Play Store (these are harder to get again)
          </label>
        </div>
        <div className="row">
          <button type="button" onClick={() => setPicked(new Set(visible.map((a) => a.packageName)))}>
            Select all
          </button>
          <button type="button" onClick={() => setPicked(new Set())}>
            Select none
          </button>
          <button type="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <ul className="plain checklist">
          {visible.map((a) => (
            <li key={a.packageName}>
              <label>
                <input type="checkbox" checked={picked.has(a.packageName)} onChange={() => toggle(picked, setPicked, a.packageName)} /> <strong>{a.packageName}</strong>{' '}
                <span className="muted small">
                  {a.versionName !== undefined ? `Version ${a.versionName} · ` : ''}
                  {a.installedFrom}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {apps !== null && visible.length === 0 && <p className="muted">No apps to show.</p>}
        <div className="row">
          <button type="button" className="primary" disabled={busy !== null || chosen.length === 0} onClick={() => void runBackup()}>
            {busy === 'backup' ? `Saving… ${working}` : `Back up ${chosen.length} app${chosen.length === 1 ? '' : 's'}`}
          </button>
        </div>
        {backupDone !== null && (
          <>
            <Results results={backupDone.results} />
            {backupDone.folder !== null && (
              <div className="row">
                <button type="button" onClick={() => void window.couchkit.revealBackups()}>
                  Show backup folder
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card tweak">
        <p>
          <strong>Put saved apps back on the TV</strong>
        </p>
        <p className="muted">
          Apps already on the TV are updated in place. An older version cannot replace a newer one. Logins and settings are not restored.
        </p>
        <div className="row">
          <button type="button" disabled={busy !== null} onClick={() => void chooseFolder()}>
            Choose backup folder…
          </button>
          {folder === null && (
            <button type="button" onClick={() => void window.couchkit.revealBackups()}>
              Show backups folder
            </button>
          )}
        </div>
        {folder !== null && (
          <>
            <p className="muted small">{folder}</p>
            {saved.length === 0 ? (
              <p className="warn">No saved apps were found in that folder.</p>
            ) : (
              <>
                <div className="row">
                  <button type="button" onClick={() => setRestorePicked(new Set(saved.map((a) => a.packageName)))}>
                    Select all
                  </button>
                  <button type="button" onClick={() => setRestorePicked(new Set())}>
                    Select none
                  </button>
                </div>
                <ul className="plain checklist">
                  {saved.map((a) => (
                    <li key={a.packageName}>
                      <label>
                        <input type="checkbox" checked={restorePicked.has(a.packageName)} onChange={() => toggle(restorePicked, setRestorePicked, a.packageName)} />{' '}
                        <strong>{a.packageName}</strong>{' '}
                        <span className="muted small">
                          {formatKb(Math.ceil(a.sizeBytes / 1024))}
                          {a.files.length > 1 ? ` · ${a.files.length} parts` : ''}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="row">
                  <button type="button" className="primary" disabled={busy !== null || restorePicked.size === 0} onClick={() => void runRestore()}>
                    {busy === 'restore' ? `Restoring… ${working}` : `Restore ${restorePicked.size} app${restorePicked.size === 1 ? '' : 's'}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {restoreDone !== null && <Results results={restoreDone} />}
      </div>
    </>
  )
}
