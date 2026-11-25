// Tech and the Holds (TC19, TC26, WD9; CY5, rules version 2): the Deck's Stun, Jam and Jack-Out on Wit against Guts;
// hacking terminals (doors, turrets, lifts, the lights); and each enemy's fate at the end, with her salvage.
import { harmHold, stun } from './attack'
import { free, spendCharge, tileOf, unitById } from './harm'
import { armless } from './rig'
import { roll } from './rng'
import { distance } from './sight'
import { inputOf } from './timeline'
import { TUNING } from './tuning'
import type { BattleState, Cue, EnemyOutcome, Prop, TechKind, Tile, UnitState } from './types'
import { PARTS } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const hasDeck = (state: Pick<BattleState, 'input'>, id: string): boolean => inputOf(state, id).loadout.back.kind === 'deck'
export const TECH_CHARGE: Record<TechKind, number> = { stun: TUNING.tech.stun, jam: TUNING.tech.jam, jackout: TUNING.tech.jackOut }

/** A Tech action's chance: 50% + 5% a Wit band − 10% a target's Guts band, clamped 5–95%. */
export function techChance(state: Pick<BattleState, 'input'>, unitId: string, targetId: string): number {
  const t = TUNING.tech
  return clamp(t.base + t.perWit * inputOf(state, unitId).bands.wit - t.perGuts * inputOf(state, targetId).bands.guts, t.clamp[0], t.clamp[1])
}

/** A heroine: she carries a Hold field (anchor, collar or none). */
export const isHeroine = (state: Pick<BattleState, 'input'>, id: string): boolean => inputOf(state, id).hold !== undefined

/** Why a Tech action can't be made from a tile, or null. */
export function techError(state: Pick<BattleState, 'input' | 'units'>, unitId: string, tech: TechKind, targetId: string, from: Tile): string | null {
  const u = unitById(state, unitId)
  if (!hasDeck(state, unitId)) return `${unitId} has no Deck`
  const role = inputOf(state, unitId).specialty
  if (role?.kind === 'laser' && role.subclass === 'support' && tech !== 'jam') return 'Support training has Jam and terminal access'
  if (armless(u)) return `${unitId} has no arm to work the Deck`
  const t = state.units.find((x) => x.id === targetId)
  if (!t || t.side === u.side || t.status !== 'active') return `${targetId} isn't a standing enemy`
  if (u.charge < TECH_CHARGE[tech]) return `${unitId} needs ${TECH_CHARGE[tech]} Charge`
  const d = distance(from, tileOf(t))
  if (tech === 'jackout') {
    if (d !== TUNING.tech.jackOutRange) return 'Jack-Out needs her next to the target'
    if (!isHeroine(state, targetId)) return `${targetId} isn't a heroine`
    if (t.hp.core * 100 >= t.maxHp.core * TUNING.tech.jackOutCorePct) return `${targetId}'s Core is above ${TUNING.tech.jackOutCorePct}%`
  } else if (d < TUNING.tech.range[0] || d > TUNING.tech.range[1]) return `${targetId} is out of Tech range`
  return null
}

/** Resolves a Tech action: the Charge, the roll, and on a success Stun, Jam (−1 Charge) or a Jack-Out (freed). A landed
 * Stun or Jam on a held heroine also hurts her Hold. Never countered. */
export function resolveTech(state: BattleState, unitId: string, tech: TechKind, targetId: string, cues: Cue[]): void {
  const u = unitById(state, unitId), t = unitById(state, targetId)
  spendCharge(u, TECH_CHARGE[tech], 'tech', cues)
  const landed = roll(state.input.seed, state.turn, unitId, `tech:${tech}:${targetId}`) * 100 < techChance(state, unitId, targetId)
  cues.push({ kind: 'tech', unit: unitId, target: targetId, tech, landed })
  if (!landed) return
  if (tech === 'jackout') return free(state, t, 'jackout', cues)
  if (tech === 'stun') stun(state, t, cues)
  else if (t.charge > 0) spendCharge(t, 1, 'jam', cues)
  if (t.holdHp) harmHold(state, unitId, t, TUNING.tech.holdDamage, cues)
}

// --- Terminals --------------------------------------------------------------------------------------------------------

export const terminalOf = (state: Pick<BattleState, 'input'>, id: string): Extract<Prop, { kind: 'terminal' }> | undefined =>
  (state.input.map.props ?? []).find((p): p is Extract<Prop, { kind: 'terminal' }> => p.kind === 'terminal' && p.id === id)
