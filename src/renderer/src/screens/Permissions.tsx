import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import { COMMON_PERMISSIONS, type PermissionEntry } from '@shared/permissions'
import { isProtectedPackage } from '@shared/cleanup'
import type { AppPackage, DeviceInfo } from '@shared/types'
import { ErrorCard } from '../components/ErrorCard'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

interface Problem {
  message: string
  fix: string
  detail: string
}

export function Permissions({ connected, onGoToConnect }: Props): JSX.Element {
  const [apps, setApps] = useState<AppPackage[] | null>(null)
  const [showSystem, setShowSystem] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [perms, setPerms] = useState<PermissionEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [holdersFor, setHoldersFor] = useState<string | null>(null)
  const [holders, setHolders] = useState<string[] | null>(null)
  const [holdersBusy, setHoldersBusy] = useState(false)

  const serial = connected?.serial ?? null

  const loadApps = useCallback(async (): Promise<void> => {
    const r = await window.couchkit.listApps()
    if (r.ok) {
      setApps(r.apps)
    } else {
      setProblem({ message: r.message, fix: r.fix, detail: r.detail })
    }
  }, [])

  useEffect(() => {
    setApps(null)
    setSelected(null)
    setPerms(null)
    setHolders(null)
    setHoldersFor(null)
    if (serial !== null) void loadApps()
  }, [serial, loadApps])

  const loadPerms = useCallback(async (name: string): Promise<void> => {
    setSelected(name)
    setPerms(null)
    setLoading(true)
    setProblem(null)
    const r = await window.couchkit.readPermissions(name)
    setLoading(false)
    if (r.ok) setPerms(r.permissions)
    else setProblem({ message: r.message, fix: r.fix, detail: r.detail })
  }, [])

  const change = async (p: PermissionEntry, grant: boolean): Promise<void> => {
    if (selected === null) return
    setBusy(p.permission)
    setProblem(null)
    const r = await window.couchkit.setPermission(selected, p.permission, grant)
    if (!r.ok) setProblem({ message: r.message, fix: r.fix, detail: r.detail })
    const again = await window.couchkit.readPermissions(selected)
    if (again.ok) setPerms(again.permissions)
    setBusy(null)
  }

  const findHolders = async (id: string): Promise<void> => {
    setHoldersFor(id)
    setHolders(null)
    setHoldersBusy(true)
    setProblem(null)
    const r = await window.couchkit.appsWithPermission(id)
    setHoldersBusy(false)
    if (r.ok) setHolders(r.packages)
    else setProblem({ message: r.message, fix: r.fix, detail: r.detail })
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (apps ?? []).filter((a) => (showSystem || !a.system) && (q === '' || a.packageName.toLowerCase().includes(q)))
  }, [apps, showSystem, search])

  if (connected === null) {
    return (
      <>
        <h2>Permissions</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const protectedApp = selected !== null && isProtectedPackage(selected)
  const holderLabel = COMMON_PERMISSIONS.find((c) => c.id === holdersFor)?.label

  return (
    <>
      <h2>Permissions</h2>
      <p className="muted">
        See what each app is allowed to do (camera, microphone, location and so on) and switch it on or off. A blocked permission can be allowed again at any time, but the app may stop working properly until you do.
      </p>

      {problem !== null && <ErrorCard message={problem.message} fix={problem.fix} detail={problem.detail} />}

      <div className="card">
        <h3>Who can use…</h3>
        <p className="muted small">Pick a permission to list the apps you installed that currently have it.</p>
        <div className="chips-row">
          {COMMON_PERMISSIONS.map((c) => (
            <button type="button" key={c.id} className={c.id === holdersFor ? 'primary' : undefined} disabled={holdersBusy} onClick={() => void findHolders(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        {holdersBusy && <p className="muted">Checking your apps… this can take a little while.</p>}
        {holders !== null && (
          <>
            <p>
              <strong>{holders.length === 0 ? `No installed app has ${holderLabel}.` : `${holders.length} app${holders.length === 1 ? '' : 's'} can use ${holderLabel}:`}</strong>
            </p>
            <ul className="plain">
              {holders.map((h) => (
                <li key={h}>
                  <button type="button" className="linklike" onClick={() => void loadPerms(h)}>
                    {h}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="card">
        <h3>An app's permissions</h3>
        <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="search" placeholder="Search by app name…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search apps" />
          <label className="small">
            <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} /> Include apps that came with the TV
          </label>
        </div>
        {apps === null ? (
          <p className="muted">Loading apps…</p>
        ) : (
          <div className="pick-list" role="listbox" aria-label="Apps">
            {visible.length === 0 && <p className="muted small">No apps match.</p>}
            {visible.map((a) => (
              <button type="button" key={a.packageName} role="option" aria-selected={a.packageName === selected} className={a.packageName === selected ? 'pick active' : 'pick'} onClick={() => void loadPerms(a.packageName)}>
                {a.packageName}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected !== null && (
        <div className="card">
          <h3>{selected}</h3>
          {loading && <p className="muted">Reading permissions…</p>}
          {protectedApp && <p className="warn">This is a core system app. You can look, but changes are not allowed from here.</p>}
          {perms !== null && perms.length === 0 && <p className="muted">This app does not ask for any permissions that can be switched.</p>}
          {perms !== null &&
            perms.map((p) => (
              <div className="perm-row" key={p.permission}>
                <div>
                  <strong>{p.label}</strong>
                  <div className="muted small">{p.permission}</div>
                </div>
                <span className={p.granted ? 'ok' : 'muted'}>{p.granted ? 'Allowed' : 'Blocked'}</span>
                {p.locked ? (
                  <span className="muted small">Fixed by the TV</span>
                ) : (
                  <button type="button" disabled={busy !== null || protectedApp} onClick={() => void change(p, !p.granted)}>
                    {busy === p.permission ? 'Working…' : p.granted ? 'Block' : 'Allow'}
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </>
  )
}
