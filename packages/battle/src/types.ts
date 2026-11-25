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

/** A battle map. Schema 2 defines ten expedition spawns. Both schemas use digit rows for heights. */
export interface BattleMap {
  schemaVersion: 1 | 2
  id: string
  width: number
  depth: number
  /** One digit 0–3 a tile; row 0 is the back (north). */
  heights: readonly string[]
  /** One char a tile: "." floor, "#" solid (no standing, blocks sight), "=" grating, "c" cover (CY5 gives these two their
   * rules; until then they're floor). */
  tiles: readonly string[]
  /** Five squad tiles in schema 1 or ten in schema 2, and one to eight enemy tiles. */
  spawns: { squad: readonly Tile[]; enemy: readonly Tile[] }
  /** Things on the map (CY5, rules version 2). */
  props?: readonly Prop[]
  /** Tile states the battle starts with (CY8, rules version 2): Wet and Oil, lasting. */
  states?: { wet?: readonly Tile[]; oil?: readonly Tile[] }
}

/** What a terminal does when hacked (CY5). */
export type TerminalDoes = { door: string } | { lift: string } | { turret: string } | { lights: true }

/** Things on the map (CY5). Barrels, pipes and terminals take a tile no one stands on but shots pass over; a cable makes
 * its tile Live; a door's tiles are solid while it's shut; a lift's tiles sit at `low` or `high`. */
export type Prop =
  | { kind: 'barrel'; id: string; tile: Tile }
  | { kind: 'pipe'; id: string; tile: Tile }
  | { kind: 'cable'; id: string; tile: Tile }
  | { kind: 'terminal'; id: string; tile: Tile; does: TerminalDoes }
  | { kind: 'door'; id: string; tiles: readonly Tile[]; open: boolean }
  | { kind: 'lift'; id: string; tiles: readonly Tile[]; low: number; high: number; raised: boolean }

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
  /** In rules v4, a hit also damages enemy rigs adjacent to its target. */
  blast?: 1
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

/** The five roles (TC5), as the bench support call names them. */
export type Role = 'vanguard' | 'striker' | 'gunner' | 'netrunner' | 'medic'
/** Stride, from her running style (TC46). */
export type Stride = 'break' | 'draft' | 'surge' | 'kick'
/** A heroine's Hold (WD9, TC26). */
export type Hold = 'anchor' | 'collar' | 'none'
/** The five chance skills (TC22), each with its base %. */
export interface ChanceSkills { double?: number; switch?: number; burst?: number; first?: number; stun?: number }
export type ChanceSkill = keyof ChanceSkills
export type ItemKind = 'repair' | 'patch' | 'smoke' | 'cell'
export type Faction = 'steel-muster'

/** Who a unit is, for the app only: the rules never read it. Git holds stand-ins only. */
export interface UnitRef {
  kind: 'standin' | 'uma' | 'heroine' | 'hardware'
  id: string
}

export const COMBAT_SUBCLASSES = ['melee', 'heal', 'shield', 'long', 'support'] as const
export type CombatSubclass = typeof COMBAT_SUBCLASSES[number]
export type FireMode = 'thermal' | 'impact' | 'area' | 'suppress'
export type Specialty =
  | { kind: 'laser'; rank: number; subclass?: CombatSubclass }
  | { kind: 'wing' | 'shield' | 'sniper' | 'medic' | 'windup' }

export type HeroineSpriteRole = 'boss-enemy' | 'boss-ally' | 'sub-boss'

export interface HeroineSprite {
  role: HeroineSpriteRole
  form: string
  /** An authored scenario fitting for fixed opponents. Playable allies use their frozen rig. */
  fitting?: string
}

export interface Signature {
  id: string
  label: string
  mount: Mount
  charge: number
  power: number
}

export interface UnitInput {
  sprite?: HeroineSprite
  signature?: Signature
  specialty?: Specialty
  /** Optional frozen equipment identities for presentation. The reducer uses loadout. */
  frozenRig?: Record<'core' | 'leftArm' | 'rightArm' | 'legs' | 'visor', string>
    & Record<'leftHand' | 'rightHand' | 'back' | 'coat', string | null>
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
  // --- Rules version 2 (CY5) ---
  /** Chance skills with their base % (+5% a Wit band in play). */
  skills?: ChanceSkills
  stride?: Stride
  /** A heroine's Hold; an Anchor or a Collar is an extra part with `holdHp`. */
  hold?: Hold
  holdHp?: number
  /** Hardware that never moves: a turret. */
  fixed?: boolean
  faction?: Faction
  // --- Rules version 3 (CY17) ---
  /** Her bond with the captain: the rules read only the rank's perks (TC58). */
  bond?: { rank: number; path: 'trust' | 'heart' | null }
  /** Her partner in this battle and the pair's level (TC58). */
  partner?: { unit: string; level: 1 | 2 | 3 }
}

