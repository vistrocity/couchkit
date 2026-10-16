import { useEffect, useState, type JSX } from 'react'
import type { AdbStatus, AppInfo, DeviceInfo } from '@shared/types'
import type { HardwareInfo } from '@shared/hardware'
import { formatKb } from '@shared/cleanup'
import { ABOUT, ABOUT_LINKS } from '@shared/about'
import { AdbCard } from '../components/AdbCard'

interface Props {
  info: AppInfo | null
  adb: AdbStatus | null
  onAdbChanged: () => void
  onGoToConnect: () => void
  onGo: (section: string) => void
  connected: DeviceInfo | null
  tvName: string
}

const TILES = [
  { id: 'remote', name: 'Remote', what: 'Use your keyboard as the TV remote.' },
  { id: 'apps', name: 'Apps', what: 'Install, open, clear or remove apps.' },
  { id: 'files', name: 'Files', what: 'Send files to the TV and fetch them back.' },
  { id: 'capture', name: 'Capture', what: 'Screenshots and screen recordings.' },
  { id: 'tune', name: 'Tune-ups', what: 'Animations, text size, screen saver, HDMI-CEC.' },
  { id: 'cleanup', name: 'Cleanup', what: 'Free up space and close background apps.' },
  { id: 'backup', name: 'Backup', what: 'Save your apps to the computer and restore them.' },
  { id: 'launcher', name: 'Launcher', what: 'Keep your favourite home screen in charge.' }
] as const

export function Home({ info, adb, onAdbChanged, onGoToConnect, onGo, connected, tvName }: Props): JSX.Element {
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const serial = connected?.serial ?? null
  useEffect(() => {
    setHardware(null)
    if (serial === null) return
    let cancelled = false
    void window.couchkit.readHardware().then((r) => {
      if (!cancelled && r.ok) setHardware(r.hardware)
    })
    return () => {
      cancelled = true
    }
  }, [serial])

  return (
    <>
      {connected !== null && (
        <div className="tv-banner">
          <div className="tv-banner-main">
            <span className="tv-dot" aria-hidden="true" />
            <div>
              <strong>{tvName}</strong>
              <div className="muted small">
                {[connected.manufacturer, connected.model].filter(Boolean).join(' ')} · {connected.host}
              </div>
            </div>
          </div>
          <dl className="tv-facts">
            <div><dt>Android</dt><dd>{connected.androidVersion ?? '—'}</dd></div>
            <div><dt>Screen</dt><dd>{connected.resolution ?? '—'}</dd></div>
            <div><dt>Memory</dt><dd>{hardware?.ramKb != null ? formatKb(hardware.ramKb) : '…'}</dd></div>
            <div><dt>Storage free</dt><dd>{hardware?.storage != null ? `${formatKb(hardware.storage.freeKb)} of ${formatKb(hardware.storage.totalKb)}` : '…'}</dd></div>
          </dl>
          <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onGo('remote')}>Remote</button>
            <button type="button" onClick={() => onGo('apps')}>Apps</button>
            <button type="button" onClick={() => onGo('cleanup')}>Free up space</button>
          </div>
        </div>
      )}

      <div className="hero">
        <h2>Welcome to {ABOUT.name}</h2>
        <p>
          {ABOUT.tagline} Everything runs on your computer and talks only to your TV over your home network, on{' '}
          {osName(info)}.
        </p>
        {adb?.found === true && connected === null && (
          <div className="row">
            <button type="button" className="primary" onClick={onGoToConnect}>
              Connect to your TV
            </button>
            {info && (
              <span className="muted small" style={{ alignSelf: 'center' }}>
                Tip: press <kbd>{info.shortcutModifier}</kbd>+<kbd>K</kbd> to jump to the TV address box.
              </span>
            )}
          </div>
        )}
      </div>

      <AdbCard adb={adb} onChanged={onAdbChanged} />

      <div className="card wide">
        <h3>Getting started</h3>
        <ol className="steps">
          <li>On the TV, turn on Developer options, then USB debugging or Network debugging.</li>
          <li>Find the TV's address in its Wi-Fi or network settings (it looks like 192.168.1.50).</li>
          <li>Open Connect, type the address and press Connect. Accept the prompt on the TV (tick "Always allow").</li>
        </ol>
      </div>

      <div className="tiles">
        {TILES.map((t) => (
          <button type="button" className="tile" key={t.id} onClick={() => onGo(t.id)}>
            <strong>{t.name}</strong>
            <span>{t.what}</span>
          </button>
        ))}
      </div>

      <div className="card wide">
        <h3>About {ABOUT.name}</h3>
        <p className="muted">
          Version {info?.appVersion ?? '…'} · Created by {ABOUT.creator} · Free and open source ({ABOUT.licence}).
        </p>
        <p className="muted small">
          No accounts, no tracking and no data leaves your computer. Couchkit downloads Google's adb tool only when you
          say so. It is an independent project and is not made by or affiliated with Google or any TV maker. "Android"
          and "Google TV" are trademarks of Google LLC.
        </p>
        <div className="links">
          {ABOUT_LINKS.map((l) => (
            <button type="button" key={l.id} onClick={() => void window.couchkit.openAboutLink(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function osName(info: AppInfo | null): string {
  if (info === null) return 'your computer'
  return info.os === 'darwin' ? 'macOS' : info.os === 'win32' ? 'Windows' : 'Linux'
}
