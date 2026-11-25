// How a unit looks on the board (D19): an Uma (a unit whose `ref` is `uma`) walks as her outfit's sprite set from master
// data's `outfit-sprites` when the release has one (the authored chibis), else stands as a card with her face from
// `outfit-faces`; anyone else, or any Uma before master data loads, is a stand-in. uma-farm's figure-looks in shape: sets
// and faces load through the release client (hash-named, cached on the device), once a session, and are kept.
import type { BattleInput } from '@cyber/battle'
import type { ArtIndex } from '@luismlorenzana/uma-data'
import { imagePath } from '@luismlorenzana/uma-kit/content'
import { decodeImage, loadSpriteSet, type ActorSource } from '@luismlorenzana/uma-stage'
import { CONTENT } from '../content/client'

export type UnitLook = { kind: 'set'; source: ActorSource } | { kind: 'face'; face: HTMLImageElement }

/** Whether her outfit has an authored sprite set on this release. */
export const hasSet = (art: ArtIndex | null, outfit: number): boolean => !!art?.sprites?.[String(outfit)]
/** Her face's release path, or null. */
export const facePath = (art: ArtIndex | null, outfit: number): string | null => (art ? imagePath(art, 'outfit-faces', String(outfit)) : null)

const sets = new Map<number, Promise<ActorSource | null>>()
const faces = new Map<string, Promise<HTMLImageElement | null>>()

function setOf(art: ArtIndex, outfit: number): Promise<ActorSource | null> {
  let s = sets.get(outfit)
  if (!s) {
    s = (async () => {
      const [client, manifest] = await Promise.all([CONTENT.release(), CONTENT.manifest()])
      const loaded = await loadSpriteSet(client, manifest, art, outfit, decodeImage)
      return loaded ? { set: loaded.set, pages: loaded.pages } : null
    })().catch(() => { sets.delete(outfit); return null })
    sets.set(outfit, s)
  }
  return s
}

function faceOf(path: string): Promise<HTMLImageElement | null> {
  let f = faces.get(path)
  if (!f) {
    const release = CONTENT.hold(path)
    f = CONTENT.artUrl(path).then(async (url) => {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    }).catch(() => { faces.delete(path); return null }).finally(release)
    faces.set(path, f)
  }
  return f
}

/** Her look: her sprite set, else her face, else null (a stand-in). */
export async function lookOf(art: ArtIndex | null, outfit: number, allowSprites = true): Promise<UnitLook | null> {
  if (!art) return null
  if (allowSprites && hasSet(art, outfit)) {
    const source = await setOf(art, outfit)
    if (source) return { kind: 'set', source }
  }
  const path = facePath(art, outfit)
  const face = path ? await faceOf(path) : null
  return face ? { kind: 'face', face } : null
}

/** Starts loading these outfits' looks now (the sandbox's setup does, so Start is quick); they're kept for later. */
export function preloadLooks(art: ArtIndex | null, outfits: readonly number[]): void {
  for (const o of outfits) void lookOf(art, o)
}

/** Every Uma's look in a battle by unit id, waiting `ms` at most: whatever hasn't loaded by then plays as a stand-in. A
 * first battle downloads about 1.6 MB a sprite set; after that they're cached on the device. `progress` hears each one. */
export async function looksFor(input: BattleInput, art: ArtIndex | null, ms = 25_000, progress?: (done: number, of: number) => void, allowSprites = true): Promise<Map<string, UnitLook>> {
  const out = new Map<string, UnitLook>()
  const umas = input.units.filter((u) => u.ref?.kind === 'uma' && Number(u.ref.id) > 0)
  if (!art || umas.length === 0) return out
  let done = 0
  progress?.(0, umas.length)
  const all = Promise.all(umas.map(async (u) => {
    const look = await lookOf(art, Number(u.ref!.id), allowSprites)
    if (look) out.set(u.id, look)
    progress?.(++done, umas.length)
  }))
  await Promise.race([all, new Promise((r) => setTimeout(r, ms))])
  return new Map(out)
}