const propOf = (state: Pick<BattleState, 'input'>, id: string): Prop | undefined => (state.input.map.props ?? []).find((p) => p.id === id)

/** Why a terminal can't be hacked from a tile, or null. A door won't shut on someone. */
export function hackError(state: Pick<BattleState, 'input' | 'units' | 'field'>, unitId: string, terminalId: string, from: Tile): string | null {
  const term = terminalOf(state, terminalId)
  if (!term) return `no terminal ${terminalId}`
  if (!hasDeck(state, unitId)) return `${unitId} has no Deck`
  const u = unitById(state, unitId)
  if (u.charge < TUNING.tech.hack) return `${unitId} needs ${TUNING.tech.hack} Charge`
  const d = distance(from, term.tile)
  if (d < TUNING.tech.hackRange[0] || d > TUNING.tech.hackRange[1]) return `${terminalId} is out of range`
  const does = term.does
  if ('door' in does) {
    const door = propOf(state, does.door)
    if (door?.kind === 'door' && state.field!.doors[door.id] && door.tiles.some((t) => state.units.some((x) => (x.status === 'active' || x.status === 'down') && !(x.id === unitId) && x.x === t[0] && x.y === t[1]) || (t[0] === from[0] && t[1] === from[1])))
      return 'the door would shut on someone'
  }
  if ('turret' in does) {
    const turret = state.units.find((x) => x.id === does.turret)
    if (!turret || turret.status !== 'active' || turret.side === u.side) return 'the turret is already hers'
  }
  return null
}

/** Hacks a terminal: 1 Charge, no roll. A door opens or shuts, a turret turns to her side, a lift moves, or the lights go
 * out for two rounds. */
export function resolveHack(state: BattleState, unitId: string, terminalId: string, cues: Cue[]): void {
  const field = state.field!
  const u = unitById(state, unitId)
  spendCharge(u, TUNING.tech.hack, 'hack', cues)
  if (!field.hacked.includes(terminalId)) field.hacked.push(terminalId)
  cues.push({ kind: 'hacked', unit: unitId, terminal: terminalId })
  const does = terminalOf(state, terminalId)!.does
  if ('door' in does) {
    const door = propOf(state, does.door) as Extract<Prop, { kind: 'door' }>
    field.doors[door.id] = !field.doors[door.id]
    cues.push({ kind: 'door', door: door.id, open: field.doors[door.id]!, tiles: [...door.tiles] })
  } else if ('lift' in does) {
    const lift = propOf(state, does.lift) as Extract<Prop, { kind: 'lift' }>
    field.lifts[lift.id] = !field.lifts[lift.id]
    cues.push({ kind: 'heights', lift: lift.id, tiles: [...lift.tiles], height: field.lifts[lift.id] ? lift.high : lift.low })
  } else if ('turret' in does) {
    const turret = unitById(state, does.turret)
    turret.side = u.side
    cues.push({ kind: 'turned', unit: turret.id, side: u.side })
  } else {
    field.lightsOutUntil = state.time + TUNING.terrain.lightsRounds * TUNING.roundTicks
    cues.push({ kind: 'lights', out: true })
  }
}

// --- Outcomes ---------------------------------------------------------------------------------------------------------

/** Each enemy's fate at the end: freed (by her Hold or a Jack-Out), broken (Rig Break) or standing, with her salvage: her
 * unbroken parts, freed or broken alike (TC26). */
export function outcomes(state: Pick<BattleState, 'input' | 'units'>): EnemyOutcome[] {
  const input = state.input.units
  return input.filter((i) => i.side === 'enemy').map((i) => {
    const u: UnitState = state.units.find((x) => x.id === i.id)!
    const fate = u.status === 'freed' ? 'freed' : u.status === 'active' ? 'standing' : 'broken'
    if (u.talked) return { id: u.id, fate, salvage: [], talk: u.talked }
    const home = fate === 'broken' ? state.input.talk?.find((c) => c.target === u.id)?.brokenOutcome : undefined
    return { id: u.id, fate, salvage: fate === 'standing' ? [] : PARTS.filter((p) => u.hp[p] > 0),
      ...(home ? { home } : {}), ...(u.freedBy ? { freedBy: u.freedBy } : {}) }
  })
}