/** The captain's Orders (TC59) and the ship's support, one kind each. */
export type OrderKind = 'sure' | 'hold' | 'reboot' | 'resonance' | 'strike' | 'sweep' | 'barrier' | 'drone' | 'reinforce'
export type SystemKind = 'battery' | 'sensors' | 'shield' | 'drones' | 'engines'
/** A powered battle system: its level and its post holder's band (rules version 3; CY15 recorded bare ids, read as level 1). */
export interface SystemInput { id: SystemKind; level: number; band: Band }
export type MealKind = 'noodles' | 'stew' | 'skewers' | 'curry' | 'salad' | 'feast'

export type Objective =
  | { kind: 'defeatAll' }
  | { kind: 'defeatLeader' }
  | { kind: 'reach'; tile: Tile }
  | { kind: 'hold'; rounds: number }
  // Rules version 2 (CY5):
  | { kind: 'escort'; unit: string; tile: Tile }
  | { kind: 'hack'; count: number }
  | { kind: 'freeLeader'; collar?: 'rigBreak' }

/** A frozen encounter's named ally and enemy. Talk spends a turn and removes the enemy from the field. */
export interface TalkContact {
  actor: string
  target: string
  requires: 'active' | 'actorHit'
  hint: string
  /** The campaign's key for the settled outcome. */
  outcome: string
  /** A different campaign outcome if the target's rig breaks first. */
  brokenOutcome?: string
}

/** Everything a battle starts from, frozen: a battle is this plus its actions (BP4). */
export interface BattleInput {
  rulesVersion: number
  seed: string
  map: BattleMap
  objective: Objective
  /** A control point or terminal has to be reached even after the opposition is cleared. */
  goalRequired?: true
  preserve?: string
  units: readonly UnitInput[]
  // --- Rules version 2 (CY5) ---
  /** The squad's item stock, six at most. */
  items?: Partial<Record<ItemKind, number>>
  /** The resting Umas' roles, for one bench support call a battle. */
  bench?: readonly Role[]
  /** Factions whose mechanics are on. */
  factions?: readonly Faction[]
  // --- Rules version 3 (CY17); below version 3 they're ignored ---
  /** The ship's battle systems powered for this sortie (CY15 recorded bare ids). */
  systems?: readonly (string | SystemInput)[]
  /** The cook's meal for this battle (CY16). */
  meal?: string
  /** The captain's Orders this battle: how many, and which kinds. */
  orders?: { slots: number; kinds: readonly OrderKind[] }
  /** The deployed squad's cohesion (CY18): its level, its leader and its members' unit ids. */
  cohesion?: { level: number; leader: string; members: readonly string[] }
  /** A finale's harsh conditions for each unmet readiness need (CY18): fog, hull-breach hazards, no reinforcements. */
  conditions?: readonly ('fog' | 'hazards' | 'no-reinforcements')[]
  /** Rules version 5: which named ally can Talk to each target. */
  talk?: readonly TalkContact[]
}

// --- The state ------------------------------------------------------------------------------------------------------

/** Down: Rig Break, kneeling. Out: extracted. Freed: released and removed from the field. */
export type UnitStatus = 'active' | 'down' | 'out' | 'freed'

export interface PartHp {
  core: number
  leftArm: number
  rightArm: number
  legs: number
}

export interface UnitState {
  patched?: true
  suppressed?: true
  windupUsed?: true
  windup?: { target: string; with: Mount }
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
  signatureUsed?: true
  signatureMark?: { target: string; tile: Tile; targetTurn: number }
  // --- Rules version 2 (CY5): present only once they apply, so a version-1 state is CY4's exactly ---
  /** An Anchor's or Collar's HP. */
  holdHp?: number
  /** Loses her next turn. */
  stunned?: boolean
  /** A Steel Muster unit that fired can't counter until her next turn. */
  reloading?: boolean
  /** Pinned by Muster fire on an arm: −10% hit until her next turn. */
  pinned?: boolean
  /** Her last turn was a Wait (for Surge). */
  waited?: boolean
  /** Rules version 5: the authored Talk actor has landed a hit on this target. */
  talkHit?: true
  /** Rules version 5: the resolved, encounter-authored Talk outcome. */
  talked?: string
  /** Rules version 5: how this unit was actually released from a Hold. */
  freedBy?: FreeMethod
}

