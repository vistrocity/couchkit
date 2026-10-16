import { useCallback, useEffect, useState, type JSX } from 'react'
import type { AdbStatus, AppInfo, DeviceInfo } from '@shared/types'
import { Activity } from './screens/Activity'
import { Capture } from './screens/Capture'
import { Connect } from './screens/Connect'
import { Console } from './screens/Console'
import { Apps } from './screens/Apps'
import { Files } from './screens/Files'
import { Home } from './screens/Home'
import { Remote } from './screens/Remote'

/** Sidebar sections. Home, Connect, Remote, Apps, Files, Capture, Console and Activity work; the others come in later updates. */
const SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'connect', label: 'Connect' },
  { id: 'remote', label: 'Remote' },
  { id: 'apps', label: 'Apps' },
  { id: 'files', label: 'Files' },
  { id: 'capture', label: 'Capture' },
  { id: 'console', label: 'Console' },
  { id: 'log', label: 'Activity' }
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function App(): JSX.Element {
  const [section, setSection] = useState<SectionId>('home')
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [adb, setAdb] = useState<AdbStatus | null>(null)
  const [connected, setConnected] = useState<DeviceInfo | null>(null)
  const [focusToken, setFocusToken] = useState(0)

  const refreshAdb = useCallback(() => {
    void window.couchkit.checkAdb().then(setAdb)
  }, [])

  useEffect(() => {
    void window.couchkit.getAppInfo().then(setInfo)
    void window.couchkit.getConnected().then(setConnected)
    refreshAdb()
  }, [refreshAdb])

  // Cmd+K (macOS) or Ctrl+K (Windows): jump to the TV address box.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSection('connect')
        setFocusToken((n) => n + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Sections">
        <h1 className="brand">Couchkit</h1>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={s.id === section ? 'nav active' : 'nav'}
                aria-current={s.id === section ? 'page' : undefined}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="main">
        <header className="statusbar" aria-live="polite">
          {connected !== null ? (
            <span className="ok">
              ● Connected to {connected.model ?? connected.host} ({connected.host})
            </span>
          ) : (
            <span className="muted">○ Not connected</span>
          )}
        </header>

        <main className="content">
          {section === 'home' && (
            <Home info={info} adb={adb} onAdbChanged={refreshAdb} onGoToConnect={() => setSection('connect')} />
          )}
          {section === 'connect' && (
            <Connect
              adb={adb}
              connected={connected}
              focusToken={focusToken}
              onAdbChanged={refreshAdb}
              onConnected={setConnected}
            />
          )}
          {section === 'remote' && <Remote connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'apps' && <Apps connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'capture' && <Capture connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'console' && <Console connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'files' && <Files connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'log' && <Activity />}
          {!['home', 'connect', 'remote', 'apps', 'files', 'capture', 'console', 'log'].includes(section) && (
            <>
              <h2>{SECTIONS.find((s) => s.id === section)?.label}</h2>
              <p className="muted">This section is not built yet.</p>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
