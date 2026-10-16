import { useCallback, useEffect, useMemo, useState, type DragEvent, type JSX } from 'react'
import type { ActionResult, ApkInstallProgress, ApkInstallResult, AppPackage, DeviceInfo, ListAppsResult } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

type ListFailure = Extract<ListAppsResult, { ok: false }>
type Filter = 'user' | 'all'

export function Apps({ connected, onGoToConnect }: Props): JSX.Element {
  const [apps, setApps] = useState<AppPackage[] | null>(null)
  const [listFailure, setListFailure] = useState<ListFailure | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('user')
  const [installing, setInstalling] = useState<ApkInstallProgress | null>(null)
  const [installResults, setInstallResults] = useState<ApkInstallResult[]>([])
  const [dragging, setDragging] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [notice, setNotice] = useState<ActionResult | null>(null)
  const [busyPackage, setBusyPackage] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    const result = await window.couchkit.listApps()
    setLoading(false)
    if (result.ok) {
      setApps(result.apps)
      setListFailure(null)
    } else {
      setListFailure(result)
    }
  }, [])

  useEffect(() => {
    if (connected !== null) void refresh()
  }, [connected, refresh])

  useEffect(() => window.couchkit.onApkProgress(setInstalling), [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (apps ?? []).filter((a) => (filter === 'all' || !a.system) && (q === '' || a.packageName.toLowerCase().includes(q)))
  }, [apps, search, filter])

  if (connected === null) {
    return (
      <>
        <h2>Apps</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const install = async (paths: string[]): Promise<void> => {
    if (paths.length === 0) return
    setInstallResults([])
    setInstalling({ index: 1, total: paths.length, name: '' })
    const results = await window.couchkit.installApks(paths)
    setInstalling(null)
    setInstallResults(results)
    void refresh()
  }

  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    setDragging(false)
    const paths = Array.from(event.dataTransfer.files)
      .map((f) => window.couchkit.pathForFile(f))
      .filter((p) => p !== '')
    void install(paths)
  }

  const act = async (packageName: string, run: () => Promise<ActionResult>): Promise<void> => {
    setBusyPackage(packageName)
    setNotice(null)
    const result = await run()
    setBusyPackage(null)
    setNotice(result)
    setConfirm(null)
    void refresh()
  }

  return (
    <>
      <h2>Apps</h2>

      <div
        className={dragging ? 'dropzone dragging' : 'dropzone'}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p>
          <strong>Drop .apk files here</strong> to install them on your TV
        </p>
        <button type="button" disabled={installing !== null} onClick={() => void window.couchkit.pickApks().then(install)}>
          Choose files…
        </button>
        {installing !== null && (
          <p role="status">
            Installing {installing.index} of {installing.total}
            {installing.name !== '' ? `: ${installing.name}` : ''}… this can take a minute.
          </p>
        )}
      </div>

      {installResults.length > 0 && (
        <ul className="results">
          {installResults.map((r) => (
            <li key={r.path} className={r.ok ? 'ok' : 'warn'}>
              <strong>{r.name}</strong>: {r.message} {r.fix}
            </li>
          ))}
        </ul>
      )}

      {notice !== null && (
        <div className={notice.ok ? 'card' : 'card error'} role={notice.ok ? 'status' : 'alert'}>
          {notice.ok ? (
            <p className="ok">{notice.detail}</p>
          ) : (
            <>
              <p>
                <strong>{notice.message}</strong>
              </p>
              <p>{notice.fix}</p>
              {notice.detail !== '' && (
                <details>
                  <summary>Technical details</summary>
                  <pre>{notice.detail}</pre>
                </details>
              )}
            </>
          )}
        </div>
      )}

      <div className="row toolbar">
        <label className="sr-only" htmlFor="app-search">
          Search apps
        </label>
        <input id="app-search" type="text" className="grow" placeholder="Search by app name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Which apps to show" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="user">Apps I installed</option>
          <option value="all">All apps (including system)</option>
        </select>
        <button type="button" disabled={loading} onClick={() => void refresh()}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {listFailure !== null && (
        <div className="card error" role="alert">
          <p>
            <strong>{listFailure.message}</strong>
          </p>
          <p>{listFailure.fix}</p>
        </div>
      )}

      {apps !== null && (
        <p className="muted small">
          Showing {visible.length} of {apps.length}. Names below are package names (the app's technical id).
        </p>
      )}

      <ul className="applist">
        {visible.map((a) => (
          <li key={a.packageName} className="card app">
            <div className="grow">
              <div>
                <strong>{a.packageName}</strong> {!a.enabled && <span className="warn">(disabled)</span>}
              </div>
              <div className="muted small">
                {a.versionName !== undefined ? `Version ${a.versionName}` : 'Version unknown'} · {a.installedFrom}
                {a.system ? ' · System app' : ''}
              </div>
            </div>
            {confirm === a.packageName ? (
              <div className="row">
                <span>{a.system ? 'Remove for this user? (reversible by factory reset)' : 'Remove this app?'}</span>
                <button type="button" className="primary" disabled={busyPackage !== null} onClick={() => void act(a.packageName, () => window.couchkit.uninstallApp(a.packageName))}>
                  Yes, remove
                </button>
                <button type="button" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="row">
                <button type="button" disabled={busyPackage !== null} onClick={() => void act(a.packageName, () => window.couchkit.setAppEnabled(a.packageName, !a.enabled))}>
                  {a.enabled ? 'Disable' : 'Enable'}
                </button>
                <button type="button" disabled={busyPackage !== null} onClick={() => setConfirm(a.packageName)}>
                  Uninstall
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
