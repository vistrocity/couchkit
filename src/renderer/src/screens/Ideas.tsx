import type { JSX } from 'react'
import { APP_IDEAS } from '@shared/ideas'

/** A short list of free, open-source apps. Each button opens the project's own page in your browser. */
export function Ideas(): JSX.Element {
  return (
    <>
      <h2>App ideas</h2>
      <p className="muted">
        Free, open-source apps that work well on a TV. Each button opens the project's own page in your web browser, where you can find the download. Install what you download by dropping the .apk file on the Apps page (or look for the app in your TV's app store). Couchkit installs nothing by itself.
      </p>
      {APP_IDEAS.map((idea) => (
        <div className="card tweak" key={idea.id}>
          <p>
            <strong>{idea.name}</strong>
          </p>
          <p className="muted">{idea.what}</p>
          <div className="row">
            <button type="button" onClick={() => void window.couchkit.openIdea(idea.id)}>
              Open project page
            </button>
          </div>
        </div>
      ))}
    </>
  )
}
