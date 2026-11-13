// Attacks (TC19, TC21, TC23, TC25; CY4). One pure function works out a strike's numbers (hit %, crit %, damage, Guard,
// where hits land), and both the resolution and the forecast call it, so the forecast card and the result can't disagree.
// Resolution then rolls each hit with the seeded roll.
import { heightAt } from './map'
import { armed, evasionOf, guardOf, MOUNTS } from './rig'
import { roll } from './rng'
import { dirTo, distance, facingOf, inReach, pincerTile, sameTile } from './sight'
import { inputOf, rateOf, ticksToTurn } from './timeline'
import { TUNING } from './tuning'
import type { AttackRole, BattleState, Cue, Facing, Mount, PartId, Tile, UnitState, Weapon } from './types'
import { PARTS } from './types'

export interface Strike {
  attacker: string
  target: string
  mount: Mount
  weapon: Weapon
  from: Tile
  facing: Facing
  /** Per hit, %. */
  hit: number
  crit: number
  hits: number
  /** One hit's damage, and a crit's. */
  damage: number
  critDamage: number
  /** The Guard's cut, %, or 0. */
  guard: number
  aim?: PartId
  /** Where a hit lands, out of 100, with broken parts already sent to the Core. */
  weights: Record<PartId, number>
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const unitById = (state: Pick<BattleState, 'units'>, id: string): UnitState => state.units.find((u) => u.id === id)!
export const tileOf = (u: Pick<UnitState, 'x' | 'y'>): Tile => [u.x, u.y]

/** One hit's damage (TC19, TC23), in exact integer arithmetic: power (+ Power for Melee) × facing × height × Coat × crit ×
 * (100 − Guard), rounded down, at least 1. */
export function damageOf(input: { power: number; meleeBonus: number; facing: Facing; heightDiff: number; coat: boolean; crit: boolean; guard: number }): number {
  const base = input.power + input.meleeBonus
  const facing = input.facing === 'back' ? TUNING.backPct : input.facing === 'side' ? TUNING.sidePct : 100
  const height = 100 + TUNING.heightPctPerLevel * input.heightDiff
  const coat = input.coat ? TUNING.coatPct : 100
  const crit = input.crit ? TUNING.critPct : 100
  return Math.max(TUNING.minDamage, Math.floor((base * facing * height * coat * crit * (100 - input.guard)) / 1e10))
}

/** Where a strike's hits land: aimed, or the band's weights; a broken part's share goes to the Core. */
export function weightsFor(weapon: Weapon, target: Pick<UnitState, 'hp'>, aim?: PartId): Record<PartId, number> {
  const base = aim ? { core: 0, leftArm: 0, rightArm: 0, legs: 0, [aim]: 100 } : { ...TUNING.partWeights[weapon.band as 'melee' | 'short' | 'long'] }
  const out: Record<PartId, number> = { core: 0, leftArm: 0, rightArm: 0, legs: 0 }
  for (const part of PARTS) {
    const to = part !== 'core' && target.hp[part] <= 0 ? 'core' : part
    out[to] += base[part]
  }
  return out
}

/**
 * A strike's numbers: `attacker` firing `mount` from `from` at `target` where she stands. `facing` overrides where it
 * lands (Cover steps in to take it from the front). Null when the mount can't fire.
 */
export function strikeOf(state: Pick<BattleState, 'input' | 'units'>, attackerId: string, mount: Mount, targetId: string, from: Tile, opts: { aim?: PartId; facing?: Facing } = {}): Strike | null {
  const attacker = unitById(state, attackerId), target = unitById(state, targetId)
  const aIn = inputOf(state, attackerId), tIn = inputOf(state, targetId)
  const arm = armed(aIn, attacker, mount)
  if (!arm) return null
  const { weapon } = arm
  const map = state.input.map
  const facing = opts.facing ?? facingOf(tileOf(target), target.facing, from)
  const accuracy = arm.halfAccuracy ? Math.floor((weapon.accuracy * TUNING.oneArmTwoHandedPct) / 100) : weapon.accuracy
  const hit = clamp(accuracy + TUNING.witAccuracy * aIn.bands.wit - evasionOf(tIn, target) - (opts.aim ? TUNING.aimPenalty : 0), TUNING.hitClamp[0], TUNING.hitClamp[1])
  const guard = facing === 'back' ? 0 : guardOf(tIn, target)
  const numbers = {
    power: weapon.power,
    meleeBonus: weapon.band === 'melee' ? TUNING.meleePowerPerBand * aIn.bands.power : 0,
    facing,
    heightDiff: heightAt(map, from[0], from[1]) - heightAt(map, target.x, target.y),
    coat: tIn.loadout.coat === weapon.type,
    guard,
  }
  return {
    attacker: attackerId, target: targetId, mount, weapon, from, facing, hit, crit: weapon.crit ?? TUNING.baseCrit, hits: weapon.hits,
    damage: damageOf({ ...numbers, crit: false }), critDamage: damageOf({ ...numbers, crit: true }), guard, aim: opts.aim,
    weights: weightsFor(weapon, target, opts.aim),
  }
}

/** The first mount, in the fixed order, that can fire on a target from a tile, limited to some bands. */
export function mountFor(state: Pick<BattleState, 'input' | 'units'>, unitId: string, from: Tile, targetId: string, bands: readonly Weapon['band'][]): Mount | null {
  const u = unitById(state, unitId), t = unitById(state, targetId)
  for (const mount of MOUNTS) {
    const arm = armed(inputOf(state, unitId), u, mount)
    if (arm && bands.includes(arm.weapon.band) && inReach(state.input.map, arm.weapon, from, tileOf(t))) return mount
  }
  return null
}

/** Ids in the order their next turns come (the timeline's order), for Crossfire and Cover. */
export function timelineOrder(state: Pick<BattleState, 'input' | 'units' | 'turn'>, ids: readonly string[]): string[] {
  const rank = (id: string) => {
    const u = unitById(state, id), input = inputOf(state, id)
    return { id, ticks: ticksToTurn(u.clock, rateOf(input)), speed: input.bands.speed, tie: roll(state.input.seed, state.turn, id, 'order') }
  }
  return ids.map(rank).sort((a, b) => a.ticks - b.ticks || b.speed - a.speed || a.tie - b.tie).map((r) => r.id)
}

/** Who covers a target against an attack from `facing`: when her own shield doesn't guard it, the first adjacent ally in
 * timeline order with a whole shield arm, her link on and the Charge (TC21). */
export function coverFor(state: Pick<BattleState, 'input' | 'units' | 'turn'>, targetId: string, facing: Facing): string | null {
  const target = unitById(state, targetId)
  if (facing !== 'back' && guardOf(inputOf(state, targetId), target) > 0) return null
  const ids = state.units.filter((u) => u.side === target.side && u.id !== targetId && u.status === 'active' && u.link
    && u.charge >= TUNING.charge.cover && distance(tileOf(u), tileOf(target)) === 1 && guardOf(inputOf(state, u.id), u) > 0).map((u) => u.id)
  return timelineOrder(state, ids)[0] ?? null
}

export interface Joiner { unit: string; mount: Mount; how: 'pincer' | 'link' }

/** Who joins an attack from `from` on a target (TC21): up to two of the attacker's allies, in timeline order, with their
 * link on and the Charge, standing on the target's far side with a Melee or Short weapon in reach (a pincer) or with a
 * Short or Long weapon in reach and a line of fire (a link). */
export function crossfireFor(state: Pick<BattleState, 'input' | 'units' | 'turn'>, attackerId: string, from: Tile, targetId: string): Joiner[] {
  const attacker = unitById(state, attackerId), target = unitById(state, targetId)
  const far = pincerTile(tileOf(target), from)
  const found = new Map<string, Joiner>()
  for (const u of state.units) {
    if (u.side !== attacker.side || u.id === attackerId || u.status !== 'active' || !u.link || u.charge < TUNING.charge.crossfire) continue
    const at = tileOf(u)
    const pincer = sameTile(at, far) ? mountFor(state, u.id, at, targetId, ['melee', 'short']) : null
    if (pincer) found.set(u.id, { unit: u.id, mount: pincer, how: 'pincer' })
    else {
      const link = mountFor(state, u.id, at, targetId, ['short', 'long'])
      if (link) found.set(u.id, { unit: u.id, mount: link, how: 'link' })
    }
  }
  return timelineOrder(state, [...found.keys()]).slice(0, TUNING.crossfireMax).map((id) => found.get(id)!)
}

/** The counter a defender would answer with (TC21): she stands, has the Charge, the attack came from her front or side
 * and wasn't Long, and she has a Melee or Short weapon in reach of the attacker. */
export function counterFor(state: Pick<BattleState, 'input' | 'units'>, defenderId: string, attackerId: string, attackerAt: Tile, landed: Facing, band: Weapon['band']): Mount | null {
  const d = unitById(state, defenderId)
  if (d.status !== 'active' || d.charge < TUNING.charge.counter || landed === 'back' || band === 'long') return null
  const t = unitById(state, attackerId)
  if (t.status !== 'active') return null
  const units = state.units.map((u) => (u.id === attackerId ? { ...u, x: attackerAt[0], y: attackerAt[1] } : u))
  return mountFor({ input: state.input, units }, defenderId, tileOf(d), attackerId, ['melee', 'short'])
}

/** Spends Charge and says so. */
export function spendCharge(u: UnitState, amount: number, why: 'counter' | 'crossfire' | 'cover', cues: Cue[]): void {
  const from = u.charge
  u.charge -= amount
  cues.push({ kind: 'charge', unit: u.id, from, to: u.charge, why })
}

/** Rolls a strike's hits on the live state: hit, crit, part, damage, broken parts, Hold on and Rig Break. */
export function resolveStrike(state: BattleState, s: Strike, role: AttackRole, cues: Cue[]): void {
  const seed = state.input.seed, turn = state.turn
  const attacker = unitById(state, s.attacker), target = unitById(state, s.target)
  const tIn = inputOf(state, s.target)
  if (s.mount === 'back') attacker.ammo -= 1
  if (s.guard > 0) cues.push({ kind: 'guard', unit: s.target, cut: s.guard })
  for (let i = 0; i < s.hits; i++) {
    if (target.status !== 'active') break
    const purpose = `${role}:${s.target}:${i}`
    if (roll(seed, turn, s.attacker, `${purpose}:hit`) * 100 >= s.hit) {
      cues.push({ kind: 'miss', unit: s.attacker, target: s.target })
      continue
    }
    const crit = roll(seed, turn, s.attacker, `${purpose}:crit`) * 100 < s.crit
    let part: PartId = s.aim ?? 'core'
    if (!s.aim) {
      const base = TUNING.partWeights[s.weapon.band as 'melee' | 'short' | 'long']
      let r = roll(seed, turn, s.attacker, `${purpose}:part`) * 100
      for (const p of PARTS) {
        if (r < base[p]) { part = p; break }
        r -= base[p]
      }
    }
    if (part !== 'core' && target.hp[part] <= 0) part = 'core'
    const amount = crit ? s.critDamage : s.damage
    const before = target.hp[part]
    let after = Math.max(0, before - amount)
    let held = false
    if (part === 'core' && after === 0 && !target.holdOnUsed && tIn.bands.guts >= TUNING.holdOnBand) {
      after = TUNING.holdOnCore
      target.holdOnUsed = true
      held = true
    }
    target.hp[part] = after
    const broke = before > 0 && after === 0
    cues.push({ kind: 'hit', unit: s.attacker, target: s.target, part, amount, crit, broke })
    if (held) cues.push({ kind: 'holdOn', unit: s.target })
    if (broke) {
      cues.push({ kind: 'partBroke', unit: s.target, part })
      if (part === 'core') {
        target.status = 'down'
        cues.push({ kind: 'rigBreak', unit: s.target })
      }
    }
  }
}

/** The whole exchange of an attack on the live state: the attacker turns to her target, Cover may step in, the strike
 * rolls, allies join (Crossfire), and the defender counters. */
export function resolveAttack(state: BattleState, attackerId: string, mount: Mount, targetId: string, aim: PartId | undefined, cues: Cue[]): void {
  const attacker = unitById(state, attackerId)
  const from = tileOf(attacker)
  const target = unitById(state, targetId)
  const landed = facingOf(tileOf(target), target.facing, from)
  attacker.facing = dirTo(from, tileOf(target))
  const main = strikeOf(state, attackerId, mount, targetId, from, { aim })!
  const coverer = coverFor(state, targetId, landed)
  cues.push({ kind: 'attack', unit: attackerId, target: coverer ?? targetId, with: mount, band: main.weapon.band, role: 'main', facing: coverer ? 'front' : landed, ...(aim ? { aim } : {}) })
  if (coverer) {
    const c = unitById(state, coverer)
    spendCharge(c, TUNING.charge.cover, 'cover', cues)
    cues.push({ kind: 'cover', unit: coverer, for: targetId, attacker: attackerId })
    resolveStrike(state, strikeOf(state, attackerId, mount, coverer, from, { aim, facing: 'front' })!, 'main', cues)
  } else resolveStrike(state, main, 'main', cues)
  if (target.status === 'active') {
    for (const j of crossfireFor(state, attackerId, from, targetId)) {
      if (target.status !== 'active') break
      const u = unitById(state, j.unit)
      spendCharge(u, TUNING.charge.crossfire, 'crossfire', cues)
      cues.push({ kind: 'crossfire', unit: j.unit, target: targetId, how: j.how })
      const s = strikeOf(state, j.unit, j.mount, targetId, tileOf(u))!
      cues.push({ kind: 'attack', unit: j.unit, target: targetId, with: j.mount, band: s.weapon.band, role: 'crossfire', facing: s.facing })
      resolveStrike(state, s, 'crossfire', cues)
    }
  }
  if (coverer) return
  const counter = counterFor(state, targetId, attackerId, from, landed, main.weapon.band)
  if (!counter) return
  spendCharge(target, TUNING.charge.counter, 'counter', cues)
  cues.push({ kind: 'counter', unit: targetId, target: attackerId })
  const s = strikeOf(state, targetId, counter, attackerId, tileOf(target))!
  cues.push({ kind: 'attack', unit: targetId, target: attackerId, with: counter, band: s.weapon.band, role: 'counter', facing: s.facing })
  resolveStrike(state, s, 'counter', cues)
}
