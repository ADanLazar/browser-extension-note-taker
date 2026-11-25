/** Notes are kept per site. Pages that are not on a website share one general note. */
// The colon keeps this from ever matching a real hostname.
export const GENERAL_KEY = ':general'

export interface Site {
  /** Storage identity: the hostname without "www.", or GENERAL_KEY. */
  key: string
  /** What the person sees. */
  label: string
}

export function siteFromKey(key: string): Site {
  return { key, label: key === GENERAL_KEY ? 'General notes' : key }
}

export function siteFromUrl(url: string | undefined): Site {
  if (url) {
    try {
      const parsed = new URL(url)
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname) {
        return siteFromKey(parsed.hostname.replace(/^www\./, ''))
      }
    } catch {
      // Not a URL: fall through to the general note.
    }
  }
  return siteFromKey(GENERAL_KEY)
}

/** A stable hue (0–359) per site, so each site's notes carry their own colour. */
export function siteHue(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 360
}
