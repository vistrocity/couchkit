import { useState, type JSX } from 'react'

interface Props {
  /** What went wrong, in plain words. */
  message: string
  /** What the person can do about it. */
  fix?: string
  /** The raw technical text, hidden until asked for. */
  detail?: string
}

/** One look for every problem: a plain sentence, what to try, and the technical details on request. */
export function ErrorCard({ message, fix = '', detail = '' }: Props): JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard
      .writeText([message, fix, detail].filter((t) => t !== '').join('\n\n'))
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => undefined)
  }
  return (
    <div className="card error problem" role="alert">
      <span className="problem-icon" aria-hidden="true">!</span>
      <div className="problem-body">
        <p className="problem-title">{message}</p>
        {fix !== '' && (
          <p className="problem-fix">
            <strong>What to try:</strong> {fix}
          </p>
        )}
        {detail !== '' && (
          <details>
            <summary className="small">Technical details</summary>
            <pre>{detail}</pre>
            <button type="button" className="small" onClick={copy}>
              {copied ? 'Copied' : 'Copy details'}
            </button>
          </details>
        )}
      </div>
    </div>
  )
}
