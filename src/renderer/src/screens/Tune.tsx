import { useCallback, useEffect, useState, type JSX } from 'react'
import { TWEAKS, MIN_DENSITY, MAX_DENSITY, isValidDensity, type Tweak, type TweakGroup, type TweakSnapshot, type ScreensaverOption } from '@shared/tweaks'
import type { ApplyTweakResult, DeviceInfo, PendingChange } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

const GROUPS: readonly TweakGroup[] = ['Speed', 'Display', 'System', 'Network']

interface CardInfo {
  title: string
  tweaks: Tweak[]
}

/** Groups the tweaks of one section into blocks; tweaks sharing a card name sit together. */
function cardsFor(group: TweakGroup): CardInfo[] {
  const cards: CardInfo[] = []
  for (const t of TWEAKS.filter((x) => x.group === group)) {
    const title = t.card ?? t.title
    const existing = cards.find((c) => c.title === title)
    if (existing === undefined) cards.push({ title, tweaks: [t] })
    else existing.tweaks.push(t)
  }
  return cards
}

export function Tune({ connected, onGoToConnect }: Props): JSX.Element {
  const [snapshot, setSnapshot] = useState<TweakSnapshot | null>(null)
  const [error, setError] = useState<{ message: string; fix: string; detail: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [now, setNow] = useState(Date.now())
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const [savers, setSavers] = useState<ScreensaverOption[] | null>(null)
  const [clockNote, setClockNote] = useState<{ ok: boolean; text: string; fix: string } | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const r = await window.couchkit.readTweaks()
    if (r.ok) {
      setSnapshot(r.snapshot)
      setError(null)
    } else {
      setError({ message: r.message, fix: r.fix, detail: r.detail })
    }
    setPending(await window.couchkit.pendingChange())
    const list = await window.couchkit.listScreensavers()
    setSavers(list.ok ? list.options : null)
  }, [])

  useEffect(() => {
    if (connected !== null) void refresh()
  }, [connected, refresh])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), pending === null ? 1000 : 250)
    return () => clearInterval(id)
  }, [pending])

  // When the countdown ends the main process has already undone the change; show the real state.
  const expired = pending !== null && now >= pending.deadline
  useEffect(() => {
    if (expired) {
      const t = setTimeout(() => {
        setPending(null)
        setNote('The change was undone because it was not kept.')
        void refresh()
      }, 1500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [expired, refresh])

  const finish = async (r: ApplyTweakResult): Promise<void> => {
    if (r.ok) {
      setError(null)
      setNote('')
      setPending(r.pending ?? null)
    } else {
      setError({ message: r.message, fix: r.fix, detail: r.detail })
    }
    await refresh()
    setBusy(false)
  }

  const choose = async (tweakId: string, choiceId: string): Promise<void> => {
    setBusy(true)
    await finish(await window.couchkit.applyTweak(tweakId, choiceId))
  }

  const setDensity = async (value: number | 'reset'): Promise<void> => {
    setBusy(true)
    await finish(await window.couchkit.applyDensity(value))
  }

  const setSaver = async (component: string): Promise<void> => {
    setBusy(true)
    const r = await window.couchkit.setScreensaver(component)
    if (!r.ok) setError({ message: r.message, fix: r.fix, detail: r.detail })
    else setError(null)
    await refresh()
    setBusy(false)
  }

  const setClock = async (): Promise<void> => {
    setBusy(true)
    const r = await window.couchkit.setClockFromComputer()
    setClockNote(r.ok ? { ok: true, text: r.detail, fix: '' } : { ok: false, text: r.message, fix: r.fix })
    setBusy(false)
  }

  if (connected === null) {
    return (
      <>
        <h2>Tune-ups</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const autoTimeOn = snapshot?.tweaks.find((x) => x.id === 'autotime')?.choice === 'on'
  const rawSaver = snapshot?.tweaks.find((x) => x.id === 'screensaver')?.values['component'] ?? 'null'
  const currentSaver = rawSaver === 'null' || rawSaver === '' ? null : (rawSaver.split(',')[0] ?? null)
  const seconds = pending === null ? 0 : Math.max(0, Math.ceil((pending.deadline - now) / 1000))
  const density = snapshot?.density ?? null
  const customNumber = Number(custom)

  return (
    <>
      <h2>Tune-ups</h2>
      <p className="muted">Change common TV settings without digging through menus. Every change can be switched back.</p>

      {pending !== null && (
        <div className="card warn" role="status">
          <p>
            <strong>{pending.label}</strong> — keep this change? {seconds > 0 ? `Undoing in ${seconds} s.` : 'Undoing…'}
          </p>
          <p className="muted">If the screen looks wrong, just wait: it goes back by itself.</p>
          <div className="row">
            <button
              type="button"
              className="primary"
              onClick={() => void window.couchkit.keepChange().then(() => setPending(null))}
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() =>
                void window.couchkit.undoChange().then(() => {
                  setPending(null)
                  return refresh()
                })
              }
            >
              Undo now
            </button>
          </div>
        </div>
      )}

      {note !== '' && <p className="muted">{note}</p>}

      {error !== null && (
        <div className="card error" role="alert">
          <p>
            <strong>{error.message}</strong>
          </p>
          {error.fix !== '' && <p>{error.fix}</p>}
          {error.detail !== '' && (
            <details>
              <summary>Technical details</summary>
              <pre>{error.detail}</pre>
            </details>
          )}
        </div>
      )}

      <div className="row">
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {GROUPS.map((group) => (
        <section key={group}>
          <h3>{group}</h3>
          {cardsFor(group).map((card) => (
            <div className="card tweak" key={card.title}>
              <p>
                <strong>{card.title}</strong>
              </p>
              {card.tweaks.map((t) => {
                const active = snapshot?.tweaks.find((x) => x.id === t.id)?.choice ?? null
                return (
                  <div className={card.tweaks.length > 1 ? 'subtweak' : ''} key={t.id}>
                    {card.tweaks.length > 1 && (
                      <p>
                        <strong>{t.title}</strong>
                      </p>
                    )}
                    <p className="muted">{t.help}</p>
                    <div className="row">
                      {t.choices.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          className={active === c.id ? 'primary' : ''}
                          aria-pressed={active === c.id}
                          disabled={busy}
                          onClick={() => void choose(t.id, c.id)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    {snapshot !== null && active === null && <p className="muted">Currently set to something else.</p>}
                  </div>
                )
              })}

              {card.title === 'Screen off and screen saver' && (
                <div className="subtweak">
                  <p>
                    <strong>Screen saver app</strong>
                  </p>
                  <p className="muted">
                    Choose which app shows when the TV is idle (for example Aerial Views, if you installed it).
                    {currentSaver === null ? ' Now: the TV\'s own screen saver.' : ` Now: ${currentSaver}.`}
                  </p>
                  {savers === null || savers.length === 0 ? (
                    <p className="muted">No other screen saver apps were found on this TV.</p>
                  ) : (
                    <div className="row">
                      {savers.map((o) => (
                        <button
                          type="button"
                          key={o.component}
                          className={o.component === currentSaver ? 'primary' : ''}
                          aria-pressed={o.component === currentSaver}
                          disabled={busy}
                          title={o.component}
                          onClick={() => void setSaver(o.component)}
                        >
                          {o.packageName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {card.title === 'Date and time' && (
                <div className="subtweak">
                  <p>
                    <strong>Set the clock yourself</strong>
                  </p>
                  <p className="muted">
                    Copies this computer's time ({new Date(now).toLocaleTimeString()}, {Intl.DateTimeFormat().resolvedOptions().timeZone}) to the TV.
                    {autoTimeOn ? ' Turn "Set date and time automatically" Off first.' : ' Some TVs refuse this.'}
                  </p>
                  <div className="row">
                    <button type="button" disabled={busy || autoTimeOn} onClick={() => void setClock()}>
                      Set TV clock to this computer
                    </button>
                  </div>
                  {clockNote !== null && (
                    <p className={clockNote.ok ? 'muted' : 'warn'}>
                      {clockNote.text} {clockNote.fix}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {group === 'Display' && (
            <div className="card tweak">
              <p>
                <strong>Screen density</strong>
              </p>
              <p className="muted">
                Makes everything on screen smaller (higher number) or bigger (lower number).
                {density !== null && ` Now ${density.current}; the TV's own value is ${density.physical}.`}
              </p>
              {density === null ? (
                <p className="muted">This TV did not report its density.</p>
              ) : (
                <>
                  <div className="row">
                    <button type="button" disabled={busy} onClick={() => void setDensity(Math.round(density.physical * 0.8))}>
                      Smaller (−20%)
                    </button>
                    <button type="button" disabled={busy} onClick={() => void setDensity('reset')}>
                      TV default
                    </button>
                    <button type="button" disabled={busy} onClick={() => void setDensity(Math.round(density.physical * 1.2))}>
                      Larger (+20%)
                    </button>
                  </div>
                  <div className="row">
                    <input
                      type="number"
                      aria-label="Custom density"
                      min={MIN_DENSITY}
                      max={MAX_DENSITY}
                      value={custom}
                      placeholder={`${MIN_DENSITY}–${MAX_DENSITY}`}
                      onChange={(e) => setCustom(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || !isValidDensity(customNumber)}
                      onClick={() => void setDensity(customNumber)}
                    >
                      Apply
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      ))}
    </>
  )
}
