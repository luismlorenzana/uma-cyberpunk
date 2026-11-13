// A mission's battle (CY10, CY11): its scenario (the game's, in scenarios/, named by the mission) with the squad's Umas in
// the squad slots, in order, each with her bands, her rig as a loadout and her Stride; the crew left aboard is the bench
// (its roles for the one bench support call). Slots the squad doesn't fill keep their stand-ins.
import { parseScenario, scenarioInput, type Bands, type BattleInput, type BattleMap, type Loadout, type Role, type Scenario, type Stride } from '@cyber/battle'

const MAPS: Record<string, BattleMap> = Object.fromEntries(Object.entries(import.meta.glob<{ default: BattleMap }>('../../../../scenarios/maps/*.json', { eager: true }))
  .map(([path, m]) => [path.split('/').pop()!.replace('.json', ''), m.default]))
export const SCENARIOS: Record<string, Scenario> = Object.fromEntries(Object.values(import.meta.glob<{ default: unknown }>('../../../../scenarios/*.json', { eager: true }))
  .map((m) => { const s = parseScenario(m.default, MAPS); return [s.id, s] }))

export interface SquadUnit { outfit: number; label: string; bands: Bands; loadout: Loadout; stride: Stride | null }

export function missionInput(scenarioId: string, squad: readonly SquadUnit[], bench: readonly Role[], attempt: string): BattleInput {
  const s = SCENARIOS[scenarioId]
  if (!s) throw new Error(`no scenario ${scenarioId}`)
  let i = 0
  const units = s.input.units.map((u) => {
    if (u.side !== 'squad' || i >= squad.length) return u
    const m = squad[i++]!
    return {
      id: u.id, side: u.side, spawn: u.spawn, facing: u.facing, chargeCap: u.chargeCap, link: u.link, bands: m.bands, loadout: m.loadout,
      ...(m.stride ? { stride: m.stride } : {}), ref: { kind: 'uma' as const, id: String(m.outfit) }, label: m.label,
    }
  })
  const { bench: _bench, ...input } = s.input
  return scenarioInput({ ...s, input: { ...input, units, ...(bench.length ? { bench: [...bench] } : {}) } }, MAPS[s.map]!, attempt)
}
