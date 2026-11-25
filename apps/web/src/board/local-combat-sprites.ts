import type { BattleInput, UnitInput } from '@cyber/battle'
import type { CampaignCombatSprite, CampaignRelease } from '@cyber/domain'
import { FACINGS, RIG_SLOTS, parseCombatEffects, parseSpriteBundle, type CombatEffects, type SpriteBundle } from './combat-sprite-format'
import { compositionFor, hasNativeHands, type ComposedRig } from './combat-sprite-composition'
import { CONTENT } from '../content/client'

const url = '/__cyber-combat-sprites/'
export type SpriteFitting = SpriteBundle['fittings'][number]

export interface LoadedCombatArt {
  bundle: SpriteBundle
  effects: CombatEffects
  pages: ReadonlyMap<string, HTMLImageElement>
}

export interface CombatLook {
  kind: 'combat'
  art: LoadedCombatArt
  fitting: SpriteFitting
  composed?: ComposedRig
}

const slots = Object.keys(RIG_SLOTS) as (keyof typeof RIG_SLOTS)[]
type DecodedPages = Map<string, Promise<{ image: HTMLImageElement; bytes: number }>>

export function matchCombatFitting(bundle: Pick<SpriteBundle, 'outfit' | 'fittings'>, unit: Pick<UnitInput, 'ref' | 'frozenRig' | 'sprite'>): SpriteFitting | undefined {
  const kind = typeof bundle.outfit === 'number' ? 'uma' : 'heroine'
  if (unit.ref?.kind !== kind || unit.ref.id !== String(bundle.outfit)) return
  const rig = unit.frozenRig
  if (!rig) return kind === 'heroine' ? bundle.fittings.find(fit => fit.id === unit.sprite?.fitting) : undefined
  return bundle.fittings.find(fit => slots.every(slot => fit.rig[slot] === rig[slot]))
}

export function matchesSpriteBinding(binding: CampaignCombatSprite, unit: Pick<UnitInput, 'ref' | 'side' | 'sprite' | 'frozenRig'>): boolean {
  if (unit.ref?.id !== String(binding.outfit)) return false
  if (typeof binding.outfit === 'number') return unit.ref?.kind === 'uma' && !!unit.frozenRig
  const sprite = unit.sprite
  if (unit.ref?.kind !== 'heroine' || !sprite || sprite.form !== binding.form || !binding.roles.includes(sprite.role)) return false
  if (unit.side === 'squad') return sprite.role !== 'boss-enemy' && !!unit.frozenRig
  return sprite.role !== 'boss-ally' && !!sprite.fitting
}

async function bundleLooks(input: BattleInput, bundle: SpriteBundle, read: {
  effects: () => Promise<unknown>; page: (file: string) => Promise<Blob>; outfit?: number
}, decoded: DecodedPages = new Map()): Promise<Map<string, CombatLook>> {
  const outfit = read.outfit ?? bundle.outfit
  const selected = input.units.flatMap<{ id: string; fitting: SpriteFitting; composed?: ComposedRig }>(unit => {
    const fitting = matchCombatFitting({ outfit, fittings: bundle.fittings }, unit)
    const composed = outfit === bundle.outfit ? compositionFor(bundle, unit) : undefined
    if (composed) return [{ id: unit.id, fitting: { id: fitting?.id ?? 'composed', label: fitting?.label ?? 'Fitted rig',
      motion: bundle.composition!.body, rig: composed.rig }, composed }]
    return fitting ? [{ id: unit.id, fitting, composed: undefined }] : []
  })
  if (!selected.length) return new Map()
  const effects = parseCombatEffects(await read.effects(), bundle)
  const required = new Set<string>()
  for (const { fitting, composed } of selected) {
    const sources = [fitting.motion]
    if (composed?.twoHand) sources.push(composed[composed.twoHand] === 'greatblade' ? bundle.composition!.blade : bundle.composition!.rifle)
    if (composed && hasNativeHands(bundle)) {
      sources.push('mixed-reverse')
      if (composed.left === 'shield' && bundle.motions.shield) sources.push('shield')
    }
    for (const motion of sources) for (const facing of FACINGS) {
      for (const { layers } of Object.values(bundle.motions[motion]![facing].frames)) {
        for (const layer of layers) {
          if (composed || !layer.when || fitting.rig[layer.when.slot] === layer.when.part) required.add(layer.page)
        }
      }
    }
  }
  for (const track of [...Object.values(effects.barrier), ...Object.values(effects.recipient)]) {
    for (const layer of track.frames) required.add(layer.page)
  }
  const pages = new Map<string, HTMLImageElement>()
  const queue = [...required]
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    for (let key = queue.shift(); key; key = queue.shift()) {
      const page = bundle.pages[key]!
      let shared = decoded.get(page.sha256)
      if (!shared) {
        shared = read.page(page.file).then(async blob => {
          if (blob.size !== page.bytes) throw new Error('Combat sprite page size mismatch')
          const src = URL.createObjectURL(blob)
          try {
            const img = new Image()
            img.src = src
            await img.decode()
            return { image: img, bytes: blob.size }
          } finally { URL.revokeObjectURL(src) }
        })
        decoded.set(page.sha256, shared)
      }
      const { image, bytes } = await shared
      if (bytes !== page.bytes) throw new Error('Combat sprite page size mismatch')
      if (image.naturalWidth !== page.width || image.naturalHeight !== page.height) throw new Error('Combat sprite page dimensions mismatch')
      pages.set(key, image)
    }
  }))
  const art = { bundle, effects, pages }
  return new Map(selected.map(({ id, fitting, composed }) => [id, { kind: 'combat', art, fitting, ...(composed ? { composed } : {}) }]))
}

