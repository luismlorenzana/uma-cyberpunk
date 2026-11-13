// What the unit whose turn it is may do (CY4): every tile she can reach, and from each, waiting, doing nothing, or each
// attack a mount can make on a standing enemy. The facing is free. `checkTurn` is the reducer's gate.
import { strikeOf, tileOf, unitById } from './attack'
import { reachable, type Reach } from './move'
import { armed, MOUNTS } from './rig'
import { DIRS, inReach, sameTile } from './sight'
import { inputOf } from './timeline'
import type { Act, BattleState, Tile, TurnAction } from './types'

export interface LegalTurn {
  to: Tile
  path: Tile[]
  act: Act
}

/** The attacks a unit could make from a tile. */
export function attacksFrom(state: Pick<BattleState, 'input' | 'units'>, unitId: string, from: Tile): Act[] {
  const u = unitById(state, unitId), input = inputOf(state, unitId)
  const out: Act[] = []
  for (const mount of MOUNTS) {
    const arm = armed(input, u, mount)
    if (!arm) continue
    for (const t of state.units) {
      if (t.side === u.side || t.status !== 'active') continue
      if (inReach(state.input.map, arm.weapon, from, tileOf(t))) out.push({ kind: 'attack', with: mount, target: t.id })
    }
  }
  return out
}

/** Every legal turn for the active unit, without the facing (any of the four). */
export function legalTurns(state: BattleState): LegalTurn[] {
  if (!state.active || state.result) return []
  const out: LegalTurn[] = []
  for (const r of reachable(state, state.active)) {
    out.push({ to: r.to, path: r.path, act: { kind: 'none' } }, { to: r.to, path: r.path, act: { kind: 'wait' } })
    for (const act of attacksFrom(state, state.active, r.to)) out.push({ to: r.to, path: r.path, act })
  }
  return out
}

/** The move a turn makes, or an error: the unit must be the active one, the tile reachable, the action legal from there
 * and the facing one of the four. */
export function checkTurn(state: BattleState, action: TurnAction): { reach: Reach } | { error: string } {
  if (state.result) return { error: 'the battle is over' }
  if (action.unit !== state.active) return { error: `it is not ${action.unit}'s turn` }
  if (!DIRS.includes(action.face)) return { error: `unknown facing ${String(action.face)}` }
  const u = unitById(state, action.unit)
  const to = action.to ?? tileOf(u)
  const reach = reachable(state, action.unit).find((r) => sameTile(r.to, to))
  if (!reach) return { error: `${action.unit} can't reach ${to[0]},${to[1]}` }
  const act = action.act
  if (act.kind === 'attack') {
    const t = state.units.find((x) => x.id === act.target)
    if (!t || t.side === u.side || t.status !== 'active') return { error: `${act.target} isn't a standing enemy` }
    const arm = armed(inputOf(state, action.unit), u, act.with)
    if (!arm) return { error: `${action.unit} can't fire ${act.with}` }
    if (!inReach(state.input.map, arm.weapon, to, tileOf(t))) return { error: `${act.target} is out of reach` }
    if (act.aim) {
      if (!inputOf(state, action.unit).loadout.visor.aim) return { error: `${action.unit} can't aim` }
      if (t.hp[act.aim] <= 0) return { error: `${act.target}'s ${act.aim} is already broken` }
    }
    if (!strikeOf({ input: state.input, units: state.units.map((x) => (x.id === u.id ? { ...x, x: to[0], y: to[1] } : x)) }, action.unit, act.with, act.target, to)) return { error: 'no strike' }
  } else if (act.kind !== 'wait' && act.kind !== 'none') return { error: 'unknown action' }
  return { reach }
}
