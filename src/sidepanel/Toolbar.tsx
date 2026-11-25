import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import {
  Bold,
  Code,
  Globe,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Strikethrough,
  TextQuote,
} from 'lucide-react'
import type { ActiveTab } from './useActiveTab'

const ICON = 16

function ToolButton(props: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="tool"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      // Keep the selection in the note when a tool is clicked.
      onMouseDown={(event) => event.preventDefault()}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

/**
 * Turns what was typed into a link address: adds https:// when no scheme was
 * given. Returns null for anything that is not a web or email address.
 */
export function linkAddress(input: string): string | null {
  const typed = input.trim()
  const address = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`
  return /^(https?:\/\/|mailto:)\S+$/i.test(address) ? address : null
}

export function Toolbar({ editor, tab }: { editor: Editor; tab: ActiveTab }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      bullets: editor.isActive('bulletList'),
      numbers: editor.isActive('orderedList'),
      tasks: editor.isActive('taskList'),
      quote: editor.isActive('blockquote'),
      link: editor.isActive('link'),
    }),
  })

  // null while the link row is closed, otherwise what is typed in it.
  const [typedAddress, setTypedAddress] = useState<string | null>(null)
  const [addressRefused, setAddressRefused] = useState(false)
  const addressInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (typedAddress !== null) addressInput.current?.select()
    // Only when the link row opens, not on every keystroke in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedAddress === null])

  const pageUrl = tab.url && /^https?:/.test(tab.url) ? tab.url : undefined

  const applyLink = (event: FormEvent) => {
    event.preventDefault()
    const typed = (typedAddress ?? '').trim()
    const href = typed ? linkAddress(typed) : ''
    if (href === null) {
      setAddressRefused(true)
      return
    }
    setTypedAddress(null)
    const chain = editor.chain().focus()
    if (!href) {
      chain.extendMarkRange('link').unsetLink().run()
    } else if (editor.state.selection.empty && !editor.isActive('link')) {
      chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
    } else {
      chain.extendMarkRange('link').setLink({ href }).run()
    }
  }

  const insertPageLink = () => {
    if (!pageUrl) return
    editor
      .chain()
      .focus()
      .insertContent([
        { type: 'text', text: tab.title?.trim() || pageUrl, marks: [{ type: 'link', attrs: { href: pageUrl } }] },
        { type: 'text', text: ' ' },
      ])
      .run()
  }

  const run = () => editor.chain().focus()

  return (
    <div className="toolbar-area">
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        <ToolButton label="Bold" active={active.bold} onClick={() => run().toggleBold().run()}>
          <Bold size={ICON} />
        </ToolButton>
        <ToolButton label="Italic" active={active.italic} onClick={() => run().toggleItalic().run()}>
          <Italic size={ICON} />
        </ToolButton>
        <ToolButton label="Strikethrough" active={active.strike} onClick={() => run().toggleStrike().run()}>
          <Strikethrough size={ICON} />
        </ToolButton>
        <ToolButton label="Code" active={active.code} onClick={() => run().toggleCode().run()}>
          <Code size={ICON} />
        </ToolButton>
        <span className="tool-gap" />
        <ToolButton label="Heading" active={active.h1} onClick={() => run().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={ICON} />
        </ToolButton>
        <ToolButton label="Subheading" active={active.h2} onClick={() => run().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={ICON} />
        </ToolButton>
        <span className="tool-gap" />
        <ToolButton label="Bulleted list" active={active.bullets} onClick={() => run().toggleBulletList().run()}>
          <List size={ICON} />
        </ToolButton>
        <ToolButton label="Numbered list" active={active.numbers} onClick={() => run().toggleOrderedList().run()}>
          <ListOrdered size={ICON} />
        </ToolButton>
        <ToolButton label="Checklist" active={active.tasks} onClick={() => run().toggleTaskList().run()}>
          <ListChecks size={ICON} />
        </ToolButton>
        <ToolButton label="Quote" active={active.quote} onClick={() => run().toggleBlockquote().run()}>
          <TextQuote size={ICON} />
        </ToolButton>
        <span className="tool-gap" />
        <ToolButton
          label={active.link ? 'Edit link' : 'Add link'}
          active={active.link || typedAddress !== null}
          onClick={() => {
            setAddressRefused(false)
            setTypedAddress(typedAddress === null ? ((editor.getAttributes('link').href as string) ?? '') : null)
          }}
        >
          <Link2 size={ICON} />
        </ToolButton>
        <ToolButton label="Insert a link to the page in this tab" disabled={!pageUrl} onClick={insertPageLink}>
          <Globe size={ICON} />
        </ToolButton>
      </div>

      {typedAddress !== null && (
        <form className="link-row" onSubmit={applyLink}>
          <input
            ref={addressInput}
            className="link-input"
            type="text"
            inputMode="url"
            aria-label="Link address"
            placeholder="Paste or type a link address"
            value={typedAddress}
            aria-invalid={addressRefused}
            onChange={(event) => {
              setAddressRefused(false)
              setTypedAddress(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setTypedAddress(null)
                editor.commands.focus()
              }
            }}
          />
          <button className="text-button" type="submit">
            {typedAddress.trim() ? 'Apply' : active.link ? 'Remove link' : 'Close'}
          </button>
        </form>
      )}
      {typedAddress !== null && addressRefused && (
        <p className="link-error" role="alert">
          That is not a web or email address. Use one like example.com or mailto:name@example.com.
        </p>
      )}
    </div>
  )
}
