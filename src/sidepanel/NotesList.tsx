import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { downloadMarkdown, notesToMarkdownFile } from '../lib/markdown'
import { GENERAL_KEY, siteFromKey, siteHue } from '../lib/site'
import { deleteNote, listNotes, type Note } from '../lib/storage'

function whenEdited(timestamp: number): string {
  const edited = new Date(timestamp)
  const today = new Date().toDateString() === edited.toDateString()
  return today
    ? edited.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : edited.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function NotesList({ onOpen }: { onOpen: (siteKey: string) => void }) {
  const [notes, setNotes] = useState<Note[]>()
  const [deleting, setDeleting] = useState<string | null>(null)
  const rows = useRef<HTMLUListElement>(null)

  useEffect(() => {
    let live = true
    let latest = 0
    const refresh = () => {
      // Only the newest read counts: an older one may answer late.
      const request = ++latest
      return listNotes().then(
        (found) => live && request === latest && setNotes(found),
        () => live && request === latest && setNotes([]),
      )
    }
    const onChanged = (_changes: object, area: string) => {
      if (area === 'local') void refresh()
    }
    void refresh()
    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      live = false
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [])

  if (!notes) return <div className="list" />

  if (notes.length === 0) {
    return (
      <div className="list">
        <p className="empty">No notes yet. Open a site and start typing in the panel. Notes save on their own.</p>
      </div>
    )
  }

  return (
    <div className="list">
      <ul className="list-rows" ref={rows} tabIndex={-1}>
        {notes.map((note) => {
          const site = siteFromKey(note.site)
          const dot = {
            '--site-hue': siteHue(note.site),
            '--site-chroma': note.site === GENERAL_KEY ? 0.02 : 0.15,
          } as CSSProperties
          return (
            <li key={note.site} className="row" style={dot}>
              {deleting === note.site ? (
                <div className="row-confirm">
                  <span>Delete the note for {site.label}?</span>
                  <button
                    className="text-button danger"
                    onClick={() => {
                      setDeleting(null)
                      void deleteNote(note.site)
                      // The row is about to go: keep keyboard focus in the list.
                      rows.current?.focus()
                    }}
                  >
                    Delete
                  </button>
                  <button className="text-button" onClick={() => setDeleting(null)} autoFocus>
                    Keep
                  </button>
                </div>
              ) : (
                <>
                  <button className="row-open" onClick={() => onOpen(note.site)}>
                    <span className="row-head">
                      <span className="site-dot" aria-hidden="true" />
                      <span className="row-name">{site.label}</span>
                      <time className="row-time" dateTime={new Date(note.updatedAt).toISOString()}>
                        {whenEdited(note.updatedAt)}
                      </time>
                    </span>
                    <span className="row-preview">{note.preview || 'No text'}</span>
                  </button>
                  <button
                    className="icon-button row-delete"
                    onClick={() => setDeleting(note.site)}
                    title={`Delete the note for ${site.label}`}
                    aria-label={`Delete the note for ${site.label}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <footer className="footer">
        <p className="status">{notes.length === 1 ? '1 note' : `${notes.length} notes`}</p>
        <button
          className="export-button"
          onClick={() => downloadMarkdown('all-notes.md', notesToMarkdownFile(notes))}
          title="Download every note in one Markdown file"
        >
          <Download size={15} aria-hidden="true" /> Export all as Markdown
        </button>
      </footer>
    </div>
  )
}
