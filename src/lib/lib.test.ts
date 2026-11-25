import type { JSONContent } from '@tiptap/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { docToMarkdown, markdownFilename, noteToMarkdownFile } from './markdown'
import { GENERAL_KEY, siteFromUrl } from './site'
import { createAutosaver } from './storage'

describe('siteFromUrl', () => {
  it('keys notes by hostname, ignoring www, path and scheme', () => {
    expect(siteFromUrl('https://www.example.com/a/b?c=1').key).toBe('example.com')
    expect(siteFromUrl('http://docs.example.com/').key).toBe('docs.example.com')
  })

  it('uses the general note for pages that are not on a website', () => {
    expect(siteFromUrl('chrome://extensions').key).toBe(GENERAL_KEY)
    expect(siteFromUrl(undefined).key).toBe(GENERAL_KEY)
  })
})

describe('Markdown export', () => {
  const text = (value: string, marks?: JSONContent['marks']): JSONContent => ({
    type: 'text',
    text: value,
    ...(marks && { marks }),
  })
  const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })

  it('writes every kind of formatting the editor offers', () => {
    const markdown = docToMarkdown({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [text('Pricing')] },
        paragraph(
          text('Plain, '),
          text('bold', [{ type: 'bold' }]),
          text(', '),
          text('italic', [{ type: 'italic' }]),
          text(', '),
          text('struck', [{ type: 'strike' }]),
          text(', '),
          text('code', [{ type: 'code' }]),
          text(' and a '),
          text('link', [{ type: 'link', attrs: { href: 'https://example.com/pricing' } }]),
          text('.'),
        ),
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [paragraph(text('first'))] },
            { type: 'listItem', content: [paragraph(text('second'))] },
          ],
        },
        {
          type: 'orderedList',
          attrs: { start: 1 },
          content: [{ type: 'listItem', content: [paragraph(text('step'))] }],
        },
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('done'))] },
            { type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('todo'))] },
          ],
        },
        { type: 'blockquote', content: [paragraph(text('quoted'))] },
        { type: 'codeBlock', attrs: { language: 'js' }, content: [text('const a = 1')] },
      ],
    })

    expect(markdown).toContain('## Pricing')
    expect(markdown).toContain('**bold**')
    expect(markdown).toContain('*italic*')
    expect(markdown).toContain('~~struck~~')
    expect(markdown).toContain('`code`')
    expect(markdown).toContain('[link](https://example.com/pricing)')
    expect(markdown).toContain('- first\n- second')
    expect(markdown).toContain('1. step')
    expect(markdown).toContain('- [x] done')
    expect(markdown).toContain('- [ ] todo')
    expect(markdown).toContain('> quoted')
    expect(markdown).toContain('```js\nconst a = 1\n```')
  })

  it('keeps plain text and link addresses from turning into other Markdown', () => {
    const markdown = docToMarkdown({
      type: 'doc',
      content: [
        paragraph(text('# not a heading')),
        paragraph(text('1. not a list')),
        paragraph(text('- not a bullet')),
        paragraph(text('page', [{ type: 'link', attrs: { href: 'https://example.com/a b_(c)' } }])),
      ],
    })

    expect(markdown).toBe(
      [
        '\\# not a heading',
        '1\\. not a list',
        '\\- not a bullet',
        '[page](https://example.com/a%20b_%28c%29)',
      ].join('\n\n') + '\n',
    )
  })

  it('titles the file with the site and names it after the site', () => {
    const doc = { type: 'doc', content: [paragraph(text('hello'))] }
    expect(noteToMarkdownFile('example.com', doc)).toBe('# Notes on example.com\n\nhello\n')
    expect(markdownFilename('example.com')).toBe('example.com-notes.md')
    expect(markdownFilename(GENERAL_KEY)).toBe('general-notes.md')
  })
})

describe('autosaver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves only the latest value once typing pauses', async () => {
    const save = vi.fn(async (_value: string) => {})
    const saver = createAutosaver({ delay: 400, save })

    saver.schedule('a')
    saver.schedule('ab')
    await vi.advanceTimersByTimeAsync(399)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('ab')
  })

  it('starts a waiting save at once when flushed, and does not save it twice', async () => {
    const save = vi.fn(async (_value: string) => {})
    const saver = createAutosaver({ delay: 400, save })

    saver.schedule('closing')
    void saver.flush()
    expect(save).toHaveBeenCalledWith('closing')

    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('reports saving, then saved, and reports a failed save as an error', async () => {
    const statuses: string[] = []
    let fail = false
    const saver = createAutosaver({
      delay: 400,
      save: async () => {
        if (fail) throw new Error('quota')
      },
      onStatus: (status) => statuses.push(status),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    saver.schedule('ok')
    await saver.flush()
    fail = true
    saver.schedule('too big')
    await saver.flush()

    expect(statuses).toEqual(['saving', 'saved', 'saving', 'error'])
  })

  it('keeps a value whose save failed and tries it again on the next flush', async () => {
    let fail = true
    const saved: string[] = []
    const saver = createAutosaver<string>({
      delay: 400,
      save: async (value) => {
        if (fail) throw new Error('quota')
        saved.push(value)
      },
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    saver.schedule('kept')
    await saver.flush()
    expect(saver.hasPending()).toBe(true)

    fail = false
    await saver.flush()
    expect(saved).toEqual(['kept'])
    expect(saver.hasPending()).toBe(false)
  })
})
