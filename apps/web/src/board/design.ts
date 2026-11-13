// The battle map as uma-stage's room design (CY7): heights stay digit rows (uma-stage's format, so they pass as they are),
// solid tiles become walls, and the design is built directly, never through `parseRoomDesign` (uma-quest's dungeon
// format, which stops at level 2). Pure: no three.js.
import type { BattleMap } from '@cyber/battle'

export interface BoardDesign {
  cells: string[]
  heights: string[]
  spots: { kind: 'prop'; x: number; z: number }[]
}

/** The map's tiles as room cells: `#` stays a wall, everything else is floor. Barrels, pipes and terminals stand as the
 * kit's decorations (CY8), and a shut door's tiles are walls. */
export function toRoomDesign(map: Pick<BattleMap, 'tiles' | 'heights' | 'props'>, opts: { shut?: readonly string[]; burst?: readonly string[] } = {}): BoardDesign {
  const cells = map.tiles.map((row) => row.replace(/[^#]/g, '.').split(''))
  const spots: BoardDesign['spots'] = []
  for (const p of map.props ?? []) {
    if ((p.kind === 'barrel' || p.kind === 'pipe') && !opts.burst?.includes(p.id)) spots.push({ kind: 'prop', x: p.tile[0], z: p.tile[1] })
    if (p.kind === 'terminal') spots.push({ kind: 'prop', x: p.tile[0], z: p.tile[1] })
    if (p.kind === 'door' && opts.shut?.includes(p.id)) for (const [x, z] of p.tiles) cells[z]![x] = '#'
  }
  return { cells: cells.map((r) => r.join('')), heights: [...map.heights], spots }
}

/** A tile's level on the map. */
export const levelOf = (map: Pick<BattleMap, 'heights'>, x: number, z: number): number => Number(map.heights[z]?.[x] ?? 0)
