import type { BattleInput, UnitInput } from '@cyber/battle'
import { FACINGS, RIG_SLOTS, parseCombatEffects, parseSpriteBundle, type CombatEffects, type SpriteBundle } from './combat-sprite-format'

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
}

const slots = Object.keys(RIG_SLOTS) as (keyof typeof RIG_SLOTS)[]

export function matchCombatFitting(bundle: Pick<SpriteBundle, 'outfit' | 'fittings'>, unit: Pick<UnitInput, 'ref' | 'frozenRig'>): SpriteFitting | undefined {
  const rig = unit.frozenRig
  if (unit.ref?.kind !== 'uma' || unit.ref.id !== String(bundle.outfit) || !rig) return
  return bundle.fittings.find(fit => slots.every(slot => fit.rig[slot] === rig[slot]))
}

/** The unpublished review source is mounted only by the explicitly enabled local dev server. */
export async function localCombatLooks(input: BattleInput): Promise<Map<string, CombatLook>> {
  const result = new Map<string, CombatLook>()
  if (!import.meta.env.DEV || !import.meta.env.CYBER_COMBAT_SPRITE_REVIEW || !input.units.some(unit => unit.frozenRig)) return result
  try {
    const signal = AbortSignal.timeout(15_000)
    async function json(file: string): Promise<unknown> {
      const response = await fetch(url + file, { signal })
      if (!response.ok) throw new Error('Combat sprite review source unavailable')
      return response.json()
    }
    const [manifest, selection] = await Promise.all([json('bundle.json'), json('binding.json')])
    const bundle = parseSpriteBundle(manifest)
    const outfit = (selection as { outfit?: unknown } | null)?.outfit
    if (typeof outfit !== 'number' || !Number.isSafeInteger(outfit) || outfit <= 0) throw new Error('Combat sprite review identity unavailable')
    const selected = input.units.flatMap(unit => {
      const fitting = matchCombatFitting({ outfit, fittings: bundle.fittings }, unit)
      return fitting ? [{ id: unit.id, fitting }] : []
    })
    if (!selected.length) return result
    const effects = parseCombatEffects(await json('asset-placements.json'), bundle)
    const required = new Set<string>()
    for (const { fitting } of selected) for (const facing of FACINGS) {
      for (const frame of Object.values(bundle.motions[fitting.motion]![facing].frames)) {
        for (const layer of frame.layers) {
          if (!layer.when || fitting.rig[layer.when.slot] === layer.when.part) required.add(layer.page)
        }
      }
    }
    for (const track of [...Object.values(effects.barrier), ...Object.values(effects.recipient)]) {
      for (const layer of track.frames) required.add(layer.page)
    }
    const pages = new Map<string, HTMLImageElement>()
    await Promise.all([...required].map(async key => {
      const page = bundle.pages[key]!
      const response = await fetch(url + page.file, { signal })
      if (!response.ok) throw new Error(page.file)
      const blob = await response.blob()
      if (blob.size !== page.bytes) throw new Error('Combat sprite page size mismatch')
      const src = URL.createObjectURL(blob)
      try {
        const img = new Image()
        img.src = src
        await img.decode()
        if (img.naturalWidth !== page.width || img.naturalHeight !== page.height) throw new Error('Combat sprite page dimensions mismatch')
        pages.set(key, img)
      } finally { URL.revokeObjectURL(src) }
    }))
    const art = { bundle, effects, pages }
    for (const { id, fitting } of selected) result.set(id, { kind: 'combat', art, fitting })
  } catch (error) {
    console.warn('Local combat sprite fallback', error)
  }
  return result
}
