// The battle map as uma-stage's room design (CY7): heights stay digit rows (uma-stage's format, so they pass as they are),
// solid tiles become walls, and the design is built directly, never through `parseRoomDesign` (uma-quest's dungeon
// format, which stops at level 2). Pure: no three.js.
import type { BattleMap } from '@cyber/battle'

export interface BoardDesign {
  cells: string[]
  heights: string[]
  spots: { kind: 'prop'; x: number; z: number }[]
}

/** The map's tiles as room cells: `#` stays a wall, everything else is floor. */
export function toRoomDesign(map: Pick<BattleMap, 'tiles' | 'heights'>): BoardDesign {
  return { cells: map.tiles.map((row) => row.replace(/[^#]/g, '.')), heights: [...map.heights], spots: [] }
}

/** A tile's level on the map. */
export const levelOf = (map: Pick<BattleMap, 'heights'>, x: number, z: number): number => Number(map.heights[z]?.[x] ?? 0)
