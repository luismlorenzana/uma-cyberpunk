// Terrain (TC24, CY5): the board as it stands now (lifts, doors, barriers, props), the five tile states with their
// spread, timers and damage, and the terrain card. A version-1 battle has no field: its board is its map.
import { heightAt, inBounds, isSolid, tileAt } from './map'
import { TUNING } from './tuning'
import type { BattleMap, BattleState, Cue, FieldState, ItemKind, Prop, Tile, TileState, TileStateKind } from './types'

export const keyOf = (x: number, y: number): string => `${x},${y}`
const NEIGHBOURS: readonly Tile[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]

/** The board a rule reads: heights, where a unit may stand or pass, and what stops a line of fire. */
export interface Board {
  width: number
  depth: number
  height(x: number, y: number): number
  /** A unit may stand or pass here (units aside). */
  open(x: number, y: number): boolean
  /** A line of fire passing over this tile stops. */
  blocks(x: number, y: number): boolean
  /** Ranged hits into or out of this tile lose Smoke's %. */
  smoky(x: number, y: number): boolean
  /** A cover tile (`c`), in rules version 2. */
  cover(x: number, y: number): boolean
}

export function mapBoard(map: BattleMap): Board {
  return {
    width: map.width, depth: map.depth,
    height: (x, y) => heightAt(map, x, y),
    open: (x, y) => inBounds(map, x, y) && !isSolid(map, x, y),
    blocks: (x, y) => isSolid(map, x, y),
    smoky: () => false,
    cover: () => false,
  }
}

const propsOf = (map: BattleMap): readonly Prop[] => map.props ?? []

/** The board as it stands in a battle: a version-1 battle's is its map. */
export function boardOf(state: Pick<BattleState, 'input' | 'field'>): Board {
  const map = state.input.map, field = state.field
  if (!field) return mapBoard(map)
  const height = new Map<string, number>(), closed = new Set<string>(), sightless = new Set<string>()
  for (const p of propsOf(map)) {
    if (p.kind === 'lift') for (const t of p.tiles) height.set(keyOf(t[0], t[1]), field.lifts[p.id] ? p.high : p.low)
    if (p.kind === 'door' && !field.doors[p.id]) for (const t of p.tiles) { closed.add(keyOf(t[0], t[1])); sightless.add(keyOf(t[0], t[1])) }
    if ((p.kind === 'barrel' || p.kind === 'pipe') && !field.burst.includes(p.id)) closed.add(keyOf(p.tile[0], p.tile[1]))
    if (p.kind === 'terminal') closed.add(keyOf(p.tile[0], p.tile[1]))
  }
  for (const b of field.barriers) { closed.add(keyOf(b.x, b.y)); sightless.add(keyOf(b.x, b.y)) }
  const smoke = (x: number, y: number) => field.states[keyOf(x, y)]?.kind === 'smoke'
  return {
    width: map.width, depth: map.depth,
    height: (x, y) => height.get(keyOf(x, y)) ?? heightAt(map, x, y),
    open: (x, y) => inBounds(map, x, y) && !isSolid(map, x, y) && !closed.has(keyOf(x, y)),
    blocks: (x, y) => isSolid(map, x, y) || sightless.has(keyOf(x, y)) || smoke(x, y),
    smoky: smoke,
    cover: (x, y) => tileAt(map, x, y) === 'c',
  }
}

/** A version-2 battle's first field, from its map and input. */
export function newField(state: Pick<BattleState, 'input'>): FieldState {
  const doors: Record<string, boolean> = {}, lifts: Record<string, boolean> = {}
  for (const p of propsOf(state.input.map)) {
    if (p.kind === 'door') doors[p.id] = p.open
    if (p.kind === 'lift') lifts[p.id] = p.raised
  }
  const items: Record<ItemKind, number> = { repair: 0, patch: 0, smoke: 0, cell: 0 }
  for (const [k, v] of Object.entries(state.input.items ?? {})) items[k as ItemKind] = v ?? 0
  const states: Record<string, TileState> = {}
  for (const t of state.input.map.states?.wet ?? []) states[keyOf(t[0], t[1])] = { kind: 'wet', until: 0 }
  for (const t of state.input.map.states?.oil ?? []) states[keyOf(t[0], t[1])] = { kind: 'oil', until: 0 }
  return { states, doors, lifts, burst: [], barriers: [], nextBarrier: 1, lightsOutUntil: 0, hacked: [], volley: { meter: 0, marked: [], at: 0 }, items, benchUsed: false }
}

