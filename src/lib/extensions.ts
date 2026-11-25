import type { AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'

/**
 * The formatting a note can hold. The editor and the Markdown export share
 * this list, so everything you can write has a Markdown form. Underline is
 * left out for that reason: Markdown has no underline.
 */
export const noteExtensions: AnyExtension[] = [
  StarterKit.configure({
    underline: false,
    heading: { levels: [1, 2, 3] },
    // A plain click places the cursor. The editor opens links on Cmd/Ctrl-click.
    link: { autolink: true, defaultProtocol: 'https', openOnClick: false },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
]
