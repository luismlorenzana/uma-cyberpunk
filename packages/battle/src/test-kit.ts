// Places units where a test wants them and hands the turn to one of them (tests only).
import { createBattle } from './battle'
import { battle, placed, unit } from './fixtures'
import type { BattleState, Dir, Objective, UnitInput } from './types'

export interface Spot { id: string; at: [number, number]; facing?: Dir; opts?: Partial<Omit<UnitInput, 'id' | 'side' | 'spawn'>> }

export function setup(squad: Spot[], enemy: Spot[], opts: { heights?: string[]; tiles?: string[]; seed?: string; objective?: Objective; active?: string } = {}): BattleState {
  const map = placed(squad.map((s) => s.at), enemy.map((s) => s.at), opts)
  const units = [
    ...squad.map((s, i) => unit(s.id, 'squad', i, { facing: s.facing ?? 'N', ...s.opts })),
    ...enemy.map((s, i) => unit(s.id, 'enemy', i, { facing: s.facing ?? 'S', ...s.opts })),
  ]
  const state = createBattle(battle(units, { map, seed: opts.seed, objective: opts.objective }))
  return opts.active ? { ...state, active: opts.active } : state
}

/** A copy with one unit changed. */
export function edit(state: BattleState, id: string, change: (u: BattleState['units'][number]) => void): BattleState {
  const next = { ...state, units: state.units.map((u) => ({ ...u, hp: { ...u.hp } })) }
  change(next.units.find((u) => u.id === id)!)
  return next
}

export const unitOf = (state: BattleState, id: string) => state.units.find((u) => u.id === id)!
