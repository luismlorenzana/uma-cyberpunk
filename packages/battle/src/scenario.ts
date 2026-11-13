// The scenario format (CY6, schema 1): one JSON file a scenario in `scenarios/`, shared by the sandbox (CY8) and the
// simulator. A scenario names its map (a file in `scenarios/maps/`), holds a battle input without its seed and map, and
// lists the seeds to play. Scenarios are nameless: stand-in units only. `parseScenario` checks it with the battle's own
// parsers.
import { startBattle } from './battle'
import { BattleInputError, parseMap } from './map'
import type { BattleInput, BattleMap, UnitInput } from './types'

export interface Scenario {
  schemaVersion: 1
  id: string
  title: string
  /** A map id in scenarios/maps/. */
  map: string
  /** The battle input without its seed and map. */
  input: Omit<BattleInput, 'seed' | 'map'>
  /** The seeds to play; the sandbox's default is the first. */
  seeds?: number[]
  control?: { squad: 'player' | 'ai'; enemy: 'player' | 'ai' }
  /** The simulator holds an even scenario to the 45–55% win-rate target. */
  even?: boolean
}

type Obj = Record<string, unknown>
const object = (v: unknown, path: string): Obj => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new BattleInputError(path, 'expected an object')
  return v as Obj
}

/** Every word a stand-in may not use: a scenario names no Uma, heroine or franchise. Labels are like "Vanguard A". */
const LABEL = /^[A-Z][A-Za-z]*( [A-Za-z]+)*( [A-Z0-9]+)?$/

/** A scenario's battle input for one seed. */
export function scenarioInput(s: Scenario, map: BattleMap, seed: number | string): BattleInput {
  return { ...s.input, seed: `${s.id}:${seed}`, map }
}

/** Parses a scenario against its map: the shape, stand-in units only, and a battle that starts. */
export function parseScenario(value: unknown, maps: Record<string, BattleMap>, path = 'scenario'): Scenario {
  const o = object(value, path)
  if (o.schemaVersion !== 1) throw new BattleInputError(`${path}.schemaVersion`, 'expected 1')
  if (typeof o.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(o.id)) throw new BattleInputError(`${path}.id`, 'expected a lowercase id')
  if (typeof o.title !== 'string' || o.title.length === 0 || o.title.length > 80) throw new BattleInputError(`${path}.title`, 'expected a title')
  if (typeof o.map !== 'string' || !maps[o.map]) throw new BattleInputError(`${path}.map`, `no map ${String(o.map)}`)
  const map = parseMap(maps[o.map], `maps.${o.map}`)
  const input = object(o.input, `${path}.input`)
  if ('seed' in input || 'map' in input) throw new BattleInputError(`${path}.input`, 'the seed and the map come from the scenario')
  const units = input.units as UnitInput[] | undefined
  if (!Array.isArray(units)) throw new BattleInputError(`${path}.input.units`, 'expected units')
  units.forEach((u, i) => {
    if (u.ref && u.ref.kind !== 'standin') throw new BattleInputError(`${path}.input.units[${i}].ref`, 'scenarios use stand-ins only')
    if (u.label !== undefined && (typeof u.label !== 'string' || !LABEL.test(u.label))) throw new BattleInputError(`${path}.input.units[${i}].label`, 'expected a plain stand-in label')
  })
  if (o.seeds !== undefined && !(Array.isArray(o.seeds) && o.seeds.every((s) => Number.isSafeInteger(s) && s >= 0))) throw new BattleInputError(`${path}.seeds`, 'expected whole numbers')
  if (o.control !== undefined) {
    const c = object(o.control, `${path}.control`)
    for (const side of ['squad', 'enemy'] as const) if (c[side] !== 'player' && c[side] !== 'ai') throw new BattleInputError(`${path}.control.${side}`, 'expected player or ai')
  }
  if (o.even !== undefined && typeof o.even !== 'boolean') throw new BattleInputError(`${path}.even`, 'expected true or false')
  const extra = Object.keys(o).filter((k) => !['schemaVersion', 'id', 'title', 'map', 'input', 'seeds', 'control', 'even'].includes(k))
  if (extra.length > 0) throw new BattleInputError(path, `unknown keys ${extra.join(', ')}`)
  const scenario = o as unknown as Scenario
  // The battle's own parsers have the last word.
  startBattle(scenarioInput(scenario, map, 0))
  return scenario
}
