// Looks on screen (D23–D25, LK10): an Uma's approved full-body look from Uma Character Art's Cyberpunk universe, read
// through cyber-api's private content route (`/api/content/looks/…`, the owner's sign-in), matched to her by her
// character's English name from master data. A full image where a screen is about her, a fixed bust crop elsewhere, and
// the fallback (master data's bust, or a stand-in card) while it loads or when there's no look for her.
import { BUST_CROP, LOOK_NAME, LOOKS, type Look } from '@cyber/domain'
import { useEffect, useState, type ReactNode } from 'react'
import { CONTENT } from '../content/client'
import { useMaster } from '../master/master'

export interface LookEntry { id: string; character: string; outfit: Look; path: string }

/** The universe index's looks, checked: a known look and a path the route serves. Pure, tested. */
export function parseLooks(value: unknown): LookEntry[] {
  const looks = (value as { looks?: unknown } | null)?.looks
  if (!Array.isArray(looks)) return []
  return looks.flatMap((l: Record<string, unknown>) =>
    typeof l?.character === 'string' && LOOKS.includes(l.outfit as Look) && typeof l.path === 'string' && /^images\/[a-z0-9-]+\.[a-f0-9]{16}\.png$/.test(l.path)
      ? [{ id: String(l.id ?? ''), character: l.character, outfit: l.outfit as Look, path: l.path }] : [])
}

/** The route's path of her look, or null. */
export function lookPath(entries: readonly LookEntry[], character: string | undefined, look: Look): string | null {
  if (!character) return null
  const e = entries.find((x) => x.character.toLowerCase() === character.toLowerCase() && x.outfit === look)
  return e ? `looks/${e.path}` : null
}

let index: Promise<LookEntry[]> | null = null
/** The index, once a session; empty when the route serves none (a 404 locally without the mirror, or offline). */
export function looksIndex(): Promise<LookEntry[]> {
  index ??= CONTENT.pack('looks/index.json').then((bytes) => parseLooks(JSON.parse(new TextDecoder().decode(bytes)))).catch(() => { index = null; return [] })
  return index
}

/** A blob URL for her look, or null while it loads or when she has none. */
export function useLookUrl(outfit: number, look: Look): string | null {
  const master = useMaster()
  const character = master.status === 'ready' ? master.view.characters.get(outfit) : undefined
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    if (!character) return
    void looksIndex().then((entries) => { const path = lookPath(entries, character, look); return path ? CONTENT.packUrl(path) : null })
      .then((u) => { if (live) setUrl(u) }).catch(() => {})
    return () => { live = false }
  }, [character, look])
  return url
}

/** Her look as a full-body image (`full`) or its bust crop (`bust`, in a 3:4 frame), else `fallback`. */
export function LookPortrait({ outfit, name, look, mode, fallback, className }: { outfit: number; name: string; look: Look; mode: 'full' | 'bust'; fallback: ReactNode; className?: string }) {
  const url = useLookUrl(outfit, look)
  if (!url) return <>{fallback}</>
  const alt = `${name}, ${LOOK_NAME[look]}`
  if (mode === 'full') return <img data-look={look} src={url} alt={alt} className={`h-full w-auto object-contain ${className ?? ''}`} />
  // The bust: the image's top band, `height` of it tall, a 3:4 window centred across the 2:3 picture.
  const crop = BUST_CROP[look], bandH = crop.height * 1536, bandW = bandH * 0.75
  return (
    <div data-look={look} className={`relative aspect-[3/4] overflow-hidden ${className ?? ''}`}>
      <img src={url} alt={alt} className="absolute max-w-none" style={{ width: `${(1024 / bandW) * 100}%`, left: `${(-(512 - bandW / 2) / bandW) * 100}%`, top: `${(-(crop.top * 1536) / bandH) * 100}%` }} />
    </div>
  )
}
