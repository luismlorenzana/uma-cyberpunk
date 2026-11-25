import sharp from 'sharp'
import type { SpriteBundle } from '../../apps/web/src/board/combat-sprite-format'

type RGB = [number, number, number]
type Rect = [number, number, number, number]
const MATERIALS = ['paint', 'panel', 'metal', 'signal', 'tail', 'suit'] as const
type Material = typeof MATERIALS[number]
export type Palette = Record<Material, RGB>
export type Bitmap = { pixels: Buffer; width: number; height: number }
type LayerMap = Record<string, Record<string, string[]>>
type Swatches = Record<Material, { boxes: Rect[]; accept: (color: RGB) => boolean }>
const luminance = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const violet = ([r, g, b]: RGB) => r >= 98 && r > g + 6 && b > g + 14
const blueMetal = ([r, g, b]: RGB) => r >= 64 && g > r + 4 && b > r + 9
const cyan = ([r, g, b]: RGB) => g >= 90 && g - r >= 34 && b - r >= 26
const anyColor = () => true

// Fixed swatches on the approved front-facing armor plate. The reference mask excludes nearby seams and trim.
const SWATCHES: Swatches = {
  paint: { boxes: [[622, 362, 56, 66], [319, 580, 50, 65], [357, 1082, 32, 62], [413, 113, 42, 49]], accept: violet },
  panel: { boxes: [[453, 412, 112, 28], [496, 511, 33, 19], [477, 251, 68, 25]], accept: rgb => luminance(rgb) >= 145 && !violet(rgb) },
  metal: { boxes: [[421, 448, 52, 45], [552, 447, 51, 46], [452, 319, 34, 29], [534, 318, 31, 27]], accept: blueMetal },
  signal: { boxes: [[446, 183, 133, 35]], accept: cyan },
  tail: { boxes: [[673, 878, 67, 252]], accept: ([r, g, b]) => r > g + 12 && g > b + 12 },
  suit: { boxes: [[470, 690, 85, 58], [400, 916, 47, 52]], accept: anyColor },
}

async function bitmap(source: Buffer, reference = false): Promise<Bitmap> {
  const input = sharp(source).ensureAlpha()
  const normalized = reference ? input.resize(512, 768, { fit: 'fill' }) : input
  const { data, info } = await normalized.raw().toBuffer({ resolveWithObject: true })
  return { pixels: data, width: info.width, height: info.height }
}

const colorAt = (pixels: Buffer, offset: number): RGB => [pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!]
function sample(bitmap: Bitmap, reference: Bitmap, material: Material) {
  const { boxes, accept } = SWATCHES[material]
  const aligned: RGB[] = [], within: RGB[] = []
  for (const [left, top, width, height] of boxes) {
    for (let y = top >> 1; y < (top + height) >> 1; y++) for (let x = left >> 1; x < (left + width) >> 1; x++) {
      const i = (y * bitmap.width + x) * 4
      if (bitmap.pixels[i + 3]! < 240) continue
      const target = colorAt(bitmap.pixels, i)
      within.push(target)
      if (reference.pixels[i + 3]! >= 240 && accept(colorAt(reference.pixels, i))) aligned.push(target)
    }
  }
  // The visor line can sit a few pixels higher on another head. Find bright colored glass within the strip.
  const tinted = material === 'signal' ? within.filter(rgb => luminance(rgb) > 95 && Math.max(...rgb) - Math.min(...rgb) >= 26) : []
  const colors = tinted.length >= 5 ? tinted : material === 'signal' || aligned.length < 12 ? within : aligned
  if (!colors.length) throw new Error('No opaque color samples for ' + material)
  colors.sort((a, b) => luminance(a) - luminance(b))
  return colors[Math.floor((colors.length - 1) * (material === 'signal' && tinted.length < 5 ? 0.96 : 0.60))]!
}

export const referenceBitmap = (source: Buffer) => bitmap(source, true)
export function samplePalette(image: Bitmap, reference: Bitmap): Palette {
  return Object.fromEntries(MATERIALS.map(material => [material, sample(image, reference, material)])) as Palette
}

const armorLane = /^(?:head|shell|leg-(?:left|right)(?:-(?:boot|shin|thigh))?|(?:left|right)-(?:upper|fore|glove))$/
function transition(value: number, lower: number, upper: number) {
  const t = Math.max(0, Math.min(1, (value - lower) / (upper - lower)))
  return t * t * (3 - 2 * t)
}

function materialWeights(name: string, rgb: RGB) {
  const value = luminance(rgb)
  if (name === 'tail') return [0, 0, 0, 0, transition(value, 18, 50), 0]
  const [r, g, b] = rgb
  const signal = transition(Math.min(g - r, b - r + 6), 23, 51) * transition(g, 74, 104)
  const metal = (1 - signal) * transition(Math.min(g - r, b - r - 4), 2, 15) * transition(value, 60, 102)
  const paint = (1 - signal - metal) * transition((r - g) * 0.42 + (b - g) * 0.58, 13, 30) *
    transition(b - r, -7, 2) * transition(value, 62, 110)
  const panel = (1 - signal - metal - paint) * transition(value, 87, 147)
  const suit = (1 - signal - metal - paint - panel) * transition(value, 28, 53)
  return [paint, panel, metal, signal, 0, suit]
}

