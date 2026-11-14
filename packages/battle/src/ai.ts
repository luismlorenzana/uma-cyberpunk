// The enemy AI and ally Auto (CY6, TC30): one scorer for both sides. For the unit whose turn it is, it scores candidate
// turns (her reachable tiles, pruned to the best dozen plus the best tiles to strike each foe from, × every legal action
// from each) with the same numbers the forecast shows: expected damage, the chance of a broken part or a Rig Break, the
// counter it draws, the allies who join, the threat where she ends up, cover, height, terrain, the objective, and
// Charge kept for a counter. Ties go to the seeded roll, so a battle always plays the same way. It never idles: with
// nothing worth doing, it advances. The Steel Muster holds cover and keeps a gun loaded under its volley.
import { orderError } from './v3'
import { canAim, counterFor, crossfireFor, mapTarget, objectStrikeOf, strikeOf, tileOf, unitById, type Strike } from './attack'
import { v2 } from './harm'
import { attacksFrom, supportFrom } from './legal'
import { movePoints, reachable, type Reach } from './move'
import { isMuster } from './muster'
import { armed, MOUNTS } from './rig'
import { roll } from './rng'
import { DIRS, distance, facingOf, inReach } from './sight'
import { dashError } from './support'
import { techChance } from './tech'
import { boardOf, cross, keyOf, liveTiles, type Board } from './terrain'
import { inputOf } from './timeline'
import { TUNING } from './tuning'
import type { BattleAction, OrderAction, Act, BattleState, Dir, Tile, TurnAction, UnitState } from './types'
import { PARTS } from './types'

/** How many tiles the scorer looks at beyond the best places to strike from. */
const KEEP_TILES = 12

const expected = (s: Strike | null): number => (s ? (s.hit / 100) * s.hits * (s.damage * (1 - s.crit / 100) + s.critDamage * (s.crit / 100)) : 0)

/** The chance a strike breaks the target's Core this attack, roughly: a hit on the Core that alone breaks it. */
function killChance(s: Strike, target: UnitState): number {
  if (s.aim === 'hold') return 0
  const p = (s.hit / 100) * (s.weights.core / 100)
  const core = target.hp.core
  if (s.damage >= core) return 1 - (1 - p) ** s.hits
  if (s.critDamage >= core) return (1 - (1 - p) ** s.hits) * (s.crit / 100)
  if (s.damage * s.hits >= core) return p ** Math.ceil(core / s.damage)
  return 0
}

/** The chance a strike breaks each limb, weighted by what the limb carries. */
function breakValue(s: Strike, target: UnitState, input: ReturnType<typeof inputOf>): number {
  let value = 0
  for (const part of PARTS) {
    if (part === 'core' || target.hp[part] <= 0 || s.weights[part] === 0) continue
    const p = (s.hit / 100) * (s.weights[part] / 100)
    const chance = s.damage >= target.hp[part] ? 1 - (1 - p) ** s.hits : s.critDamage >= target.hp[part] ? (1 - (1 - p) ** s.hits) * (s.crit / 100) : 0
    const hand = part === 'leftArm' ? input.loadout.leftHand : part === 'rightArm' ? input.loadout.rightHand : null
    const worth = part === 'legs' ? 4 : hand?.kind === 'weapon' ? 6 : hand?.kind === 'shield' ? 4 : 2
    value += chance * worth
  }
  return value
}

/** A unit's best expected damage on a target where they both stand: her threat. */
function threatOf(state: BattleState, attackerId: string, targetId: string): number {
  let best = 0
  for (const mount of MOUNTS) {
    const a = unitById(state, attackerId)
    const s = strikeOf(state, attackerId, mount, targetId, tileOf(a))
    if (s) best = Math.max(best, expected(s))
  }
  return best
}

/** The longest reach a unit has with any weapon now. */
function maxReach(state: BattleState, u: UnitState): number {
  let r = 0
  for (const mount of MOUNTS) {
    const arm = armed(inputOf(state, u.id), u, mount)
    if (arm) r = Math.max(r, arm.weapon.range[1])
  }
  return r
}

