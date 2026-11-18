// The forecast card (TC29, CY4, CY5). It never resolves the attack on a copy, since the seed would leak the real rolls:
// it calls the resolution's own pure functions (the strike's numbers, Cover, Crossfire and counter eligibility, the Tech
// chance, the chance skills) and returns chances and ranges, so the card and the result can't disagree.
import { blastTargets, counterFor, coverFor, crossfireFor, objectStrikeOf, skillChance, strikeOf, tileOf, unitById, type Strike } from './attack'
import { v2 } from './harm'
import { checkTurn } from './legal'
import { dirTo, facingOf } from './sight'
import { TECH_CHARGE, techChance } from './tech'
import { upcomingAfter } from './timeline'
import { TUNING } from './tuning'
import type { BattleState, ChanceSkill, Facing, Mount, PartId, TechKind, Tile, TurnAction, UnitState } from './types'
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
  /** Aimed at a heroine's Hold: the chance a hit lands on it and whether it frees her. */
  hold?: { chance: number; breaks: Breaks }
}

export interface Forecast {
  attack: StrikeForecast | null
  /** Who steps in to take the main attack. */
  cover: string | null
  crossfire: (StrikeForecast & { how: 'pincer' | 'link' })[]
  counter: StrikeForecast | null
  /** Rules version 2: each chance skill's %, the attacker's and the defender's First. */
  skills: Partial<Record<ChanceSkill, number>>
  /** Rules version 2: a Tech action's chance. */
  tech: { tech: TechKind; target: string; chance: number } | null
  /** Rules version 2: the Steel Muster's marked tiles, and when they're hit. */
  volley: { tiles: Tile[]; at: number } | null
  splash?: { targets: string[]; damage: number }
  /** Charge spent by each unit this turn (a gain shows negative). */
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

function view(s: Strike, target: Pick<UnitState, 'hp' | 'holdHp'> | null): StrikeForecast {
  const out: StrikeForecast = {
    unit: s.attacker, target: s.target, mount: s.mount, band: s.weapon.band, facing: s.facing, hit: s.hit, crit: s.crit, hits: s.hits,
    damage: [s.damage, s.critDamage], guard: s.guard, parts: target ? partOdds(s, target) : [],
  }
  if (s.aim === 'hold' && target?.holdHp) {
    const hp = target.holdHp
    out.hold = { chance: pct(1 - (1 - s.hit / 100) ** s.hits), breaks: s.damage >= hp ? 'will' : s.critDamage >= hp || s.damage * s.hits >= hp ? 'may' : 'no' }
  }
  return out
}

/** What a turn would do, before it's sent. Errors as the reducer would. */
export function forecast(state: BattleState, turn: TurnAction): Forecast | { error: string } {
  const checked = checkTurn(state, turn)
  if ('error' in checked) return { error: checked.error }
  const to = checked.reach.to
  // The board as it stands after the move: positions only, no rolls.
  const placed = { ...state, units: state.units.map((u) => (u.id === turn.unit ? { ...u, x: to[0], y: to[1] } : u)) }
  const charge: Record<string, number> = {}
  const volley = state.field?.volley.at ? { tiles: state.field.volley.marked, at: state.field.volley.at } : null
  const empty = { attack: null, cover: null, crossfire: [], counter: null, skills: {}, tech: null, volley }
  if (turn.dash) charge[turn.unit] = TUNING.back.dash
  const add = (id: string, n: number) => { charge[id] = (charge[id] ?? 0) + n }
  const act = turn.act
  if (act.kind === 'wait') {
    const u = unitById(state, turn.unit)
    const cap = state.input.units.find((i) => i.id === turn.unit)!.chargeCap
    add(turn.unit, -(Math.min(cap, u.charge - (charge[turn.unit] ?? 0) + TUNING.charge.wait) - (u.charge - (charge[turn.unit] ?? 0))))
    return { ...empty, charge, timeline: upcomingAfter(state, TUNING.waitClock) }
  }
  if (act.kind === 'tech') {
    add(turn.unit, TECH_CHARGE[act.tech])
    return { ...empty, tech: { tech: act.tech, target: act.target, chance: techChance(state, turn.unit, act.target) }, charge, timeline: upcomingAfter(state, 0) }
  }
  if (act.kind === 'hack') add(turn.unit, TUNING.tech.hack)
  if (act.kind === 'barrier') add(turn.unit, TUNING.back.barrier)
  if (act.kind === 'mend') add(turn.unit, TUNING.back.mend)
  if (act.kind === 'reboot') add(turn.unit, TUNING.back.reboot)
  if (act.kind === 'item' && act.item === 'cell') add(act.target ?? turn.unit, -TUNING.items.cell)
  if (act.kind !== 'attack') return { ...empty, charge, timeline: upcomingAfter(state, 0) }
  if (!state.units.some((u) => u.id === act.target)) {
    const s = objectStrikeOf(placed, turn.unit, act.with, act.target, to)!
    return { ...empty, attack: view(s, null), charge, timeline: upcomingAfter(state, 0) }
  }
  const target = unitById(placed, act.target)
  const landed = facingOf(tileOf(target), target.facing, to)
  const main = strikeOf(placed, turn.unit, act.with, act.target, to, { aim: act.aim })!
  const cover = coverFor(placed, act.target, landed)
  const actual = cover ? strikeOf(placed, turn.unit, act.with, cover, to, { aim: act.aim === 'hold' ? undefined : act.aim, facing: 'front' })! : main
  const recipient = cover ? unitById(placed, cover) : target
  const attack = view(actual, recipient)
  const targets = blastTargets(placed, actual, recipient).map(({ id }) => id)
  if (cover) add(cover, TUNING.charge.cover)
  const crossfire = crossfireFor(placed, turn.unit, to, act.target).map((j) => {
    add(j.unit, TUNING.charge.crossfire)
    const s = strikeOf(placed, j.unit, j.mount, act.target, tileOf(unitById(placed, j.unit)))!
    s.hits = Math.min(s.hits, TUNING.crossfireRounds)
    return { ...view(s, target), how: j.how }
  })
  let counter: StrikeForecast | null = null
  const skills: Partial<Record<ChanceSkill, number>> = {}
  if (v2(state)) {
    for (const k of ['burst', 'double', 'switch', 'stun'] as const) {
      const c = skillChance(state, turn.unit, k)
      if (c > 0 && (k !== 'burst' || main.weapon.band === 'short') && (k !== 'double' || main.weapon.band === 'melee')) skills[k] = c
    }
  }
  if (!cover) {
    // The attacker turns to her target as she fires, so the counter comes at her from that way.
    const facingAttacker = { ...placed, units: placed.units.map((u) => (u.id === turn.unit ? { ...u, facing: dirTo(to, tileOf(target)) } : u)) }
    const mount = counterFor(facingAttacker, act.target, turn.unit, to, landed, main.weapon.band)
    if (mount) {
      add(act.target, TUNING.charge.counter)
      counter = view(strikeOf(facingAttacker, act.target, mount, turn.unit, tileOf(target))!, unitById(facingAttacker, turn.unit))
      const first = skillChance(state, act.target, 'first')
      if (first > 0) skills.first = first
    }
  }
  return { attack, cover, crossfire, counter, skills, tech: null, volley, charge, timeline: upcomingAfter(state, 0),
    ...(targets.length ? { splash: { targets, damage: Math.max(1, Math.floor(actual.damage / 2)) } } : {}) }
}
