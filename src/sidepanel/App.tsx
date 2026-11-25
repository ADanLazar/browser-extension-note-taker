import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import { GENERAL_KEY, siteFromKey, siteFromUrl, siteHue } from '../lib/site'
import { NotePane } from './NotePane'
import { NotesList } from './NotesList'
import { useActiveTab } from './useActiveTab'

export function App() {
  const tab = useActiveTab()
  const tabSite = useMemo(() => siteFromUrl(tab?.url), [tab?.url])

  // A note opened from the list, shown instead of the one for the site in the tab.
  const [openedKey, setOpenedKey] = useState<string | null>(null)
  const [showingList, setShowingList] = useState(false)

  // The panel follows the browser: moving to another site puts its note back.
  useEffect(() => setOpenedKey(null), [tabSite.key])

  if (!tab) return null

  const site = openedKey ? siteFromKey(openedKey) : tabSite
  const isTabSite = site.key === tabSite.key

  const colour = {
    '--site-hue': siteHue(site.key),
    '--site-chroma': showingList || site.key === GENERAL_KEY ? 0.02 : 0.15,
  } as CSSProperties

  return (
    <div className="panel" style={colour}>
      <header className="masthead">
        {showingList ? (
          <h1 className="masthead-title">All notes</h1>
        ) : (
          <h1 className="masthead-title" title={site.label}>
            <span className="site-dot" aria-hidden="true" />
            <span className="masthead-name">{site.label}</span>
          </h1>
        )}
        <button className="text-button" onClick={() => setShowingList(!showingList)}>
          {showingList ? (
            <>
              <ArrowLeft size={14} aria-hidden="true" /> Back to note
            </>
          ) : (
            'All notes'
          )}
        </button>
      </header>

      {!showingList && !isTabSite && (
        <p className="notice">
          This note is for a different site than the one in this tab.{' '}
          <button className="link-button" onClick={() => setOpenedKey(null)}>
            Show the note for {tabSite.label}
          </button>
        </p>
      )}

      {showingList ? (
        <NotesList
          onOpen={(key) => {
            setOpenedKey(key === tabSite.key ? null : key)
            setShowingList(false)
          }}
        />
      ) : (
        <NotePane key={site.key} site={site} tab={tab} />
      )}
    </div>
  )
}