const isGrating = (state: Pick<BattleState, 'input'>, x: number, y: number) => tileAt(state.input.map, x, y) === '='

/** Live tiles now: every cable, and current spreading at once across connected Wet tiles and grating. */
export function liveTiles(state: Pick<BattleState, 'input' | 'field'>): Set<string> {
  const field = state.field
  const live = new Set<string>()
  if (!field) return live
  const map = state.input.map
  const conducts = (x: number, y: number) => inBounds(map, x, y) && (field.states[keyOf(x, y)]?.kind === 'wet' || isGrating(state, x, y))
  const queue: Tile[] = []
  for (const p of propsOf(map)) if (p.kind === 'cable') { live.add(keyOf(p.tile[0], p.tile[1])); queue.push(p.tile) }
  while (queue.length > 0) {
    const [x, y] = queue.shift()!
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy, k = keyOf(nx, ny)
      if (live.has(k) || !conducts(nx, ny)) continue
      live.add(k)
      queue.push([nx, ny])
    }
  }
  return live
}

/** The connected tiles of one state from a tile, by flood fill. */
function slick(field: FieldState, from: Tile, kind: TileStateKind, map: BattleMap): Tile[] {
  const out: Tile[] = [], seen = new Set<string>([keyOf(from[0], from[1])]), queue: Tile[] = [from]
  while (queue.length > 0) {
    const t = queue.shift()!
    out.push(t)
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = t[0] + dx, ny = t[1] + dy, k = keyOf(nx, ny)
      if (seen.has(k) || !inBounds(map, nx, ny) || field.states[k]?.kind !== kind) continue
      seen.add(k)
      queue.push([nx, ny])
    }
  }
  return out
}

/** Sets a state on tiles (open, non-solid ones), with its rules: Wet puts out Fire; Fire on Oil takes the whole slick
 * and can't take Wet; Smoke and Fire carry their timers. One cue per change. */
export function setState(state: BattleState, tiles: readonly Tile[], kind: TileStateKind, cues: Cue[]): void {
  const field = state.field!
  const map = state.input.map
  const changed: Tile[] = []
  const put = (t: Tile, s: TileState | null) => {
    const k = keyOf(t[0], t[1])
    if (s) field.states[k] = s
    else delete field.states[k]
    changed.push(t)
  }
  const rounds = (n: number) => state.time + n * TUNING.roundTicks
  for (const t of tiles) {
    if (!inBounds(map, t[0], t[1]) || isSolid(map, t[0], t[1])) continue
    const now = field.states[keyOf(t[0], t[1])]
    if (kind === 'fire') {
      if (now?.kind === 'wet') continue
      if (now?.kind === 'oil') {
        for (const s of slick(field, t, 'oil', map)) put(s, { kind: 'fire', until: rounds(TUNING.terrain.fireRounds) })
        continue
      }
      put(t, { kind: 'fire', until: rounds(TUNING.terrain.fireRounds) })
    } else if (kind === 'wet') put(t, { kind: 'wet', until: 0 })
    else if (kind === 'oil') {
      if (now?.kind === 'fire') continue
      put(t, { kind: 'oil', until: 0 })
    } else put(t, { kind: 'smoke', until: rounds(TUNING.terrain.smokeRounds) })
  }
  if (changed.length > 0) cues.push({ kind: 'terrain', tiles: changed, state: kind })
  if (kind === 'oil' || kind === 'wet') sparks(state, cues)
}

/** Current meeting Oil sets the slick alight. */
export function sparks(state: BattleState, cues: Cue[]): void {
  const field = state.field!
  const live = liveTiles(state)
  for (const [k, s] of Object.entries(field.states)) {
    if (s.kind !== 'oil') continue
    const [x, y] = k.split(',').map(Number) as [number, number]
    if (live.has(k) || NEIGHBOURS.some(([dx, dy]) => live.has(keyOf(x + dx, y + dy)))) {
      setState(state, [[x, y]], 'fire', cues)
      return sparks(state, cues)
    }
  }
}

