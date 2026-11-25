import type { BattleInput, HeroineSpriteRole, Tile, UnitInput } from '@cyber/battle'
import { issuedCampaignRig } from '../campaign-gear'
import { loadoutOf, PARTS_BY_ID, type Rig } from '../crew/parts'
import type { P } from './parse'
import type { Casting } from './types'

export interface GroundFormation {
  lead: { unit: string; outfit: number; alternate?: { flag: string; at: Tile } }
  ally: { unit: string; heroine: string; label: string; at: Tile; released: string; main: string; back: string; spriteForm?: string }
  opponents: { unit: string; from: string; heroine: string; label: string; at?: Tile; spriteForm?: string; spriteRole?: Exclude<HeroineSpriteRole, 'boss-ally'> }[]
  duoWhen?: string
  advisory?: true
}

export function parseGroundFormation(p: P, value: unknown, path: string, casting: Casting, missionLead: number | undefined): GroundFormation {
  const source = p.object(value, path, ['lead', 'ally', 'opponents', 'duoWhen', 'advisory'], ['lead', 'ally', 'opponents'])
  if (source.advisory !== undefined && (source.advisory !== true || source.duoWhen !== undefined)) {
    p.fail(path + '.advisory', 'an adviser has no deployed Duo action')
  }
  const lead = p.object(source.lead, `${path}.lead`, ['unit', 'outfit', 'alternate'], ['unit', 'outfit'])
  const ally = p.object(source.ally, `${path}.ally`, ['unit', 'heroine', 'label', 'at', 'released', 'main', 'back', 'spriteForm'],
    ['unit', 'heroine', 'label', 'at', 'released', 'main', 'back'])
  const heroine = (value: unknown, field: string) => {
    const id = p.slug(value, field)
    return casting.heroines.some((entry) => entry.board === id) ? id : p.fail(field, 'expected a heroine from casting')
  }
  const tile = (value: unknown, field: string): Tile => {
    if (!Array.isArray(value) || value.length !== 2) return p.fail(field, 'expected an x and y spawn')
    return [p.int(value[0], `${field}[0]`, 0, 13), p.int(value[1], `${field}[1]`, 0, 13)]
  }
  const unit = p.slug(lead.unit, `${path}.lead.unit`), outfit = p.outfit(lead.outfit, `${path}.lead.outfit`)
  const alternate = lead.alternate === undefined ? undefined : (() => {
    const spec = p.object(lead.alternate, `${path}.lead.alternate`, ['flag', 'at'])
    return { flag: p.slug(spec.flag, `${path}.lead.alternate.flag`), at: tile(spec.at, `${path}.lead.alternate.at`) }
  })()
  const main = p.slug(ally.main, `${path}.ally.main`), back = p.slug(ally.back, `${path}.ally.back`)
  const weapon = PARTS_BY_ID.get(main)
  if (weapon?.slot !== 'hand' || weapon.item.kind !== 'weapon') p.fail(`${path}.ally.main`, 'expected a hand weapon')
  if (PARTS_BY_ID.get(back)?.slot !== 'back') p.fail(`${path}.ally.back`, 'expected a Back unit')
  if (missionLead !== outfit) p.fail(`${path}.lead.outfit`, 'expected the mission lead')
  const second = {
    unit: p.slug(ally.unit, `${path}.ally.unit`), heroine: heroine(ally.heroine, `${path}.ally.heroine`),
    label: p.text(ally.label, `${path}.ally.label`, 48), at: tile(ally.at, `${path}.ally.at`),
    released: p.slug(ally.released, `${path}.ally.released`), main, back,
    ...(ally.spriteForm === undefined ? {} : { spriteForm: p.slug(ally.spriteForm, `${path}.ally.spriteForm`) }),
  }
  const units = new Set([unit, second.unit]), actors = new Set([second.heroine])
  if (units.size !== 2) p.fail(`${path}.ally.unit`, 'expected another unit')
  const opponents = p.list<GroundFormation['opponents'][number]>(source.opponents, `${path}.opponents`, (raw, field) => {
    const row = p.object(raw, field, ['unit', 'from', 'heroine', 'label', 'at', 'spriteForm', 'spriteRole'], ['unit', 'from', 'heroine', 'label'])
    const unit = p.slug(row.unit, `${field}.unit`), actor = heroine(row.heroine, `${field}.heroine`)
    if (units.has(unit) || actors.has(actor)) p.fail(field, 'expected a unique unit and actor')
    units.add(unit)
    actors.add(actor)
    const spriteRole = row.spriteRole
    if (spriteRole !== undefined && spriteRole !== 'boss-enemy' && spriteRole !== 'sub-boss') return p.fail(`${field}.spriteRole`, 'expected an opposing role')
    return { unit, from: p.slug(row.from, `${field}.from`), heroine: actor, label: p.text(row.label, `${field}.label`, 48),
      ...(spriteRole ? { spriteRole } : {}),
      ...(row.spriteForm === undefined ? {} : { spriteForm: p.slug(row.spriteForm, `${field}.spriteForm`) }),
      ...(row.at === undefined ? {} : { at: tile(row.at, `${field}.at`) }) }
  }, 8)
  if (!opponents.length) p.fail(`${path}.opponents`, 'expected the opposing formation')
  return { lead: { unit, outfit, ...(alternate ? { alternate } : {}) }, ally: second, opponents,
    ...(source.advisory === true ? { advisory: true as const } : {}),
    ...(source.duoWhen === undefined ? {} : { duoWhen: p.slug(source.duoWhen, `${path}.duoWhen`) }) }
}

