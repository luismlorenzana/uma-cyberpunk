// The sandbox's squad (D19): who fills each squad slot. A pick is a tier 1 Uma (by outfit id) and her role (null: her
// default, from her running style); a slot with no pick keeps the scenario's stand-in. Each Uma fights as the crew does
// (CY11): her bands from master data's 5★ stats, her Stride, and the best rig for her role. Scenarios stay stand-in only
// (they're in git); the picks are this phone's own, applied when a battle starts. Pure, tested headless.
import type { BattleInput, Role } from '@cyber/battle'
import { loadoutOf, newMember } from '@cyber/domain'
import type { ArtIndex } from '@luismlorenzana/uma-data'
import { TIER_1 } from '../crew/tier1'
import { memberView, type CrewView, type InfoOf } from '../crew/view'
import { hasSet } from '../board/looks'
import { fillSquad } from '../mission/battleInput'

export interface Pick { outfit: number; role: Role | null }
/** One entry a squad slot, in order; null keeps the stand-in. */
export type SquadPicks = (Pick | null)[]

/** A first visit's squad: four tier 1 Umas, those with their chibis first, in ranking order. */
export function defaultPicks(art: ArtIndex | null): SquadPicks {
  const ordered = [...TIER_1.filter((o) => hasSet(art, o)), ...TIER_1.filter((o) => !hasSet(art, o))]
  return ordered.slice(0, 4).map((outfit) => ({ outfit, role: null }))
}

/** A pick as the crew sees her (no story tag in the sandbox: her role is the one picked, else her running style's). */
export const pickView = (p: Pick, infoOf: InfoOf, nameOf: (outfit: number) => string): CrewView =>
  memberView({ ...newMember(p.outfit), role: p.role }, null, infoOf, nameOf)

/** The battle's input with the picks in its squad slots, and tier 1's other Umas as the bench (each role once, for the one
 * bench support call), unless no slot has a pick. */
export function applyPicks(input: BattleInput, picks: SquadPicks, infoOf: InfoOf, nameOf: (outfit: number) => string): BattleInput {
  const slots = input.units.filter((u) => u.side === 'squad').length
  const used = picks.slice(0, slots)
  if (!used.some((p) => p)) return input
  const squad = used.map((p) => {
    if (!p) return null
    const v = pickView(p, infoOf, nameOf)
    return { outfit: v.outfit, label: v.name, bands: v.bands, loadout: loadoutOf(v.rig), stride: v.stride }
  })
  const picked = new Set(used.flatMap((p) => (p ? [p.outfit] : [])))
  const bench = [...new Set(TIER_1.filter((o) => !picked.has(o)).map((o) => pickView({ outfit: o, role: null }, infoOf, nameOf).role))]
  return { ...input, units: fillSquad(input.units, squad), ...(bench.length ? { bench } : {}) }
}

const KEY = 'cyber-sandbox-squad'
/** This phone's picks, or null (a first visit, or storage closed). */
export function readPicks(): SquadPicks | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown
    return Array.isArray(v) ? v.map((p) => (p && typeof p === 'object' && Number.isSafeInteger((p as Pick).outfit) ? { outfit: (p as Pick).outfit, role: (p as Pick).role ?? null } : null)) : null
  } catch { return null }
}
export function writePicks(picks: SquadPicks): void {
  try { localStorage.setItem(KEY, JSON.stringify(picks)) } catch { /* a closed storage keeps the picks for this visit only */ }
}
