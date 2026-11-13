// Attacks (TC19, TC21–TC23, TC25, TC26; CY4, CY5). One pure function works out a strike's numbers (hit %, crit %,
// damage, Guard, where hits land), and both the resolution and the forecast call it, so the forecast card and the result
// can't disagree. Resolution then rolls each hit with the seeded roll. Rules version 2 adds cover, Smoke, the lights and
// pinning fire to hit %; aiming at a Hold; barrels, pipes and barriers as targets; the five chance skills; an impact hit
// that Stuns; Fire from F hits; and the Steel Muster's reload and meter.
import { harm, spendCharge, tileOf, unitById, v2 } from './harm'
import { afterMusterAttack, pin } from './muster'
import { armed, evasionOf, guardOf, MOUNTS } from './rig'
import { roll } from './rng'
import { dirTo, distance, facingOf, inReach, pincerTile, sameTile } from './sight'
import { boardOf, cross, lightsOut, setState, type Board } from './terrain'
import { inputOf, rateOf, ticksToTurn } from './timeline'
import { TUNING } from './tuning'
import type { AimAt, AttackRole, BattleState, ChanceSkill, Cue, Facing, Mount, PartId, Prop, Tile, UnitState, Weapon } from './types'
import { PARTS } from './types'

export { spendCharge, tileOf, unitById }

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
  aim?: AimAt
  /** Where a hit lands, out of 100, with broken parts already sent to the Core (all 0 when aimed at the Hold). */
  weights: Record<PartId, number>
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

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
export function weightsFor(weapon: Weapon, target: Pick<UnitState, 'hp'>, aim?: AimAt): Record<PartId, number> {
  const out: Record<PartId, number> = { core: 0, leftArm: 0, rightArm: 0, legs: 0 }
  if (aim === 'hold') return out
  const base = aim ? { core: 0, leftArm: 0, rightArm: 0, legs: 0, [aim]: 100 } : { ...TUNING.partWeights[weapon.band as 'melee' | 'short' | 'long'] }
  for (const part of PARTS) {
    const to = part !== 'core' && target.hp[part] <= 0 ? 'core' : part
    out[to] += base[part]
  }
  return out
}

/** Can she aim? A Visor with `aim`, or (rules version 2) a Launcher (TC5). */
export function canAim(state: Pick<BattleState, 'input'>, unitId: string): boolean {
  const l = inputOf(state, unitId).loadout
  return !!l.visor.aim || (v2(state) && l.back.kind === 'launcher')
}

/** Rules version 2's hit % off for a ranged strike: the target on cover (front and sides), Smoke at either end, the lights
 * out, and the attacker pinned. */
function rangedPenalty(state: Pick<BattleState, 'input' | 'field' | 'time' | 'units'>, board: Board, attacker: UnitState, band: Weapon['band'], from: Tile, to: Tile, facing: Facing | null): number {
  if (!v2(state)) return 0
  let off = attacker.pinned ? TUNING.muster.pinPenalty : 0
  if (band === 'short' || band === 'long') {
    const t = TUNING.terrain
    if (facing !== null && facing !== 'back' && board.cover(to[0], to[1])) off += t.coverEvasion
    if (board.smoky(from[0], from[1]) || board.smoky(to[0], to[1])) off += t.smokePenalty
    if (lightsOut(state)) off += t.lightsPenalty
  }
  return off
}

/**
 * A strike's numbers: `attacker` firing `mount` from `from` at `target` where she stands. `facing` overrides where it
 * lands (Cover steps in to take it from the front). Null when the mount can't fire.
 */
