import type { Speaker } from '@cyber/domain'
import { useState } from 'react'

export interface SceneFace {
  emote: string
  url: string
  at: { x: number; y: number }
}

export interface ScenePortraitImage {
  speaker: Speaker
  url: string
  emote?: string
  faces?: SceneFace[]
}

export function selectScenePortrait(portraits: readonly ScenePortraitImage[], speaker: Speaker, emote: string | undefined) {
  const base = portraits.find((portrait) => portrait.speaker === speaker && portrait.emote === undefined)
  const face = emote === 'neutral' ? undefined : base?.faces?.find((face) => face.emote === emote)
  if (face && base) return { image: base, face }
  const image = portraits.find((portrait) => portrait.speaker === speaker && portrait.emote === emote) ?? base
  return image ? { image, face: undefined } : null
}

interface ImageSize { width: number; height: number }

const sizeOf = (image: HTMLImageElement): ImageSize => ({ width: image.naturalWidth, height: image.naturalHeight })

export function faceBox(base: ImageSize, crop: ImageSize, { x, y }: SceneFace['at']) {
  if (x < 0 || y < 0 || crop.width <= 0 || crop.height <= 0 || x + crop.width > base.width || y + crop.height > base.height) return undefined
  const percent = (part: number, whole: number) => `${(part / whole) * 100}%`
  return { left: percent(x, base.width), top: percent(y, base.height),
    width: percent(crop.width, base.width), height: percent(crop.height, base.height) }
}

/** A command profile frames the approved face in native pixels, independent of the bust crop. */
export function profileFrame(base: ImageSize, crop: ImageSize, at: SceneFace['at']) {
  if (!faceBox(base, crop, at)) return undefined
  const width = Math.min(base.width, crop.width * 1.25), height = Math.min(base.height, crop.height * 1.25)
  return { left: Math.max(0, Math.min(base.width - width, at.x + crop.width / 2 - width / 2)),
    top: Math.max(0, Math.min(base.height - height, at.y + crop.height / 2 - height / 2)), width, height }
}

function FaceLayer({ face, base, measured }: { face: SceneFace; base: ImageSize; measured?: (size: ImageSize) => void }) {
  const [size, setSize] = useState<ImageSize>()
  const box = size && faceBox(base, size, face.at)
  return <img src={face.url} alt="" draggable={false}
    onLoad={(event) => { const size = sizeOf(event.currentTarget); setSize(size); measured?.(size) }} onError={() => setSize(undefined)}
    className="pointer-events-none absolute max-w-none"
    style={box ?? { visibility: 'hidden' }} data-scene-face={box ? face.emote : undefined} />
}

export function ScenePortrait({ image, face, profile = false }: { image: ScenePortraitImage; face?: SceneFace | undefined; profile?: boolean }) {
  const [baseSize, setBaseSize] = useState<ImageSize>()
  const [crop, setCrop] = useState<ImageSize & { url: string }>()
  const anchor = face ?? image.faces?.[0]
  const frame = profile && anchor && crop?.url === anchor.url && baseSize && profileFrame(baseSize, crop, anchor.at)
  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className={profile ? 'hidden' : undefined}>
      <img src={image.url} alt="" draggable={false} className="block max-h-[44vh] max-w-[35vw] object-contain"
        onLoad={(event) => setBaseSize(sizeOf(event.currentTarget))} onError={() => setBaseSize(undefined)}
        data-scene-portrait={image.emote ?? 'neutral'} />
      {(profile ? anchor : face) && baseSize && <FaceLayer key={(profile ? anchor : face)!.url} face={(profile ? anchor : face)!} base={baseSize}
        measured={profile && anchor ? size => setCrop({ ...size, url: anchor.url }) : undefined} />}
      </div>
      {frame && baseSize && <svg width="90" height="92" viewBox={`${frame.left} ${frame.top} ${frame.width} ${frame.height}`} data-scene-profile>
        <image href={image.url} width={baseSize.width} height={baseSize.height} />
        {face && crop && <image href={face.url} x={face.at.x} y={face.at.y} width={crop.width} height={crop.height} />}
      </svg>}
    </div>
  )
}
