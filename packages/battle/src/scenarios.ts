// The scenarios in git (CY6), loaded for the tests and the simulator: `scenarios/*.json` and `scenarios/maps/*.json` at
// the repo root. Node only; the app loads them its own way.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseScenario, type Scenario } from './scenario'
import type { BattleMap } from './types'

export function loadScenarios(root: string): { maps: Record<string, BattleMap>; scenarios: Scenario[] } {
  const dir = join(root, 'scenarios')
  const maps: Record<string, BattleMap> = {}
  for (const f of readdirSync(join(dir, 'maps')).filter((f) => f.endsWith('.json'))) maps[f.slice(0, -5)] = JSON.parse(readFileSync(join(dir, 'maps', f), 'utf8'))
  const scenarios = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => parseScenario(JSON.parse(readFileSync(join(dir, f), 'utf8')), maps, f))
  return { maps, scenarios }
}
