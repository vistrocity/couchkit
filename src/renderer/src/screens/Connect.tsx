import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react'
import type { AdbStatus, ConnectOutcome, DeviceInfo, HistoryEntry } from '@shared/types'
import { AdbCard } from '../components/AdbCard'

interface Props {
  adb: AdbStatus | null
  connected: DeviceInfo | null
  /** Changes each time the user presses Cmd/Ctrl+K, to move the cursor into the address box. */
  focusToken: number
  onAdbChanged: () => void
  onConnected: (device: DeviceInfo | null) => void
}

type Failure = Extract<ConnectOutcome, { ok: false }>

export function Connect({ adb, connected, focusToken, onAdbChanged, onConnected }: Props): JSX.Element {
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void window.couchkit.listHistory().then(setHistory)
  }, [connected])

  useEffect(() => {
    inputRef.current?.focus()
  }, [focusToken])

  const connect = async (target: string): Promise<void> => {
    setBusy(true)
    setFailure(null)
    const outcome = await window.couchkit.connect(target)
    setBusy(false)
    if (outcome.ok) {
      onConnected(outcome.device)
      setAddress('')
    } else {
      setFailure(outcome)
    }
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (address.trim() !== '') void connect(address)
  }

  const disconnect = async (): Promise<void> => {
    await window.couchkit.disconnect()
    onConnected(null)
  }

  const adbReady = adb?.found === true

  return (
    <>
      <h2>Connect</h2>
      <p className="muted">Enter the TV&apos;s address, or pick one you used before.</p>

      {!adbReady && <AdbCard adb={adb} onChanged={onAdbChanged} />}

      <form className="row" onSubmit={submit}>
        <label htmlFor="tv-address" className="sr-only">
          TV address
        </label>
        <input
          id="tv-address"
          ref={inputRef}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="192.168.0.105"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          disabled={busy || !adbReady}
        />
        <button type="submit" className="primary" disabled={busy || !adbReady || address.trim() === ''}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </form>

      {busy && (
        <p className="muted small">
          First time with this TV? Watch the TV screen and choose <strong>Allow</strong> when it asks.
        </p>
      )}

      {failure !== null && (
        <div className="card error" role="alert">
          <strong>{failure.message}</strong>
          <p>{failure.fix}</p>
          {failure.detail !== '' && (
            <details>
              <summary className="small">Technical details</summary>
              <pre>{failure.detail}</pre>
            </details>
          )}
        </div>
      )}

      {connected !== null && <DeviceCard device={connected} onDisconnect={() => void disconnect()} />}

      <History
        entries={history}
        busy={busy || !adbReady}
        onConnect={(entry) => void connect(entry.id)}
        onChange={setHistory}
      />
    </>
  )
}

function DeviceCard({ device, onDisconnect }: { device: DeviceInfo; onDisconnect: () => void }): JSX.Element {
  const rows: Array<[string, string | undefined]> = [
    ['Model', [device.manufacturer, device.model].filter(Boolean).join(' ') || undefined],
    ['Android version', device.androidVersion !== undefined ? `${device.androidVersion} (API ${device.sdkLevel ?? '?'})` : undefined],
    ['Screen resolution', device.resolution],
    ['Address', device.serial],
    ['Serial number', device.hardwareSerial],
    ['Build', device.buildId]
  ]
  return (
    <section className="card" aria-labelledby="device-heading">
      <h3 id="device-heading">Connected TV</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="kv">
            <dt>{label}</dt>
            <dd>{value ?? 'unavailable'}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={onDisconnect}>
        Disconnect
      </button>
    </section>
  )
}

interface HistoryProps {
  entries: HistoryEntry[]
  busy: boolean
  onConnect: (entry: HistoryEntry) => void
  onChange: (entries: HistoryEntry[]) => void
}

function History({ entries, busy, onConnect, onChange }: HistoryProps): JSX.Element | null {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (entries.length === 0) return null

  const saveName = async (id: string): Promise<void> => {
    onChange(await window.couchkit.renameHistory(id, draft))
    setEditing(null)
  }

  return (
    <section aria-labelledby="history-heading">
      <h3 id="history-heading">Your TVs</h3>
      <ul className="history">
        {entries.map((entry) => (
          <li key={entry.id} className="card">
            <div className="grow">
              {editing === entry.id ? (
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void saveName(entry.id)
                  }}
                >
                  <input
                    aria-label="Nickname"
                    value={draft}
                    maxLength={40}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="primary">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <strong>{entry.nickname}</strong>
                  <div className="muted small">
                    {entry.id}
                    {entry.model !== undefined ? ` · ${entry.model}` : ''}
                    {entry.androidVersion !== undefined ? ` · Android ${entry.androidVersion}` : ''}
                    {' · last used '}
                    {new Date(entry.lastConnectedAt).toLocaleString()}
                  </div>
                </>
              )}
            </div>
            {editing !== entry.id && (
              <div className="row">
                <button type="button" className="primary" disabled={busy} onClick={() => onConnect(entry)}>
                  Connect
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(entry.id)
                    setDraft(entry.nickname)
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove "${entry.nickname}" from your list?`)) {
                      void window.couchkit.removeHistory(entry.id).then(onChange)
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
