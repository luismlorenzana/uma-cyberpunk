// The battle's data (CY4): the map, the units and their rigs, the frozen input, the state, the actions and the cues. The
// rules read plain numbers only: names, art and master data stay in the app (a unit's `ref` and `label` are never read).

export type Band = 1 | 2 | 3 | 4 | 5
/** N is the back of the map (row 0), S faces the camera; x grows east, y grows south. */
export type Dir = 'N' | 'E' | 'S' | 'W'
export type Side = 'squad' | 'enemy'
export type Tile = readonly [x: number, y: number]
/** Pierce, impact, fire (TC19). A Coat halves one. */
export type DamageType = 'P' | 'I' | 'F'
export type WeaponBand = 'melee' | 'short' | 'long' | 'tech'
/** The four parts that take damage and break (TC17). */
export type PartId = 'core' | 'leftArm' | 'rightArm' | 'legs'
export const PARTS: readonly PartId[] = ['core', 'leftArm', 'rightArm', 'legs']
/** Where an attack comes from: a hand, or the Back unit's Launcher. */
export type Mount = 'left' | 'right' | 'back'
export type Facing = 'front' | 'side' | 'back'

// --- The map --------------------------------------------------------------------------------------------------------

/** A battle map (schema 1). Heights are digit rows like uma-stage's room format, so the board builds them as they are. */
export interface BattleMap {
  schemaVersion: 1
  id: string
  width: number
  depth: number
  /** One digit 0–3 a tile; row 0 is the back (north). */
  heights: readonly string[]
  /** One char a tile: "." floor, "#" solid (no standing, blocks sight), "=" grating, "c" cover (CY5 gives these two their
   * rules; until then they're floor). */
  tiles: readonly string[]
  /** Five squad tiles (four and a guest) and one to eight enemy tiles. */
  spawns: { squad: readonly Tile[]; enemy: readonly Tile[] }
}

// --- The rig --------------------------------------------------------------------------------------------------------

export interface Weapon {
  kind: 'weapon'
  band: Exclude<WeaponBand, 'tech'>
  type: DamageType
  /** Damage a hit before modifiers. */
  power: number
  /** Base hit %. */
  accuracy: number
  /** Manhattan range, inclusive: Melee [1, 1], Short within [1, 3], Long within [3, 6]. */
  range: readonly [min: number, max: number]
  /** Hits an attack: Melee and Long 1, Short several. */
  hits: number
  /** Crit % (TUNING.baseCrit when absent). */
  crit?: number
  /** Held in the right hand with the left hand empty. */
  twoHanded?: boolean
  load: number
}

export interface Shield {
  kind: 'shield'
  /** The share of a hit it cuts, from the front or side (tower 40, buckler 20). */
  guard: number
  load: number
}

export type HandItem = Weapon | Shield

/** The Back unit: the role's signature (TC5). CY4 plays the Launcher; the others' actions arrive in CY5. */
export type BackKind = 'none' | 'launcher' | 'bulwark' | 'thruster' | 'deck' | 'med'

export interface Loadout {
  core: { load: number; capacity?: number; hp?: number }
  leftArm: { load: number; hp?: number }
  rightArm: { load: number; hp?: number }
  legs: { load: number; hp?: number; move?: number }
  back: { kind: BackKind; load: number; capacity?: number; weapon?: Weapon; ammo?: number }
  /** `aim`: the Visor can pick a part at −25% hit (TC19). */
  visor: { load: number; aim?: boolean }
  leftHand: HandItem | null
  rightHand: HandItem | null
  coat: DamageType | null
}

export interface Bands {
  speed: Band
  stamina: Band
  power: Band
  guts: Band
  wit: Band
}

/** Who a unit is, for the app only: the rules never read it. Git holds stand-ins only. */
export interface UnitRef {
  kind: 'standin' | 'uma' | 'heroine' | 'hardware'
  id: string
}

export interface UnitInput {
  id: string
  side: Side
  bands: Bands
  /** Charge cap: 3, or 4 and 5 with licences (TC44). */
  chargeCap: number
  /** Joins allies' attacks (Crossfire) and covers them. */
  link: boolean
  leader?: boolean
  /** An index into the map's spawns for this side. */
  spawn: number
  facing: Dir
  loadout: Loadout
  ref?: UnitRef
  label?: string
}

