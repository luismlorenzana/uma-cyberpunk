// Line of fire, reach and facing (TC19, TC21, TC23; CY4). They read a Board: the map as it stands now, with CY5's lifts,
// doors, barriers and Smoke.
import type { Board } from './terrain'
import { TUNING } from './tuning'
import type { Dir, Facing, Tile, Weapon } from './types'

export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W']
export const STEP: Record<Dir, Tile> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }
export const distance = (a: Tile, b: Tile): number => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
export const sameTile = (a: Tile, b: Tile): boolean => a[0] === b[0] && a[1] === b[1]

/** The way from `from` toward `to` along the longer axis (north–south on a tie). */
export function dirTo(from: Tile, to: Tile): Dir {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W'
  return dy > 0 ? 'S' : 'N'
}

/** Where an attack from `from` lands on a unit at `at` facing `facing`: inside her front quarter is the front, inside her
 * back quarter the back, and anything else, diagonals included, the side. */
export function facingOf(at: Tile, facing: Dir, from: Tile): Facing {
  const [fx, fy] = STEP[facing]
  const dx = from[0] - at[0], dy = from[1] - at[1]
  const along = dx * fx + dy * fy
  const across = Math.abs(dx * fy - dy * fx)
  if (along > across) return 'front'
  if (-along > across) return 'back'
  return 'side'
}

/** The eye over a tile and the middle of a unit standing on one, in levels. */
const EYE = 0.8
const BODY = 0.5

/** Whether a shot from `from` reaches `to`: nothing that blocks sight in between (a solid tile, a shut door, a barrier,
 * Smoke) and no tile higher than the line where it crosses. Units never block. */
export function lineOfFire(board: Board, from: Tile, to: Tile): boolean {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  const steps = 8 * Math.max(Math.abs(dx), Math.abs(dy))
  if (steps === 0) return true
  const h0 = board.height(from[0], from[1]) + EYE, h1 = board.height(to[0], to[1]) + BODY
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps
    const x = Math.floor(from[0] + dx * t + 0.5), y = Math.floor(from[1] + dy * t + 0.5)
    if ((x === from[0] && y === from[1]) || (x === to[0] && y === to[1]) || x < 0 || y < 0 || x >= board.width || y >= board.depth) continue
    if (board.blocks(x, y)) return false
    if (board.height(x, y) > h0 + (h1 - h0) * t) return false
  }
  return true
}

/** A weapon's longest reach from a tile: Long gains range from two levels up (TC23). */
export function maxRange(board: Board, weapon: Weapon, from: Tile, to: Tile): number {
  const up = board.height(from[0], from[1]) - board.height(to[0], to[1])
  const bonus = weapon.band === 'long' && up >= TUNING.longHeightBonus.levels ? TUNING.longHeightBonus.range : 0
  return weapon.range[1] + bonus
}

/** Whether a weapon at `from` can fire on `to`: range, the two-level reach for Melee and Short, and line of fire for Short
 * and Long. */
export function inReach(board: Board, weapon: Pick<Weapon, 'band' | 'range'>, from: Tile, to: Tile): boolean {
  const d = distance(from, to)
  if (d < weapon.range[0] || d > maxRange(board, weapon as Weapon, from, to)) return false
  if (weapon.band !== 'long' && Math.abs(board.height(from[0], from[1]) - board.height(to[0], to[1])) > TUNING.reachLevels) return false
  if (weapon.band === 'melee') return true
  return lineOfFire(board, from, to)
}

/** The tile on the far side of a target from an attacker: where an ally stands for a pincer (TC21). */
export function pincerTile(target: Tile, attacker: Tile): Tile {
  const [sx, sy] = STEP[dirTo(target, attacker)]
  return [target[0] - sx, target[1] - sy]
}