type Published = NonNullable<CampaignRelease['combatSprites']>
const jsonOf = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes))

/** Authoring review and the authenticated campaign share the same outfit and frozen-rig compositor. */
export async function campaignCombatLooks(input: BattleInput, published: Published = []): Promise<Map<string, CombatLook>> {
  if (!input.units.some(unit => unit.frozenRig || unit.sprite?.fitting)) return new Map()
  if (import.meta.env.DEV && import.meta.env.CYBER_COMBAT_SPRITE_REVIEW) {
    const signal = AbortSignal.timeout(15_000)
    const fetchLocal = async (file: string) => {
      const response = await fetch(url + file, { signal })
      if (!response.ok) throw new Error('Combat sprite review source unavailable')
      return response
    }
    try {
      const [manifest, binding] = await Promise.all([fetchLocal('bundle.json').then(r => r.json()), fetchLocal('binding.json').then(r => r.json())])
      if (!Number.isSafeInteger(binding?.outfit) || binding.outfit <= 0) throw new Error('Local sprite outfit missing')
      return await bundleLooks(input, parseSpriteBundle(manifest), { outfit: binding.outfit, effects: async () => (await fetchLocal('asset-placements.json')).json(),
        page: async file => (await fetchLocal(file)).blob() })
    } catch (error) {
      console.warn('Local combat sprite fallback', error)
    }
  }
  const decoded: DecodedPages = new Map()
  const matched = published.flatMap(binding => {
    const units = input.units.filter(unit => matchesSpriteBinding(binding, unit))
    return units.length ? [{ binding, units }] : []
  })
  const results = await Promise.all(matched.map(async ({ binding: { outfit, manifest, placements, pages }, units }) => {
    try {
      const bundle = parseSpriteBundle(jsonOf(await CONTENT.pack(manifest.path, manifest)))
      if (bundle.outfit !== outfit) throw new Error('Campaign combat sprite identity mismatch')
      const byFile = new Map(pages.map(page => [page.file, page]))
      for (const page of Object.values(bundle.pages)) {
        const ref = byFile.get(page.file)
        if (ref?.sha256 !== page.sha256 || ref.bytes !== page.bytes) throw new Error('Campaign combat sprite page pin mismatch')
      }
      return await bundleLooks({ ...input, units }, bundle, {
        effects: async () => jsonOf(await CONTENT.pack(placements.path, placements)),
        page: async file => {
          const ref = byFile.get(file)!
          return new Blob([Uint8Array.from(await CONTENT.pack(ref.path, ref))], { type: 'image/png' })
        },
      }, decoded)
    } catch (error) {
      console.warn('Campaign combat sprite fallback', error)
      return new Map<string, CombatLook>()
    }
  }))
  return new Map(results.flatMap(result => [...result]))
}
