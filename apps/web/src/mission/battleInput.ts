// A mission's battle (CY10, CY11): its scenario (the game's, in scenarios/, named by the mission) with the squad's Umas in
// the squad slots, in order, each with her bands, her rig as a loadout and her Stride; the crew left aboard is the bench
// (its roles for the one bench support call). Slots the squad doesn't fill keep their stand-ins.
import { parseScenario, scenarioInput, type Band, type Bands, type BattleInput, type BattleMap, type Loadout, type Role, type Scenario, type Stride, type UnitInput } from '@cyber/battle'
import { cohesionLevel, partnershipOf, sortieOrders, sortieSystems, type FinaleCondition, type PostKind, type Save } from '@cyber/domain'

const MAPS: Record<string, BattleMap> = Object.fromEntries(Object.entries(import.meta.glob<{ default: BattleMap }>('../../../../scenarios/maps/*.json', { eager: true }))
  .map(([path, m]) => [path.split('/').pop()!.replace('.json', ''), m.default]))
export const SCENARIOS: Record<string, Scenario> = Object.fromEntries(Object.values(import.meta.glob<{ default: unknown }>('../../../../scenarios/*.json', { eager: true }))
  .map((m) => { const s = parseScenario(m.default, MAPS); return [s.id, s] }))

export interface SquadUnit { outfit: number; label: string; bands: Bands; loadout: Loadout; stride: Stride | null }

/** A battle's units with Umas in its squad slots, in order (a null keeps that slot's stand-in): each Uma brings her bands,
 * her rig as a loadout and her Stride; the slot keeps its id, spawn, facing, Charge cap and Link. */
export function fillSquad(units: readonly UnitInput[], squad: readonly (SquadUnit | null)[]): UnitInput[] {
  let i = 0
  return units.map((u) => {
    if (u.side !== 'squad') return u
    const m = squad[i++]
    if (!m) return u
    return {
      id: u.id, side: u.side, spawn: u.spawn, facing: u.facing, chargeCap: u.chargeCap, link: u.link, bands: m.bands, loadout: m.loadout,
      ...(m.stride ? { stride: m.stride } : {}), ref: { kind: 'uma' as const, id: String(m.outfit) }, label: m.label,
    }
  })
}

export function missionInput(scenarioId: string, squad: readonly SquadUnit[], bench: readonly Role[], attempt: string): BattleInput {
  const s = SCENARIOS[scenarioId]
  if (!s) throw new Error(`no scenario ${scenarioId}`)
  const { bench: _bench, ...input } = s.input
  return scenarioInput({ ...s, input: { ...input, units: fillSquad(s.input.units, squad), ...(bench.length ? { bench: [...bench] } : {}) } }, MAPS[s.map]!, attempt)
}

/**
 * A mission's battle at rules version 3 (CY17): each Uma's bond (rank and path) and her partner when both are in the
 * squad, the captain's Orders the ship offers, the powered systems with their levels and their post holders' bands, and
 * the cook's meal; and (CY18) the deployed squad's cohesion and a finale's harsh conditions. Built from the save, frozen
 * into the input: the rules never read the save.
 */
export function lifeAboardInput(base: BattleInput, save: Save, bandOfPost: (post: PostKind) => Band | null, conditions: readonly FinaleCondition[] = []): BattleInput {
  const unitOf = new Map(base.units.filter((u) => u.side === 'squad' && u.ref?.kind === 'uma').map((u) => [Number(u.ref!.id), u.id]))
  const units = base.units.map((u) => {
    if (u.side !== 'squad' || u.ref?.kind !== 'uma') return u
    const outfit = Number(u.ref.id), m = save.crew.find((c) => c.outfit === outfit)
    const p = partnershipOf(save.partners, outfit)
    const mate = p ? unitOf.get(p.a === outfit ? p.b : p.a) : undefined
    return { ...u, ...(m ? { bond: { rank: m.bond.rank, path: m.bond.path } } : {}), ...(p && mate ? { partner: { unit: mate, level: p.level } } : {}) }
  })
  const { systems: _systems, meal: _meal, cohesion: _cohesion, conditions: _conditions, ...rest } = base
  const systems = sortieSystems(save.ship, bandOfPost)
  const cohesion = squadCohesion(save, unitOf)
  return {
    ...rest, rulesVersion: 3, units, orders: sortieOrders(save.ship, (base.bench ?? []).length > 0),
    ...(systems.length ? { systems } : {}), ...(save.meal ? { meal: save.meal } : {}), ...(cohesion ? { cohesion } : {}),
    ...(conditions.length ? { conditions: [...new Set(conditions)] } : {}),
  }
}

/** The squad that fights together (three or more of its members deployed, the most if two): its cohesion level, its
 * leader (or its first member deployed when she isn't) and its members' unit ids. Level 0 gives nothing. */
export function squadCohesion(save: Save, unitOf: ReadonlyMap<number, string>): BattleInput['cohesion'] | null {
  const fielded = save.squads.map((s) => ({ s, here: s.members.filter((m) => unitOf.has(m)) })).filter((x) => x.here.length >= 3)
    .sort((a, b) => b.here.length - a.here.length || b.s.cohesion - a.s.cohesion)[0]
  if (!fielded || cohesionLevel(fielded.s.cohesion) === 0) return null
  const leader = unitOf.get(fielded.here.includes(fielded.s.leader) ? fielded.s.leader : fielded.here[0]!)!
  return { level: cohesionLevel(fielded.s.cohesion), leader, members: fielded.here.map((m) => unitOf.get(m)!) }
}
