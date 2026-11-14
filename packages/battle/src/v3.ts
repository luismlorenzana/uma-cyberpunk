// Rules version 3 (CY17, TC58, TC59, TC64): the bond perks, the captain's Orders and the ship's support, the powered
// systems' passives, the meals, partners and their duo technique. Everything enters the frozen input; the rules never read
// the save. Gated by `v3`: a version-2 battle never reaches any of this.
import { distance } from './sight'
import { gainCharge, harm, tileOf, unitById } from './harm'
import { boardOf } from './terrain'
import { inputOf } from './timeline'
import { TUNING } from './tuning'
import type { BattleState, Cue, DuoAction, OrderAction, Role, SystemInput, SystemKind, Tile, UnitState, V3State } from './types'

export const v3 = (state: Pick<BattleState, 'input'>): boolean => state.input.rulesVersion >= 3
export const newV3 = (): V3State => ({ orders: 0, resonance: false, resonating: null, sure: null, strike: null, sweep: false, endured: [], steadfast: [], joined: [], covered: [], spent: [], shields: {}, cohered: [] })
export const cloneV3 = (v: V3State): V3State => ({ ...v, strike: v.strike && { ...v.strike, tiles: [...v.strike.tiles] }, endured: [...v.endured], steadfast: [...v.steadfast], joined: [...v.joined], covered: [...v.covered], spent: [...v.spent], shields: { ...v.shields }, cohered: [...v.cohered] })

/** Her bond rank in this battle: 0 below version 3, or without one. */
export const rankOf = (state: Pick<BattleState, 'input'>, id: string): number => (v3(state) ? inputOf(state, id).bond?.rank ?? 0 : 0)
export const mealOf = (state: Pick<BattleState, 'input'>) => (v3(state) && state.input.meal ? TUNING.meals[state.input.meal] ?? null : null)

/** A powered system's level and its post holder's band, or null (a bare id, as CY15 recorded, is level 1 at band 3). */
export function systemOf(state: Pick<BattleState, 'input'>, id: SystemKind): SystemInput | null {
  if (!v3(state)) return null
  for (const s of state.input.systems ?? []) {
    if (typeof s === 'string') { if (s === id) return { id, level: 1, band: 3 } }
    else if (s.id === id) return s
  }
  return null
}

/** Her partner this battle and the pair's level, when both are in it. */
export function partnerOf(state: Pick<BattleState, 'input'>, id: string): { unit: string; level: number } | null {
  if (!v3(state)) return null
  const p = inputOf(state, id).partner
  return p && state.input.units.some((u) => u.id === p.unit) ? p : null
}
export const arePartners = (state: Pick<BattleState, 'input'>, a: string, b: string): number => {
  const p = partnerOf(state, a)
  return p?.unit === b ? p.level : partnerOf(state, b)?.unit === a ? partnerOf(state, b)!.level : 0
}

// --- At the start -------------------------------------------------------------------------------------------------------

/** The start (rules version 3): Ready's Charge (rank 3), a meal's Charge or Core HP, the Engines' head start on the
 * clock, and the Shield Projector's shield on each squad unit. */
export function startV3(state: BattleState): void {
  state.v3 = newV3()
  const meal = mealOf(state)
  for (const u of state.units) {
    if (u.side !== 'squad') continue
    const cap = inputOf(state, u.id).chargeCap
    if (rankOf(state, u.id) >= TUNING.bond.ready) u.charge = Math.min(cap, u.charge + 1)
    if (meal?.charge) u.charge = Math.min(cap, u.charge + meal.charge)
    if (meal?.coreHpPct) { const add = Math.ceil((u.maxHp.core * meal.coreHpPct) / 100); u.maxHp.core += add; u.hp.core += add }
    const shield = systemOf(state, 'shield')
    if (shield) state.v3.shields[u.id] = TUNING.shield.absorb + TUNING.shield.perLevel * (shield.level - 1)
  }
  // Cohesion level 1 (CY18): the squad's leader starts with +1 Charge.
  const c = state.input.cohesion
  if (c && c.level >= 1) { const lead = state.units.find((u) => u.id === c.leader && u.side === 'squad'); if (lead) lead.charge = Math.min(inputOf(state, lead.id).chargeCap, lead.charge + TUNING.cohesion.charge) }
  // A finale's harsh conditions (CY18): fog is lights out for the first rounds; hazards are lasting Fire on the middle row;
  // no reinforcements closes the bench.
  const cond = state.input.conditions ?? []
  if (state.field && cond.includes('fog')) state.field.lightsOutUntil = TUNING.conditions.fogRounds * TUNING.roundTicks
  if (state.field && cond.includes('no-reinforcements')) state.field.benchUsed = true
  if (state.field && cond.includes('hazards')) {
    const board = boardOf(state), y = Math.floor(state.input.map.depth / 2)
    let placed = 0
    for (let x = 1; x < state.input.map.width - 1 && placed < TUNING.conditions.hazardTiles; x += 2) {
      if (!board.open(x, y) || state.units.some((u) => u.x === x && u.y === y)) continue
      state.field.states[`${x},${y}`] = { kind: 'fire', until: 0 }
      placed++
    }
  }
  // The Engines: a head start on the clock for the whole squad, so it usually moves first in round 1.
  if (systemOf(state, 'engines')) for (const u of state.units) if (u.side === 'squad') u.clock = Math.floor((TUNING.clockFull * TUNING.engines.clockPct) / 100)
}

