// Movement (TC17, TC23; CY4, CY5): Move points from the rig, one level up or down a step, broken Legs move 1 and stay
// level, entering a tile next to an enemy ends the move, and a unit passes its own side but never the other. Rules
// version 2 adds the Thruster (two levels a step; Dash: +2 Move and no zones of control), Stride's Move, and turrets
// that never move.
import { moveOf } from './rig'
import { DIRS, STEP } from './sight'
import { boardOf } from './terrain'
import { inputOf } from './timeline'
import { TUNING } from './tuning'
import type { BattleState, Tile, UnitState } from './types'

export interface Reach {
  to: Tile
  /** From the start tile to `to`, both included. */
  path: Tile[]
}

const key = (x: number, y: number) => y * 64 + x
const onBoard = (u: UnitState) => u.status === 'active' || u.status === 'down'

/** Stride's Move this turn (TC46), rules version 2. */
export function strideMove(state: Pick<BattleState, 'input' | 'units'>, u: UnitState): number {
  if (state.input.rulesVersion < 2) return 0
  const stride = inputOf(state, u.id).stride
  if (stride === 'break') return u.turns === 0 ? TUNING.stride.break : 0
  if (stride === 'surge') return u.waited ? TUNING.stride.surge : 0
  if (stride === 'kick') return u.hp.core * 2 <= u.maxHp.core ? TUNING.stride.kick : 0
  if (stride === 'draft') {
    const next = state.units.some((o) => o.id !== u.id && o.side === u.side && o.status === 'active' && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1)
    return next ? TUNING.stride.draft : 0
  }
  return 0
}

/** Move points this turn. */
export function movePoints(state: Pick<BattleState, 'input' | 'units'>, u: UnitState, dash = false): number {
  const input = inputOf(state, u.id)
  if (input.fixed) return 0
  if (u.hp.legs <= 0) return TUNING.brokenLegsMove
  return moveOf(input, u) + strideMove(state, u) + (dash ? TUNING.back.dashMove : 0)
}

/** Every tile the unit can end its move on, staying put included, each with its path (breadth first: N, E, S, W). */
export function reachable(state: Pick<BattleState, 'input' | 'units' | 'field'>, unitId: string, opts: { dash?: boolean } = {}): Reach[] {
  const board = boardOf(state)
  const unit = state.units.find((u) => u.id === unitId)
  if (!unit || unit.status !== 'active') return []
  const input = inputOf(state, unitId)
  const points = movePoints(state, unit, opts.dash)
  const thruster = state.input.rulesVersion >= 2 && input.loadout.back.kind === 'thruster'
  const climb = unit.hp.legs <= 0 ? 0 : thruster ? TUNING.back.thrusterClimb : TUNING.stepHeight
  const occupant = new Map<number, UnitState>()
  for (const u of state.units) if (onBoard(u) && u.id !== unitId) occupant.set(key(u.x, u.y), u)
  const zone = new Set<number>()
  if (!opts.dash) {
    for (const u of state.units) {
      if (u.side === unit.side || u.status !== 'active') continue
      for (const d of DIRS) zone.add(key(u.x + STEP[d][0], u.y + STEP[d][1]))
    }
  }
  const start: Tile = [unit.x, unit.y]
  const seen = new Map<number, Tile[]>([[key(unit.x, unit.y), [start]]])
  let frontier: Tile[] = [start]
  for (let step = 0; step < points; step++) {
    const next: Tile[] = []
    for (const at of frontier) {
      const path = seen.get(key(at[0], at[1]))!
      // Entering a tile next to an enemy ends the move; the start tile doesn't hold her.
      if (step > 0 && zone.has(key(at[0], at[1]))) continue
      for (const d of DIRS) {
        const x = at[0] + STEP[d][0], y = at[1] + STEP[d][1]
        const k = key(x, y)
        if (seen.has(k) || !board.open(x, y)) continue
        if (Math.abs(board.height(x, y) - board.height(at[0], at[1])) > climb) continue
        const other = occupant.get(k)
        if (other && other.side !== unit.side) continue
        seen.set(k, [...path, [x, y]])
        next.push([x, y])
      }
    }
    frontier = next
  }
  const out: Reach[] = []
  for (const path of seen.values()) {
    const to = path[path.length - 1]!
    if (occupant.has(key(to[0], to[1]))) continue
    out.push({ to, path })
  }
  return out
}
