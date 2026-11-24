// The map format (schema 1, CY4) and its parser. Heights stay digit rows, the same as uma-stage's room format, so the
// board (CY7) builds them with no translation. `parseMap` checks every rule and names the path of any error.
import { TUNING } from './tuning'
import type { BattleMap, Prop, Tile } from './types'

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
export function parseMap(value: unknown, path = 'map', rulesVersion = 4): BattleMap {
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
  const squadTiles = tiles(s.squad, `${path}.spawns.squad`, shape, rulesVersion >= 5 ? 10 : squad, rulesVersion >= 5 ? undefined : squad)
  const enemyTiles = tiles(s.enemy, `${path}.spawns.enemy`, shape, maxEnemies)
  const seen = new Set<string>()
  for (const [i, t] of [...squadTiles, ...enemyTiles].entries()) {
    const key = `${t[0]},${t[1]}`
    if (seen.has(key)) throw new BattleInputError(`${path}.spawns`, `tile ${key} is used twice (spawn ${i})`)
    seen.add(key)
  }
  const extra = Object.keys(o).filter((k) => !['schemaVersion', 'id', 'width', 'depth', 'heights', 'tiles', 'spawns', 'props', 'states'].includes(k))
  if (extra.length > 0) throw new BattleInputError(path, `unknown keys ${extra.join(', ')}`)
  const map: BattleMap = { schemaVersion: 1, id: o.id, width, depth, heights, tiles: tileRows, spawns: { squad: squadTiles, enemy: enemyTiles } }
  if (o.props !== undefined) map.props = props(o.props, `${path}.props`, map, seen)
  if (o.states !== undefined) {
    const st = object(o.states, `${path}.states`)
    const extraStates = Object.keys(st).filter((k) => k !== 'wet' && k !== 'oil')
    if (extraStates.length > 0) throw new BattleInputError(`${path}.states`, `unknown states ${extraStates.join(', ')}`)
    const list = (v: unknown, p: string): Tile[] => {
      if (!Array.isArray(v) || v.length > 64) throw new BattleInputError(p, 'expected up to 64 tiles')
      return v.map((t, i) => {
        if (!Array.isArray(t) || t.length !== 2) throw new BattleInputError(`${p}[${i}]`, 'expected [x, y]')
        const x = int(t[0], `${p}[${i}][0]`, 0, width - 1), y = int(t[1], `${p}[${i}][1]`, 0, depth - 1)
        if (tileRows[y]![x] === '#') throw new BattleInputError(`${p}[${i}]`, 'on a solid tile')
        return [x, y] as const
      })
    }
    map.states = { ...(st.wet !== undefined ? { wet: list(st.wet, `${path}.states.wet`) } : {}), ...(st.oil !== undefined ? { oil: list(st.oil, `${path}.states.oil`) } : {}) }
  }
  return map
}

const PROP_ID = /^[a-z0-9][a-z0-9-]{0,31}$/

/** The props (CY5): unique ids, tiles on the map; barrels, pipes and terminals off spawns and solid tiles; a terminal's
 * door or lift exists; a lift's heights are 0–3. */
function props(value: unknown, path: string, map: BattleMap, spawns: Set<string>): Prop[] {
  if (!Array.isArray(value) || value.length > 32) throw new BattleInputError(path, 'expected up to 32 props')
  const ids = new Set<string>()
  const tile = (t: unknown, p: string): Tile => {
    if (!Array.isArray(t) || t.length !== 2) throw new BattleInputError(p, 'expected [x, y]')
    const x = int(t[0], `${p}[0]`, 0, map.width - 1), y = int(t[1], `${p}[1]`, 0, map.depth - 1)
    if (map.tiles[y]![x] === '#') throw new BattleInputError(p, 'on a solid tile')
    return [x, y]
  }
  const list = value.map((raw, i): Prop => {
    const p = `${path}[${i}]`
    const o = object(raw, p)
    if (typeof o.id !== 'string' || !PROP_ID.test(o.id) || ids.has(o.id)) throw new BattleInputError(`${p}.id`, 'expected a unique lowercase id')
    ids.add(o.id)
    const id = o.id
    switch (o.kind) {
      case 'barrel': case 'pipe': case 'cable': case 'terminal': {
        const t = tile(o.tile, `${p}.tile`)
        if (o.kind !== 'cable' && spawns.has(`${t[0]},${t[1]}`)) throw new BattleInputError(`${p}.tile`, 'on a spawn')
        if (o.kind !== 'terminal') return { kind: o.kind, id, tile: t } as Prop
        const does = object(o.does, `${p}.does`)
        const keys = Object.keys(does)
        if (keys.length !== 1 || !['door', 'lift', 'turret', 'lights'].includes(keys[0]!)) throw new BattleInputError(`${p}.does`, 'expected one of door, lift, turret or lights')
        if (keys[0] === 'lights' ? does.lights !== true : typeof does[keys[0]!] !== 'string') throw new BattleInputError(`${p}.does`, 'expected an id, or lights: true')
        return { kind: 'terminal', id, tile: t, does } as Prop
      }
      case 'door': case 'lift': {
        if (!Array.isArray(o.tiles) || o.tiles.length < 1 || o.tiles.length > 12) throw new BattleInputError(`${p}.tiles`, 'expected 1–12 tiles')
        const tiles = o.tiles.map((t, k) => tile(t, `${p}.tiles[${k}]`))
        if (o.kind === 'door') {
          if (typeof o.open !== 'boolean') throw new BattleInputError(`${p}.open`, 'expected true or false')
          return { kind: 'door' as const, id, tiles, open: o.open }
        }
        const low = int(o.low, `${p}.low`, 0, TUNING.map.maxHeight), high = int(o.high, `${p}.high`, 0, TUNING.map.maxHeight)
        if (high <= low) throw new BattleInputError(`${p}.high`, 'expected above low')
        if (typeof o.raised !== 'boolean') throw new BattleInputError(`${p}.raised`, 'expected true or false')
        return { kind: 'lift' as const, id, tiles, low, high, raised: o.raised }
      }
      default:
        throw new BattleInputError(`${p}.kind`, 'expected barrel, pipe, cable, terminal, door or lift')
    }
  })
  for (const [i, prop] of list.entries()) {
    if (prop.kind !== 'terminal') continue
    const does = prop.does as Record<string, unknown>
    for (const k of ['door', 'lift'] as const)
      if (k in does && !list.some((q) => q.kind === k && q.id === does[k])) throw new BattleInputError(`${path}[${i}].does.${k}`, `no ${k} ${String(does[k])}`)
  }
  return list
}

export const inBounds = (map: BattleMap, x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.depth
export const heightAt = (map: BattleMap, x: number, y: number): number => Number(map.heights[y]![x])
export const tileAt = (map: BattleMap, x: number, y: number): string => map.tiles[y]![x]!
export const isSolid = (map: BattleMap, x: number, y: number): boolean => tileAt(map, x, y) === '#'
