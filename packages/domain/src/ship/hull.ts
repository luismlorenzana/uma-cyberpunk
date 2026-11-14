// The ship as a build (CY15, TC62, TC63, TC66): decks of slots, modules placed and built over watches, levels, the
// reactor's pips and the battle systems powered per sortie, the Lab's one project, the capabilities the map asks for, and
// the wallet. Pure; the save holds `Ship` and `Wallet`, the director and the screens call these. No upkeep, ever.
import { LEVEL3_RESEARCH, MODULES, MODULES_BY_ID, PROJECTS_BY_ID, type Cost, type ModuleDef, type ModuleId, type SystemId } from './modules'
import { ROOM_IDS, type RoomId } from './rooms'

export interface PlacedModule {
  id: ModuleId
  deck: number
  slot: number
  /** 0 while its first build runs: it doesn't run yet. */
  level: number
  /** A build under way: the level it reaches and the watches left. */
  building: { level: number; left: number } | null
}
export interface Ship {
  decks: number
  /** Slots a deck: five, six from Hull III. */
  width: number
  modules: PlacedModule[]
  /** Modules the player may place (from the start, a lead's `opens`, research). */
  unlocked: ModuleId[]
  /** The battle systems the player last powered for a sortie. */
  powered: SystemId[]
  research: { done: string[]; current: { id: string; left: number } | null }
}
export interface Wallet { credits: number; alloy: number; data: number }

/** Every hull number in one table (D26). */
export const HULL_TUNING = {
  decks: 2, width: 5, maxDecks: 6, wideWidth: 6,
  /** Engineering's reactor pips by level, and one more for each Reactor project. */
  pips: [0, 3, 5, 7] as const,
  /** Builds at once: one, two from Engineering level 3. */
  builds: (engineering: number) => (engineering >= 3 ? 2 : 1),
  /** What results pay besides credits: Alloy is the salvage number; Data 5 a battle, 10 a win. */
  dataBattle: 5, dataWin: 10,
  starterWallet: { credits: 500, alloy: 20, data: 20 } as Wallet,
} as const

/** The order the rooms of an older save (and a new game) take their slots, deck by deck. */
const PLACE_ORDER: readonly ModuleId[] = ['bridge', 'log', 'comms', 'engineering', 'store', 'hangar', 'quarters', 'simpod']

/** A ship with these modules placed and built at level 1, in the fixed order, on two decks of five. */
export function shipWith(open: readonly ModuleId[]): Ship {
  const ids = PLACE_ORDER.filter((id) => open.includes(id))
  const modules: PlacedModule[] = ids.map((id, i) => ({ id, deck: Math.floor(i / HULL_TUNING.width), slot: i % HULL_TUNING.width, level: 1, building: null }))
  const unlocked = [...new Set([...ids, ...MODULES.filter((m) => m.unlock === 'start').map((m) => m.id)])]
  return { decks: HULL_TUNING.decks, width: HULL_TUNING.width, modules, unlocked, powered: [], research: { done: [], current: null } }
}

export const moduleAt = (ship: Ship, id: ModuleId): PlacedModule | undefined => ship.modules.find((m) => m.id === id)
export const moduleLevel = (ship: Ship, id: ModuleId): number => moduleAt(ship, id)?.level ?? 0
const def = (id: ModuleId): ModuleDef => MODULES_BY_ID.get(id)!

/** The rooms with a page that run now (built to level 1 at least). */
export const openRooms = (ship: Ship): RoomId[] => ship.modules.filter((m) => m.level >= 1 && ROOM_IDS.includes(m.id as RoomId)).map((m) => m.id as RoomId)

/** What occupies each slot of a deck: a module's id (twice for a wide one), or null. */
export function deckSlots(ship: Ship, deck: number): (ModuleId | null)[] {
  const out: (ModuleId | null)[] = Array(ship.width).fill(null)
  for (const m of ship.modules) if (m.deck === deck) for (let i = 0; i < def(m.id).width; i++) out[m.slot + i] = m.id
  return out
}
const fits = (ship: Ship, id: ModuleId, deck: number, slot: number): boolean => {
  if (deck < 0 || deck >= ship.decks || slot < 0 || slot + def(id).width > ship.width) return false
  const slots = deckSlots(ship, deck)
  return slots.slice(slot, slot + def(id).width).every((x) => x === null)
}
/** The first free place for a module, or null. */
export function freePlace(ship: Ship, id: ModuleId): { deck: number; slot: number } | null {
  for (let deck = 0; deck < ship.decks; deck++) for (let slot = 0; slot < ship.width; slot++) if (fits(ship, id, deck, slot)) return { deck, slot }
  return null
}