/** Timers run out: Fire burns out (to Smoke where it burned Oil? no: to nothing), Smoke clears, the lights come back. */
export function expire(state: BattleState, cues: Cue[]): void {
  const field = state.field
  if (!field) return
  const gone: Record<TileStateKind, Tile[]> = { wet: [], oil: [], fire: [], smoke: [] }
  for (const [k, s] of Object.entries(field.states)) {
    if (s.until > 0 && s.until <= state.time) {
      gone[s.kind].push(k.split(',').map(Number) as unknown as Tile)
      delete field.states[k]
    }
  }
  for (const kind of ['fire', 'smoke'] as const) if (gone[kind].length > 0) cues.push({ kind: 'terrain', tiles: gone[kind], state: null })
  if (field.lightsOutUntil > 0 && field.lightsOutUntil <= state.time) {
    field.lightsOutUntil = 0
    cues.push({ kind: 'lights', out: false })
  }
}

export const lightsOut = (state: Pick<BattleState, 'field' | 'time'>): boolean => !!state.field && state.field.lightsOutUntil > state.time

/** The tile and its four neighbours. */
export const cross = (t: Tile): Tile[] => [t, ...NEIGHBOURS.map(([dx, dy]) => [t[0] + dx, t[1] + dy] as const)]

export interface TerrainCard {
  tile: Tile
  height: number
  /** The map's tile: floor, solid, grating or cover. */
  ground: 'floor' | 'solid' | 'grating' | 'cover'
  state: TileStateKind | null
  live: boolean
  /** Rounds left on a timed state. */
  rounds: number | null
  props: string[]
  /** What could change it. */
  changes: string[]
  /** What it does for whoever stands there, in words. */
  effects: string[]
}

/** A tile's terrain card, for the board's long press (TC24). */
export function terrainCard(state: Pick<BattleState, 'input' | 'field' | 'time'>, tile: Tile): TerrainCard {
  const [x, y] = tile
  const map = state.input.map
  const board = boardOf(state)
  const c = tileAt(map, x, y)
  const ground = c === '#' ? 'solid' : c === '=' ? 'grating' : c === 'c' ? 'cover' : 'floor'
  const s = state.field?.states[keyOf(x, y)] ?? null
  const live = liveTiles(state).has(keyOf(x, y))
  const props = propsOf(map).filter((p) => ('tile' in p ? p.tile[0] === x && p.tile[1] === y : p.tiles.some((t) => t[0] === x && t[1] === y))).map((p) => `${p.kind}:${p.id}`)
  const changes: string[] = []
  if (ground !== 'solid') {
    if (s?.kind !== 'wet') changes.push('Fire from F weapons, burning Oil or current on Oil')
    changes.push('Wet from a burst pipe', 'Smoke from a smoke charge')
  }
  if (props.some((p) => p.startsWith('lift:'))) changes.push('Its height, from a terminal')
  if (props.some((p) => p.startsWith('door:'))) changes.push('Open or shut, from a terminal')
  const effects: string[] = []
  const t = TUNING.terrain
  if (ground === 'cover' && state.input.rulesVersion >= 2) effects.push(`Cover: −${t.coverEvasion}% to Short and Long hits from the front and sides`)
  if (ground === 'grating' && state.input.rulesVersion >= 2) effects.push('Grating carries current')
  if (s?.kind === 'fire') effects.push(`Fire: ${t.fireDamage} F damage to the Legs of whoever ends a turn here`)
  if (s?.kind === 'smoke') effects.push(`Smoke: blocks sight; −${t.smokePenalty}% to ranged hits`)
  if (s?.kind === 'oil') effects.push('Oil: fire spreads across the slick')
  if (s?.kind === 'wet') effects.push('Wet: current spreads across it; puts out Fire')
  if (live) effects.push(`Live: ${t.liveDamage} damage to the Core of whoever enters or ends a turn here`)
  return { tile, height: board.height(x, y), ground, state: s?.kind ?? null, live, rounds: s && s.until > 0 ? Math.ceil((s.until - state.time) / TUNING.roundTicks) : null, props, changes, effects }
}
