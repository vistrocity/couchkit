import { useEffect, useRef, useState, type Dispatch, type FormEvent, type JSX, type SetStateAction } from 'react'
import { BUILT_IN_SHORTCUTS, MAX_COMMAND_LENGTH, isRisky, isValidCommand, type SavedShortcut } from '@shared/console'
import type { DeviceInfo, ShellResult } from '@shared/types'

export interface ConsoleRun {
  command: string
  result: ShellResult
  at: number
}

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
  /** Kept by the app, not by this page, so they survive switching to another tab. */
  command: string
  onCommandChange: Dispatch<SetStateAction<string>>
  runs: ConsoleRun[]
  onRunsChange: Dispatch<SetStateAction<ConsoleRun[]>>
}

const GROUPS = ['Info', 'Network', 'Apps and screen', 'Power'] as const

export function Console({ connected, onGoToConnect, command, onCommandChange: setCommand, runs, onRunsChange: setRuns }: Props): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedShortcut[]>([])
  const [naming, setNaming] = useState(false)
  const [shortcutName, setShortcutName] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void window.couchkit.listShortcuts().then(setSaved)
  }, [])

  if (connected === null) {
    return (
      <>
        <h2>Console</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const execute = async (text: string): Promise<void> => {
    setConfirm(null)
    setBusy(true)
    const result = await window.couchkit.runShell(text)
    setBusy(false)
    setRuns((prev) => [{ command: text.trim(), result, at: Date.now() }, ...prev].slice(0, 20))
  }

  /** Runs the command, but asks first if it looks like it could delete data or restart the TV. */
  const request = (text: string): void => {
    if (!isValidCommand(text) || busy) return
    setCommand(text)
    if (isRisky(text)) setConfirm(text)
    else void execute(text)
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    request(command)
  }

  const saveShortcut = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setSaved(await window.couchkit.saveShortcut(shortcutName, command))
    setNaming(false)
    setShortcutName('')
  }

  const latest = runs[0]

  const copy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard not available: the text can still be selected by hand.
    }
  }

  return (
    <>
      <h2>Console</h2>
      <p className="muted">
        Run a command on the TV, like <code>adb shell</code>. It runs on the TV only, never on this computer. A command that does not
        finish within 30 seconds is stopped.
      </p>

      <div className="console-layout">
        <div className="console-main">
        <form className="row" onSubmit={submit}>
          <label className="sr-only" htmlFor="console-input">
            Command to run on the TV
          </label>
          <input
            id="console-input"
            ref={inputRef}
            className="grow mono"
            type="text"
            value={command}
            maxLength={MAX_COMMAND_LENGTH}
            placeholder="for example: getprop ro.product.model"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setCommand(e.target.value)}
          />
          <button type="submit" className="primary" disabled={busy || !isValidCommand(command)}>
            {busy ? 'Running…' : 'Run'}
          </button>
          <button type="button" disabled={!isValidCommand(command)} onClick={() => setNaming(true)}>
            Save as shortcut…
          </button>
        </form>

        {naming && (
          <form className="card row" onSubmit={(e) => void saveShortcut(e)}>
            <label className="sr-only" htmlFor="shortcut-name">
              Shortcut name
            </label>
            <input id="shortcut-name" type="text" className="grow" value={shortcutName} maxLength={40} placeholder="Name this shortcut" onChange={(e) => setShortcutName(e.target.value)} autoFocus />
            <button type="submit" className="primary" disabled={shortcutName.trim() === ''}>
              Save
            </button>
            <button type="button" onClick={() => setNaming(false)}>
              Cancel
            </button>
          </form>
        )}

        {confirm !== null && (
          <div className="card error" role="alert">
            <p>
              <strong>This command can delete data, change settings, or restart the TV.</strong>
            </p>
            <p>
              <code>{confirm}</code>
            </p>
            <div className="row">
              <button type="button" className="primary" onClick={() => void execute(confirm)}>
                Yes, run it
              </button>
              <button type="button" onClick={() => setConfirm(null)}>
                No
              </button>
            </div>
          </div>
        )}

        <section aria-labelledby="shortcuts-heading">
          <h3 id="shortcuts-heading">Shortcuts</h3>
          {saved.length > 0 && (
            <div className="shortcut-group">
              <div className="muted small">Yours</div>
              <div className="row">
                {saved.map((s) => (
                  <span key={s.id} className="chip-group">
                    <button type="button" className="chip" title={s.command} disabled={busy} onClick={() => request(s.command)}>
                      {s.name}
                    </button>
                    <button
                      type="button"
                      className="chip chip-x"
                      aria-label={`Remove shortcut ${s.name}`}
                      onClick={() => void window.couchkit.removeShortcut(s.id).then(setSaved)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {GROUPS.map((group) => (
            <div key={group} className="shortcut-group">
              <div className="muted small">{group}</div>
              <div className="row">
                {BUILT_IN_SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <button key={s.label} type="button" className="chip" title={s.command} disabled={busy} onClick={() => request(s.command)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
        </div>
        <aside className="console-results" aria-label="Results">
          {latest === undefined ? (
            <p className="muted">Results appear here. Run a command or click a shortcut.</p>
          ) : (
            <>
              <div className="row">
                <h3 id="output-heading" className="grow">
                  <code>{latest.command}</code>
                </h3>
                <button type="button" onClick={() => void copy(latest.result.output)} disabled={latest.result.output === ''}>
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
                <button type="button" onClick={() => setRuns([])}>
                  Clear
                </button>
              </div>
              <p className={latest.result.ok ? 'muted small' : 'warn small'} aria-live="polite">
                {latest.result.message ??
                  (latest.result.ok ? 'Finished' : `The TV reported an error (exit code ${latest.result.exitCode ?? '?'})`)}{' '}
                · {latest.result.durationMs} ms
              </p>
              <pre className="output">{latest.result.output === '' ? '(no output)' : latest.result.output}</pre>
              {latest.result.truncated && <p className="muted small">The output was very long, so only the first part is shown.</p>}
            </>
          )}
          {runs.length > 1 && (
            <div className="recent-box">
              <h3 id="recent-heading">Earlier in this session</h3>
              <ul className="recent">
                {runs.slice(1).map((r) => (
                  <li key={r.at}>
                    <button type="button" className="crumb mono" onClick={() => setCommand(r.command)} title="Put this back in the box">
                      {r.command}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
