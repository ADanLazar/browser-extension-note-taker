# Margin Notes

A Chrome extension for keeping notes about the site you are browsing. The notes live in Chrome's side panel, next to the page.

- **One note per site.** The panel shows the note for the site in the active tab and follows you as you switch tabs or navigate. Pages that are not on a website (a new tab, `chrome://` pages) share a general note.
- **Rich text.** Headings, bold, italic, strikethrough, code, bulleted and numbered lists, checklists, quotes and links. Hold Cmd (Ctrl on Windows and Linux) and click a link to open it. Markdown shortcuts work as you type: `# ` for a heading, `- ` for a list, `[ ] ` for a checklist item, `> ` for a quote, three backticks for a code block.
- **Saved automatically** in the browser's local storage, a moment after you stop typing and whenever you leave the note or close the panel.
- **Export to Markdown.** Download the current note as a `.md` file, copy it as Markdown, or export every note in one file from **All notes**.

Nothing leaves your browser: there is no server and no account.

## Install

Requires Node.js 22 or later and Chrome 116 or later.

```sh
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `dist` folder.

## Use

Click the Margin Notes button in the toolbar, or press `Alt+Shift+N` (`Option+Shift+N` on a Mac), to open the panel. Drag its inner edge to resize it.

Chrome decides which side the panel sits on. It is on the right unless you changed **Settings → Appearance → Side panel position**.

## Permissions

| Permission | Why |
| --- | --- |
| `sidePanel` | Show the notes beside the page. |
| `storage` | Keep the notes in the browser. |
| `tabs` | Read the address of the active tab, to know which site's note to show. |

## Develop

| Command | What it does |
| --- | --- |
| `npm run dev` | Rebuild into `dist` on every change. Reload the extension in `chrome://extensions` to pick it up. |
| `npm run build` | Type-check and build into `dist`. |
| `npm test` | Run the unit tests. |

The toolbar icons in `public/icons` are rendered from `design/icon.svg`.

```
public/manifest.json   Extension manifest (Manifest V3)
sidepanel.html         The panel page
src/background.ts      Opens the panel when the toolbar button is clicked
src/lib/               Site keys, storage and autosave, Markdown export
src/sidepanel/         The React interface
```