/** The tile she should close on: the objective's for the squad where it names one, else the nearest foe's. */
function goalOf(state: BattleState, me: UnitState, foes: UnitState[]): Tile | null {
  const o = state.input.objective
  if (me.side === 'squad') {
    if (o.kind === 'reach') return o.tile
    if (o.kind === 'escort' && o.unit === me.id) return o.tile
    if (o.kind === 'hack' && inputOf(state, me.id).loadout.back.kind === 'deck') {
      const open = (state.input.map.props ?? []).filter((p) => p.kind === 'terminal' && !state.field?.hacked.includes(p.id))
      const near = open.sort((a, b) => distance(tileOf(me), (a as { tile: Tile }).tile) - distance(tileOf(me), (b as { tile: Tile }).tile))[0]
      if (near && 'tile' in near) return near.tile
    }
  }
  if (foes.length === 0) return null
  return tileOf(foes.reduce((best, f) => (distance(tileOf(me), tileOf(f)) < distance(tileOf(me), tileOf(best)) ? f : best)))
}

interface Ctx {
  state: BattleState
  me: UnitState
  board: Board
  foes: UnitState[]
  allies: UnitState[]
  threat: Map<string, number>
  reach: Map<string, number>
  move: Map<string, number>
  live: Set<string>
  goal: Tile | null
  ranged: boolean
  preferred: number
  myMove: number
  myReach: number
  /** Her best expected damage on each foe. */
  myThreat: Map<string, number>
}

/** What standing on a tile at the end of her turn is worth: less the threat there, with cover, height, terrain, the
 * volley's marks, the objective and the advance. */
function placeValue(c: Ctx, tile: Tile): number {
  const { state, me, board } = c
  let v = 0
  let threat = 0
  for (const f of c.foes) {
    if (distance(tileOf(f), tile) <= (c.move.get(f.id) ?? 0) + (c.reach.get(f.id) ?? 0)) threat += c.threat.get(f.id) ?? 0
  }
  // Caution fades as the battle wears on, so a fight always closes (no stalemates).
  const caution = Math.max(0, 1 - state.time / (20 * TUNING.roundTicks))
  v -= threat * 0.15 * caution
  // Standing where the foes in reach could break her Core is a different matter: she'd be out next round.
  if (threat >= me.hp.core) v -= (12 + (threat - me.hp.core) * 0.4) * caution
  // What she could strike next turn from here: being in reach is how a fight ends.
  let reachNext = 0
  for (const f of c.foes) if (distance(tileOf(f), tile) <= (c.myMove + c.myReach)) reachNext = Math.max(reachNext, c.myThreat.get(f.id) ?? 0)
  v += reachNext * 0.35
  if (v2(state)) {
    if (board.cover(tile[0], tile[1])) v += isMuster(state, me.id) ? 5 : 2
    const here = state.field?.states[keyOf(tile[0], tile[1])]
    if (here?.kind === 'fire') v -= TUNING.terrain.fireDamage
    if (c.live.has(keyOf(tile[0], tile[1]))) v -= TUNING.terrain.liveDamage * 2
    const volley = state.field?.volley
    if (volley?.at && me.side === 'squad' && volley.marked.some((m) => m[0] === tile[0] && m[1] === tile[1])) v -= 20
    if (me.holdHp && c.foes.some((f) => inputOf(state, f.id).loadout.back.kind === 'deck' && distance(tileOf(f), tile) <= TUNING.tech.range[1] + 1)) v -= 4
  }
  if (c.ranged) {
    const avg = c.foes.length ? c.foes.reduce((s, f) => s + board.height(f.x, f.y), 0) / c.foes.length : 0
    v += Math.max(0, board.height(tile[0], tile[1]) - avg) * 0.8
  }
  if (c.goal) {
    const d = distance(tile, c.goal)
    const goalIsFoe = c.foes.some((f) => f.x === c.goal![0] && f.y === c.goal![1])
    v -= goalIsFoe && c.ranged ? Math.abs(d - c.preferred) * 0.5 : d * 0.7
  }
  return v
}

