import { useCallback, useEffect, useState, type JSX } from 'react'
import type { LogEntry } from '@shared/types'

/** Every command Couchkit has run on this computer. Stays on this computer. */
export function Activity(): JSX.Element {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [copied, setCopied] = useState(false)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  const refresh = useCallback(() => {
    void window.couchkit.listLog().then(setEntries)
  }, [])

  useEffect(() => {
    void window.couchkit.getSettings().then((v) => setEnabled(v.activityLog))
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 3000)
    return () => clearInterval(timer)
  }, [refresh])

  const copyAll = async (): Promise<void> => {
    const text = entries
      .map((e) => `${new Date(e.startedAt).toISOString()}  ${e.ok ? 'ok  ' : 'FAIL'}  ${e.durationMs}ms  ${e.command}\n${e.output}`)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const toggle = async (on: boolean): Promise<void> => {
    const v = await window.couchkit.setActivityLog(on)
    setEnabled(v.activityLog)
    refresh()
  }

  if (enabled === null) return <h2>Activity</h2>

  if (!enabled) {
    return (
      <>
        <h2>Activity</h2>
        <div className="card">
          <p>
            <strong>The activity log is off.</strong>
          </p>
          <p className="muted">
            When it is on, Couchkit keeps a list of the commands it runs on your TV. It is only useful for troubleshooting or if you are curious. The list stays in memory on this computer, is never sent anywhere, and is emptied when you close Couchkit.
          </p>
          <button type="button" className="primary" onClick={() => void toggle(true)}>
            Turn on the activity log
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <h2>Activity</h2>
      <p className="muted">Every command Couchkit runs from now on, newest first. This list stays on your computer and is emptied when you close Couchkit.</p>
      <p className="row">
        <button type="button" onClick={refresh}>
          Refresh
        </button>
        <button type="button" onClick={() => void copyAll()} disabled={entries.length === 0}>
          {copied ? 'Copied' : 'Copy all'}
        </button>
        <button type="button" onClick={() => void window.couchkit.clearLog().then(refresh)} disabled={entries.length === 0}>
          Clear
        </button>
        <button type="button" onClick={() => void toggle(false)}>
          Turn off
        </button>
      </p>

      {entries.length === 0 ? (
        <p className="muted">Nothing yet.</p>
      ) : (
        <ul className="log">
          {entries.map((e) => (
            <li key={e.id}>
              <details>
                <summary>
                  <span className={e.ok ? 'ok' : 'warn'}>{e.ok ? 'OK' : 'Failed'}</span>{' '}
                  <code>{e.command}</code>{' '}
                  <span className="muted small">
                    {new Date(e.startedAt).toLocaleTimeString()} · {e.durationMs} ms
                  </span>
                </summary>
                <pre>{e.output === '' ? '(no output)' : e.output}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
