import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { Placeholder } from '@tiptap/extensions'
import { Copy, Download } from 'lucide-react'
import { noteExtensions } from '../lib/extensions'
import { docToMarkdown, downloadMarkdown, markdownFilename, noteToMarkdownFile } from '../lib/markdown'
import { GENERAL_KEY, type Site } from '../lib/site'
import {
  createAutosaver,
  deleteNote,
  loadNote,
  noteStorageKey,
  saveNote,
  type Note,
  type SaveStatus,
} from '../lib/storage'
import { Toolbar } from './Toolbar'
import type { ActiveTab } from './useActiveTab'

/** Identifies this open panel in what it saves. */
const WRITER = crypto.randomUUID()
const SAVE_DELAY_MS = 400

interface Props {
  site: Site
  tab: ActiveTab
}

/** Loads the note for a site, then hands it to the editor. Keyed by site in App. */
export function NotePane({ site, tab }: Props) {
  const [loaded, setLoaded] = useState<{ note: Note | undefined } | 'failed'>()

  useEffect(() => {
    let live = true
    loadNote(site.key).then(
      (note) => live && setLoaded({ note }),
      () => live && setLoaded('failed'),
    )
    return () => {
      live = false
    }
  }, [site.key])

  if (!loaded) return <div className="note" />
  if (loaded === 'failed') {
    return (
      <div className="note">
        <p className="empty">Could not read this note from browser storage. Close the panel and open it again.</p>
      </div>
    )
  }
  return <NoteEditor site={site} tab={tab} initial={loaded.note} />
}

/** Cmd/Ctrl-click opens a link in a new tab. A plain click only places the cursor. */
function openLinkOnModifiedClick(event: MouseEvent): boolean {
  if (!(event.metaKey || event.ctrlKey)) return false
  const link = (event.target as HTMLElement | null)?.closest?.('a')
  const href = link?.getAttribute('href') ?? ''
  if (!/^(https?|mailto):/i.test(href)) return false
  window.open(href, '_blank', 'noopener')
  return true
}

function NoteEditor({ site, tab, initial }: Props & { initial: Note | undefined }) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [confirmation, setConfirmation] = useState('')
  const confirmationTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // The saver is handed the editor and reads the note out of it only when it
  // writes, so typing does not serialise the whole note on every keystroke.
  const saver = useMemo(
    () =>
      createAutosaver<Editor>({
        delay: SAVE_DELAY_MS,
        onStatus: setStatus,
        // An emptied note is removed, so the list of notes holds only real ones.
        save: (editor) =>
          editor.isEmpty
            ? deleteNote(site.key)
            : saveNote({
                site: site.key,
                doc: editor.getJSON(),
                preview: editor.getText({ blockSeparator: ' ' }).trim().slice(0, 140),
                updatedAt: Date.now(),
                writer: WRITER,
              }),
      }),
    [site.key],
  )

  const extensions = useMemo(
    () => [
      ...noteExtensions,
      Placeholder.configure({
        placeholder:
          site.key === GENERAL_KEY
            ? 'Notes for pages that are not on a website…'
            : `Write a note about ${site.label}…`,
      }),
    ],
    [site.key, site.label],
  )

  const editor = useEditor({
    extensions,
    content: initial?.doc ?? '',
    // Take the cursor only if the person is already working in the panel, so
    // switching tabs never pulls their typing away from the page.
    autofocus: document.hasFocus() ? 'end' : false,
    editorProps: {
      attributes: { 'aria-label': `Note for ${site.label}`, spellcheck: 'true' },
      handleClick: (_view, _pos, event) => openLinkOnModifiedClick(event),
    },
    onUpdate: ({ editor }) => saver.schedule(editor),
  })

  // Save at once when the panel is hidden or closed, and when leaving this note.
  useEffect(() => {
    const saveNow = () => void saver.flush()
    const onVisibility = () => document.visibilityState === 'hidden' && saveNow()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', saveNow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', saveNow)
      saveNow()
    }
  }, [saver])

  // Follow edits made to this note in another window's panel.
  useEffect(() => {
    let live = true
    const key = noteStorageKey(site.key)

    const applyRemote = (next: Note | undefined) => {
      if (next?.writer === WRITER) return
      // Typing here that is not saved yet is newer: its save will reach the
      // other window. Taking the remote text now would split the two.
      if (saver.hasPending()) return
      // A removal carries no writer. This panel removes a note when it is
      // emptied, so while it has focus a removal is its own and must not
      // clear what has been typed since.
      if (!next && (editor.isEmpty || document.hasFocus())) return
      editor.commands.setContent(next?.doc ?? '', { emitUpdate: false })
    }

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && key in changes) applyRemote(changes[key].newValue as Note | undefined)
    }
    chrome.storage.onChanged.addListener(onChanged)

    // Catch a change that landed between loading the note and listening.
    loadNote(site.key).then(
      (current) => {
        if (live && current && current.updatedAt !== initial?.updatedAt) applyRemote(current)
      },
      () => {},
    )

    return () => {
      live = false
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [editor, saver, site.key, initial?.updatedAt])

  useEffect(() => () => clearTimeout(confirmationTimer.current), [])

  const isEmpty = useEditorState({ editor, selector: ({ editor }) => editor.isEmpty })

  const confirm = (message: string) => {
    setConfirmation(message)
    clearTimeout(confirmationTimer.current)
    confirmationTimer.current = setTimeout(() => setConfirmation(''), 2500)
  }

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(docToMarkdown(editor.getJSON()))
      confirm('Copied as Markdown')
    } catch {
      confirm('Could not copy. Click the note, then try again.')
    }
  }

  const exportMarkdown = () => {
    const filename = markdownFilename(site.key)
    downloadMarkdown(filename, noteToMarkdownFile(site.key, editor.getJSON()))
    confirm(`Exported ${filename}`)
  }

  // Only confirmations and failures are announced. "Saving…" and "Saved"
  // change with every pause in typing and would be read out constantly.
  const announcement =
    confirmation ||
    (status === 'error'
      ? 'Not saved. Browser storage may be full: export, then delete notes you no longer need.'
      : '')

  return (
    <div className="note">
      <Toolbar editor={editor} tab={tab} />
      <EditorContent className="editor" editor={editor} />
      <footer className="footer">
        <p className={status === 'error' && !confirmation ? 'status status-error' : 'status'}>
          <span role="status">{announcement}</span>
          {!announcement && <span>{status === 'saving' ? 'Saving…' : 'Saved'}</span>}
        </p>
        <button className="icon-button" onClick={copyMarkdown} disabled={isEmpty} title="Copy as Markdown" aria-label="Copy as Markdown">
          <Copy size={16} aria-hidden="true" />
        </button>
        <button className="export-button" onClick={exportMarkdown} disabled={isEmpty} title="Download this note as a Markdown file">
          <Download size={15} aria-hidden="true" /> Export Markdown
        </button>
      </footer>
    </div>
  )
}
