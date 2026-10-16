/** About-page facts and the only web pages the app will open from its own links. */
export const ABOUT = {
  name: 'Couchkit',
  tagline: 'A friendly toolbox for your Google TV or Android TV.',
  creator: 'Amulu',
  licence: 'Apache License 2.0'
} as const

export interface AboutLink {
  id: string
  label: string
  url: string
}

export const ABOUT_LINKS: readonly AboutLink[] = [
  { id: 'github', label: 'Project page on GitHub', url: 'https://github.com/vistrocity/couchkit' },
  { id: 'issues', label: 'Report a problem or suggest an idea', url: 'https://github.com/vistrocity/couchkit/issues' },
  { id: 'licence', label: 'Read the licence', url: 'https://github.com/vistrocity/couchkit/blob/main/LICENSE' },
  { id: 'adb', label: 'Get adb (Google platform-tools)', url: 'https://developer.android.com/tools/releases/platform-tools' }
]

export function findAboutLink(id: unknown): AboutLink | undefined {
  return typeof id === 'string' ? ABOUT_LINKS.find((l) => l.id === id) : undefined
}