export type TileStateKind = 'wet' | 'oil' | 'fire' | 'smoke'
export interface TileState {
  kind: TileStateKind
  /** The time it ends, or 0 for lasting. */
  until: number
}

export interface Barrier { id: string; x: number; y: number; hp: number }

/** Rules version 2's board state (CY5). */
export interface FieldState {
  /** By tile key "x,y". Live is worked out from cables, Wet and grating, never stored. */
  states: Record<string, TileState>
  doors: Record<string, boolean>
  lifts: Record<string, boolean>
  /** Barrels and pipes already burst. */
  burst: string[]
  barriers: Barrier[]
  nextBarrier: number
  lightsOutUntil: number
  /** Terminals hacked at least once. */
  hacked: string[]
  /** The Steel Muster's volley: the meter, and once full, the marked tiles and when they're hit. */
  volley: { meter: number; marked: Tile[]; at: number }
  items: Record<ItemKind, number>
  benchUsed: boolean
}

export type Fate = 'freed' | 'broken' | 'standing'
export type FreeMethod = 'hold' | 'jackout' | 'rigBreak'
export interface EnemyOutcome { id: string; fate: Fate; salvage: PartId[]; talk?: string; home?: string; freedBy?: FreeMethod }

export interface BattleResult {
  winner: Side
  reason: 'objective' | 'defeated'
  /** Rules version 2: each enemy freed, broken or standing, with her salvage (her unbroken parts). */
  enemies?: EnemyOutcome[]
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
  /** Rules version 2 only. */
  field?: FieldState
  /** Rules version 3 only. */
  v3?: V3State
}

/** Rules version 3's battle state (CY17): Orders spent, the once-a-battle perks used, the marked strike, the sure shot,
 * Resonance and the partners' free joins and covers. */
export interface V3State {
  orders: number
  resonance: boolean
  resonating: string | null
  sure: string | null
  strike: { tiles: Tile[]; at: number; damage: number } | null
  sweep: boolean
  endured: string[]
  steadfast: string[]
  joined: string[]
  covered: string[]
  /** Partners whose next turn a duo technique used up. */
  spent: string[]
  /** The Shield Projector's shield on each squad unit: damage it still absorbs. */
  shields: Record<string, number>
  /** Members who took cohesion level 5's free Cover. */
  cohered: string[]
}

// --- Actions --------------------------------------------------------------------------------------------------------

/** Where an aimed hit goes: a part, or a heroine's Hold. */
export type AimAt = PartId | 'hold'
export type TechKind = 'stun' | 'jam' | 'jackout'

export type Act =
  | { kind: 'attack'; with: Mount; target: string; aim?: AimAt; signature?: true; mode?: FireMode }
  | { kind: 'prepare'; with: Mount; target: string }
  | { kind: 'wait' }
  | { kind: 'none' }
  // Rules version 2 (CY5):
  | { kind: 'tech'; tech: TechKind; target: string }
  | { kind: 'hack'; terminal: string }
  | { kind: 'barrier'; at: Tile }
  | { kind: 'mend'; target: string; part: PartId }
  | { kind: 'reboot'; target: string }
  | { kind: 'item'; item: ItemKind; target?: string; part?: PartId; at?: Tile }
  // Rules version 5 (CY74):
  | { kind: 'talk'; target: string }

/** A whole turn: the move (optional), one action, then the facing. The UI holds the two-tap move and its undo locally and
 * sends the turn whole, so an autosave after every action is exact (TC29). */
export interface TurnAction {
  kind: 'turn'
  unit: string
  to?: Tile
  /** A Thruster's Dash (1 Charge): +2 Move and no zones of control this turn (rules version 2). */
  dash?: boolean
  act: Act
  face: Dir
}

/** The link toggle: a free action on her own turn. */
export interface LinkAction {
  kind: 'link'
  unit: string
  on: boolean
}

/** The bench support call (TC27): once a battle, a free action on a squad unit's turn (rules version 2). */
export interface BenchAction {
  kind: 'bench'
  unit: string
  role: Role
  at: Tile
}

/** An Order (TC59, rules version 3): a free action on a squad unit's turn, from the battle's slots. */
export interface OrderAction {
  kind: 'order'
  unit: string
  order: OrderKind
  target?: string
  at?: Tile
  /** For a reinforcement: the resting Uma's role. */
  role?: Role
}

/** A duo technique (TC58, rules version 3): partners at level 3 both strike; it takes this turn and the partner's next. */
export interface DuoAction {
  kind: 'duo'
  unit: string
  target: string
}

