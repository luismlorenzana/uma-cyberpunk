// The scenarios in git (CY6), loaded for the tests and the simulator: `scenarios/*.json` and `scenarios/maps/*.json` at
// the repo root. Node only; the app loads them its own way.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseScenario, type Scenario } from './scenario'
import type { BattleMap } from './types'

export function loadScenarios(root: string, campaign = false): { maps: Record<string, BattleMap>; scenarios: Scenario[] } {
  const dir = join(root, 'scenarios')
  const campaignDir = join(dir, 'campaign')
  const maps: Record<string, BattleMap> = {}
  const files = (folder: string) => readdirSync(folder).filter((f) => f.endsWith('.json')).sort().map((f) => join(folder, f))
  for (const path of [...files(join(dir, 'maps')), ...(campaign ? files(join(campaignDir, 'maps')) : [])]) {
    const map = JSON.parse(readFileSync(path, 'utf8')) as BattleMap
    maps[map.id] = map
  }
  const paths = [...files(dir), ...(campaign ? files(campaignDir) : [])]
  const scenarios = paths.map((path) => parseScenario(JSON.parse(readFileSync(path, 'utf8')), maps, path))
  return { maps, scenarios }
}