/** What an action is worth from a tile. */
function actValue(c: Ctx, placed: BattleState, to: Tile, act: Act): number {
  const { state, me } = c
  const o = state.input.objective
  const charge = me.charge
  const reserve = (cost: number) => (charge - cost < TUNING.charge.counter ? 1.5 : 0)
  if (act.kind === 'none') return 0
  if (act.kind === 'wait') return charge < inputOf(state, me.id).chargeCap ? 0.8 : 0.2
  if (act.kind === 'attack') {
    const target = placed.units.find((u) => u.id === act.target)
    if (!target) {
      const thing = mapTarget(placed, act.target)
      const s = objectStrikeOf(placed, me.id, act.with, act.target, to)
      if (!thing || !s) return -1
      if (thing.kind === 'barrier') return expected(s) * 0.05
      const area = cross(thing.tile)
      const near = (side: 'foe' | 'ally') => (side === 'foe' ? c.foes : c.allies).filter((u) => area.some((t) => t[0] === u.x && t[1] === u.y) || distance(tileOf(u), thing.tile) <= 2).length
      const fire = thing.kind === 'barrel' && s.weapon.type === 'F'
      return (s.hit / 100) * ((fire ? 8 : 3) * near('foe') - (fire ? 10 : 4) * near('ally'))
    }
    const tIn = inputOf(state, target.id)
    const s = strikeOf(placed, me.id, act.with, act.target, to, { aim: act.aim })
    if (!s) return -1
    let v = expected(s)
    if (act.aim === 'hold') {
      const p = 1 - (1 - s.hit / 100) ** s.hits
      v = (s.damage >= (target.holdHp ?? 0) ? 30 : 8) * p
    } else {
      v += killChance(s, target) * (20 + (c.threat.get(target.id) ?? 0))
      v += breakValue(s, target, tIn)
      v += expected(s) * (1 - target.hp.core / target.maxHp.core) * 0.5
    }
    if (me.side === 'squad' && target.id && state.input.units.find((i) => i.id === target.id)?.leader) {
      if (o.kind === 'defeatLeader') v *= 1.4
      if (o.kind === 'freeLeader' && act.aim !== 'hold') v -= killChance(s, target) * 60
    }
    for (const j of crossfireFor(placed, me.id, to, act.target)) {
      const js = strikeOf(placed, j.unit, j.mount, act.target, tileOf(unitById(placed, j.unit)))
      if (js) js.hits = Math.min(js.hits, TUNING.crossfireRounds)
      v += expected(js) * 0.8
    }
    const landed = facingOf(tileOf(target), target.facing, to)
    const counter = counterFor(placed, act.target, me.id, to, landed, s.weapon.band)
    if (counter) {
      const back = strikeOf(placed, act.target, counter, me.id, tileOf(target))
      v -= expected(back) * 0.7
      if (back && killChance(back, { ...me, x: to[0], y: to[1] })) v -= 15 * killChance(back, me)
    }
    if (v2(state) && isMuster(state, me.id) && state.field?.volley.at && (s.weapon.band === 'short' || s.weapon.band === 'long')) {
      const loaded = c.allies.filter((a) => isMuster(state, a.id) && !a.reloading)
      if (loaded.length === 0) v -= 3
    }
    return v
  }
  if (act.kind === 'tech') {
    const p = techChance(state, me.id, act.target) / 100
    const t = unitById(state, act.target)
    const cost = act.tech === 'jam' ? TUNING.tech.jam : act.tech === 'stun' ? TUNING.tech.stun : TUNING.tech.jackOut
    const worth = act.tech === 'stun' ? (c.threat.get(t.id) ?? 0) * 1.5 + 3 : act.tech === 'jam' ? (t.charge > 0 ? 3 : 0) : 35
    return p * worth - reserve(cost)
  }
  if (act.kind === 'hack') {
    const term = (state.input.map.props ?? []).find((p) => p.id === act.terminal)
    if (!term || term.kind !== 'terminal') return 0
    let v = 'turret' in term.does ? 14 : 'lights' in term.does ? (c.foes.some((f) => maxReach(state, f) > 1) ? 4 : 1) : 'lift' in term.does ? 2 : 1.5
    if (o.kind === 'hack' && !state.field?.hacked.includes(act.terminal)) v += 25
    return v - reserve(TUNING.tech.hack)
  }
  if (act.kind === 'barrier') {
    // Only under fire, and one barrier beside her is enough.
    const beside = (state.field?.barriers ?? []).some((b) => distance([b.x, b.y], to) === 1)
    let threatHere = 0
    for (const f of c.foes) if (distance(tileOf(f), to) <= (c.move.get(f.id) ?? 0) + (c.reach.get(f.id) ?? 0)) threatHere += c.threat.get(f.id) ?? 0
    return beside ? -1 : threatHere * 0.15 - reserve(TUNING.back.barrier)
  }
  if (act.kind === 'reboot') return 30 - reserve(TUNING.back.reboot)
  if (act.kind === 'mend' || (act.kind === 'item' && (act.item === 'repair' || act.item === 'patch'))) {
    const targetId = act.kind === 'mend' ? act.target : act.target ?? me.id
    const t = unitById(state, targetId)
    const part = act.kind === 'mend' ? act.part : act.item === 'repair' ? 'core' : act.part ?? 'legs'
    const urgency = 1 + (1 - t.hp.core / t.maxHp.core) * 2
    const v = part === 'core' ? Math.min(t.maxHp.core - t.hp.core, TUNING.back.mendCore) * 0.4 * urgency : part === 'legs' ? 6 : 5
    return (act.kind === 'item' ? v * 0.9 : v - reserve(TUNING.back.mend))
  }
  if (act.kind === 'item') {
    if (act.item === 'cell') return 2
    if (act.item === 'smoke') return c.foes.filter((f) => maxReach(state, f) > 1 && act.at && distance(tileOf(f), act.at) <= 1).length * 2
  }
  return 0
}

