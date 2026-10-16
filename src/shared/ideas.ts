/** Apps worth a look. Free and open source, from their own official pages. Nothing is installed from here. */
export interface AppIdea {
  id: string
  name: string
  what: string
  /** The project's own page, where the download links live. */
  url: string
}

export const APP_IDEAS: readonly AppIdea[] = [
  {
    id: 'aerialviews',
    name: 'Aerial Views',
    what: 'A screen saver with slow, beautiful videos (4K aerial footage) and your own photos. After installing, choose it under Tune-ups > Screen saver app.',
    url: 'https://github.com/theothernt/AerialViews'
  },
  {
    id: 'vlc',
    name: 'VLC',
    what: 'Plays almost any video or music file, from a USB drive or from your network.',
    url: 'https://www.videolan.org/vlc/download-android.html'
  },
  {
    id: 'kodi',
    name: 'Kodi',
    what: 'A media centre for your own movie, music and photo collection. Use it with content you have the right to watch.',
    url: 'https://kodi.tv/download/'
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    what: 'Watch the media on your own home server (a PC or NAS running the free Jellyfin server).',
    url: 'https://jellyfin.org/downloads/'
  },
  {
    id: 'moonlight',
    name: 'Moonlight',
    what: 'Stream games from your own gaming PC to the TV over your home network.',
    url: 'https://moonlight-stream.org/'
  },
  {
    id: 'tvbro',
    name: 'TV Bro',
    what: 'A simple web browser made for a TV remote.',
    url: 'https://github.com/truefedex/tv-bro'
  },
  {
    id: 'tailscale',
    name: 'Tailscale',
    what: 'Reach your home network (and your TV) safely from anywhere. The app is open source; the service has a free personal plan.',
    url: 'https://tailscale.com/download'
  }
]

export function findIdea(id: unknown): AppIdea | undefined {
  return typeof id === 'string' ? APP_IDEAS.find((i) => i.id === id) : undefined
}
