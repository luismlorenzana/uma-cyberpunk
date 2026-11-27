import type { BattleInput, UnitInput } from '@cyber/battle'
import type { CampaignCombatSprite, CampaignRelease, CombatSpriteLoadout } from '@cyber/domain'
import { FACINGS, RIG_SLOTS, type SpriteBundle, type Track } from './combat-sprite-format'
import type { ComposedRig } from './combat-sprite-composition'
import { parseCompleteSpriteBundle, type CompleteSpriteBundle } from './complete-sprite-format'
import { CONTENT } from '../content/client'

export type SpriteFitting = SpriteBundle['fittings'][number]

export interface LoadedCombatArt {
  bundle: SpriteBundle
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
  // Named original bosses already use the standard joined pose in the authored battle snapshots.
  const form = binding.original ? 'standard' : binding.form
  if (unit.ref?.kind !== 'heroine' || !sprite || sprite.form !== form || !binding.roles?.includes(sprite.role)) return false
  if (unit.side === 'squad') return sprite.role !== 'boss-enemy' && !!unit.frozenRig
  return sprite.role !== 'boss-ally' && !!sprite.fitting
}

export const COMPLETE_VIEW = { S: 'front-left', E: 'front-right', W: 'rear-left', N: 'rear-right' } as const

/** The battle snapshot supplies the identity, deployed role and actual equipment. */
export function completeLoadout(binding: CampaignCombatSprite, unit: UnitInput): CombatSpriteLoadout | undefined {
  if (!binding.loadouts || !matchesSpriteBinding(binding, unit)) return
  if (unit.side === 'enemy') return binding.loadouts.find(row => {
    if (!unit.sprite?.fitting || !row.encounters.includes(unit.sprite.fitting)) return false
    const original = binding.original
    if (!original) return true
    return row.attacks.length > 0 && row.attacks.every(mount => {
      const weapon = mount === 'left' ? unit.loadout.leftHand : mount === 'right' ? unit.loadout.rightHand : null
      return weapon?.kind === 'weapon' && weapon.band === original.weaponBand
    })
  })
  const rig = unit.frozenRig
  return rig && binding.loadouts.find(row => row.rigs.some(match => rig.leftHand === match.left && rig.rightHand === match.right
    && (match.back === undefined || rig.back === match.back)))
}

/** Reuse the board cell player with exactly one layer per complete cel and no equipment composition. */
function readyLook(bundle: CompleteSpriteBundle, outfit: number | string, choice: CombatSpriteLoadout, pages: ReadonlyMap<string, HTMLImageElement>): CombatLook {
  const set = bundle.sets.find(set => set.id === choice.set)
  if (!set) throw new Error('Unknown selected complete loadout')
  const { attack, ...clips }: Track['clips'] = set.clips
  if (!attack) throw new Error('Approved loadout is missing its attack clip')
  const events = attack.events.map(event => ({
    ...event, cue: /^(pulse-\d+|weapon-contact)$/.test(event.cue) ? 'shot-pulse' : event.cue,
  }))
  for (const mount of choice.attacks) clips['attack-' + mount] = { ...attack, events }
  if (choice.medic) clips['back-med'] = { ...attack, events: events.map(event => event.cue === 'heal-contact'
    ? { ...event, cue: 'emitter' } : event) }
  const motions = Object.fromEntries(FACINGS.map(facing => {
    const frames = Object.fromEntries(Object.entries(set.frames[COMPLETE_VIEW[facing]]).map(([id, cel]) =>
      [id, { layers: [{ page: cel.page, rect: cel.rect, at: [0, 0] }], anchors: {} }]))
    return [facing, { frames, clips }]
  })) as SpriteBundle['motions'][string]
  const fitting = { id: choice.set, label: set.label, motion: choice.set,
    rig: Object.fromEntries(slots.map(slot => [slot, null])) as SpriteFitting['rig'] }
  return { kind: 'combat', fitting, art: { pages, bundle: { schemaVersion: 1, kind: 'combat-sprite-bundle',
    outfit, look: 'armor-helmet', character: bundle.character, version: bundle.version, universe: bundle.universe,
    status: bundle.status, cell: bundle.cell, foot: bundle.foot, reviewHeight: bundle.reviewHeight, figureHeight: bundle.figureHeight,
    sources: bundle.sources, pages: bundle.pages, motions: { [choice.set]: motions }, fittings: [fitting] } } }
}

type Published = NonNullable<CampaignRelease['combatSprites']>
const jsonOf = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes))

/** Complete looks come from the selected campaign. Atlases are decoded only for deployed sets. */
export async function campaignCombatLooks(input: BattleInput, published: Published = []): Promise<Map<string, CombatLook>> {
  const decoded: DecodedPages = new Map()
  const matched = published.flatMap(binding => {
    const units = input.units.flatMap(unit => {
      const choice = completeLoadout(binding, unit)
      return choice ? [{ unit, choice }] : []
    })
    return units.length ? [{ binding, units }] : []
  })
  const results = await Promise.all(matched.map(async ({ binding, units }) => {
    try {
      const { outfit, manifest, pages } = binding
      const bundle = parseCompleteSpriteBundle(jsonOf(await CONTENT.pack(manifest.path, manifest)))
      if (bundle.status !== 'approved' || (typeof outfit === 'string' && bundle.character !== (binding.original?.actor ?? outfit))) {
        throw new Error('Complete sprite identity mismatch')
      }
      const byFile = new Map(pages.map(page => [page.file, page]))
      const selectedSets = new Set(units.map(({ choice }) => choice.set))
      const usedPages = new Set(bundle.sets.filter(set => selectedSets.has(set.id))
        .flatMap(set => bundle.views.flatMap(view => Object.values(set.frames[view]).map(cel => cel.page))))
      const images = new Map<string, HTMLImageElement>()
      await Promise.all([...usedPages].map(async key => {
        const page = bundle.pages[key]!
        const ref = byFile.get(page.file)
        if (ref?.sha256 !== page.sha256 || ref.bytes !== page.bytes) throw new Error('Complete sprite page pin mismatch')
        let shared = decoded.get(ref.sha256)
        if (!shared) {
          shared = CONTENT.pack(ref.path, ref).then(async bytes => {
            const src = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }))
            try {
              const image = new Image()
              image.src = src
              await image.decode()
              return { image, bytes: bytes.length }
            } finally { URL.revokeObjectURL(src) }
          })
          decoded.set(ref.sha256, shared)
        }
        const { image, bytes } = await shared
        if (bytes !== page.bytes || image.naturalWidth !== page.width || image.naturalHeight !== page.height) {
          throw new Error('Complete sprite page dimensions differ')
        }
        images.set(key, image)
      }))
      return units.map(({ unit, choice }) => [unit.id, readyLook(bundle, outfit, choice, images)] as const)
    } catch (error) {
      console.warn('Campaign combat sprite unavailable', error)
      return []
    }
  }))
  return new Map(results.flat())
}
