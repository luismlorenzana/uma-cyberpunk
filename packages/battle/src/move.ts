// Movement (TC17, TC23; CY4): Move points from the rig, one level up or down a step, broken Legs move 1 and stay level,
// entering a tile next to an enemy ends the move, and a unit passes its own side but never the other.
import { heightAt, inBounds, isSolid } from './map'
import { moveOf } from './rig'
import { DIRS, STEP } from './sight'
import { inputOf } from './timeline'
import { TUNING } from './tuning'
import type { BattleState, Tile, UnitState } from './types'

export interface Reach {
  to: Tile
  /** From the start tile to `to`, both included. */
  path: Tile[]
}

const key = (x: number, y: number) => y * 64 + x
const onBoard = (u: UnitState) => u.status !== 'out'

/** Every tile the unit can end its move on, staying put included, each with its path (breadth first: N, E, S, W). */
export function reachable(state: Pick<BattleState, 'input' | 'units'>, unitId: string): Reach[] {
  const map = state.input.map
  const unit = state.units.find((u) => u.id === unitId)
  if (!unit || unit.status !== 'active') return []
  const points = moveOf(inputOf(state, unitId), unit)
  const climb = unit.hp.legs <= 0 ? 0 : TUNING.stepHeight
  const occupant = new Map<number, UnitState>()
  for (const u of state.units) if (onBoard(u) && u.id !== unitId) occupant.set(key(u.x, u.y), u)
  const zone = new Set<number>()
  for (const u of state.units) {
    if (u.side === unit.side || u.status !== 'active') continue
    for (const d of DIRS) zone.add(key(u.x + STEP[d][0], u.y + STEP[d][1]))
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
        if (!inBounds(map, x, y) || seen.has(k) || isSolid(map, x, y)) continue
        if (Math.abs(heightAt(map, x, y) - heightAt(map, at[0], at[1])) > climb) continue
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
