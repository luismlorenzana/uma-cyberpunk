// The sandbox's local rows (CY8): the battle in progress as a scenario, its frozen input and its actions, and the
// scenarios saved on this phone. A database of its own, never the synced save: a sandbox battle is a test, not progress,
// so it bumps no save version, sends no sync traffic and can't touch `account.updatedAt`.
import type { Dexie, Table } from 'dexie'
import type { BattleAction, BattleInput, Scenario } from '@cyber/battle'

export interface SandboxRow {
  id: 'current'
  scenario: Scenario
  input: BattleInput
  actions: BattleAction[]
  rulesVersion: number
  updatedAt: string
  /** When the battle started, for the results' wall-clock minutes. */
  startedAt: string
}

export interface SavedScenario { id: string; scenario: Scenario; savedAt: string }

let db: Promise<Dexie> | null = null
function database(): Promise<Dexie> {
  db ??= (async () => {
    const { default: DexieDb } = await import('dexie')
    const opened = new DexieDb('uma-cyberpunk-sandbox')
    opened.version(1).stores({ battle: 'id', scenarios: 'id' })
    return opened
  })().catch((e: unknown) => { db = null; throw e })
  return db
}
const battleTable = async (): Promise<Table<SandboxRow, string>> => (await database()).table('battle')
const scenarioTable = async (): Promise<Table<SavedScenario, string>> => (await database()).table('scenarios')

export async function readBattle(): Promise<SandboxRow | null> {
  try { return (await (await battleTable()).get('current')) ?? null } catch { return null }
}
export async function writeBattle(row: SandboxRow): Promise<void> {
  try { await (await battleTable()).put(row) } catch { /* private mode: the battle just won't resume */ }
}
export async function clearBattle(): Promise<void> {
  try { await (await battleTable()).delete('current') } catch { /* nothing to clear */ }
}
export async function savedScenarios(): Promise<SavedScenario[]> {
  try { return (await (await scenarioTable()).toArray()).sort((a, b) => a.id.localeCompare(b.id)) } catch { return [] }
}
export async function saveScenario(scenario: Scenario): Promise<void> {
  await (await scenarioTable()).put({ id: scenario.id, scenario, savedAt: new Date().toISOString() })
}
export async function removeScenario(id: string): Promise<void> {
  await (await scenarioTable()).delete(id)
}
