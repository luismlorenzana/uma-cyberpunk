// The forecast card (TC29, CY4). It never resolves the attack on a copy, since the seed would leak the real rolls: it
// calls the resolution's own pure functions (the strike's numbers, Cover, Crossfire and counter eligibility) and returns
// chances and ranges, so the card and the result can't disagree.
import { counterFor, coverFor, crossfireFor, strikeOf, tileOf, unitById, type Strike } from './attack'
import { checkTurn } from './legal'
import { dirTo, facingOf } from './sight'
import { upcomingAfter } from './timeline'
import { TUNING } from './tuning'
import type { BattleState, Facing, Mount, PartId, TurnAction, UnitState } from './types'
import { PARTS } from './types'

export type Breaks = 'will' | 'may' | 'no'

export interface PartOdds {
  part: PartId
  /** The chance at least one hit lands there, %. */
  chance: number
  /** Will one normal hit break it, or may a crit or several hits? */
  breaks: Breaks
}

export interface StrikeForecast {
  unit: string
  target: string
  mount: Mount
  band: Strike['weapon']['band']
  facing: Facing
  /** Per hit, %. */
  hit: number
  crit: number
  hits: number
  /** One hit's damage: [normal, crit]. */
  damage: readonly [number, number]
  guard: number
  parts: PartOdds[]
}

export interface Forecast {
  attack: StrikeForecast | null
  /** Who steps in to take the main attack. */
  cover: string | null
  crossfire: (StrikeForecast & { how: 'pincer' | 'link' })[]
  counter: StrikeForecast | null
  /** Charge spent by each unit this turn (Wait shows as a gain, negative). */
  charge: Record<string, number>
  /** The turns after this one. */
  timeline: string[]
}

const pct = (p: number) => Math.round(p * 1000) / 10

function partOdds(s: Strike, target: Pick<UnitState, 'hp'>): PartOdds[] {
  const p = s.hit / 100
  return PARTS.filter((part) => s.weights[part] > 0).map((part) => {
    const one = p * (s.weights[part] / 100)
    const hp = target.hp[part]
    const breaks: Breaks = s.damage >= hp ? 'will' : s.critDamage >= hp || s.damage * s.hits >= hp ? 'may' : 'no'
    return { part, chance: pct(1 - (1 - one) ** s.hits), breaks }
  }).sort((a, b) => b.chance - a.chance)
}

function view(s: Strike, target: Pick<UnitState, 'hp'>): StrikeForecast {
  return {
    unit: s.attacker, target: s.target, mount: s.mount, band: s.weapon.band, facing: s.facing, hit: s.hit, crit: s.crit, hits: s.hits,
    damage: [s.damage, s.critDamage], guard: s.guard, parts: partOdds(s, target),
  }
}

/** What a turn would do, before it's sent. Errors as the reducer would. */
export function forecast(state: BattleState, turn: TurnAction): Forecast | { error: string } {
  const checked = checkTurn(state, turn)
  if ('error' in checked) return { error: checked.error }
  const to = checked.reach.to
  // The board as it stands after the move: positions only, no rolls.
  const placed = { ...state, units: state.units.map((u) => (u.id === turn.unit ? { ...u, x: to[0], y: to[1] } : u)) }
  const charge: Record<string, number> = {}
  const act = turn.act
  if (act.kind === 'wait') {
    const u = unitById(state, turn.unit)
    const cap = state.input.units.find((i) => i.id === turn.unit)!.chargeCap
    charge[turn.unit] = -(Math.min(cap, u.charge + TUNING.charge.wait) - u.charge)
    return { attack: null, cover: null, crossfire: [], counter: null, charge, timeline: upcomingAfter(state, TUNING.waitClock) }
  }
  if (act.kind !== 'attack') return { attack: null, cover: null, crossfire: [], counter: null, charge, timeline: upcomingAfter(state, 0) }
  const target = unitById(placed, act.target)
  const landed = facingOf(tileOf(target), target.facing, to)
  const main = strikeOf(placed, turn.unit, act.with, act.target, to, { aim: act.aim })!
  const cover = coverFor(placed, act.target, landed)
  const attack = cover
    ? view(strikeOf(placed, turn.unit, act.with, cover, to, { aim: act.aim, facing: 'front' })!, unitById(placed, cover))
    : view(main, target)
  if (cover) charge[cover] = TUNING.charge.cover
  const crossfire = crossfireFor(placed, turn.unit, to, act.target).map((j) => {
    charge[j.unit] = TUNING.charge.crossfire
    const s = strikeOf(placed, j.unit, j.mount, act.target, tileOf(unitById(placed, j.unit)))!
    return { ...view(s, target), how: j.how }
  })
  let counter: StrikeForecast | null = null
  if (!cover) {
    // The attacker turns to her target as she fires, so the counter comes at her from that way.
    const facingAttacker = { ...placed, units: placed.units.map((u) => (u.id === turn.unit ? { ...u, facing: dirTo(to, tileOf(target)) } : u)) }
    const mount = counterFor(facingAttacker, act.target, turn.unit, to, landed, main.weapon.band)
    if (mount) {
      charge[act.target] = TUNING.charge.counter
      counter = view(strikeOf(facingAttacker, act.target, mount, turn.unit, tileOf(target))!, unitById(facingAttacker, turn.unit))
    }
  }
  return { attack, cover, crossfire, counter, charge, timeline: upcomingAfter(state, 0) }
}