const affordable = (w: Wallet, c: Cost) => w.credits >= c.credits && w.alloy >= c.alloy && w.data >= c.data
const pay = (w: Wallet, c: Cost): Wallet => ({ credits: w.credits - c.credits, alloy: w.alloy - c.alloy, data: w.data - c.data })
export const earn = (w: Wallet, add: Partial<Wallet>): Wallet => ({ credits: w.credits + (add.credits ?? 0), alloy: w.alloy + (add.alloy ?? 0), data: w.data + (add.data ?? 0) })
const buildsRunning = (ship: Ship) => ship.modules.filter((m) => m.building).length
export const buildSlots = (ship: Ship): number => HULL_TUNING.builds(moduleLevel(ship, 'engineering'))

/** Why a module can't be placed there, or null. */
export function placeProblem(ship: Ship, wallet: Wallet, id: ModuleId, deck: number, slot: number): string | null {
  if (!ship.unlocked.includes(id)) return 'Not unlocked yet'
  if (moduleAt(ship, id)) return 'Already aboard'
  if (!fits(ship, id, deck, slot)) return def(id).width === 2 ? 'Needs two free slots side by side' : 'That slot is taken'
  if (buildsRunning(ship) >= buildSlots(ship)) return 'Engineering is busy with another build'
  if (!affordable(wallet, def(id).levels[0].cost)) return 'Not enough in the wallet'
  return null
}

/** Places a module and starts its first build; null when it can't. */
export function placeModule(ship: Ship, wallet: Wallet, id: ModuleId, deck: number, slot: number): { ship: Ship; wallet: Wallet } | null {
  if (placeProblem(ship, wallet, id, deck, slot)) return null
  const lvl = def(id).levels[0]
  return { ship: { ...ship, modules: [...ship.modules, { id, deck, slot, level: 0, building: { level: 1, left: lvl.watches } }] }, wallet: pay(wallet, lvl.cost) }
}

/** Why a module can't go up a level, or null. */
export function upgradeProblem(ship: Ship, wallet: Wallet, id: ModuleId): string | null {
  const m = moduleAt(ship, id)
  if (!m) return 'Not aboard'
  if (m.building) return 'Already building'
  if (m.level >= 3) return 'At level 3'
  const d = def(id)
  if (m.level === 2 && !ship.research.done.includes(LEVEL3_RESEARCH[d.family])) return `Level 3 needs the ${PROJECTS_BY_ID.get(LEVEL3_RESEARCH[d.family])!.name} project`
  if (buildsRunning(ship) >= buildSlots(ship)) return 'Engineering is busy with another build'
  if (!affordable(wallet, d.levels[m.level]!.cost)) return 'Not enough in the wallet'
  return null
}

export function upgradeModule(ship: Ship, wallet: Wallet, id: ModuleId): { ship: Ship; wallet: Wallet } | null {
  if (upgradeProblem(ship, wallet, id)) return null
  const m = moduleAt(ship, id)!, next = def(id).levels[m.level]!
  return { ship: { ...ship, modules: ship.modules.map((x) => (x.id === id ? { ...x, building: { level: m.level + 1, left: next.watches } } : x)) }, wallet: pay(wallet, next.cost) }
}

/** A lead's `opens` (TC49): the module unlocked, and placed and built at level 1 at once when a slot is free. */
export function openModule(ship: Ship, id: ModuleId): Ship {
  const unlocked = ship.unlocked.includes(id) ? ship.unlocked : [...ship.unlocked, id]
  if (moduleAt(ship, id)) return { ...ship, unlocked }
  const at = freePlace(ship, id)
  return { ...ship, unlocked, modules: at ? [...ship.modules, { id, ...at, level: 1, building: null }] : ship.modules }
}

/** A story refit (the `refit` step) or a Hull project: one more deck, to six. */
export const addDeck = (ship: Ship): Ship => ({ ...ship, decks: Math.min(HULL_TUNING.maxDecks, ship.decks + 1) })

// --- Research ----------------------------------------------------------------------------------------------------------

/** Why a project can't start, or null. */
export function researchProblem(ship: Ship, wallet: Wallet, id: string): string | null {
  const p = PROJECTS_BY_ID.get(id)
  if (!p) return 'No such project'
  if (moduleLevel(ship, 'lab') < 1) return 'Needs a Lab'
  if (ship.research.current) return 'The Lab is busy'
  if (ship.research.done.includes(id)) return 'Done'
  const missing = p.needs.filter((n) => !ship.research.done.includes(n))
  if (missing.length) return `Needs ${missing.map((n) => PROJECTS_BY_ID.get(n)!.name).join(', ')}`
  if (wallet.data < p.data) return 'Not enough Data'
  return null
}

