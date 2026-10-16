import { useCallback, useEffect, useState, type JSX } from 'react'
import type { AdbStatus, AppInfo, DeviceInfo, HistoryEntry } from '@shared/types'
import { Activity } from './screens/Activity'
import { Capture } from './screens/Capture'
import { Connect } from './screens/Connect'
import { Console, type ConsoleRun } from './screens/Console'
import { Apps } from './screens/Apps'
import { Files } from './screens/Files'
import { Home } from './screens/Home'
import { Remote } from './screens/Remote'
import { Tune } from './screens/Tune'
import { Cleanup } from './screens/Cleanup'
import { Backup } from './screens/Backup'
import { Restart } from './screens/Restart'
import { Launcher } from './screens/Launcher'
import { Ideas } from './screens/Ideas'
import { Icon } from './components/Icon'
import { Appearance } from './screens/Appearance'
import { DEFAULT_ACCENT, DEFAULT_THEME, type ThemeId } from '@shared/appearance'

/** Sidebar sections, in groups. */
const SECTIONS = [
  { id: 'home', label: 'Home', icon: 'home', group: 'Start' },
  { id: 'connect', label: 'Connect', icon: 'plug', group: 'Start' },
  { id: 'remote', label: 'Remote', icon: 'remote', group: 'Use your TV' },
  { id: 'apps', label: 'Apps', icon: 'grid', group: 'Use your TV' },
  { id: 'files', label: 'Files', icon: 'folder', group: 'Use your TV' },
  { id: 'capture', label: 'Capture', icon: 'camera', group: 'Use your TV' },
  { id: 'tune', label: 'Tune-ups', icon: 'sliders', group: 'Look after it' },
  { id: 'cleanup', label: 'Cleanup', icon: 'sparkle', group: 'Look after it' },
  { id: 'backup', label: 'Backup', icon: 'archive', group: 'Look after it' },
  { id: 'launcher', label: 'Launcher', icon: 'layout', group: 'Look after it' },
  { id: 'restart', label: 'Restart', icon: 'power', group: 'Look after it' },
  { id: 'ideas', label: 'App ideas', icon: 'bulb', group: 'More' },
  { id: 'console', label: 'Console', icon: 'terminal', group: 'More' },
  { id: 'log', label: 'Activity', icon: 'list', group: 'More' },
  { id: 'look', label: 'Appearance', icon: 'palette', group: 'More' }
] as const

const GROUPS = ['Start', 'Use your TV', 'Look after it', 'More'] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function App(): JSX.Element {
  const [section, setSection] = useState<SectionId>('home')
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [adb, setAdb] = useState<AdbStatus | null>(null)
  const [connected, setConnected] = useState<DeviceInfo | null>(null)
  const [focusToken, setFocusToken] = useState(0)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  // Console work is kept here so it survives switching tabs. It is cleared when the TV changes or disconnects.
  const [consoleCommand, setConsoleCommand] = useState('')
  const [consoleRuns, setConsoleRuns] = useState<ConsoleRun[]>([])
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME)
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT)
  const connectedSerial = connected?.serial ?? null

  useEffect(() => {
    void window.couchkit.getSettings().then((s) => {
      setTheme(s.theme)
      setAccent(s.accent)
    })
  }, [])

  // Put the chosen look on the page. "System" follows the computer's light or dark setting live.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.dataset['theme'] = dark ? 'dark' : 'light'
      document.documentElement.dataset['accent'] = accent
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme, accent])

  const changeAppearance = (t: ThemeId, a: string): void => {
    setTheme(t)
    setAccent(a)
    void window.couchkit.setAppearance(t, a)
  }
  // The name shown for the TV: the nickname you gave it, else its model, else its address.
  const nickname = connected !== null ? history.find((h) => h.id === connected.serial)?.nickname : undefined
  const tvName = connected !== null ? (nickname ?? connected.model ?? connected.host) : ''
  useEffect(() => {
    void window.couchkit.listHistory().then(setHistory)
  }, [connectedSerial])
  useEffect(() => {
    setConsoleRuns([])
  }, [connectedSerial])

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
        <h1 className="brand">
          <span className="logo" aria-hidden="true">C</span>
          Couchkit
        </h1>
        {GROUPS.map((group) => (
          <div key={group}>
            <p className="nav-group">{group}</p>
            <ul>
              {SECTIONS.filter((s) => s.group === group).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={s.id === section ? 'nav active' : 'nav'}
                    aria-current={s.id === section ? 'page' : undefined}
                    onClick={() => setSection(s.id)}
                  >
                    <Icon name={s.icon} size={17} />
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="main">
        <header className="statusbar" aria-live="polite">
          {connected !== null ? (
            <span className="ok">
              ● Connected to {tvName} ({connected.host})
            </span>
          ) : (
            <span className="muted">○ Not connected</span>
          )}
        </header>

        <main className="content">
          {section === 'home' && (
            <Home info={info} adb={adb} onAdbChanged={refreshAdb} onGoToConnect={() => setSection('connect')} onGo={(id) => setSection(id as SectionId)} connected={connected} tvName={tvName} />
          )}
          {section === 'connect' && (
            <Connect
              adb={adb}
              connected={connected}
              focusToken={focusToken}
              onAdbChanged={refreshAdb}
              onConnected={setConnected}
              history={history}
              onHistoryChange={setHistory}
            />
          )}
          {section === 'remote' && <Remote connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'apps' && <Apps connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'launcher' && <Launcher connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'restart' && <Restart connected={connected} onGoToConnect={() => setSection('connect')} onRestarted={() => setConnected(null)} />}
          {section === 'ideas' && <Ideas />}
          {section === 'look' && <Appearance theme={theme} accent={accent} onChange={changeAppearance} />}
          {section === 'backup' && <Backup connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'cleanup' && <Cleanup connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'tune' && <Tune connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'capture' && <Capture connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'console' && <Console
              connected={connected}
              onGoToConnect={() => setSection('connect')}
              tvName={tvName}
              command={consoleCommand}
              onCommandChange={setConsoleCommand}
              runs={consoleRuns}
              onRunsChange={setConsoleRuns}
            />}
          {section === 'files' && <Files connected={connected} onGoToConnect={() => setSection('connect')} />}
          {section === 'log' && <Activity />}
        </main>
      </div>
    </div>
  )
}
