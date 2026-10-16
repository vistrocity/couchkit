import { useEffect, useState, type JSX } from 'react'
import type { AdbStatus, AppInfo } from '@shared/types'

/** Sidebar sections. Only "Home" does something in this first slice. */
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

  useEffect(() => {
    void window.couchkit.getAppInfo().then(setInfo)
    void window.couchkit.checkAdb().then(setAdb)
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

      <main className="content">
        {section === 'home' ? (
          <Home info={info} adb={adb} />
        ) : (
          <ComingSoon name={SECTIONS.find((s) => s.id === section)?.label ?? ''} />
        )}
      </main>
    </div>
  )
}

function Home({ info, adb }: { info: AppInfo | null; adb: AdbStatus | null }): JSX.Element {
  return (
    <>
      <h2>Welcome to Couchkit</h2>
      <p className="muted">A toolbox for your Google TV or Android TV, on {osName(info)}.</p>

      <section className="card" aria-labelledby="adb-heading">
        <h3 id="adb-heading">adb (the tool that talks to your TV)</h3>
        {adb === null ? (
          <p>Checking…</p>
        ) : (
          <p className={adb.found ? 'ok' : 'warn'}>{adb.message}</p>
        )}
      </section>

      {info && (
        <p className="muted small">
          Version {info.appVersion}. Shortcuts use <kbd>{info.shortcutModifier}</kbd>.
        </p>
      )}
    </>
  )
}

function ComingSoon({ name }: { name: string }): JSX.Element {
  return (
    <>
      <h2>{name}</h2>
      <p className="muted">This section is not built yet.</p>
    </>
  )
}

function osName(info: AppInfo | null): string {
  if (info === null) return 'your computer'
  return info.os === 'darwin' ? 'macOS' : info.os === 'win32' ? 'Windows' : 'Linux'
}