export async function prepareAtlases(bundle: SpriteBundle, lanes: LayerMap, source: ReadonlyMap<string, Buffer>) {
  const atlases = new Map<string, Bitmap & { bytes: Buffer; masks: Uint8Array; colored: number[] }>()
  for (const [key, page] of Object.entries(bundle.pages)) {
    const bytes = source.get(page.file)!
    const image = await bitmap(bytes)
    atlases.set(key, { ...image, bytes, masks: new Uint8Array(image.width * image.height * MATERIALS.length), colored: [] })
  }
  const seen = new Map<string, string>()
  for (const [motion, directions] of Object.entries(bundle.motions)) for (const [facing, track] of Object.entries(directions)) {
    for (const [id, frame] of Object.entries(track.frames)) {
      const names = lanes[facing]?.[motion + '/' + id]
      if (names?.length !== frame.layers.length) throw new Error(`Missing source lanes for ${motion}/${facing}/${id}`)
      for (const [index, layer] of frame.layers.entries()) {
        const name = names[index]!, rectKey = layer.page + ':' + layer.rect.join(',')
        if (seen.has(rectKey)) {
          if (seen.get(rectKey) !== name) throw new Error('Shared atlas rectangle has inconsistent material lanes: ' + rectKey)
          continue
        }
        seen.set(rectKey, name)
        if (layer.effect || layer.when || (!armorLane.test(name) && name !== 'tail')) continue
        const { pixels, width, masks, colored } = atlases.get(layer.page)!
        const [left, top, w, h] = layer.rect
        for (let y = top; y < top + h; y++) for (let x = left; x < left + w; x++) {
          const index = y * width + x, offset = index * 4
          if (!pixels[offset + 3]) continue
          const weights = materialWeights(name, colorAt(pixels, offset))
          if (!weights.some(Boolean)) continue
          colored.push(index)
          for (const [material, weight] of weights.entries()) masks[index * MATERIALS.length + material] = Math.round(weight * 255)
        }
      }
    }
  }
  return atlases
}

export async function recolorAtlas(atlas: Bitmap & { bytes: Buffer; masks: Uint8Array; colored: number[] }, base: Palette, target: Palette) {
  const deltas = MATERIALS.map(material => target[material].map((value, i) => {
    const delta = value - base[material][i]!
    return material === 'suit' ? Math.max(-18, Math.min(18, delta)) : delta
  }))
  if (!deltas.some(row => row.some(Boolean)) || !atlas.colored.length) return { ...atlas, bytes: atlas.bytes, changed: 0 }
  const pixels = Buffer.from(atlas.pixels)
  let changed = 0
  for (const index of atlas.colored) {
    const offset = index * 4, mask = index * MATERIALS.length
    let edited = false
    for (let channel = 0; channel < 3; channel++) {
      const original = pixels[offset + channel]!
      let delta = 0
      for (let material = 0; material < MATERIALS.length; material++) delta += atlas.masks[mask + material]! * deltas[material]![channel]!
      const color = Math.max(0, Math.min(255, original + Math.round(delta / 255)))
      pixels[offset + channel] = color
      edited ||= color !== original
    }
    if (edited) changed++
  }
  const { width, height } = atlas
  const bytes = changed ? await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer() : atlas.bytes
  return { width, height, pixels, bytes, changed }
}

export function carryPreview(bundle: SpriteBundle, atlases: ReadonlyMap<string, Bitmap>) {
  const [width, height] = bundle.cell, fitting = bundle.fittings[0]!
  return Promise.all(Object.values(bundle.motions[fitting.motion]!).map(async (track) => {
    const frame = track.frames[track.clips.idle!.frames[0]!.frame]!
    const pixels = Buffer.alloc(width * height * 4)
    for (const layer of frame.layers) {
      if (layer.when && fitting.rig[layer.when.slot] !== layer.when.part) continue
      const page = atlases.get(layer.page)!
      const [left, top, w, h] = layer.rect
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const src = ((y + top) * page.width + x + left) * 4
        const dx = layer.at[0] + x, dy = layer.at[1] + y
        if (dx < 0 || dx >= width || dy < 0 || dy >= height || !page.pixels[src + 3]) continue
        const dst = (dy * width + dx) * 4, a = page.pixels[src + 3]! / 255
        const back = pixels[dst + 3]! / 255 * (1 - a), alpha = a + back
        for (let c = 0; c < 3; c++) pixels[dst + c] = Math.round((page.pixels[src + c]! * a + pixels[dst + c]! * back) / alpha)
        pixels[dst + 3] = Math.round(alpha * 255)
      }
    }
    const scale = bundle.reviewHeight / bundle.figureHeight
    return sharp(pixels, { raw: { width, height, channels: 4 } }).resize(Math.round(width * scale), Math.round(height * scale), { kernel: 'nearest' }).png().toBuffer()
  }))
}
