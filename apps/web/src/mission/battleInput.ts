// A mission's battle (CY10): its scenario (the game's, in scenarios/, named by the mission) with the squad's Umas in the
// squad slots, in order. Slots the squad doesn't fill keep their stand-ins (CY11 brings loadouts per Uma).
import { parseScenario, scenarioInput, type BattleInput, type BattleMap, type Scenario } from '@cyber/battle'

const MAPS: Record<string, BattleMap> = Object.fromEntries(Object.entries(import.meta.glob<{ default: BattleMap }>('../../../../scenarios/maps/*.json', { eager: true }))
  .map(([path, m]) => [path.split('/').pop()!.replace('.json', ''), m.default]))
export const SCENARIOS: Record<string, Scenario> = Object.fromEntries(Object.values(import.meta.glob<{ default: unknown }>('../../../../scenarios/*.json', { eager: true }))
  .map((m) => { const s = parseScenario(m.default, MAPS); return [s.id, s] }))

export function missionInput(scenarioId: string, squad: readonly number[], nameOf: (outfit: number) => string, attempt: string): BattleInput {
  const s = SCENARIOS[scenarioId]
  if (!s) throw new Error(`no scenario ${scenarioId}`)
  let i = 0
  const units = s.input.units.map((u) => {
    if (u.side !== 'squad' || i >= squad.length) return u
    const outfit = squad[i++]!
    return { ...u, ref: { kind: 'uma' as const, id: String(outfit) }, label: nameOf(outfit) }
  })
  return scenarioInput({ ...s, input: { ...s.input, units } }, MAPS[s.map]!, attempt)
}
