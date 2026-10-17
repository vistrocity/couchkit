import { ErrorCard } from '../components/ErrorCard'
import { useCallback, useEffect, useMemo, useState, type DragEvent, type JSX } from 'react'
import { RISK_CONSEQUENCES, RISK_VERBS, blockedReason, type RiskyAction } from '@shared/apprisk'
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
  const [confirmClear, setConfirmClear] = useState<string | null>(null)
  const [notice, setNotice] = useState<ActionResult | null>(null)
  const [busyPackage, setBusyPackage] = useState<string | null>(null)
  const [elevated, setElevated] = useState(false)
  // System apps: the person must accept a high-risk warning before they are listed.
  const [systemAccepted, setSystemAccepted] = useState(false)
  const [gate, setGate] = useState(false)
  const [activeHome, setActiveHome] = useState<string | null>(null)
  const [risk, setRisk] = useState<{ pkg: string; action: RiskyAction } | null>(null)
  const [riskTick, setRiskTick] = useState(false)
  // Files that were dragged in and are waiting for the person to say "yes, install".
  const [pendingDrop, setPendingDrop] = useState<string[] | null>(null)

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

  useEffect(() => {
    void window.couchkit.isElevated().then(setElevated)
  }, [])

  const askRisk = (pkg: string, action: RiskyAction): void => {
    setConfirm(null)
    setConfirmClear(null)
    setRiskTick(false)
    setRisk({ pkg, action })
  }

  const chooseFilter = (value: Filter): void => {
    setRisk(null)
    if (value === 'all' && !systemAccepted) {
      setGate(true)
      return
    }
    setGate(false)
    setFilter(value)
  }

  const acceptSystem = (): void => {
    setSystemAccepted(true)
    setGate(false)
    setFilter('all')
    // Learn which app is the real home screen so it can be protected.
    void window.couchkit.launcherStatus().then((r) => {
      if (r.ok) setActiveHome(r.status.activeHomePackage)
    })
  }

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
    const files = Array.from(event.dataTransfer.files)
    const paths: string[] = []
    for (const file of files) {
      try {
        const path = window.couchkit.pathForFile(file)
        if (path !== '') paths.push(path)
      } catch {
        // handled below
      }
    }
    if (paths.length === 0) {
      setNotice({
        ok: false,
        category: 'other',
        message: files.length === 0 ? 'Nothing was dropped.' : 'Couchkit could not read where that file is on your computer.',
        fix: 'Use the "Choose files…" button instead, and tell me if dragging keeps failing.',
        detail: `files dropped: ${files.length}`
      })
      return
    }
    setInstallResults([])
    setPendingDrop(paths)
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
    <div
      className="apps-page"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <h2>Apps</h2>

      {elevated && (
        <div className="card error" role="alert">
          <p>
            <strong>Couchkit is running as Administrator, so Windows blocks dragging files into it.</strong>
          </p>
          <p>Close Couchkit and start it again from a normal PowerShell window (not &quot;Run as administrator&quot;).</p>
        </div>
      )}

      <div className={dragging ? 'dropzone dragging' : 'dropzone'}>
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

      {pendingDrop !== null && (
        <div className="card warn" role="alertdialog" aria-labelledby="drop-title">
          <p id="drop-title">
            <strong>
              Install {pendingDrop.length === 1 ? 'this app' : `these ${pendingDrop.length} apps`} on {connected.model ?? 'your TV'}?
            </strong>
          </p>
          <ul>
            {pendingDrop.map((path) => (
              <li key={path}>{path.split(/[\\/]/).pop()}</li>
            ))}
          </ul>
          <p className="muted small">Only install apps from sources you trust.</p>
          <div className="row">
            <button
              type="button"
              className="primary"
              onClick={() => {
                const paths = pendingDrop
                setPendingDrop(null)
                void install(paths)
              }}
            >
              Yes, install
            </button>
            <button type="button" onClick={() => setPendingDrop(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
        <select aria-label="Which apps to show" value={gate ? 'all' : filter} onChange={(e) => chooseFilter(e.target.value as Filter)}>
          <option value="user">Apps I installed</option>
          <option value="all">All apps (including system)</option>
        </select>
        <button type="button" disabled={loading} onClick={() => void refresh()}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {gate && (
        <div className="card risk-card" role="alertdialog" aria-labelledby="risk-title">
          <p id="risk-title" className="risk-title">
            <span className="risk-badge">HIGH RISK</span> System apps run your TV
          </p>
          <p>
            System apps came with the TV and keep it working: the home screen, settings, remote, Wi-Fi, updates and more. Turning one off (freezing), removing it or erasing its data can leave the TV showing a black screen, ignoring the remote, or needing a <strong>factory reset</strong> to recover.
          </p>
          <p>Only change a system app if you know exactly what it does and can recover the TV. If you are not sure, leave it alone.</p>
          <div className="row">
            <button type="button" className="danger" onClick={acceptSystem}>
              I understand the risk, show system apps
            </button>
            <button type="button" className="primary" onClick={() => setGate(false)}>
              Go back
            </button>
          </div>
        </div>
      )}

      {filter === 'all' && systemAccepted && (
        <p className="risk-banner" role="note">
          <span className="risk-badge">HIGH RISK</span> System apps are shown. Disabling, removing or clearing them can break your TV.
        </p>
      )}

      {listFailure !== null && (
        <ErrorCard message={listFailure.message} fix={listFailure.fix} />
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
                <strong>{a.packageName}</strong> {a.system && <span className="risk-badge">SYSTEM · HIGH RISK</span>}{' '}
                {!a.enabled && <span className="warn">(disabled)</span>}
              </div>
              <div className="muted small">
                {a.versionName !== undefined ? `Version ${a.versionName}` : 'Version unknown'} · {a.installedFrom}
                {a.system ? ' · System app' : ''}
                {a.packageName === activeHome ? ' · Your current home screen' : ''}
              </div>
            </div>
            {risk !== null && risk.pkg === a.packageName ? (
              <div className="risk-confirm">
                <p>
                  <span className="risk-badge">HIGH RISK</span> <strong>You are about to {RISK_VERBS[risk.action]} the system app {a.packageName}.</strong>
                </p>
                <p>{RISK_CONSEQUENCES[risk.action]}</p>
                <label>
                  <input type="checkbox" checked={riskTick} onChange={(e) => setRiskTick(e.target.checked)} /> I understand this can break my TV and I can recover it if it does.
                </label>
                <div className="row">
                  <button
                    type="button"
                    className="danger"
                    disabled={!riskTick || busyPackage !== null}
                    onClick={() => {
                      const { action } = risk
                      setRisk(null)
                      setRiskTick(false)
                      void act(a.packageName, () =>
                        action === 'disable'
                          ? window.couchkit.setAppEnabled(a.packageName, false)
                          : action === 'uninstall'
                            ? window.couchkit.uninstallApp(a.packageName)
                            : window.couchkit.clearAppData(a.packageName)
                      )
                    }}
                  >
                    Yes, {risk.action === 'disable' ? 'turn it off' : risk.action === 'uninstall' ? 'remove it' : 'erase its data'}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setRisk(null)
                      setRiskTick(false)
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : confirmClear === a.packageName ? (
              <div className="row clear-confirm">
                <span>
                  <strong>Delete all of this app's data?</strong> Logins, downloads and settings inside the app are erased and cannot be brought back.
                </span>
                <button
                  type="button"
                  className="danger"
                  disabled={busyPackage !== null}
                  onClick={() => {
                    setConfirmClear(null)
                    void act(a.packageName, () => window.couchkit.clearAppData(a.packageName))
                  }}
                >
                  Yes, delete data
                </button>
                <button type="button" onClick={() => setConfirmClear(null)}>
                  No
                </button>
              </div>
            ) : confirm === a.packageName ? (
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
                <button type="button" disabled={busyPackage !== null} onClick={() => void act(a.packageName, () => window.couchkit.openApp(a.packageName))}>
                  Open
                </button>
                <button type="button" disabled={busyPackage !== null} onClick={() => void act(a.packageName, () => window.couchkit.forceStopApp(a.packageName))}>
                  Force stop
                </button>
                <button
                  type="button"
                  title={a.enabled && a.system ? (blockedReason(a.packageName, activeHome) ?? undefined) : undefined}
                  disabled={busyPackage !== null || (a.enabled && a.system && blockedReason(a.packageName, activeHome) !== null)}
                  onClick={() => {
                    if (a.enabled && a.system) return askRisk(a.packageName, 'disable')
                    void act(a.packageName, () => window.couchkit.setAppEnabled(a.packageName, !a.enabled))
                  }}
                >
                  {a.enabled ? 'Disable' : 'Enable'}
                </button>
                <button type="button" disabled={busyPackage !== null} onClick={() => void act(a.packageName, () => window.couchkit.clearAppCache(a.packageName))}>
                  Clear cache
                </button>
                <button
                  type="button"
                  title={a.system ? (blockedReason(a.packageName, activeHome) ?? undefined) : undefined}
                  disabled={busyPackage !== null || (a.system && blockedReason(a.packageName, activeHome) !== null)}
                  onClick={() => (a.system ? askRisk(a.packageName, 'clear') : setConfirmClear(a.packageName))}
                >
                  Clear data
                </button>
                <button
                  type="button"
                  title={a.system ? (blockedReason(a.packageName, activeHome) ?? undefined) : undefined}
                  disabled={busyPackage !== null || (a.system && blockedReason(a.packageName, activeHome) !== null)}
                  onClick={() => (a.system ? askRisk(a.packageName, 'uninstall') : setConfirm(a.packageName))}
                >
                  Uninstall
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