export type BattleAction = TurnAction | LinkAction | BenchAction | OrderAction | DuoAction
  | { kind: 'quickPatch'; unit: string; target: string }

// --- Cues: what the board and the cut-in play; the scene decides nothing ----------------------------------------------

export type ChargeWhy = 'turn' | 'wait' | 'counter' | 'crossfire' | 'cover' | 'tech' | 'hack' | 'barrier' | 'dash' | 'mend' | 'reboot' | 'item' | 'jam' | 'ready' | 'answer' | 'meal' | 'resonance' | 'duo' | 'signature' | 'mode' | 'patch'
export type AttackRole = 'main' | 'crossfire' | 'counter'

export type Cue =
  | { kind: 'turnStarted'; unit: string; round: number }
  | { kind: 'charge'; unit: string; from: number; to: number; why: ChargeWhy }
  | { kind: 'moved'; unit: string; path: Tile[] }
  | { kind: 'faced'; unit: string; facing: Dir }
  | { kind: 'waited'; unit: string }
  | { kind: 'linked'; unit: string; on: boolean }
  | { kind: 'attack'; unit: string; target: string; with: Mount; band: Exclude<WeaponBand, 'tech'>; role: AttackRole; facing: Facing; aim?: PartId; mode?: FireMode; signature?: { id: string; label: string } }
  | { kind: 'signatureWarning'; unit: string; tile: Tile; label: string }
  | { kind: 'signatureCanceled'; unit: string }
  | { kind: 'prepared'; unit: string; target: string }
  | { kind: 'suppressed'; unit: string; target: string; interrupted: boolean }
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
  // Rules version 2 (CY5):
  | { kind: 'terrain'; tiles: Tile[]; state: TileStateKind | null }
  | { kind: 'burn'; unit: string; part: PartId; amount: number; by: 'fire' | 'live' | 'volley' | 'strike' | 'mortar'; broke: boolean }
  | { kind: 'burst'; prop: string }
  | { kind: 'hacked'; unit: string; terminal: string }
  | { kind: 'door'; door: string; open: boolean; tiles: Tile[] }
  | { kind: 'heights'; lift: string; tiles: Tile[]; height: number }
  | { kind: 'turned'; unit: string; side: Side }
  | { kind: 'lights'; out: boolean }
  | { kind: 'tech'; unit: string; target: string; tech: TechKind; landed: boolean }
  | { kind: 'stunned'; unit: string }
  | { kind: 'skipped'; unit: string; why: 'stunned' | 'idle' | 'duo' }
  | { kind: 'holdHit'; unit: string; target: string; amount: number; broke: boolean }
  | { kind: 'freed'; unit: string; by: FreeMethod }
  | { kind: 'barrier'; unit: string; id: string; at: Tile }
  | { kind: 'barrierHit'; unit: string; id: string; amount: number; broke: boolean }
  | { kind: 'dash'; unit: string }
  | { kind: 'mended'; unit: string; target: string; part: PartId; hp: number }
  | { kind: 'rebooted'; unit: string; target: string }
  | { kind: 'item'; unit: string; item: ItemKind; target?: string; at?: Tile }
  | { kind: 'skill'; unit: string; skill: ChanceSkill }
  | { kind: 'bench'; unit: string; role: Role; at: Tile }
  | { kind: 'scan'; unit: string }
  | { kind: 'reload'; unit: string }
  | { kind: 'pinned'; unit: string }
  | { kind: 'volleySignal'; tiles: Tile[]; at: number }
  | { kind: 'volley'; tiles: Tile[] }
  // Rules version 3 (CY17):
  | { kind: 'order'; unit: string; order: OrderKind; target?: string; at?: Tile }
  | { kind: 'resonance'; unit: string; path: 'trust' | 'heart' | null }
  | { kind: 'strikeMarked'; tiles: Tile[]; at: number }
  | { kind: 'endure'; unit: string }
  | { kind: 'freeJoin'; unit: string; why: 'partner' | 'resonance' }
  | { kind: 'freeCover'; unit: string; why: 'steadfast' | 'partner' | 'cohesion' }
  | { kind: 'duo'; unit: string; partner: string; target: string; tech: string }
  | { kind: 'sweep'; unit: string }
  | { kind: 'drone'; unit: string; target: string; part: PartId; hp: number }
  | { kind: 'shielded'; unit: string; absorbed: number; left: number }
  // Rules version 5 (CY74):
  | { kind: 'talked'; unit: string; target: string; outcome: string }

export interface ActionResult {
  state: BattleState
  cues: Cue[]
  /** Set when the action was illegal: the state is unchanged and there are no cues. */
  error: string | null
}
