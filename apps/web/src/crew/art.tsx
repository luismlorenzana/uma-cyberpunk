// The album's art (CY11; uma-farm's album-art.tsx in shape): faces and busts from master data's release at run time, and a
// stand-in card for an Uma it doesn't hold (CY9's invented crew, or before it loads): her label's letters on a disc
// whose colour comes from her id, never her name.
import type { AlbumArt, UmaArtKind } from '@luismlorenzana/uma-kit/album'
import { imagePath, useArtUrl } from '@luismlorenzana/uma-kit/content'
import type { ImageFamily } from '@luismlorenzana/uma-data'
import { useMaster } from '../master/master'

const FAMILY: Record<UmaArtKind, ImageFamily | null> = { face: 'outfit-faces', bust: 'outfit-busts', chibi: 'outfit-chibis', icon: null }

function useUrl(kind: UmaArtKind, id: string): string | null {
  const master = useMaster()
  const art = master.status === 'ready' ? master.view.art : null
  const family = FAMILY[kind]
  return useArtUrl(family && art ? imagePath(art, family, kind === 'chibi' ? `${id}-a` : id) : null)
}

const COLORS = ['#3a5fcf', '#b6407e', '#2f8f8a', '#7a52c9', '#c0702c', '#3f7f3a', '#9a3b3b', '#2b6f9e']
export const discColor = (id: string): string => COLORS[[...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]!
export const letters = (name: string): string => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'

export function StandInCard({ id, name, size }: { id: string; name: string; size: number }) {
  return (
    <span aria-hidden data-stand-in={id} className="flex size-full items-center justify-center font-display font-bold text-white"
      style={{ background: `linear-gradient(160deg, ${discColor(id)}, #0b0d17)`, fontSize: Math.max(11, size * 0.32), minHeight: size }}>
      {letters(name)}
    </span>
  )
}

/** For uma-kit's album: the release's art, else a stand-in card. `nameOf` gives the card its letters. */
export function albumArt(nameOf: (id: string) => string): AlbumArt {
  return { useUrl, Fallback: ({ outfitId, size }) => <StandInCard id={outfitId} name={nameOf(outfitId)} size={size} /> }
}