/** The Shield Projector's shield takes a hit first: what's left of the damage. */
export function shielded(state: BattleState, target: UnitState, amount: number, cues: Cue[]): number {
  const left = state.v3?.shields[target.id] ?? 0
  if (left <= 0 || amount <= 0) return amount
  const absorbed = Math.min(left, amount)
  state.v3!.shields[target.id] = left - absorbed
  cues.push({ kind: 'shielded', unit: target.id, absorbed, left: left - absorbed })
  return amount - absorbed
}

// --- Perks in play ------------------------------------------------------------------------------------------------------

/** Endure (rank 8): once a battle a Core-breaking hit leaves 1. Hold on (Guts) is checked first; Endure is a second use,
 * never the same hit twice. Returns the Core after the hit. */
export function endure(state: BattleState, target: UnitState, after: number, held: boolean, cues: Cue[]): number {
  if (!state.v3 || held || after > 0 || target.side !== 'squad' || rankOf(state, target.id) < TUNING.bond.endure || state.v3.endured.includes(target.id)) return after
  state.v3.endured.push(target.id)
  cues.push({ kind: 'endure', unit: target.id })
  return 1
}

/** Answer (rank 5): an Uma next to an ally who suffers a Rig Break gains 1 Charge. */
export function answer(state: BattleState, broken: UnitState, cues: Cue[]): void {
  if (!state.v3) return
  for (const u of state.units) {
    if (u.side !== broken.side || u.id === broken.id || u.status !== 'active' || rankOf(state, u.id) < TUNING.bond.answer) continue
    if (distance(tileOf(u), tileOf(broken)) === 1) gainCharge(state, u, 1, 'answer', cues)
  }
}

/** A free Cover (Steadfast at rank 9, or a level-2 partner), once a battle each: who, and why, or null. */
export function freeCover(state: Pick<BattleState, 'input' | 'v3'>, coverer: string, target: string): 'steadfast' | 'partner' | 'cohesion' | null {
  const v = state.v3
  if (!v) return null
  if (rankOf(state, coverer) >= TUNING.bond.steadfast && !v.steadfast.includes(coverer)) return 'steadfast'
  if (arePartners(state, coverer, target) >= 2 && !v.covered.includes(coverer)) return 'partner'
  // Cohesion level 5 (CY18): one free Cover for each member of the squad.
  const c = state.input.cohesion
  if (c && c.level >= TUNING.cohesion.coverLevel && c.members.includes(coverer) && !v.cohered.includes(coverer)) return 'cohesion'
  return null
}
/** Cohesion level 3 (CY18): a member's Crossfire reach, +1. */
export const cohesionReach = (state: Pick<BattleState, 'input'>, unit: string): number => {
  const c = v3(state) ? state.input.cohesion : undefined
  return c && c.level >= TUNING.cohesion.reachLevel && c.members.includes(unit) ? TUNING.cohesion.reach : 0
}
export function useFreeCover(state: BattleState, coverer: string, why: 'steadfast' | 'partner' | 'cohesion', cues: Cue[]): void {
  if (why === 'steadfast') state.v3!.steadfast.push(coverer)
  else if (why === 'cohesion') state.v3!.cohered.push(coverer)
  else state.v3!.covered.push(coverer)
  cues.push({ kind: 'freeCover', unit: coverer, why })
}

/** A free Crossfire join: everyone during Resonance; a partner once a battle. */
export function freeJoin(state: Pick<BattleState, 'input' | 'v3'>, attacker: string, joiner: string): 'resonance' | 'partner' | null {
  const v = state.v3
  if (!v) return null
  if (v.resonating === attacker) return 'resonance'
  if (arePartners(state, attacker, joiner) >= 1 && !v.joined.includes(joiner)) return 'partner'
  return null
}

// --- Orders (TC59) ------------------------------------------------------------------------------------------------------