export function strikeOf(state: Pick<BattleState, 'input' | 'units' | 'field' | 'time'>, attackerId: string, mount: Mount, targetId: string, from: Tile, opts: { aim?: AimAt; facing?: Facing } = {}): Strike | null {
  const attacker = unitById(state, attackerId), target = unitById(state, targetId)
  const aIn = inputOf(state, attackerId), tIn = inputOf(state, targetId)
  const arm = armed(aIn, attacker, mount)
  if (!arm) return null
  const { weapon } = arm
  const board = boardOf(state)
  const to = tileOf(target)
  const facing = opts.facing ?? facingOf(to, target.facing, from)
  const accuracy = arm.halfAccuracy ? Math.floor((weapon.accuracy * TUNING.oneArmTwoHandedPct) / 100) : weapon.accuracy
  const hit = clamp(accuracy + TUNING.witAccuracy * aIn.bands.wit - evasionOf(tIn, target) - (opts.aim ? TUNING.aimPenalty : 0) - rangedPenalty(state, board, attacker, weapon.band, from, to, facing),
    TUNING.hitClamp[0], TUNING.hitClamp[1])
  const guard = facing === 'back' ? 0 : guardOf(tIn, target)
  const numbers = {
    power: weapon.power,
    meleeBonus: weapon.band === 'melee' ? TUNING.meleePowerPerBand * aIn.bands.power : 0,
    facing,
    heightDiff: board.height(from[0], from[1]) - board.height(target.x, target.y),
    coat: tIn.loadout.coat === weapon.type,
    guard,
  }
  return {
    attacker: attackerId, target: targetId, mount, weapon, from, facing, hit, crit: weapon.crit ?? TUNING.baseCrit, hits: weapon.hits,
    damage: damageOf({ ...numbers, crit: false }), critDamage: damageOf({ ...numbers, crit: true }), guard, aim: opts.aim,
    weights: weightsFor(weapon, target, opts.aim),
  }
}

// --- Things on the map as targets (rules version 2) --------------------------------------------------------------------

export interface MapTarget { id: string; tile: Tile; kind: 'barrel' | 'pipe' | 'barrier' }

/** Barrels and pipes not yet burst, and standing barriers. */
export function mapTargets(state: Pick<BattleState, 'input' | 'field'>): MapTarget[] {
  const field = state.field
  if (!field) return []
  const out: MapTarget[] = []
  for (const p of state.input.map.props ?? []) if ((p.kind === 'barrel' || p.kind === 'pipe') && !field.burst.includes(p.id)) out.push({ id: p.id, tile: p.tile, kind: p.kind })
  for (const b of field.barriers) out.push({ id: b.id, tile: [b.x, b.y], kind: 'barrier' })
  return out
}

export const mapTarget = (state: Pick<BattleState, 'input' | 'field'>, id: string): MapTarget | undefined => mapTargets(state).find((t) => t.id === id)

/** A strike on a thing: no evasion, Guard or Coat; facing is the front. */
export function objectStrikeOf(state: Pick<BattleState, 'input' | 'units' | 'field' | 'time'>, attackerId: string, mount: Mount, targetId: string, from: Tile): Strike | null {
  const attacker = unitById(state, attackerId), aIn = inputOf(state, attackerId)
  const target = mapTarget(state, targetId)
  const arm = armed(aIn, attacker, mount)
  if (!arm || !target) return null
  const { weapon } = arm
  const board = boardOf(state)
  const accuracy = arm.halfAccuracy ? Math.floor((weapon.accuracy * TUNING.oneArmTwoHandedPct) / 100) : weapon.accuracy
  const hit = clamp(accuracy + TUNING.witAccuracy * aIn.bands.wit - rangedPenalty(state, board, attacker, weapon.band, from, target.tile, null), TUNING.hitClamp[0], TUNING.hitClamp[1])
  const numbers = { power: weapon.power, meleeBonus: weapon.band === 'melee' ? TUNING.meleePowerPerBand * aIn.bands.power : 0, facing: 'front' as const, heightDiff: board.height(from[0], from[1]) - board.height(target.tile[0], target.tile[1]), coat: false, guard: 0 }
  return {
    attacker: attackerId, target: targetId, mount, weapon, from, facing: 'front', hit, crit: weapon.crit ?? TUNING.baseCrit, hits: weapon.hits,
    damage: damageOf({ ...numbers, crit: false }), critDamage: damageOf({ ...numbers, crit: true }), guard: 0, weights: { core: 0, leftArm: 0, rightArm: 0, legs: 0 },
  }
}

/** The tile a target id stands on: a unit's or a thing's. */
export function targetTile(state: Pick<BattleState, 'input' | 'units' | 'field'>, id: string): Tile | null {
  const u = state.units.find((x) => x.id === id)
  if (u) return tileOf(u)
  return mapTarget(state, id)?.tile ?? null
}

// --- Chance skills (rules version 2) -----------------------------------------------------------------------------------