/** The way that faces the most foes in her front quarter, the nearest breaking a tie. */
function bestFacing(c: Ctx, at: Tile): Dir {
  let best: Dir = c.me.facing, score = -1
  for (const d of DIRS) {
    let n = 0, near = 99
    for (const f of c.foes) {
      // A foe she faces sees her front: count foes in that quarter.
      if (facingOf(at, d, tileOf(f)) === 'front') { n += 10; near = Math.min(near, distance(at, tileOf(f))) }
    }
    const s = n - near * 0.01
    if (s > score) { score = s; best = d }
  }
  return best
}

interface Candidate { to: Tile; dash: boolean; act: Act; value: number; key: string }

/** The AI's turn for the unit whose turn it is: the best-scored candidate. */
export function chooseTurn(state: BattleState, unitId: string = state.active!): TurnAction {
  const me = unitById(state, unitId)
  const foes = state.units.filter((u) => u.side !== me.side && u.status === 'active')
  const allies = state.units.filter((u) => u.side === me.side && u.id !== me.id && u.status === 'active')
  const threat = new Map<string, number>(), reachOf = new Map<string, number>(), moveOf = new Map<string, number>()
  for (const f of foes) {
    threat.set(f.id, threatOf(state, f.id, me.id))
    reachOf.set(f.id, maxReach(state, f))
    moveOf.set(f.id, movePoints(state, f))
  }
  const ranged = maxReach(state, me) > 1
  const myThreat = new Map<string, number>()
  for (const f of foes) myThreat.set(f.id, threatOf(state, me.id, f.id))
  const c: Ctx = {
    state, me, board: boardOf(state), foes, allies, threat, reach: reachOf, move: moveOf, live: liveTiles(state), goal: goalOf(state, me, foes), ranged,
    preferred: Math.max(1, maxReach(state, me) - 1), myMove: movePoints(state, me), myReach: maxReach(state, me), myThreat,
  }
  // The tiles: the best dozen by where she'd stand, plus the two best to strike each foe from.
  const plain = reachable(state, unitId)
  const dashing = v2(state) && !dashError(state, unitId) ? reachable(state, unitId, { dash: true }).filter((r) => !plain.some((p) => p.to[0] === r.to[0] && p.to[1] === r.to[1])) : []
  const tiles: (Reach & { dash: boolean; place: number })[] = [
    ...plain.map((r) => ({ ...r, dash: false, place: placeValue(c, r.to) })),
    ...dashing.map((r) => ({ ...r, dash: true, place: placeValue(c, r.to) - 1 })),
  ]
  const byPlace = [...tiles].sort((a, b) => b.place - a.place)
  const keep = new Set(byPlace.slice(0, KEEP_TILES))
  keep.add(tiles[0]!)
  for (const f of foes) {
    let found = 0
    for (const t of byPlace) {
      if (found >= 2) break
      const canHit = MOUNTS.some((m) => {
        const arm = armed(inputOf(state, unitId), me, m)
        return arm && inReach(c.board, arm.weapon, t.to, tileOf(f))
      })
      if (canHit) { keep.add(t); found++ }
    }
  }
  const candidates: Candidate[] = []
  for (const t of keep) {
    const placed: BattleState = {
      ...state,
      units: state.units.map((u) => (u.id === unitId ? { ...u, x: t.to[0], y: t.to[1], charge: u.charge - (t.dash ? TUNING.back.dash : 0) } : u)),
    }
    const acts: Act[] = [{ kind: 'none' }, { kind: 'wait' }, ...attacksFrom(placed, unitId, t.to), ...supportFrom(placed, unitId, t.to)]
    // Aiming at a Hold, for a squad unit that can aim.
    if (v2(state) && me.side === 'squad' && canAim(state, unitId)) {
      for (const a of [...acts]) {
        if (a.kind !== 'attack') continue
        const target = placed.units.find((u) => u.id === a.target)
        if (target?.holdHp) acts.push({ ...a, aim: 'hold' })
      }
    }
    for (const act of acts) {
      const value = t.place + actValue(c, placed, t.to, act)
      candidates.push({ to: t.to, dash: t.dash, act, value, key: `${t.to[0]},${t.to[1]}:${t.dash ? 'd' : ''}:${JSON.stringify(act)}` })
    }
  }
  const seed = state.input.seed
  const tie = (k: string) => roll(seed, state.turn, unitId, `ai:${k}`)
  candidates.sort((a, b) => (Math.abs(b.value - a.value) > 1e-9 ? b.value - a.value : tie(a.key) - tie(b.key)))
  let best = candidates[0]!
  // Never idle (TC30): with nothing to do here, advance on the goal.
  if ((best.act.kind === 'wait' || best.act.kind === 'none') && c.goal) {
    const now = distance(tileOf(me), c.goal)
    const closer = candidates.filter((x) => (x.act.kind === 'wait') && distance(x.to, c.goal!) < now && !(c.ranged && c.foes.some((f) => f.x === c.goal![0] && f.y === c.goal![1]) && distance(x.to, c.goal!) < c.preferred))
    if (closer.length > 0 && best.to[0] === me.x && best.to[1] === me.y) best = closer[0]!
  }
  return { kind: 'turn', unit: unitId, ...(best.to[0] !== me.x || best.to[1] !== me.y ? { to: best.to } : {}), ...(best.dash ? { dash: true } : {}), act: best.act, face: bestFacing(c, best.to) }
}

