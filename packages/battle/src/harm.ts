// Harm (CY4, CY5): damage to a part, with Hold on, a broken part and Rig Break, shared by strikes, terrain, the bench
// support call and the Steel Muster's volley; and Charge spent with its cue.
import { inputOf } from './timeline'
import { TUNING } from './tuning'
import type { BattleState, ChargeWhy, Cue, FreeMethod, PartId, Tile, UnitState } from './types'
import { answer, endure, shielded } from './v3'

export const unitById = (state: Pick<BattleState, 'units'>, id: string): UnitState => state.units.find((u) => u.id === id)!
export const tileOf = (u: Pick<UnitState, 'x' | 'y'>): Tile => [u.x, u.y]
export const v2 = (state: Pick<BattleState, 'input'>): boolean => state.input.rulesVersion >= 2

/** Frees a heroine: she leaves the field and counts as beaten. */
export function free(state: Pick<BattleState, 'input'>, target: UnitState, by: FreeMethod, cues: Cue[]): void {
  target.status = 'freed'
  delete target.stunned
  if (state.input.rulesVersion >= 5) {
    target.freedBy = by
    if (target.holdHp !== undefined) target.holdHp = 0
  }
  cues.push({ kind: 'freed', unit: target.id, by })
}

export function hitForTalk(state: Pick<BattleState, 'input'>, source: string, target: UnitState): void {
  if (state.input.talk?.some((c) => c.requires === 'actorHit' && c.actor === source && c.target === target.id)) target.talkHit = true
}

/** Only an encounter with the new Collar policy frees its leader on Rig Break. */
export function breaksCollar(state: Pick<BattleState, 'input'>, id: string): boolean {
  const objective = state.input.objective
  if (state.input.rulesVersion < 5 || objective.kind !== 'freeLeader' || objective.collar !== 'rigBreak') return false
  const unit = inputOf(state, id)
  return unit.side === 'enemy' && !!unit.leader && unit.hold === 'collar'
}

/** Damage to a part: the cue `say` makes comes first (with whether the part broke), then Hold on, the broken part and
 * Rig Break. A Core-breaking hit leaves a Guts 4+ unit at Core 1, once a battle. */
export function harm(state: BattleState, target: UnitState, part: PartId, amount: number, cues: Cue[], say: (broke: boolean) => Cue): void {
  // Rules version 3: the Shield Projector's shield takes it first.
  if (state.v3) amount = shielded(state, target, amount, cues)
  const before = target.hp[part]
  let after = Math.max(0, before - amount)
  let held = false
  if (part === 'core' && after === 0 && before > 0 && !target.holdOnUsed && inputOf(state, target.id).bands.guts >= TUNING.holdOnBand) {
    after = TUNING.holdOnCore
    target.holdOnUsed = true
    held = true
  }
  // Rules version 3: Endure (bond rank 8), a second use once a battle, never on the hit Hold on just caught.
  if (part === 'core' && before > 0 && state.v3) after = endure(state, target, after, held, cues)
  target.hp[part] = after
  const broke = before > 0 && after === 0
  const cue = say(broke)
  cues.push(cue)
  if (cue.kind === 'hit' && amount > 0) hitForTalk(state, cue.unit, target)
  if (held) cues.push({ kind: 'holdOn', unit: target.id })
  if (broke) {
    cues.push({ kind: 'partBroke', unit: target.id, part })
    if (part === 'core') {
      target.status = 'down'
      delete target.stunned
      delete target.windup
      cues.push({ kind: 'rigBreak', unit: target.id })
      if (state.v3) answer(state, target, cues)
      if (breaksCollar(state, target.id)) free(state, target, 'rigBreak', cues)
    }
  }
}

/** Spends Charge and says so. */
export function spendCharge(u: UnitState, amount: number, why: ChargeWhy, cues: Cue[]): void {
  const from = u.charge
  u.charge -= amount
  cues.push({ kind: 'charge', unit: u.id, from, to: u.charge, why })
}

/** Gains Charge up to her cap and says so. */
export function gainCharge(state: Pick<BattleState, 'input'>, u: UnitState, amount: number, why: ChargeWhy, cues: Cue[]): void {
  const from = u.charge
  u.charge = Math.min(inputOf(state, u.id).chargeCap, u.charge + amount)
  if (u.charge !== from) cues.push({ kind: 'charge', unit: u.id, from, to: u.charge, why })
}