/** Freeze the named opposition and any deployed ally on the scenario's existing geometry. */
export function formGroundBattle(input: BattleInput, formation: GroundFormation, flags?: readonly string[], allyRig?: Rig): BattleInput {
  const lead = input.units.find((u) => u.side === 'squad' && u.id === formation.lead.unit)
  const support = input.units.filter(unit => unit.side === 'squad' && unit !== lead)
  if (!lead || (!formation.advisory && support.length !== 0)) throw new Error('The formation needs its named lead template')
  if (flags && (lead.ref?.kind !== 'uma' || lead.ref.id !== String(formation.lead.outfit) || !flags.includes(formation.ally.released))) {
    throw new Error('The named pair must be cleared for this sortie')
  }
  const spawns = { squad: [...input.map.spawns.squad], enemy: [...input.map.spawns.enemy] }
  function spawn(side: UnitInput['side'], at: Tile): number {
    const pool = spawns[side]
    const existing = pool.findIndex(([x, y]) => x === at[0] && y === at[1])
    return existing >= 0 ? existing : pool.push(at) - 1
  }
  const alternate = formation.lead.alternate
  const entry = alternate && flags?.includes(alternate.flag) ? { ...lead, spawn: spawn('squad', alternate.at) } : lead
  const enemies = formation.opponents.map((actor): UnitInput => {
    const source = input.units.find((u) => u.side === 'enemy' && u.id === actor.from)
    if (!source || (source.id !== actor.unit && (!actor.at || source.leader))) throw new Error(`Missing a legal opponent template for ${actor.unit}`)
    return { ...source, id: actor.unit, spawn: actor.at ? spawn('enemy', actor.at) : source.spawn,
      ref: { kind: 'heroine', id: actor.heroine }, label: actor.label,
      sprite: { role: actor.spriteRole ?? 'sub-boss', form: actor.spriteForm ?? 'standard', fitting: actor.from } }
  })
  if (formation.advisory) return { ...input, map: { ...input.map, spawns }, units: [entry, ...support, ...enemies] }
  const ally = formation.ally
  const rig = allyRig ?? issuedCampaignRig(ally.main, ally.back)
  const duo = !!formation.duoWhen && !!flags?.includes(formation.duoWhen)
  const second: UnitInput = { id: ally.unit, side: 'squad', spawn: spawn('squad', ally.at), bands: lead.bands,
    facing: lead.facing, chargeCap: lead.chargeCap, link: true, loadout: loadoutOf(rig), frozenRig: rig,
    ref: { kind: 'heroine', id: ally.heroine }, label: ally.label,
    sprite: { role: 'boss-ally', form: ally.spriteForm ?? 'standard' },
    ...(duo ? { partner: { unit: lead.id, level: 3 } } : {}) }
  return { ...input, map: { ...input.map, spawns }, units: [
    duo ? { ...entry, partner: { unit: ally.unit, level: 3 } } : entry, second, ...enemies,
  ] }
}
