import type { JSX } from 'react'
import type { AdbStatus, AppInfo } from '@shared/types'
import { AdbCard } from '../components/AdbCard'

interface Props {
  info: AppInfo | null
  adb: AdbStatus | null
  onAdbChanged: () => void
  onGoToConnect: () => void
}

export function Home({ info, adb, onAdbChanged, onGoToConnect }: Props): JSX.Element {
  return (
    <>
      <h2>Welcome to Couchkit</h2>
      <p className="muted">A toolbox for your Google TV or Android TV, on {osName(info)}.</p>

      <AdbCard adb={adb} onChanged={onAdbChanged} />

      {adb?.found === true && (
        <p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Connect to your TV
          </button>
        </p>
      )}

      {info && (
        <p className="muted small">
          Version {info.appVersion}. Press <kbd>{info.shortcutModifier}</kbd>+<kbd>K</kbd> to jump to the TV address
          box.
        </p>
      )}
    </>
  )
}

function osName(info: AppInfo | null): string {
  if (info === null) return 'your computer'
  return info.os === 'darwin' ? 'macOS' : info.os === 'win32' ? 'Windows' : 'Linux'
}
