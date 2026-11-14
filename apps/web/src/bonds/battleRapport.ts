// A battle's rapport (CY13, TC56), read from the battle's own cues: each Uma who fought, plus once each for covering an
// ally and joining a Crossfire. It replays the battle, so it lives beside the battle code, out of the startup bundle; the
// mission screen hands its result to the results step (`closeResults`).
import { replayBattle, type BattleAction, type BattleInput } from '@cyber/battle'
import { BOND_TUNING, pairKey, PARTNER_TUNING } from '@cyber/domain'

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

/** A battle's camaraderie (CY17, TC58), read from its cues: every pair of Umas who fought it together, and more for a
 * pair where one covered or rebooted the other. */
export function battleCamaraderie(input: BattleInput, actions: readonly BattleAction[]): Map<string, number> {
  const outfitOf = new Map(input.units.filter((u) => u.side === 'squad' && u.ref?.kind === 'uma').map((u) => [u.id, Number(u.ref!.id)]))
  const outfits = [...outfitOf.values()]
  const out = new Map<string, number>()
  for (let i = 0; i < outfits.length; i++) for (let j = i + 1; j < outfits.length; j++) out.set(pairKey(outfits[i]!, outfits[j]!), PARTNER_TUNING.battle)
  let cues
  try { cues = replayBattle(input, actions).cues.flat() } catch { return out }
  const assisted = new Set<string>()
  for (const c of cues) {
    const pair = c.kind === 'cover' ? [c.unit, c.for] : c.kind === 'rebooted' ? [c.unit, c.target] : null
    const a = pair ? outfitOf.get(pair[0]!) : undefined, b = pair ? outfitOf.get(pair[1]!) : undefined
    if (a === undefined || b === undefined || a === b) continue
    const k = pairKey(a, b)
    if (assisted.has(k)) continue
    assisted.add(k)
    out.set(k, (out.get(k) ?? 0) + PARTNER_TUNING.assist)
  }
  return out
}
