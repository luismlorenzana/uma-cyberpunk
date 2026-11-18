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

function FaceLayer({ face, base }: { face: SceneFace; base: ImageSize }) {
  const [size, setSize] = useState<ImageSize>()
  const box = size && faceBox(base, size, face.at)
  return <img src={face.url} alt="" draggable={false}
    onLoad={(event) => setSize(sizeOf(event.currentTarget))} onError={() => setSize(undefined)}
    className="pointer-events-none absolute max-w-none"
    style={box ?? { visibility: 'hidden' }} data-scene-face={box ? face.emote : undefined} />
}

export function ScenePortrait({ image, face }: { image: ScenePortraitImage; face?: SceneFace | undefined }) {
  const [baseSize, setBaseSize] = useState<ImageSize>()
  return (
    <div className="relative overflow-hidden rounded-lg">
      <img src={image.url} alt="" draggable={false} className="block max-h-[44vh] max-w-[35vw] object-contain"
        onLoad={(event) => setBaseSize(sizeOf(event.currentTarget))} onError={() => setBaseSize(undefined)}
        data-scene-portrait={image.emote ?? 'neutral'} />
      {face && baseSize && <FaceLayer key={face.url} face={face} base={baseSize} />}
    </div>
  )
}
