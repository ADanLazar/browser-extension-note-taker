// Clicking the toolbar button (or pressing its shortcut) opens the side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Margin Notes: could not set panel behaviour', error))
