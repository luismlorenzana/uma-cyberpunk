// The ship's modules and the Lab's projects (CY15, TC62, TC63): every room and battle system the hull can hold, with its
// width, its three levels' costs and watches, what each level adds, its posts (CY16) and what it opens on the map (TC66);
// and the research table in four branches. Invented numbers in one place (D26), tuned with the rest of life aboard.
import type { RoomId } from './rooms'

export type SystemId = 'battery' | 'sensors' | 'shield' | 'drones' | 'engines'
export type BuildRoomId = 'engineering' | 'lab' | 'galley' | 'medbay' | 'observation' | 'workshop' | 'garden' | 'guest'
export type ModuleId = RoomId | BuildRoomId | SystemId

export interface Cost { credits: number; alloy: number; data: number }
export interface LevelDef { cost: Cost; watches: number; adds: string }
export type Family = 'core' | 'rooms' | 'quarters' | 'systems'
/** How a module becomes buildable: placed at a new game, unlocked from the start, by a lead's `opens`, or by research. */
export type Unlock = 'placed' | 'start' | 'lead' | { research: string }

export interface ModuleDef {
  id: ModuleId
  name: string
  kind: 'room' | 'system'
  family: Family
  width: 1 | 2
  /** A battle system's reactor pips when powered for a sortie. */
  pips?: number
  levels: readonly [LevelDef, LevelDef, LevelDef]
  /** What each level opens on the map (`ship:<capability>` keys), if anything. */
  capability?: readonly [string | null, string | null, string | null]
  unlock: Unlock
}

const c = (credits: number, alloy: number, data = 0): Cost => ({ credits, alloy, data })
/** The level costs and watches by family; level 3 waits on that family's research. */
const COSTS: Record<Family, readonly [[Cost, number], [Cost, number], [Cost, number]]> = {
  core: [[c(200, 10), 2], [c(400, 30, 10), 2], [c(900, 60, 30), 3]],
  rooms: [[c(200, 10), 2], [c(400, 25, 10), 2], [c(800, 50, 30), 3]],
  quarters: [[c(200, 10), 2], [c(500, 30), 2], [c(1000, 60, 20), 3]],
  systems: [[c(300, 20, 10), 2], [c(600, 40, 20), 2], [c(1000, 70, 40), 3]],
}
/** The research each family's level 3 needs. */
export const LEVEL3_RESEARCH: Record<Family, string> = { core: 'core-3', rooms: 'rooms-3', quarters: 'private-cabins', systems: 'systems-3' }

const mod = (id: ModuleId, name: string, kind: ModuleDef['kind'], family: Family, unlock: Unlock, adds: readonly [string, string, string], extra: Partial<ModuleDef> = {}): ModuleDef => ({
  id, name, kind, family, width: 1, unlock,
  levels: COSTS[family].map(([cost, watches], i) => ({ cost, watches, adds: adds[i]! })) as unknown as ModuleDef['levels'],
  ...extra,
})