export type Objective =
  | { kind: 'defeatAll' }
  | { kind: 'defeatLeader' }
  | { kind: 'reach'; tile: Tile }
  | { kind: 'hold'; rounds: number }

/** Everything a battle starts from, frozen: a battle is this plus its actions (BP4). */
export interface BattleInput {
  rulesVersion: number
  seed: string
  map: BattleMap
  objective: Objective
  units: readonly UnitInput[]
}

// --- The state ------------------------------------------------------------------------------------------------------

export type UnitStatus = 'active' | 'down' | 'out'

export interface PartHp {
  core: number
  leftArm: number
  rightArm: number
  legs: number
}

export interface UnitState {
  id: string
  side: Side
  x: number
  y: number
  facing: Dir
  hp: PartHp
  maxHp: PartHp
  charge: number
  /** Fills toward TUNING.clockFull. */
  clock: number
  link: boolean
  /** Down: Rig Break, kneeling, rebootable until the end of her next turn; then out. */
  status: UnitStatus
  holdOnUsed: boolean
  /** The Launcher's shots left. */
  ammo: number
  turns: number
}

export interface BattleResult {
  winner: Side
  reason: 'objective' | 'defeated'
}

export interface BattleState {
  input: BattleInput
  /** Ticks since the start. */
  time: number
  /** Turns taken in the whole battle: the seeded roll's key. */
  turn: number
  /** Whose turn it is, or null once the battle has ended. */
  active: string | null
  units: UnitState[]
  result: BattleResult | null
}

// --- Actions --------------------------------------------------------------------------------------------------------

export type Act =
  | { kind: 'attack'; with: Mount; target: string; aim?: PartId }
  | { kind: 'wait' }
  | { kind: 'none' }

/** A whole turn: the move (optional), one action, then the facing. The UI holds the two-tap move and its undo locally and
 * sends the turn whole, so an autosave after every action is exact (TC29). */
export interface TurnAction {
  kind: 'turn'
  unit: string
  to?: Tile
  act: Act
  face: Dir
}

/** The link toggle: a free action on her own turn. */
export interface LinkAction {
  kind: 'link'
  unit: string
  on: boolean
}

export type BattleAction = TurnAction | LinkAction

// --- Cues: what the board and the cut-in play; the scene decides nothing ----------------------------------------------

export type ChargeWhy = 'turn' | 'wait' | 'counter' | 'crossfire' | 'cover'
export type AttackRole = 'main' | 'crossfire' | 'counter'

export type Cue =
  | { kind: 'turnStarted'; unit: string; round: number }
  | { kind: 'charge'; unit: string; from: number; to: number; why: ChargeWhy }
  | { kind: 'moved'; unit: string; path: Tile[] }
  | { kind: 'faced'; unit: string; facing: Dir }
  | { kind: 'waited'; unit: string }
  | { kind: 'linked'; unit: string; on: boolean }
  | { kind: 'attack'; unit: string; target: string; with: Mount; band: Exclude<WeaponBand, 'tech'>; role: AttackRole; facing: Facing; aim?: PartId }
  | { kind: 'cover'; unit: string; for: string; attacker: string }
  | { kind: 'crossfire'; unit: string; target: string; how: 'pincer' | 'link' }
  | { kind: 'counter'; unit: string; target: string }
  | { kind: 'guard'; unit: string; cut: number }
  | { kind: 'hit'; unit: string; target: string; part: PartId; amount: number; crit: boolean; broke: boolean }
  | { kind: 'miss'; unit: string; target: string }
  | { kind: 'partBroke'; unit: string; part: PartId }
  | { kind: 'holdOn'; unit: string }
  | { kind: 'rigBreak'; unit: string }
  | { kind: 'extracted'; unit: string }
  | { kind: 'objective'; objective: Objective['kind']; value: number; of: number }
  | { kind: 'ended'; winner: Side; reason: BattleResult['reason'] }

export interface ActionResult {
  state: BattleState
  cues: Cue[]
  /** Set when the action was illegal: the state is unchanged and there are no cues. */
  error: string | null
}
