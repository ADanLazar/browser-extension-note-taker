import type { JSONContent } from '@tiptap/core'

export interface Note {
  site: string
  doc: JSONContent
  /** First words of the note, for the list of all notes. */
  preview: string
  updatedAt: number
  /** Which open panel wrote this, so a panel can ignore its own writes. */
  writer: string
}

const PREFIX = 'note:'

export const noteStorageKey = (site: string) => PREFIX + site

export async function loadNote(site: string): Promise<Note | undefined> {
  const key = noteStorageKey(site)
  const found = await chrome.storage.local.get(key)
  return found[key] as Note | undefined
}

// saveNote and deleteNote hand the write to the browser before they first
// yield, so a read issued afterwards in the same tick sees the new value.
export async function saveNote(note: Note): Promise<void> {
  await chrome.storage.local.set({ [noteStorageKey(note.site)]: note })
}

export async function deleteNote(site: string): Promise<void> {
  await chrome.storage.local.remove(noteStorageKey(site))
}

export async function listNotes(): Promise<Note[]> {
  const everything = await chrome.storage.local.get(null)
  return Object.entries(everything)
    .filter(([key]) => key.startsWith(PREFIX))
    .map(([, value]) => value as Note)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface Autosaver<T> {
  /** Remember the latest value and save it once typing pauses. */
  schedule(value: T): void
  /** Save now if anything is waiting. Starts the write before returning. */
  flush(): Promise<void>
  /** True while a value is waiting to be saved. */
  hasPending(): boolean
}

export function createAutosaver<T>(options: {
  delay: number
  save: (value: T) => Promise<void>
  onStatus?: (status: SaveStatus) => void
}): Autosaver<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let waiting: { value: T } | undefined
  let latest = 0
  let last: Promise<void> = Promise.resolve()

  const flush = (): Promise<void> => {
    clearTimeout(timer)
    timer = undefined
    if (!waiting) return last
    const { value } = waiting
    waiting = undefined
    const run = ++latest
    let write: Promise<void>
    try {
      write = options.save(value)
    } catch (error) {
      write = Promise.reject(error)
    }
    last = write.then(
      () => {
        if (run === latest && !waiting) options.onStatus?.('saved')
      },
      (error) => {
        console.error('Margin Notes: could not save', error)
        // Keep the value for the next flush, unless newer typing replaced it.
        waiting ??= { value }
        if (run === latest) options.onStatus?.('error')
      },
    )
    return last
  }

  return {
    schedule(value) {
      waiting = { value }
      options.onStatus?.('saving')
      clearTimeout(timer)
      timer = setTimeout(flush, options.delay)
    },
    flush,
    hasPending: () => waiting !== undefined,
  }
}
