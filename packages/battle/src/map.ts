// The map format (schema 1, CY4) and its parser. Heights stay digit rows, the same as uma-stage's room format, so the
// board (CY7) builds them with no translation. `parseMap` checks every rule and names the path of any error.
import { TUNING } from './tuning'
import type { BattleMap, Tile } from './types'

export class BattleInputError extends Error {
  readonly path: string
  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'BattleInputError'
    this.path = path
  }
}

const TILE_CHARS = new Set(['.', '#', '=', 'c'])
type Obj = Record<string, unknown>

function object(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BattleInputError(path, 'expected an object')
  return value as Obj
}

function int(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new BattleInputError(path, `expected an integer ${min}–${max}`)
  return value
}

function rows(value: unknown, path: string, width: number, depth: number, ok: (c: string) => boolean, what: string): string[] {
  if (!Array.isArray(value) || value.length !== depth) throw new BattleInputError(path, `expected ${depth} rows`)
  return value.map((row, y) => {
    if (typeof row !== 'string' || row.length !== width) throw new BattleInputError(`${path}[${y}]`, `expected ${width} characters`)
    for (let x = 0; x < width; x++) if (!ok(row[x]!)) throw new BattleInputError(`${path}[${y}][${x}]`, `expected ${what}`)
    return row
  })
}

function tiles(value: unknown, path: string, map: { width: number; depth: number; tiles: string[] }, max: number, exact?: number): Tile[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max || (exact !== undefined && value.length !== exact))
    throw new BattleInputError(path, exact !== undefined ? `expected ${exact} tiles` : `expected 1–${max} tiles`)
  return value.map((t, i) => {
    if (!Array.isArray(t) || t.length !== 2) throw new BattleInputError(`${path}[${i}]`, 'expected [x, y]')
    const x = int(t[0], `${path}[${i}][0]`, 0, map.width - 1)
    const y = int(t[1], `${path}[${i}][1]`, 0, map.depth - 1)
    if (map.tiles[y]![x] === '#') throw new BattleInputError(`${path}[${i}]`, 'a spawn on a solid tile')
    return [x, y] as const
  })
}

/** Parses a map, checking every rule. */
export function parseMap(value: unknown, path = 'map'): BattleMap {
  const o = object(value, path)
  if (o.schemaVersion !== 1) throw new BattleInputError(`${path}.schemaVersion`, 'expected 1')
  if (typeof o.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(o.id)) throw new BattleInputError(`${path}.id`, 'expected a lowercase id')
  const { minSize, maxSize, maxHeight, squad, maxEnemies } = TUNING.map
  const width = int(o.width, `${path}.width`, minSize, maxSize)
  const depth = int(o.depth, `${path}.depth`, minSize, maxSize)
  const heights = rows(o.heights, `${path}.heights`, width, depth, (c) => c >= '0' && c <= String(maxHeight), `a digit 0–${maxHeight}`)
  const tileRows = rows(o.tiles, `${path}.tiles`, width, depth, (c) => TILE_CHARS.has(c), 'one of . # = c')
  const s = object(o.spawns, `${path}.spawns`)
  const shape = { width, depth, tiles: tileRows }
  const squadTiles = tiles(s.squad, `${path}.spawns.squad`, shape, squad, squad)
  const enemyTiles = tiles(s.enemy, `${path}.spawns.enemy`, shape, maxEnemies)
  const seen = new Set<string>()
  for (const [i, t] of [...squadTiles, ...enemyTiles].entries()) {
    const key = `${t[0]},${t[1]}`
    if (seen.has(key)) throw new BattleInputError(`${path}.spawns`, `tile ${key} is used twice (spawn ${i})`)
    seen.add(key)
  }
  const extra = Object.keys(o).filter((k) => !['schemaVersion', 'id', 'width', 'depth', 'heights', 'tiles', 'spawns'].includes(k))
  if (extra.length > 0) throw new BattleInputError(path, `unknown keys ${extra.join(', ')}`)
  return { schemaVersion: 1, id: o.id, width, depth, heights, tiles: tileRows, spawns: { squad: squadTiles, enemy: enemyTiles } }
}

export const inBounds = (map: BattleMap, x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.depth
export const heightAt = (map: BattleMap, x: number, y: number): number => Number(map.heights[y]![x])
export const tileAt = (map: BattleMap, x: number, y: number): string => map.tiles[y]![x]!
export const isSolid = (map: BattleMap, x: number, y: number): boolean => tileAt(map, x, y) === '#'
