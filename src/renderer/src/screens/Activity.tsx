import { useCallback, useEffect, useState, type JSX } from 'react'
import type { LogEntry } from '@shared/types'

/** Every command Couchkit has run on this computer. Stays on this computer. */
export function Activity(): JSX.Element {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    void window.couchkit.listLog().then(setEntries)
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

  return (
    <>
      <h2>Activity</h2>
      <p className="muted">Every command Couchkit runs, newest first. This list stays on your computer.</p>
      <p className="row">
        <button type="button" onClick={refresh}>
          Refresh
        </button>
        <button type="button" onClick={() => void copyAll()} disabled={entries.length === 0}>
          {copied ? 'Copied' : 'Copy all'}
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