export const MODULES: readonly ModuleDef[] = [
  mod('bridge', 'Bridge', 'room', 'core', 'placed', ['The star map and travel', 'A second Bridge post', 'A third post; jumps show their event first']),
  mod('hangar', 'Hangar', 'room', 'core', 'placed', ['Rigs and loadouts', 'A second mechanic post', 'A third post']),
  mod('quarters', 'Quarters', 'room', 'quarters', 'placed', ['Shared berths: two Umas a cabin', 'Private cabins for the first twenty', 'Private cabins for everyone']),
  mod('log', 'Log', 'room', 'core', 'placed', ['The Timeline, Files and Anomalies', 'A second analyst post', 'A third post']),
  mod('engineering', 'Engineering', 'room', 'core', 'placed', ['The reactor: 3 pips; one build at a time', 'The reactor: 5 pips', 'The reactor: 7 pips; two builds at a time']),
  mod('store', 'Store', 'room', 'rooms', 'lead', ['Parts and items to buy', 'More stock', 'Rare stock']),
  mod('comms', 'Comms', 'room', 'rooms', 'lead', ['Calls and operations', 'A second operator post', 'A third post']),
  mod('simpod', 'Sim Pod', 'room', 'rooms', 'lead', ['Practice battles', 'Harder drills', 'Drills against past bosses']),
  mod('lab', 'Lab', 'room', 'rooms', 'start', ['Research, one project at a time', 'Projects a watch faster (2+ watches)', 'A second researcher post']),
  mod('galley', 'Galley', 'room', 'rooms', 'start', ['Meals before a sortie (CY17)', 'A second cook post', 'Two meals to choose from']),
  mod('medbay', 'Med Bay', 'room', 'rooms', { research: 'medbay' }, ['Strain heals a point faster', 'A second medic post', 'A third post']),
  mod('observation', 'Observation Deck', 'room', 'rooms', { research: 'observation' }, ['Invitations out (visits)', 'A second spot to visit', 'A third spot']),
  mod('workshop', 'Workshop', 'room', 'rooms', { research: 'workshop' }, ['Parts and furniture made aboard (CY16)', 'A second maker post', 'A third post']),
  mod('garden', 'Garden', 'room', 'rooms', { research: 'garden' }, ['Plants and calm: invitations', 'Fresh food for meals', 'A third gardener post'], { width: 2 }),
  mod('guest', 'Guest Wing', 'room', 'rooms', { research: 'guest-wing' }, ['Room for a freed heroine as a guest', 'Two guests', 'Three guests'], { width: 2 }),
  mod('battery', 'Battery', 'system', 'systems', 'start', ['Ship fire support in battle (CY17)', 'Harder hits', 'Two shots a battle'], { pips: 1 }),
  mod('sensors', 'Sensors', 'system', 'systems', 'start', ['The map revealed at the start (CY17)', 'Enemy intents shown', 'Ambushes warned'], { pips: 1, capability: ['sensors', 'sensors', 'sensors'] }),
  mod('shield', 'Shield Projector', 'system', 'systems', { research: 'shield-projector' }, ['A shield on the squad at the start (CY17); storm shielding', 'Stronger shields', 'Shields twice a battle'], { pips: 2, capability: ['storm', 'storm', 'storm'] }),
  mod('drones', 'Drone Bay', 'system', 'systems', { research: 'drone-bay' }, ['A spotter drone in battle (CY17)', 'Two drones', 'Repair drones'], { pips: 2, width: 2 }),
  mod('engines', 'Engines', 'system', 'systems', { research: 'engines' }, ['A drive that reaches farther worlds; a reposition in battle', 'The level 2 drive', 'The level 3 drive'], { pips: 1, capability: ['drive-1', 'drive-2', 'drive-3'] }),
]
export const MODULES_BY_ID: ReadonlyMap<ModuleId, ModuleDef> = new Map(MODULES.map((m) => [m.id, m]))
export const MODULE_IDS: readonly ModuleId[] = MODULES.map((m) => m.id)
export const SYSTEM_IDS: readonly SystemId[] = MODULES.filter((m) => m.kind === 'system').map((m) => m.id as SystemId)

/** Posts a module holds at a level (CY16's duties): a room one a level, a battle system one. */
export const postsAt = (def: ModuleDef, level: number): number => (level < 1 ? 0 : def.kind === 'system' ? 1 : level)

/** What a capability is, in words, for a locked node ("Needs the storm shielding"). */
export const CAPABILITY_NAME: Record<string, string> = {
  'drive-1': 'the drive', 'drive-2': 'the level 2 drive', 'drive-3': 'the level 3 drive', storm: 'the storm shielding', sensors: 'the sensors',
}

// --- Research (TC63) ---------------------------------------------------------------------------------------------------

