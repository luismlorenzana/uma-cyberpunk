// A plain greedy player that writes the golden battles' actions (CY4; the real AI is CY6's). For the unit whose turn it
// is: the attack with the best expected damage, less half the counter's; else the step toward the nearest enemy (or the
// objective's tile) and a Wait. Deterministic: ties keep the first in the legal list.
import { tileOf, unitById } from '../attack'
import { forecast, type Forecast } from '../forecast'
import { legalTurns } from '../legal'
import { dirTo, distance } from '../sight'
import type { BattleState, Tile, TurnAction } from '../types'

const expected = (f: Forecast['attack']) => (f ? (f.hit / 100) * f.damage[0] * f.hits : 0)

export function greedyTurn(state: BattleState): TurnAction {
  const me = unitById(state, state.active!)
  const foes = state.units.filter((u) => u.side !== me.side && u.status === 'active')
  const nearest = (from: Tile) => foes.reduce((best, u) => (distance(from, tileOf(u)) < distance(from, tileOf(best)) ? u : best), foes[0]!)
  const face = (from: Tile) => (foes.length ? dirTo(from, tileOf(nearest(from))) : me.facing)
  let best: { turn: TurnAction; score: number } | null = null
  for (const t of legalTurns(state)) {
    if (t.act.kind !== 'attack') continue
    const turn: TurnAction = { kind: 'turn', unit: me.id, to: t.to, act: t.act, face: face(t.to) }
    const f = forecast(state, turn)
    if ('error' in f) continue
    const score = expected(f.attack) + f.crossfire.reduce((s, c) => s + expected(c), 0) - 0.5 * expected(f.counter)
    if (!best || score > best.score) best = { turn, score }
  }
  if (best) return best.turn
  const objective = state.input.objective
  const goal: Tile = objective.kind === 'reach' && me.side === 'squad' ? objective.tile : foes.length ? tileOf(nearest(tileOf(me))) : tileOf(me)
  let to: Tile = tileOf(me)
  for (const t of legalTurns(state)) if (t.act.kind === 'wait' && distance(t.to, goal) < distance(to, goal)) to = t.to
  return { kind: 'turn', unit: me.id, to, act: { kind: 'wait' }, face: face(to) }
}