const ROLES: readonly Role[] = ['vanguard', 'striker', 'gunner', 'netrunner', 'medic']
const area = (at: Tile, r: number): Tile[] => { const out: Tile[] = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.push([at[0] + dx, at[1] + dy]); return out }
const inMap = (state: Pick<BattleState, 'input'>, t: Tile) => t[0] >= 0 && t[1] >= 0 && t[0] < state.input.map.width && t[1] < state.input.map.depth
const SYSTEM_FOR: Partial<Record<OrderAction['order'], SystemKind>> = { strike: 'battery', sweep: 'sensors', barrier: 'shield', drone: 'drones' }

/** Why an Order can't be given now, or null. */
export function orderError(state: BattleState, a: OrderAction): string | null {
  if (!v3(state) || !state.v3) return 'no Orders before rules version 3'
  if (state.result) return 'the battle is over'
  const me = state.units.find((u) => u.id === a.unit)
  if (!me || a.unit !== state.active || me.side !== 'squad') return `it is not ${a.unit}'s turn`
  const o = state.input.orders
  if (!o || !o.kinds.includes(a.order)) return `no ${a.order} Order this battle`
  if (state.v3.orders >= Math.min(o.slots, TUNING.orders.maxSlots)) return 'no Orders left'
  const sys = SYSTEM_FOR[a.order]
  if (sys && !systemOf(state, sys)) return `the ${sys} isn't powered`
  const t = a.target ? state.units.find((u) => u.id === a.target) : undefined
  switch (a.order) {
    case 'sure': return state.v3.sure === a.unit ? 'already a sure shot' : null
    case 'hold': return t && t.side === 'enemy' && t.status === 'active' ? null : 'Hold the line takes a standing enemy'
    case 'reboot': return t && t.side === 'squad' && t.status === 'down' ? null : 'Reboot takes a kneeling ally'
    case 'resonance':
      if (state.v3.resonance) return 'Resonance has been called this battle'
      return t && t.side === 'squad' && t.status === 'active' && rankOf(state, t.id) >= TUNING.bond.resonance ? null : 'her name can be called only at bond rank 10'
    case 'strike': return state.v3.strike ? 'a strike is already marked' : a.at && inMap(state, a.at) ? null : 'the strike needs a tile on the map'
    case 'sweep': return state.v3.sweep ? 'already swept' : null
    case 'barrier': {
      if (!a.at || !inMap(state, a.at) || !boardOf(state).open(a.at[0], a.at[1])) return 'the barrier needs an open tile'
      return state.units.some((u) => u.x === a.at![0] && u.y === a.at![1] && u.status !== 'out' && u.status !== 'freed') ? 'that tile is taken' : null
    }
    case 'drone': return t && t.side === 'squad' && t.status === 'active' ? null : 'the drone takes a standing ally'
    case 'reinforce': {
      if ((state.input.conditions ?? []).includes('no-reinforcements')) return 'no reinforcements in this battle'
      if (!a.role || !ROLES.includes(a.role) || !(state.input.bench ?? []).includes(a.role)) return 'no such Uma resting'
      if (!a.at || !inMap(state, a.at)) return 'the drop needs a tile on the map'
      return null
    }
  }
}

/** Gives an Order: one slot spent, its effect, its cue. `callBench` reuses the bench's drop for a reinforcement. */
export function giveOrder(state: BattleState, a: OrderAction, cues: Cue[], callBench: (state: BattleState, unit: string, role: Role, at: Tile, cues: Cue[]) => void): void {
  const v = state.v3!
  v.orders += 1
  cues.push({ kind: 'order', unit: a.unit, order: a.order, ...(a.target ? { target: a.target } : {}), ...(a.at ? { at: a.at } : {}) })
  const t = a.target ? unitById(state, a.target) : null
  switch (a.order) {
    case 'sure': v.sure = a.unit; break
    case 'hold': t!.stunned = true; cues.push({ kind: 'stunned', unit: t!.id }); break
    case 'reboot':
      t!.status = 'active'
      t!.hp.core = Math.max(1, Math.floor((t!.maxHp.core * TUNING.orders.rebootCorePct) / 100))
      cues.push({ kind: 'rebooted', unit: a.unit, target: t!.id })
      break
    case 'resonance': {
      v.resonance = true
      v.resonating = t!.id
      const from = t!.charge
      t!.charge = inputOf(state, t!.id).chargeCap
      if (t!.charge !== from) cues.push({ kind: 'charge', unit: t!.id, from, to: t!.charge, why: 'resonance' })
      // She acts next: her clock full and ahead of everyone else's.
      t!.clock = TUNING.clockFull * 2
      cues.push({ kind: 'resonance', unit: t!.id, path: inputOf(state, t!.id).bond?.path ?? null })
      break
    }
    case 'strike': {
      const s = systemOf(state, 'battery')!
      const at = (Math.floor(state.time / TUNING.roundTicks) + 1) * TUNING.roundTicks
      const tiles = area(a.at!, TUNING.strike.size).filter((x) => inMap(state, x))
      v.strike = { tiles, at, damage: TUNING.strike.base + TUNING.strike.perLevel * (s.level - 1) + TUNING.strike.perBand * (s.band - 3) }
      cues.push({ kind: 'strikeMarked', tiles, at })
      break
    }
    case 'sweep': v.sweep = true; cues.push({ kind: 'sweep', unit: a.unit }); break
    case 'barrier': {
      const f = state.field!
      const id = `barrier-${f.nextBarrier++}`
      f.barriers.push({ id, x: a.at![0], y: a.at![1], hp: TUNING.back.barrierHp })
      cues.push({ kind: 'barrier', unit: a.unit, id, at: a.at! })
      break
    }
    case 'drone': {
      const parts = (['core', 'leftArm', 'rightArm', 'legs'] as const).filter((p) => t!.hp[p] > 0)
      const part = parts.sort((x, y) => (t!.hp[x] - t!.maxHp[x]) - (t!.hp[y] - t!.maxHp[y]))[0] ?? 'core'
      const hp = Math.min(t!.maxHp[part], t!.hp[part] + TUNING.orders.droneMend)
      t!.hp[part] = hp
      cues.push({ kind: 'drone', unit: a.unit, target: t!.id, part, hp })
      break
    }
    case 'reinforce': {
      const used = state.field!.benchUsed
      callBench(state, a.unit, a.role!, a.at!, cues)
      state.field!.benchUsed = used
      break
    }
  }
}

