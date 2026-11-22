import type { BattleInput, UnitInput } from '@cyber/battle'
import type { CampaignRelease } from '@cyber/domain'
import { FACINGS, RIG_SLOTS, parseCombatEffects, parseSpriteBundle, type CombatEffects, type SpriteBundle } from './combat-sprite-format'
import { compositionFor, type ComposedRig } from './combat-sprite-composition'
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

export function matchCombatFitting(bundle: Pick<SpriteBundle, 'outfit' | 'fittings'>, unit: Pick<UnitInput, 'ref' | 'frozenRig'>): SpriteFitting | undefined {
  const rig = unit.frozenRig
  if (unit.ref?.kind !== 'uma' || unit.ref.id !== String(bundle.outfit) || !rig) return
  return bundle.fittings.find(fit => slots.every(slot => fit.rig[slot] === rig[slot]))
}

async function bundleLooks(input: BattleInput, bundle: SpriteBundle, read: {
  effects: () => Promise<unknown>; page: (file: string) => Promise<Blob>; outfit?: number
}): Promise<Map<string, CombatLook>> {
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
      const blob = await read.page(page.file)
      if (blob.size !== page.bytes) throw new Error('Combat sprite page size mismatch')
      const src = URL.createObjectURL(blob)
      try {
        const img = new Image()
        img.src = src
        await img.decode()
        if (img.naturalWidth !== page.width || img.naturalHeight !== page.height) throw new Error('Combat sprite page dimensions mismatch')
        pages.set(key, img)
      } finally { URL.revokeObjectURL(src) }
    }
  }))
  const art = { bundle, effects, pages }
  return new Map(selected.map(({ id, fitting, composed }) => [id, { kind: 'combat', art, fitting, ...(composed ? { composed } : {}) }]))
}

type Published = NonNullable<CampaignRelease['combatSprites']>
const jsonOf = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes))

/** Authoring review and the authenticated campaign share the same outfit and frozen-rig compositor. */
export async function campaignCombatLooks(input: BattleInput, published: Published = []): Promise<Map<string, CombatLook>> {
  if (!input.units.some(unit => unit.frozenRig)) return new Map()
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
  const results = await Promise.all(published.filter(({ outfit }) => input.units.some(unit => unit.frozenRig && unit.ref?.kind === 'uma'
    && unit.ref.id === String(outfit))).map(async ({ outfit, manifest, placements, pages }) => {
    try {
      const bundle = parseSpriteBundle(jsonOf(await CONTENT.pack(manifest.path, manifest)))
      if (bundle.outfit !== outfit) throw new Error('Campaign combat sprite identity mismatch')
      const byFile = new Map(pages.map(page => [page.file, page]))
      for (const page of Object.values(bundle.pages)) {
        const ref = byFile.get(page.file)
        if (ref?.sha256 !== page.sha256 || ref.bytes !== page.bytes) throw new Error('Campaign combat sprite page pin mismatch')
      }
      return await bundleLooks(input, bundle, {
        effects: async () => jsonOf(await CONTENT.pack(placements.path, placements)),
        page: async file => {
          const ref = byFile.get(file)!
          return new Blob([Uint8Array.from(await CONTENT.pack(ref.path, ref))], { type: 'image/png' })
        },
      })
    } catch (error) {
      console.warn('Campaign combat sprite fallback', error)
      return new Map<string, CombatLook>()
    }
  }))
  return new Map(results.flatMap(result => [...result]))
}
