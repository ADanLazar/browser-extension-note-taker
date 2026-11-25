import type { JSONContent } from '@tiptap/core'
import { MarkdownManager } from '@tiptap/markdown'
import { noteExtensions } from './extensions'
import { GENERAL_KEY, siteFromKey } from './site'
import type { Note } from './storage'

let manager: MarkdownManager | undefined

/**
 * Text that Markdown would read as a heading, a list item or a divider. The
 * serializer already takes care of quotes, emphasis and other inline syntax.
 */
const BLOCK_START = /^(#{1,6}(\s|$)|[-+](\s|$)|-{3,}\s*$|\d{1,9}[.)](\s|$))/

/**
 * Stands in for a backslash until the note is serialized. The serializer
 * doubles any real backslash in text, so an escape cannot be written directly.
 */
const ESCAPE = '\uE000'

/**
 * A copy of the note that survives the trip to Markdown: plain paragraphs
 * that happen to start like a heading, list or divider are escaped, and link
 * addresses cannot end the link early.
 */
function markdownSafe(node: JSONContent): JSONContent {
  const copy: JSONContent = { ...node }
  if (typeof node.text === 'string') copy.text = node.text.replaceAll(ESCAPE, '')
  if (node.marks) {
    copy.marks = node.marks.map((mark) =>
      mark.type === 'link' && typeof mark.attrs?.href === 'string'
        ? {
            ...mark,
            attrs: {
              ...mark.attrs,
              href: mark.attrs.href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29'),
            },
          }
        : mark,
    )
  }
  if (node.content) {
    copy.content = node.content.map(markdownSafe)
    const first = copy.content[0]
    if (
      node.type === 'paragraph' &&
      first?.type === 'text' &&
      first.text &&
      !first.marks?.some((mark) => mark.type === 'code') &&
      BLOCK_START.test(first.text)
    ) {
      // A backslash only escapes punctuation, so a numbered start is escaped
      // at its "." or ")" and the others at their first character.
      copy.content[0] = { ...first, text: first.text.replace(/^(\d+)?/, `$1${ESCAPE}`) }
    }
  }
  return copy
}

/** The note body as Markdown, with no title. */
export function docToMarkdown(doc: JSONContent): string {
  manager ??= new MarkdownManager({ extensions: noteExtensions })
  return manager.serialize(markdownSafe(doc)).replaceAll(ESCAPE, '\\').trim() + '\n'
}

function noteTitle(siteKey: string): string {
  return siteKey === GENERAL_KEY ? 'General notes' : `Notes on ${siteFromKey(siteKey).label}`
}

/** A whole Markdown file for one note: a title, then the body. */
export function noteToMarkdownFile(siteKey: string, doc: JSONContent): string {
  return `# ${noteTitle(siteKey)}\n\n${docToMarkdown(doc)}`
}

/** One Markdown file holding every note, each under its own title. */
export function notesToMarkdownFile(notes: Pick<Note, 'site' | 'doc'>[]): string {
  return notes.map((note) => noteToMarkdownFile(note.site, note.doc)).join('\n---\n\n')
}

export function markdownFilename(siteKey: string): string {
  const name = siteKey === GENERAL_KEY ? 'general' : siteKey.replace(/[^a-z0-9.-]+/gi, '-')
  return `${name}-notes.md`
}

export function downloadMarkdown(filename: string, markdown: string): void {
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
