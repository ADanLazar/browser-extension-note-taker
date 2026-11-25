import { useEffect, useState } from 'react'

export interface ActiveTab {
  url?: string
  title?: string
}

/**
 * The tab the person is looking at in the window this panel belongs to.
 * Undefined until the first answer arrives.
 */
export function useActiveTab(): ActiveTab | undefined {
  const [tab, setTab] = useState<ActiveTab>()

  useEffect(() => {
    let live = true
    let windowId: number | undefined

    const refresh = async () => {
      // If the tab cannot be read, show the general note instead of nothing.
      const [active] = await chrome.tabs
        .query(windowId === undefined ? { active: true, currentWindow: true } : { active: true, windowId })
        .catch(() => [] as chrome.tabs.Tab[])
      if (!live) return
      const next: ActiveTab = { url: active?.url, title: active?.title }
      setTab((previous) =>
        previous && previous.url === next.url && previous.title === next.title ? previous : next,
      )
    }

    const inThisWindow = (id: number) => windowId === undefined || id === windowId

    const onActivated = (info: { windowId: number }) => {
      if (inThisWindow(info.windowId)) void refresh()
    }
    const onUpdated = (
      _tabId: number,
      change: { url?: string; title?: string },
      updated: chrome.tabs.Tab,
    ) => {
      const relevant = change.url !== undefined || change.title !== undefined
      if (relevant && updated.active && inThisWindow(updated.windowId)) void refresh()
    }
    // A prerendered page swapped into the tab arrives as a replacement, not an update.
    const onReplaced = () => void refresh()

    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.tabs.onReplaced.addListener(onReplaced)
    chrome.windows
      .getCurrent()
      .then((current) => {
        windowId = current.id
      })
      .catch(() => {})
      .finally(refresh)

    return () => {
      live = false
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
      chrome.tabs.onReplaced.removeListener(onReplaced)
    }
  }, [])

  return tab
}