/** The marked strike lands once its round comes: every enemy in the area takes its damage on the Core. */
export function landStrike(state: BattleState, cues: Cue[]): void {
  const s = state.v3?.strike
  if (!s || state.time < s.at) return
  state.v3!.strike = null
  for (const u of state.units) {
    if (u.side !== 'enemy' || u.status !== 'active' || !s.tiles.some((t) => t[0] === u.x && t[1] === u.y)) continue
    harm(state, u, 'core', s.damage, cues, (broke) => ({ kind: 'burn', unit: u.id, part: 'core', amount: s.damage, by: 'strike', broke }))
  }
}

// --- The duo technique (TC58) ---------------------------------------------------------------------------------------------

export type DuoEffect = 'power' | 'stun' | 'mend' | 'charge' | 'pierce'
/** The fifteen pairs of roles and their technique: each partner strikes; the pair adds one effect. */
export const DUO_TECHS: Readonly<Record<string, { name: string; effect: DuoEffect }>> = {
  'vanguard+vanguard': { name: 'Twin Bulwark', effect: 'mend' }, 'vanguard+striker': { name: 'Hammer and Anvil', effect: 'stun' },
  'gunner+vanguard': { name: 'Covered Barrage', effect: 'power' }, 'netrunner+vanguard': { name: 'Firewall', effect: 'charge' },
  'medic+vanguard': { name: 'Field Hospital', effect: 'mend' }, 'striker+striker': { name: 'Crossing Blades', effect: 'power' },
  'gunner+striker': { name: 'Spotter’s Rush', effect: 'pierce' }, 'netrunner+striker': { name: 'Ghost Strike', effect: 'stun' },
  'medic+striker': { name: 'Second Wind', effect: 'charge' }, 'gunner+gunner': { name: 'Overwatch', effect: 'pierce' },
  'gunner+netrunner': { name: 'Targeting Link', effect: 'power' }, 'gunner+medic': { name: 'Triage Fire', effect: 'mend' },
  'netrunner+netrunner': { name: 'System Crash', effect: 'stun' }, 'medic+netrunner': { name: 'Nanite Bloom', effect: 'charge' },
  'medic+medic': { name: 'Lifeline', effect: 'mend' },
}
export const duoKey = (a: Role, b: Role): string => [a, b].sort().join('+')

/** Why a duo technique can't be used now, or null. */
export function duoError(state: BattleState, a: DuoAction, canStrike: (unit: string, target: string) => boolean): string | null {
  if (!v3(state)) return 'no duo techniques before rules version 3'
  if (state.result) return 'the battle is over'
  if (a.unit !== state.active) return `it is not ${a.unit}'s turn`
  const p = partnerOf(state, a.unit)
  if (!p || p.level < 3) return 'a duo technique needs partners at level 3'
  const partner = unitById(state, p.unit), target = state.units.find((u) => u.id === a.target)
  if (partner.status !== 'active') return 'her partner is down'
  if (!target || target.side === 'squad' || target.status !== 'active') return 'a duo technique takes a standing enemy'
  if (!canStrike(a.unit, a.target) || !canStrike(p.unit, a.target)) return 'both partners must reach the target'
  return null
}