export type Branch = 'ship' | 'rigs' | 'tactics' | 'quarters'
export const BRANCH_NAME: Record<Branch, string> = { ship: 'Ship', rigs: 'Rigs', tactics: 'Tactics', quarters: 'Quarters' }
export interface Project { id: string; name: string; branch: Branch; data: number; watches: number; needs: readonly string[]; does: string }

export const PROJECTS: readonly Project[] = [
  { id: 'reactor-1', name: 'Reactor I', branch: 'ship', data: 30, watches: 1, needs: [], does: '+1 reactor pip' },
  { id: 'reactor-2', name: 'Reactor II', branch: 'ship', data: 60, watches: 2, needs: ['reactor-1'], does: '+1 reactor pip' },
  { id: 'reactor-3', name: 'Reactor III', branch: 'ship', data: 90, watches: 3, needs: ['reactor-2'], does: '+1 reactor pip' },
  { id: 'hull-1', name: 'Hull I', branch: 'ship', data: 40, watches: 2, needs: [], does: 'A third deck' },
  { id: 'hull-2', name: 'Hull II', branch: 'ship', data: 80, watches: 3, needs: ['hull-1'], does: 'A fourth deck' },
  { id: 'hull-3', name: 'Hull III', branch: 'ship', data: 120, watches: 3, needs: ['hull-2'], does: 'Every deck widens to six slots' },
  { id: 'core-3', name: 'Core Refit', branch: 'ship', data: 60, watches: 2, needs: [], does: 'Level 3 for the Bridge, Hangar, Log and Engineering' },
  { id: 'rooms-3', name: 'Room Refit', branch: 'ship', data: 60, watches: 2, needs: [], does: 'Level 3 for the other rooms' },
  { id: 'shield-projector', name: 'Shield Projector', branch: 'rigs', data: 40, watches: 2, needs: [], does: 'Unlocks the Shield Projector (storm shielding)' },
  { id: 'drone-bay', name: 'Drone Bay', branch: 'rigs', data: 50, watches: 2, needs: [], does: 'Unlocks the Drone Bay' },
  { id: 'engines', name: 'Long-Range Engines', branch: 'rigs', data: 50, watches: 2, needs: [], does: 'Unlocks the Engines (farther worlds)' },
  { id: 'systems-3', name: 'Systems Refit', branch: 'rigs', data: 80, watches: 3, needs: [], does: 'Level 3 for the battle systems' },
  { id: 'tactics-1', name: 'Coordinated Fire', branch: 'tactics', data: 40, watches: 2, needs: [], does: 'A new Order for the captain (CY17)' },
  { id: 'tactics-2', name: 'Field Repairs', branch: 'tactics', data: 50, watches: 2, needs: ['tactics-1'], does: 'A new Order for the captain (CY17)' },
  { id: 'tactics-3', name: 'Ship Uplink', branch: 'tactics', data: 70, watches: 3, needs: ['tactics-2'], does: 'A new Order for the captain (CY17)' },
  { id: 'private-cabins', name: 'Private Cabins', branch: 'quarters', data: 50, watches: 2, needs: [], does: 'Quarters level 3: a cabin for everyone' },
  { id: 'medbay', name: 'Med Bay', branch: 'quarters', data: 30, watches: 1, needs: [], does: 'Unlocks the Med Bay' },
  { id: 'observation', name: 'Observation Deck', branch: 'quarters', data: 30, watches: 1, needs: [], does: 'Unlocks the Observation Deck' },
  { id: 'workshop', name: 'Workshop', branch: 'quarters', data: 40, watches: 2, needs: [], does: 'Unlocks the Workshop' },
  { id: 'garden', name: 'Garden', branch: 'quarters', data: 40, watches: 2, needs: ['observation'], does: 'Unlocks the Garden' },
  { id: 'guest-wing', name: 'Guest Wing', branch: 'quarters', data: 60, watches: 2, needs: [], does: 'Unlocks the Guest Wing' },
]
export const PROJECTS_BY_ID: ReadonlyMap<string, Project> = new Map(PROJECTS.map((p) => [p.id, p]))