/** Starts a project: its Data paid; a level 2 Lab takes a watch off a project of two or more. */
export function startResearch(ship: Ship, wallet: Wallet, id: string): { ship: Ship; wallet: Wallet } | null {
  if (researchProblem(ship, wallet, id)) return null
  const p = PROJECTS_BY_ID.get(id)!
  const left = p.watches - (moduleLevel(ship, 'lab') >= 2 && p.watches >= 2 ? 1 : 0)
  return { ship: { ...ship, research: { ...ship.research, current: { id, left } } }, wallet: { ...wallet, data: wallet.data - p.data } }
}

/** What a finished project changes: a deck, the wide hull, a module unlocked; the rest is read where it applies. */
function finishProject(ship: Ship, id: string): Ship {
  let next: Ship = { ...ship, research: { done: [...ship.research.done, id], current: null } }
  if (id === 'hull-1' || id === 'hull-2') next = addDeck(next)
  if (id === 'hull-3') next = { ...next, width: HULL_TUNING.wideWidth }
  for (const m of MODULES) if (typeof m.unlock === 'object' && m.unlock.research === id && !next.unlocked.includes(m.id)) next = { ...next, unlocked: [...next.unlocked, m.id] }
  return next
}

export interface WatchReport { built: { id: ModuleId; level: number }[]; researched: string[] }

/** A watch passes (TC62): every build and the Lab's project move a watch on; what finishes lands. */
export function passWatch(ship: Ship): { ship: Ship; report: WatchReport } {
  const report: WatchReport = { built: [], researched: [] }
  let next: Ship = {
    ...ship,
    modules: ship.modules.map((m) => {
      if (!m.building) return m
      if (m.building.left > 1) return { ...m, building: { ...m.building, left: m.building.left - 1 } }
      report.built.push({ id: m.id, level: m.building.level })
      return { ...m, level: m.building.level, building: null }
    }),
  }
  const cur = next.research.current
  if (cur) {
    if (cur.left > 1) next = { ...next, research: { ...next.research, current: { ...cur, left: cur.left - 1 } } }
    else { next = finishProject(next, cur.id); report.researched.push(cur.id) }
  }
  return { ship: next, report }
}

// --- Power and capabilities ----------------------------------------------------------------------------------------------

/** The reactor's pips: Engineering's level, plus one for each Reactor project done. */
export const reactorPips = (ship: Ship): number =>
  HULL_TUNING.pips[Math.min(3, moduleLevel(ship, 'engineering'))]! + ship.research.done.filter((d) => d.startsWith('reactor-')).length

/** The battle systems installed and running (level 1 or more), in the table's order. */
export const installedSystems = (ship: Ship): SystemId[] =>
  MODULES.filter((m) => m.kind === 'system' && moduleLevel(ship, m.id) >= 1).map((m) => m.id as SystemId)

export const pipsOf = (systems: readonly SystemId[]): number => systems.reduce((n, s) => n + (def(s).pips ?? 0), 0)

/** A sortie's power choice (TC62): installed systems only, within the reactor's pips; null when it's over. */
export function powerChoice(ship: Ship, systems: readonly SystemId[]): SystemId[] | null {
  const installed = installedSystems(ship)
  const chosen = [...new Set(systems)].filter((s) => installed.includes(s))
  return pipsOf(chosen) <= reactorPips(ship) ? chosen : null
}

/** The capabilities the map can ask for (`ship:<capability>`), from the modules running at their levels. */
export function shipCapabilities(ship: Ship): string[] {
  const out = new Set<string>()
  for (const m of ship.modules) {
    const caps = def(m.id).capability
    if (!caps || m.level < 1) continue
    for (let l = 1; l <= m.level; l++) { const cap = caps[l - 1]; if (cap) out.add(cap) }
  }
  return [...out].sort()
}

/** What a mission's results pay into the wallet (TC62): its credits, its salvage as Alloy, and Data. */
export const resultsPay = (credits: number, salvage: number, won: boolean): Wallet =>
  ({ credits, alloy: salvage, data: won ? HULL_TUNING.dataWin : HULL_TUNING.dataBattle })

/** Cabins the Quarters level gives (CY14 on TC60): shared berths at 1, private for the first twenty at 2, for all at 3. */
export const privateCabins = (ship: Ship, crew: number): number => {
  const q = moduleLevel(ship, 'quarters')
  return q >= 3 ? crew : q === 2 ? Math.min(20, crew) : 0
}