/** A chance skill's % in play: its base + 5 a Wit band, capped; 0 without it (TC22). */
export function skillChance(state: Pick<BattleState, 'input'>, unitId: string, skill: ChanceSkill): number {
  if (!v2(state)) return 0
  const input = inputOf(state, unitId)
  const base = input.skills?.[skill]
  if (base === undefined) return 0
  return Math.min(TUNING.skills.cap, base + TUNING.skills.perWit * input.bands.wit)
}

const fires = (state: BattleState, unitId: string, skill: ChanceSkill): boolean => {
  const chance = skillChance(state, unitId, skill)
  return chance > 0 && roll(state.input.seed, state.turn, unitId, `skill:${skill}`) * 100 < chance
}

// --- Eligibility ------------------------------------------------------------------------------------------------------

/** The first mount, in the fixed order, that can fire on a target from a tile, limited to some bands. */
export function mountFor(state: Pick<BattleState, 'input' | 'units' | 'field'>, unitId: string, from: Tile, targetId: string, bands: readonly Weapon['band'][]): Mount | null {
  const u = unitById(state, unitId), t = unitById(state, targetId)
  const board = boardOf(state)
  for (const mount of MOUNTS) {
    const arm = armed(inputOf(state, unitId), u, mount)
    if (arm && bands.includes(arm.weapon.band) && inReach(board, arm.weapon, from, tileOf(t))) return mount
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
export function crossfireFor(state: Pick<BattleState, 'input' | 'units' | 'turn' | 'field'>, attackerId: string, from: Tile, targetId: string): Joiner[] {
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

/** The counter a defender would answer with (TC21): she stands, has the Charge, isn't reloading, the attack came from her
 * front or side and wasn't Long, and she has a Melee or Short weapon in reach of the attacker. */
export function counterFor(state: Pick<BattleState, 'input' | 'units' | 'field'>, defenderId: string, attackerId: string, attackerAt: Tile, landed: Facing, band: Weapon['band']): Mount | null {
  const d = unitById(state, defenderId)
  if (d.status !== 'active' || d.charge < TUNING.charge.counter || d.reloading || landed === 'back' || band === 'long') return null
  const t = unitById(state, attackerId)
  if (t.status !== 'active') return null
  const units = state.units.map((u) => (u.id === attackerId ? { ...u, x: attackerAt[0], y: attackerAt[1] } : u))
  return mountFor({ input: state.input, units, field: state.field }, defenderId, tileOf(d), attackerId, ['melee', 'short'])
}

// --- Resolution -------------------------------------------------------------------------------------------------------

/** Stuns a standing unit: she loses her next turn. */
export function stun(state: BattleState, target: UnitState, cues: Cue[]): void {
  if (target.status !== 'active' || target.stunned) return
  target.stunned = true
  cues.push({ kind: 'stunned', unit: target.id })
}

/** A heroine's Hold takes damage; at 0 she's freed (TC26). */
export function harmHold(state: BattleState, attackerId: string, target: UnitState, amount: number, cues: Cue[]): void {
  if (!target.holdHp || target.status !== 'active') return
  const after = Math.max(0, target.holdHp - amount)
  target.holdHp = after
  cues.push({ kind: 'holdHit', unit: attackerId, target: target.id, amount, broke: after === 0 })
  if (after === 0) free(target, 'hold', cues)
}

/** Frees a heroine: she leaves the field and counts as beaten. */
export function free(target: UnitState, by: 'hold' | 'jackout', cues: Cue[]): void {
  target.status = 'freed'
  delete target.stunned
  cues.push({ kind: 'freed', unit: target.id, by })
}

/** Rolls a strike's hits on the live state: hit, crit, part, damage, broken parts, Hold on and Rig Break; rules version 2
 * adds the Hold, the impact Stun, pinning fire and Fire from F hits. Returns how many hits landed. */
export function resolveStrike(state: BattleState, s: Strike, role: AttackRole, cues: Cue[], tag = ''): number {
  const seed = state.input.seed, turn = state.turn
  const attacker = unitById(state, s.attacker), target = unitById(state, s.target)
  if (s.mount === 'back') attacker.ammo -= 1
  if (s.guard > 0) cues.push({ kind: 'guard', unit: s.target, cut: s.guard })
  let landed = 0
  for (let i = 0; i < s.hits; i++) {
    if (target.status !== 'active') break
    const purpose = `${role}${tag}:${s.target}:${i}`
    if (roll(seed, turn, s.attacker, `${purpose}:hit`) * 100 >= s.hit) {
      cues.push({ kind: 'miss', unit: s.attacker, target: s.target })
      continue
    }
    landed += 1
    const crit = roll(seed, turn, s.attacker, `${purpose}:crit`) * 100 < s.crit
    const amount = crit ? s.critDamage : s.damage
    if (s.aim === 'hold') {
      harmHold(state, s.attacker, target, amount, cues)
      continue
    }
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
    const hitPart = part
    harm(state, target, hitPart, amount, cues, (broke) => ({ kind: 'hit', unit: s.attacker, target: s.target, part: hitPart, amount, crit, broke }))
    if (v2(state)) {
      if (hitPart === 'core' && s.weapon.type === 'I' && roll(seed, turn, s.attacker, `${purpose}:stun`) * 100 < TUNING.impactStun) stun(state, target, cues)
      pin(state, s.attacker, s.target, hitPart, cues)
    }
  }
  if (v2(state) && landed > 0 && s.weapon.type === 'F') setState(state, [tileOf(target)], 'fire', cues)
  return landed
}

/** A strike on a barrel, pipe or barrier: a barrel bursts into Oil (alight under an F weapon), a pipe into Wet, a barrier
 * loses HP. */
function resolveObjectStrike(state: BattleState, s: Strike, cues: Cue[]): void {
  const attacker = unitById(state, s.attacker)
  if (s.mount === 'back') attacker.ammo -= 1
  const field = state.field!
  const target = mapTarget(state, s.target)!
  for (let i = 0; i < s.hits; i++) {
    if (!mapTarget(state, s.target)) break
    const purpose = `main:${s.target}:${i}`
    if (roll(state.input.seed, state.turn, s.attacker, `${purpose}:hit`) * 100 >= s.hit) {
      cues.push({ kind: 'miss', unit: s.attacker, target: s.target })
      continue
    }
    const crit = roll(state.input.seed, state.turn, s.attacker, `${purpose}:crit`) * 100 < s.crit
    const amount = crit ? s.critDamage : s.damage
    if (target.kind === 'barrier') {
      const b = field.barriers.find((x) => x.id === s.target)!
      b.hp = Math.max(0, b.hp - amount)
      cues.push({ kind: 'barrierHit', unit: s.attacker, id: b.id, amount, broke: b.hp === 0 })
      if (b.hp === 0) field.barriers = field.barriers.filter((x) => x.id !== b.id)
      continue
    }
    field.burst.push(target.id)
    cues.push({ kind: 'burst', prop: target.id })
    setState(state, cross(target.tile), target.kind === 'barrel' ? 'oil' : 'wet', cues)
    if (target.kind === 'barrel' && s.weapon.type === 'F') setState(state, [target.tile], 'fire', cues)
  }
}

/** The attack cue for a strike. */
const attackCue = (s: Strike, role: AttackRole, target: string): Cue => ({ kind: 'attack', unit: s.attacker, target, with: s.mount, band: s.weapon.band, role, facing: s.facing, ...(s.aim ? { aim: s.aim as PartId } : {}) })

/** The counter, resolved. */
function counterStrike(state: BattleState, defenderId: string, mount: Mount, attackerId: string, cues: Cue[]): void {
  const defender = unitById(state, defenderId)
  spendCharge(defender, TUNING.charge.counter, 'counter', cues)
  cues.push({ kind: 'counter', unit: defenderId, target: attackerId })
  const s = strikeOf(state, defenderId, mount, attackerId, tileOf(defender))!
  cues.push(attackCue(s, 'counter', attackerId))
  resolveStrike(state, s, 'counter', cues)
  afterMusterAttack(state, defenderId, s.weapon.band, cues)
}

/** The whole exchange of an attack on the live state: the attacker turns to her target, Cover may step in, a defender's
 * First may counter before it, the strike rolls (Burst adds rounds; then Double, Switch or Stun, one chain at most),
 * allies join (Crossfire), and the defender counters. A thing on the map just takes the strike. */
export function resolveAttack(state: BattleState, attackerId: string, mount: Mount, targetId: string, aim: AimAt | undefined, cues: Cue[]): void {
  const attacker = unitById(state, attackerId)
  const from = tileOf(attacker)
  if (!state.units.some((u) => u.id === targetId)) {
    const s = objectStrikeOf(state, attackerId, mount, targetId, from)!
    attacker.facing = dirTo(from, mapTarget(state, targetId)!.tile)
    cues.push(attackCue(s, 'main', targetId))
    resolveObjectStrike(state, s, cues)
    afterMusterAttack(state, attackerId, s.weapon.band, cues)
    return
  }
  const target = unitById(state, targetId)
  const landed = facingOf(tileOf(target), target.facing, from)
  attacker.facing = dirTo(from, tileOf(target))
  const main = strikeOf(state, attackerId, mount, targetId, from, { aim })!
  const coverer = coverFor(state, targetId, landed)
  let countered = false
  if (!coverer && v2(state)) {
    const first = counterFor(state, targetId, attackerId, from, landed, main.weapon.band)
    if (first && fires(state, targetId, 'first')) {
      cues.push({ kind: 'skill', unit: targetId, skill: 'first' })
      counterStrike(state, targetId, first, attackerId, cues)
      countered = true
      if (attacker.status !== 'active') return
    }
  }
  const burst = v2(state) && main.weapon.band === 'short' && fires(state, attackerId, 'burst')
  // Cover takes the strike on her own rig: an aim at the target's Hold has nothing to land on, so it comes in unaimed.
  const strike = coverer ? strikeOf(state, attackerId, mount, coverer, from, { aim: aim === 'hold' ? undefined : aim, facing: 'front' })! : main
  if (burst) {
    cues.push({ kind: 'skill', unit: attackerId, skill: 'burst' })
    strike.hits += TUNING.skills.burstRounds
  }
  cues.push(attackCue(strike, 'main', coverer ?? targetId))
  if (coverer) {
    spendCharge(unitById(state, coverer), TUNING.charge.cover, 'cover', cues)
    cues.push({ kind: 'cover', unit: coverer, for: targetId, attacker: attackerId })
  }
  const hits = resolveStrike(state, strike, 'main', cues)
  afterMusterAttack(state, attackerId, strike.weapon.band, cues)
  if (v2(state) && !coverer && !burst && target.status === 'active') chain(state, attackerId, mount, targetId, from, aim, hits, cues)
  if (target.status === 'active') {
    for (const j of crossfireFor(state, attackerId, from, targetId)) {
      if (target.status !== 'active') break
      const u = unitById(state, j.unit)
      spendCharge(u, TUNING.charge.crossfire, 'crossfire', cues)
      cues.push({ kind: 'crossfire', unit: j.unit, target: targetId, how: j.how })
      const s = strikeOf(state, j.unit, j.mount, targetId, tileOf(u))!
      cues.push(attackCue(s, 'crossfire', targetId))
      resolveStrike(state, s, 'crossfire', cues)
      afterMusterAttack(state, j.unit, s.weapon.band, cues)
    }
  }
  if (coverer || countered) return
  const counter = counterFor(state, targetId, attackerId, from, landed, main.weapon.band)
  if (counter) counterStrike(state, targetId, counter, attackerId, cues)
}

/** After the main strike: Double (a second melee strike), else Switch (the other hand fires too), else Stun (a hit
 * stuns). One chain at most. */
function chain(state: BattleState, attackerId: string, mount: Mount, targetId: string, from: Tile, aim: AimAt | undefined, hits: number, cues: Cue[]): void {
  const target = unitById(state, targetId)
  const main = strikeOf(state, attackerId, mount, targetId, from, { aim })
  if (main?.weapon.band === 'melee' && fires(state, attackerId, 'double')) {
    cues.push({ kind: 'skill', unit: attackerId, skill: 'double' })
    cues.push(attackCue(main, 'main', targetId))
    resolveStrike(state, main, 'main', cues, ':double')
    return
  }
  const other: Mount = mount === 'right' ? 'left' : mount === 'left' ? 'right' : 'right'
  const second = mount !== 'back' ? strikeOf(state, attackerId, other, targetId, from) : null
  if (second && inReach(boardOf(state), second.weapon, from, tileOf(target)) && fires(state, attackerId, 'switch')) {
    cues.push({ kind: 'skill', unit: attackerId, skill: 'switch' })
    cues.push(attackCue(second, 'main', targetId))
    resolveStrike(state, second, 'main', cues, ':switch')
    return
  }
  if (hits > 0 && fires(state, attackerId, 'stun')) {
    cues.push({ kind: 'skill', unit: attackerId, skill: 'stun' })
    stun(state, target, cues)
  }
}

export type { Prop }