/** Ally Auto: the same scorer, for a squad unit. */
export const autoTurn = (state: BattleState): TurnAction => chooseTurn(state)

/**
 * Ally Auto with the captain's Orders (rules version 3, CY17): before her turn, a squad unit on Auto may take a free
 * Order the battle offers: Reboot a kneeling ally, or Sure shot when the attack she means to make is likely to miss.
 * Auto never calls Resonance: that's the player's moment. Enemies, and battles below version 3, play `chooseTurn`.
 */
export function chooseAction(state: BattleState): BattleAction {
  const id = state.active!
  const me = unitById(state, id)
  const o = state.input.orders
  if (me.side === 'squad' && state.v3 && o && state.v3.orders < o.slots) {
    if (o.kinds.includes('reboot')) {
      const down = state.units.find((u) => u.side === 'squad' && u.status === 'down')
      const a: OrderAction = { kind: 'order', unit: id, order: 'reboot', target: down?.id }
      if (down && !orderError(state, a)) return a
    }
    if (o.kinds.includes('sure') && state.v3.sure !== id) {
      const t = chooseTurn(state, id)
      if (t.act.kind === 'attack' && state.units.some((u) => t.act.kind === 'attack' && u.id === t.act.target)) {
        const s = strikeOf(state, id, t.act.with, t.act.target, t.to ?? tileOf(me))
        const a: OrderAction = { kind: 'order', unit: id, order: 'sure' }
        if (s && s.hit < TUNING.autoSureBelow && !orderError(state, a)) return a
      }
    }
  }
  return chooseTurn(state, id)
}
