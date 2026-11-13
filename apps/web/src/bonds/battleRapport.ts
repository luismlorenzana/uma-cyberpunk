// A battle's rapport (CY13, TC56), read from the battle's own cues: each Uma who fought, plus once each for covering an
// ally and joining a Crossfire. It replays the battle, so it lives beside the battle code, out of the startup bundle; the
// mission screen hands its result to the results step (`closeResults`).
import { replayBattle, type BattleAction, type BattleInput } from '@cyber/battle'
import { BOND_TUNING } from '@cyber/domain'

export function battleRapport(input: BattleInput, actions: readonly BattleAction[]): Map<number, number> {
  const outfitOf = new Map(input.units.filter((u) => u.side === 'squad' && u.ref?.kind === 'uma').map((u) => [u.id, Number(u.ref!.id)]))
  const out = new Map<number, number>([...outfitOf.values()].map((o) => [o, BOND_TUNING.battle]))
  const once = new Set<string>()
  const add = (unit: string, why: 'cover' | 'crossfire') => {
    const outfit = outfitOf.get(unit)
    if (outfit === undefined || once.has(`${unit}:${why}`)) return
    once.add(`${unit}:${why}`)
    out.set(outfit, (out.get(outfit) ?? 0) + BOND_TUNING[why])
  }
  let cues
  try { cues = replayBattle(input, actions).cues.flat() } catch { return out }
  for (const c of cues) {
    if (c.kind === 'cover') add(c.unit, 'cover')
    if (c.kind === 'attack' && c.role === 'crossfire') add(c.unit, 'crossfire')
  }
  return out
}
