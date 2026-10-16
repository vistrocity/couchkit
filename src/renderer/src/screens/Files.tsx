import { useCallback, useEffect, useState, type DragEvent, type FormEvent, type JSX } from 'react'
import { FILE_SHORTCUTS, FILES_ROOT, breadcrumbs, formatSize, parentRemotePath, isDeletablePath } from '@shared/tvpath'
import type { ActionResult, DeviceInfo, FileEntry, ListFilesResult, TransferProgress, TransferResult } from '@shared/types'

interface Props {
  connected: DeviceInfo | null
  onGoToConnect: () => void
}

type ListFailure = Extract<ListFilesResult, { ok: false }>

export function Files({ connected, onGoToConnect }: Props): JSX.Element {
  const [path, setPath] = useState(FILES_ROOT)
  const [entries, setEntries] = useState<FileEntry[] | null>(null)
  const [listFailure, setListFailure] = useState<ListFailure | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<ActionResult | null>(null)
  const [uploadResults, setUploadResults] = useState<TransferResult[]>([])
  const [progress, setProgress] = useState<TransferProgress | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [dragging, setDragging] = useState(false)

  const load = useCallback(async (target: string): Promise<void> => {
    setLoading(true)
    const result = await window.couchkit.listFiles(target)
    setLoading(false)
    if (result.ok) {
      setPath(result.path)
      setEntries(result.entries)
      setListFailure(null)
    } else {
      setListFailure(result)
    }
  }, [])

  useEffect(() => {
    if (connected !== null) void load(FILES_ROOT)
  }, [connected, load])

  useEffect(() => window.couchkit.onTransferProgress(setProgress), [])

  if (connected === null) {
    return (
      <>
        <h2>Files</h2>
        <div className="card">
          <p>Connect to your TV first.</p>
          <button type="button" className="primary" onClick={onGoToConnect}>
            Go to Connect
          </button>
        </div>
      </>
    )
  }

  const upload = async (paths: string[]): Promise<void> => {
    if (paths.length === 0) return
    setNotice(null)
    setUploadResults([])
    setProgress({ index: 1, total: paths.length, name: '' })
    const results = await window.couchkit.uploadToTv(path, paths)
    setProgress(null)
    setUploadResults(results)
    void load(path)
  }

  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files)
    const paths: string[] = []
    for (const file of files) {
      try {
        const p = window.couchkit.pathForFile(file)
        if (p !== '') paths.push(p)
      } catch {
        // handled below
      }
    }
    if (paths.length === 0) {
      setNotice({
        ok: false,
        category: 'other',
        message: 'Couchkit could not read where that file is on your computer.',
        fix: 'Use the "Upload files…" button instead.',
        detail: `files dropped: ${files.length}`
      })
      return
    }
    void upload(paths)
  }

  const run = async (key: string, action: () => Promise<ActionResult>, reload = true): Promise<void> => {
    setBusyAction(key)
    setNotice(null)
    setUploadResults([])
    const result = await action()
    setBusyAction(null)
    setConfirmDelete(null)
    // An empty message means the person cancelled a dialog: show nothing.
    if (result.ok || result.message !== '') setNotice(result)
    if (reload) void load(path)
  }

  const createFolder = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    await run('mkdir', () => window.couchkit.makeFolder(path, folderName))
    setCreating(false)
    setFolderName('')
  }

  const open = (entry: FileEntry): void => {
    if (entry.kind !== 'file') {
      setNotice(null)
      void load(entry.path)
    }
  }

  const crumbs = breadcrumbs(path)

  return (
    <div
      className="files-page"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <h2>Files</h2>
      <p className="muted">Browse the TV&apos;s storage, and copy files between the TV and this computer.</p>

      <div className="row shortcuts">
        {FILE_SHORTCUTS.map((s) => (
          <button key={s.path} type="button" className={s.path === path ? 'chip active' : 'chip'} onClick={() => void load(s.path)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="row toolbar">
        <button type="button" disabled={path === '/' || loading} onClick={() => void load(parentRemotePath(path))} title="Go up one folder">
          ↑ Up
        </button>
        <nav className="crumbs grow" aria-label="Current folder on the TV">
          <button type="button" className="crumb" onClick={() => void load('/')}>
            TV
          </button>
          {crumbs.map((c) => (
            <span key={c.path}>
              <span className="muted"> / </span>
              <button type="button" className="crumb" onClick={() => void load(c.path)}>
                {c.name}
              </button>
            </span>
          ))}
        </nav>
        <button type="button" disabled={loading} onClick={() => void load(path)}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className={dragging ? 'dropzone compact dragging' : 'dropzone compact'}>
        <div className="row center">
          <span>
            <strong>Drop files or folders here</strong> to copy them into <code>{path}</code>
          </span>
          <button type="button" disabled={progress !== null} onClick={() => void window.couchkit.pickUploads('files').then(upload)}>
            Upload files…
          </button>
          <button type="button" disabled={progress !== null} onClick={() => void window.couchkit.pickUploads('folder').then(upload)}>
            Upload folder…
          </button>
          <button type="button" onClick={() => setCreating(true)}>
            New folder…
          </button>
        </div>
        {progress !== null && (
          <p role="status">
            Copying {progress.index} of {progress.total}
            {progress.name !== '' ? `: ${progress.name}` : ''}… large files can take a while.
          </p>
        )}
      </div>

      {creating && (
        <form className="card row" onSubmit={(e) => void createFolder(e)}>
          <label className="sr-only" htmlFor="new-folder">
            New folder name
          </label>
          <input id="new-folder" type="text" className="grow" value={folderName} maxLength={200} placeholder={`New folder inside ${path}`} onChange={(e) => setFolderName(e.target.value)} autoFocus />
          <button type="submit" className="primary" disabled={folderName.trim() === '' || busyAction !== null}>
            Create
          </button>
          <button type="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}

      {uploadResults.length > 0 && (
        <ul className="results">
          {uploadResults.map((r, i) => (
            <li key={`${r.name}-${i}`} className={r.ok ? 'ok' : 'warn'}>
              <strong>{r.name}</strong>: {r.message} {r.fix}
            </li>
          ))}
        </ul>
      )}

      {notice !== null && (
        <div className={notice.ok ? 'card' : 'card error'} role={notice.ok ? 'status' : 'alert'}>
          {notice.ok ? (
            <p className="ok">{notice.detail}</p>
          ) : (
            <>
              <p>
                <strong>{notice.message}</strong>
              </p>
              <p>{notice.fix}</p>
              {notice.detail !== '' && (
                <details>
                  <summary>Technical details</summary>
                  <pre>{notice.detail}</pre>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {listFailure !== null && (
        <div className="card error" role="alert">
          <p>
            <strong>{listFailure.message}</strong>
          </p>
          <p>{listFailure.fix}</p>
          {listFailure.detail !== '' && (
            <details>
              <summary>Technical details</summary>
              <pre>{listFailure.detail}</pre>
            </details>
          )}
        </div>
      )}

      {entries !== null && entries.length === 0 && listFailure === null && <p className="muted">This folder is empty.</p>}

      <ul className="filelist">
        {(entries ?? []).map((entry) => (
          <li key={entry.path} className="file-row">
            <button type="button" className="file-name" disabled={entry.kind === 'file'} onClick={() => open(entry)}>
              <span aria-hidden="true">{entry.kind === 'file' ? '📄' : '📁'}</span> {entry.name}
              {entry.kind === 'link' ? ' ↪' : ''}
            </button>
            <span className="muted small file-meta">{entry.size !== undefined ? formatSize(entry.size) : ''}</span>
            <span className="muted small file-meta">{entry.modified ?? ''}</span>
            {confirmDelete === entry.path ? (
              <div className="row">
                <span className="small">Delete {entry.kind === 'file' ? 'this file' : 'this folder and everything in it'}?</span>
                <button type="button" className="primary" disabled={busyAction !== null} onClick={() => void run('delete', () => window.couchkit.deleteFromTv(entry.path))}>
                  Yes
                </button>
                <button type="button" onClick={() => setConfirmDelete(null)}>
                  No
                </button>
              </div>
            ) : (
              <div className="row">
                <button type="button" disabled={busyAction !== null} onClick={() => void run('download', () => window.couchkit.downloadFromTv(entry.path), false)}>
                  {busyAction === 'download' ? 'Copying…' : 'Download'}
                </button>
                <button type="button" disabled={busyAction !== null || !isDeletablePath(entry.path)} title={isDeletablePath(entry.path) ? 'Delete' : 'Protected'} onClick={() => setConfirmDelete(entry.path)}>
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
