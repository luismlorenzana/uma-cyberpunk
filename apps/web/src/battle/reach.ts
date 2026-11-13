// The overlays a turn needs (CY8, TC29), from the battle rules: her reach (blue safe, magenta inside an enemy's reach),
// what she can strike (red), and every enemy's reach for the toggle.
import { attacksFrom, boardOf, inReach, MOUNTS, armed, reachable, type BattleState, type Reach, type Tile } from '@cyber/battle'

const key = (t: Tile) => `${t[0]},${t[1]}`

/** Every tile the other side could strike next turn: each standing foe's moves, then her weapons' reach. */
export function threatTiles(state: BattleState, side: 'squad' | 'enemy'): Set<string> {
  const board = boardOf(state)
  const out = new Set<string>()
  for (const f of state.units) {
    if (f.side === side || f.status !== 'active') continue
    const input = state.input.units.find((i) => i.id === f.id)!
    const weapons = MOUNTS.map((m) => armed(input, f, m)?.weapon).filter((w) => !!w)
    for (const r of reachable(state, f.id)) {
      for (let z = 0; z < state.input.map.depth; z++) for (let x = 0; x < state.input.map.width; x++) {
        if (out.has(`${x},${z}`)) continue
        if (weapons.some((w) => inReach(board, w!, r.to, [x, z]))) out.add(`${x},${z}`)
      }
    }
  }
  return out
}

export interface TurnReach { moves: Reach[]; danger: Set<string> }

export function turnReach(state: BattleState, unit: string, dash = false): TurnReach {
  const me = state.units.find((u) => u.id === unit)!
  return { moves: reachable(state, unit, { dash }), danger: threatTiles(state, me.side) }
}

/** The targets she could strike from a tile: standing enemies and things on the map. */
export function targetsFrom(state: BattleState, unit: string, from: Tile): { target: string; mount: 'left' | 'right' | 'back' }[] {
  const placed = { ...state, units: state.units.map((u) => (u.id === unit ? { ...u, x: from[0], y: from[1] } : u)) }
  const seen = new Set<string>()
  const out: { target: string; mount: 'left' | 'right' | 'back' }[] = []
  for (const a of attacksFrom(placed, unit, from)) {
    if (a.kind !== 'attack' || seen.has(`${a.target}:${a.with}`)) continue
    seen.add(`${a.target}:${a.with}`)
    out.push({ target: a.target, mount: a.with })
  }
  return out
}

export { key as tileKey }
