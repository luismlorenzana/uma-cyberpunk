import type { CommandCinemaState } from '../ship/command-cinema'
// uma-cyberpunk's save (CY3, TC11): local first in Dexie, synced through `cyber-api`. Nothing carries over from any
// other game (P4, TC14). Copied from uma-quest's at cc42fd1 (its Q14, D11), itself from uma-rpg's at 30a322a (its D32,
// D45, D260), cut to one account. Every change to the shape is a new version with its migration and tests: `parseSave`
// takes any version this game ever wrote and returns the current one, and never moves `account.updatedAt`.

import { MANAGEMENT_EVENTS, type CampaignManagementState, type ManagementReceipt } from '../campaign-management'
import { EXPEDITION_RULES_VERSION, EXPEDITION_SQUAD_SIZE, type BattleInput, type Role } from '@cyber/battle'
import { CAPTAIN_NAME_MAX, DEFAULT_CAPTAIN, PRONOUNS, ROMANCE, type Captain, type Pronouns, type Romance } from '../captain'
import { BOND_MAX, BOND_PATHS, BOND_TUNING, newBond, type Bond, type BondPath } from '../crew/bonds'
import { emptyCabin, ITEMS_BY_ID, LINE_SLOTS, placeable, SLOTS, STARTER_STOCK, TOPICS, type Cabin, type Reveal, type Slot } from '../cabins/items'
import type { Stock, Visits } from '../cabins/cabins'
import { MAX_PRESETS, newMember, PRESET_NAME_MAX, ROLES, STRAIN_REST, type CrewMember } from '../crew/crew'
import { PARTS_BY_ID, RIG_SLOTS, SLOT_KIND, type Rig } from '../crew/parts'
import { MEALS, MODULE_POSTS, POST_KINDS, type HeldPost, type Meal, type Post, type PostKind } from '../ship/duties'
import type { Partnership } from '../crew/partners'
import { firstSquad, type OperationRun, type Outcome, type Squad } from '../crew/squads'
import { HULL_TUNING, shipWith, type PlacedModule, type Ship, type Wallet } from '../ship/hull'
import type { ShipLog } from '../ship/watch'
import { MODULE_IDS, MODULES_BY_ID, PROJECTS_BY_ID, SYSTEM_IDS, type ModuleId, type SystemId } from '../ship/modules'
import { OPEN_FROM_START, ROOM_IDS, type RoomId } from '../ship/rooms'
import type { ExpeditionMember } from '../story/four-act'
import { emptyStory, type StoryState } from '../story/state'
import { firstCampaignDay, type CampaignDay, type SoloNight } from '../campaign-day'
import { parseCabinNight } from '../story/campaign-cabins'
import type { PendingPairScene } from '../campaign-pair'
import { CAMPAIGN_WORKSHOP_ALLOY_MAX, emptyCampaignGear, type CampaignGear } from '../campaign-gear'
import { PORT_STOCK_MAX, SHIP_CARGO_MAX, SUPPLY_KINDS, type CampaignSupply } from '../campaign-supply'
import { COMMAND_STATIONS, MAX_DRILLS, type CommandCrew, type CommandStation, type CommandTraining } from '../ship/command'

/** The save's version now: 2 adds the story state (CY9); 3 the crew, the ship, the worlds and the mission (CY10); 4 each
 * crew member's record (CY11); 5 the captain, the watch, the inbox and each Uma's bond (CY13); 6 each Uma's cabin, the
 * item stock and the visits (CY14); 7 the ship as a build and the wallet (CY15); 8 duties: posts, presets, the meal,
 * camaraderie, the ship log and a jump's pending event (CY16); 9 partners (CY17); 10 squads, operations and faction
 * standing (CY18); 11 the campaign day and pending scenes (CY21); 12 the supply ledger (CY23); 13 command officers (CY24);
 * 14 saved pair scenes (CY26); 15 the campaign workshop (CY30); 16 port projects and officer specialties (CY32–CY33);
 * 17 reserved cabin evenings, committed choices, frozen morning plans and per-companion rotation (CY48);
 * 18 management receipts and independent first-use/report acknowledgements (CY51);
 * 19 saved command cinematic position and fast-playback preference (CY54); 20 the active expedition (CY87). */
export const SAVE_VERSION = 20

export interface Account {
  /** The Firebase uid the save belongs to. */
  uid: string
  createdAt: string
  /** When the save last changed on a device: the conflict rule's clock. Only the player's own change moves it; no server
   * and no hand edit ever does (the production-save rules). */
  updatedAt: string
}

export interface SaveV1 {
  version: 1
  account: Account
}

/** v2 (CY9): the story's flags, Leads, Log Files, Anomalies and scenes seen. */
export interface SaveV2 {
  version: 2
  account: Account
  story: StoryState
}

export type MissionStep = 'briefing' | 'deploy' | 'battle' | 'results' | 'aboard'
export const MISSION_STEPS: readonly MissionStep[] = ['briefing', 'deploy', 'battle', 'results', 'aboard']

/** The mission in progress (CY10): where it stands, the squad, and its battle as CY8's input plus actions. The battle's
 * shape is the battle package's; the save checks it as JSON, and resume replays it. */
export interface MissionState {
  id: string
  chapter: string
  step: MissionStep
  squad: number[]
  callUp?: { members: number[]; stations?: Partial<Record<CommandStation, number | null>> }
  battle: { input: unknown; actions: unknown[] } | null
  /** At results: won or lost. */
  won: boolean | null
}

/** v3 (CY10): the crew aboard, the ship's open rooms, the worlds and the mission in progress. */
export interface SaveV3 {
  version: 3
  account: Account
  /** Outfit ids aboard, in join order (CY11 adds levels and loadouts). */
  crew: number[]
  ship: { rooms: RoomId[] }
  worlds: { current: string | null; known: Record<string, { cleared: string[] }>; missions: string[] }
  story: StoryState
  mission: MissionState | null
}

/** A crew record as v4 kept it: before the bond and the cabin. */
export type CrewMemberV4 = Omit<CrewMember, 'bond' | 'cabin'>
/** A crew record as v5 kept it: before the cabin. */
export type CrewMemberV5 = Omit<CrewMember, 'cabin' | 'post'>
/** A crew record as v6 and v7 kept it: before the post. */
export type CrewMemberV6 = Omit<CrewMember, 'post'>

/** v4 (CY11): each crew member's record (XP, role, rig, saved loadouts, Strain) in place of her bare outfit id. */
export interface SaveV4 extends Omit<SaveV3, 'version' | 'crew'> {
  version: 4
  /** In join order. */
  crew: CrewMemberV4[]
}

/** v5 (CY13): the captain, the watch, the inbox and each Uma's bond. */
export interface SaveV5 extends Omit<SaveV4, 'version' | 'crew'> {
  version: 5
  captain: Captain
  /** Watches passed: +1 when a mission's results close and +1 on a jump; every life-aboard budget counts by it. */
  watch: number
  /** Umas whose message after the last battle hasn't had a reply. */
  inbox: number[]
  crew: CrewMemberV5[]
}

/** v6 (CY14): each Uma's cabin, the items owned and how many, and the visits used this watch. */
export interface SaveV6 extends Omit<SaveV5, 'version' | 'crew'> {
  version: 6
  crew: CrewMemberV6[]
  items: Stock
  visits: Visits
}

/** v7 (CY15): the ship as a build (decks, modules, levels, builds, unlocks, power, research) and the wallet. */
export interface SaveV7 extends Omit<SaveV6, 'version' | 'ship'> {
  version: 7
  ship: Ship
  wallet: Wallet
}

/** A duty preset (CY16): a name and who holds which post. */
export interface DutyPreset { name: string; posts: Record<string, Post> }
/** A jump's event waiting for the player (CY16): its id in the generic pool or a region's. */
export interface PendingEvent { id: string; region: string | null }

/** v8 (CY16): each Uma's post, two duty presets, the cook's meal for the next battle, camaraderie between Umas posted
 * together, the last ship-log card, and a jump's event waiting to be answered. */
export interface SaveV8 extends Omit<SaveV7, 'version' | 'crew'> {
  version: 8
  crew: CrewMember[]
  dutyPresets: DutyPreset[]
  meal: Meal | null
  camaraderie: Record<string, number>
  log: ShipLog | null
  event: PendingEvent | null
}

/** v9 (CY17): partners, one each, with their level. */
export interface SaveV9 extends Omit<SaveV8, 'version'> {
  version: 9
  partners: Partnership[]
}

/** v10 (CY18): squads with their cohesion, operations under way, and each faction's standing once it has moved. */
export interface SaveV10 extends Omit<SaveV9, 'version'> {
  version: 10
  squads: Squad[]
  operations: OperationRun[]
  /** Operations won in full (each once): readiness counts them, and a story operation isn't offered again. */
  operationsWon: string[]
  standing: Record<string, number>
}

export interface SaveV11 extends Omit<SaveV10, 'version'> {
  version: 11
  campaignDay: CampaignDay<SoloNight>
}

export interface SaveV12 extends Omit<SaveV11, 'version'> {
  version: 12
  campaignSupply: CampaignSupply | null
}

export interface SaveV13 extends Omit<SaveV12, 'version'> {
  version: 13
  commandCrew: CommandCrew
}

export interface SaveV14 extends Omit<SaveV13, 'version' | 'campaignDay'> {
  version: 14
  campaignDay: CampaignDay
  pairScene: PendingPairScene | null
}

export interface SaveV15 extends Omit<SaveV14, 'version'> {
  version: 15
  campaignGear: CampaignGear
}

/** The save as the app and the API use it: always the current version. */
export interface SaveV16 extends Omit<SaveV15, 'version'> {
  version: 16
  campaignProjects: Record<string, number>
  commandTraining: CommandTraining
}

export interface SaveV17 extends Omit<SaveV16, 'version'> {
  version: 17
  cabinVisits: Record<string, number>
}

export interface SaveV18 extends Omit<SaveV17, 'version'> {
  version: 18
  management: CampaignManagementState
}

export interface SaveV19 extends Omit<SaveV18, 'version'> {
  version: 19
  commandCinema: CommandCinemaState
}

export interface ExpeditionRun {
  duo: string
  ship: string
  members: readonly ExpeditionMember[]
  fuel: number
  provisions: number
}

export interface SaveV20 extends Omit<SaveV19, 'version'> {
  version: 20
  expedition: ExpeditionRun | null
}

export type Save = SaveV20

/** What the API stores and returns: the save and its revision (0: nothing stored yet). */
export interface SaveEnvelope {
  revision: number
  save: Save | null
}

/** A save upload: the revision it was based on, the save, and the version the client sent before any migration. */
export interface SavePut {
  baseRevision: number
  save: Save
  /** The API refuses a version older than what it stores (uma-rpg D45). */
  sentVersion: number
}

export class SaveParseError extends Error {
  readonly path: string
  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'SaveParseError'
    this.path = path
  }
}

/** A new account's save. */
export function newSave(uid: string, now: string): Save {
  const v2: SaveV2 = { version: 2, account: { uid, createdAt: now, updatedAt: now }, story: emptyStory() }
  const v10 = migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3(migrateV2(v2))))))))
  return { ...migrateV18(migrateV17(migrateV16(migrateV15(migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(v10))))))))), version: 20, expedition: null }
}

export const migrateV18 = (save: SaveV18): SaveV19 => ({ ...save, version: 19, commandCinema: { fast: false, retries: 0, pending: null } })

export const migrateV17 = (save: SaveV17): SaveV18 => ({ ...save, version: 18, management: { sequence: 0, receipts: [], acknowledged: [] } })

export const migrateV16 = (save: SaveV16): SaveV17 => ({ ...save, version: 17, cabinVisits: {} })

export function migrateV15(save: SaveV15): SaveV16 {
  const commandTraining: CommandTraining = {}
  for (const station of COMMAND_STATIONS) {
    const entry = save.commandCrew[station]
    if (entry) commandTraining[entry.outfit] = { [station]: { drills: entry.drills, trainedDay: entry.trainedDay } }
  }
  return { ...save, version: 16, campaignProjects: {}, commandTraining }
}

export const migrateV14 = (save: SaveV14): SaveV15 => ({ ...save, version: 15, campaignGear: emptyCampaignGear() })
export const migrateV13 = (save: SaveV13): SaveV14 => ({ ...save, version: 14, pairScene: null })
export const migrateV12 = (save: SaveV12): SaveV13 => ({ ...save, version: 13, commandCrew: {} })
export const migrateV11 = (save: SaveV11): SaveV12 => ({ ...save, version: 12, campaignSupply: null })

export function migrateV10(save: SaveV10): SaveV11 {
  return { ...save, version: 11, account: { ...save.account }, campaignDay: firstCampaignDay() }
}

/** v9 to v10: one squad of the crew aboard (up to four), no operations, every standing at the story's start (none stored
 * until it moves); the rest as it was (`updatedAt` untouched). Pure; runs on the device. */
export function migrateV9(save: SaveV9): SaveV10 {
  return { ...save, version: 10, account: { ...save.account }, squads: firstSquad(save.crew.map((m) => m.outfit)), operations: [], operationsWon: [], standing: {} }
}

/** v8 to v9: no partners yet; the rest as it was (`updatedAt` untouched). Pure; runs on the device. */
export function migrateV8(save: SaveV8): SaveV9 {
  return { ...save, version: 9, account: { ...save.account }, partners: [] }
}

/** v7 to v8: no posts held, no presets, no meal, no camaraderie, no ship log, no event; the rest as it was (`updatedAt`
 * untouched). Pure; runs on the device. */
export function migrateV7(save: SaveV7): SaveV8 {
  return { ...save, version: 8, account: { ...save.account }, crew: save.crew.map((m) => ({ ...m, post: null })), dutyPresets: [], meal: null, camaraderie: {}, log: null, event: null }
}

/** v6 to v7: the open rooms and Engineering placed on two decks of five in a fixed order at level 1, the starter wallet,
 * nothing powered or researched; the rest as it was (`updatedAt` untouched). Pure; runs on the device. */
export function migrateV6(save: SaveV6): SaveV7 {
  return { ...save, version: 7, account: { ...save.account }, ship: shipWith([...save.ship.rooms, 'engineering']), wallet: { ...HULL_TUNING.starterWallet } }
}

/** v5 to v6: every cabin empty with nothing revealed, the starter kit in the stock, no visits used this watch; the rest as
 * it was (`updatedAt` untouched). Pure; runs on the device. */
export function migrateV5(save: SaveV5): SaveV6 {
  return { ...save, version: 6, account: { ...save.account }, crew: save.crew.map((m) => ({ ...m, cabin: emptyCabin() })), items: { ...STARTER_STOCK }, visits: { watch: save.watch, used: 0 } }
}

/** v4 to v5: a default captain the player names on next opening, watch 0, an empty inbox, every Uma at bond rank 1; the
 * rest as it was (`updatedAt` untouched). Pure; runs on the device. */
export function migrateV4(save: SaveV4): SaveV5 {
  return { ...save, version: 5, account: { ...save.account }, captain: { ...DEFAULT_CAPTAIN }, watch: 0, inbox: [], crew: save.crew.map((m) => ({ ...m, bond: newBond() })) }
}

/** v3 to v4: each outfit id aboard becomes her record with no XP, her default role, "best for her role", no saved
 * loadouts and no Strain; the rest as it was (`updatedAt` untouched). Pure; runs on the device. */
export function migrateV3(save: SaveV3): SaveV4 {
  return { ...save, version: 4, account: { ...save.account }, crew: save.crew.map((o) => { const { bond: _bond, cabin: _cabin, ...m } = newMember(o); return m }) }
}

/** v2 to v3: the account and story as they were (`updatedAt` untouched); the crew, worlds and mission empty, the rooms
 * open from the start open. Pure; runs on the device. */
export function migrateV2(save: SaveV2): SaveV3 {
  return {
    version: 3, account: { ...save.account }, crew: [], ship: { rooms: [...OPEN_FROM_START] },
    worlds: { current: null, known: {}, missions: [] }, story: save.story, mission: null,
  }
}

/** v1 to v2: the account as it was (its `updatedAt` untouched), and an empty story. Pure; runs on the device. */
export function migrateV1(save: SaveV1): SaveV2 {
  return { version: 2, account: { ...save.account }, story: emptyStory() }
}

/** The save after the player's own change at `now`: the only thing that moves `updatedAt`. */
export function touched(save: Save, now: string): Save {
  return { ...save, account: { ...save.account, updatedAt: now } }
}

/** The conflict rule (uma-rpg D32): when two devices both changed the save, the one changed last wins whole, and a tie
 * keeps this device's. The loser is kept, never dropped: a safety copy on the device, or `saveRescues` on the server. */
export function resolveConflict(local: Save, remote: Save): Save {
  return Date.parse(local.account.updatedAt) >= Date.parse(remote.account.updatedAt) ? local : remote
}

// --- Parsing: explicit, path-reporting, strict on unknown keys so an older client can't half-write a newer save -------

type Obj = Record<string, unknown>

function object(value: unknown, path: string, keys: readonly string[]): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SaveParseError(path, 'expected an object')
  const extra = Object.keys(value).filter((k) => !keys.includes(k))
  if (extra.length > 0) throw new SaveParseError(path, `unknown keys ${extra.join(', ')}`)
  return value as Obj
}

function count(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new SaveParseError(path, 'expected a non-negative integer')
  return value
}

function bounded(value: unknown, field: string, max: number): number {
  const n = count(value, field)
  if (n > max) throw new SaveParseError(field, `expected at most ${max}`)
  return n
}

function timestamp(value: unknown, path: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new SaveParseError(path, 'expected an ISO timestamp')
  return value
}

function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) throw new SaveParseError(path, 'expected a non-empty string')
  return value
}

const slugs = (value: unknown, path: string): string[] => {
  if (!Array.isArray(value) || value.length > 5000) throw new SaveParseError(path, 'expected a list')
  return value.map((v, i) => id(v, `${path}[${i}]`))
}

function parseStory(value: unknown, path: string): StoryState {
  const o = object(value, path, ['flags', 'leads', 'files', 'anomalies', 'seen'])
  const files = object(o.files, `${path}.files`, Object.keys((o.files ?? {}) as Obj))
  const anomalies = object(o.anomalies, `${path}.anomalies`, Object.keys((o.anomalies ?? {}) as Obj))
  return {
    flags: slugs(o.flags, `${path}.flags`), leads: slugs(o.leads, `${path}.leads`), seen: slugs(o.seen, `${path}.seen`),
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => {
      if (!Array.isArray(v) || v.length > 100) throw new SaveParseError(`${path}.files.${k}`, 'expected a list of lines')
      return [id(k, `${path}.files`), v.map((n, i) => count(n, `${path}.files.${k}[${i}]`))]
    })),
    anomalies: Object.fromEntries(Object.entries(anomalies).map(([k, v]) => {
      if (typeof v !== 'boolean') throw new SaveParseError(`${path}.anomalies.${k}`, 'expected true or false')
      return [id(k, `${path}.anomalies`), v]
    })),
  }
}

function outfits(value: unknown, path: string): number[] {
  if (!Array.isArray(value) || value.length > 300) throw new SaveParseError(path, 'expected a list of outfit ids')
  return value.map((v, i) => { if (!Number.isSafeInteger(v) || (v as number) < 1) throw new SaveParseError(`${path}[${i}]`, 'expected an outfit id'); return v as number })
}

function parseRig(value: unknown, path: string): Rig {
  const o = object(value, path, RIG_SLOTS)
  const rig = {} as Record<string, string | null>
  for (const slot of RIG_SLOTS) {
    const v = o[slot]
    const optional = slot === 'back' || slot === 'leftHand' || slot === 'rightHand' || slot === 'coat'
    if (v === null && optional) { rig[slot] = null; continue }
    const part = PARTS_BY_ID.get(id(v, `${path}.${slot}`))
    if (!part || part.slot !== SLOT_KIND[slot]) throw new SaveParseError(`${path}.${slot}`, `expected a ${SLOT_KIND[slot]} part`)
    rig[slot] = part.id
  }
  // D73 changes the catalog rifle's grip, not the save shape. Stow incompatible issued gear;
  // owned inventory is separate. Frozen mission inputs below never pass through this adapter.
  if (rig.rightHand === 'hand-rifle') rig.leftHand = null
  else if (rig.leftHand === 'hand-rifle') {
    if (rig.rightHand === null) rig.rightHand = 'hand-rifle'
    rig.leftHand = null
  }
  return rig as unknown as Rig
}

function parseBond(value: unknown, path: string): Bond {
  const o = object(value, path, ['rank', 'rapport', 'path', 'seen'])
  const rank = count(o.rank, `${path}.rank`)
  if (rank < 1 || rank > BOND_MAX) throw new SaveParseError(`${path}.rank`, `expected 1–${BOND_MAX}`)
  if (o.path !== null && !BOND_PATHS.includes(o.path as BondPath)) throw new SaveParseError(`${path}.path`, 'expected trust, heart or null')
  if (!Array.isArray(o.seen) || o.seen.length > 10) throw new SaveParseError(`${path}.seen`, 'expected a list of ranks')
  const seen = o.seen.map((r, i) => { const n = count(r, `${path}.seen[${i}]`); if (!(BOND_TUNING.sceneRanks as readonly number[]).includes(n)) throw new SaveParseError(`${path}.seen[${i}]`, 'expected a scene rank'); return n })
  return { rank, rapport: count(o.rapport, `${path}.rapport`), path: o.path as BondPath | null, seen }
}

function parseCaptain(value: unknown, path: string): Captain {
  const o = object(value, path, ['name', 'pronouns', 'romance', 'named'])
  const name = id(o.name, `${path}.name`)
  if (name.length > CAPTAIN_NAME_MAX) throw new SaveParseError(`${path}.name`, `expected ${CAPTAIN_NAME_MAX} characters at most`)
  if (!PRONOUNS.includes(o.pronouns as Pronouns)) throw new SaveParseError(`${path}.pronouns`, 'expected they, she or he')
  if (!ROMANCE.includes(o.romance as Romance)) throw new SaveParseError(`${path}.romance`, 'expected ask or friends')
  if (typeof o.named !== 'boolean') throw new SaveParseError(`${path}.named`, 'expected true or false')
  return { name, pronouns: o.pronouns as Pronouns, romance: o.romance as Romance, named: o.named }
}

function parseShip(value: unknown, path: string): Ship {
  const o = object(value, path, ['decks', 'width', 'modules', 'unlocked', 'powered', 'research'])
  const decks = count(o.decks, `${path}.decks`)
  if (decks < 1 || decks > HULL_TUNING.maxDecks) throw new SaveParseError(`${path}.decks`, `expected 1–${HULL_TUNING.maxDecks}`)
  const width = count(o.width, `${path}.width`)
  if (width !== HULL_TUNING.width && width !== HULL_TUNING.wideWidth) throw new SaveParseError(`${path}.width`, `expected ${HULL_TUNING.width} or ${HULL_TUNING.wideWidth}`)
  const known = (v: unknown, p: string) => { const x = id(v, p); if (!MODULE_IDS.includes(x as ModuleId)) throw new SaveParseError(p, 'expected a module'); return x as ModuleId }
  if (!Array.isArray(o.modules) || o.modules.length > 60) throw new SaveParseError(`${path}.modules`, 'expected a list')
  const taken = new Set<string>(), ids = new Set<string>()
  const modules = o.modules.map((v, i): PlacedModule => {
    const p = `${path}.modules[${i}]`
    const m = object(v, p, ['id', 'deck', 'slot', 'level', 'building'])
    const mid = known(m.id, `${p}.id`)
    if (ids.has(mid)) throw new SaveParseError(`${p}.id`, 'already aboard')
    ids.add(mid)
    const deck = count(m.deck, `${p}.deck`), slot = count(m.slot, `${p}.slot`), level = count(m.level, `${p}.level`)
    const w = MODULES_BY_ID.get(mid)!.width
    if (deck >= decks || slot + w > width) throw new SaveParseError(`${p}`, 'outside the hull')
    for (let k = 0; k < w; k++) { const key = `${deck}:${slot + k}`; if (taken.has(key)) throw new SaveParseError(p, 'overlaps another module'); taken.add(key) }
    if (level > 3) throw new SaveParseError(`${p}.level`, 'expected 0–3')
    let building: PlacedModule['building'] = null
    if (m.building !== null) {
      const b = object(m.building, `${p}.building`, ['level', 'left'])
      building = { level: count(b.level, `${p}.building.level`), left: count(b.left, `${p}.building.left`) }
      if (building.level !== level + 1 || building.left < 1 || building.left > 3) throw new SaveParseError(`${p}.building`, 'expected the next level and 1–3 watches')
    } else if (level === 0) throw new SaveParseError(`${p}.level`, 'level 0 only while building')
    return { id: mid, deck, slot, level, building }
  })
  const unlocked = slugs(o.unlocked, `${path}.unlocked`).map((u, i) => known(u, `${path}.unlocked[${i}]`))
  const powered = slugs(o.powered, `${path}.powered`).map((u, i) => { if (!SYSTEM_IDS.includes(u as SystemId)) throw new SaveParseError(`${path}.powered[${i}]`, 'expected a battle system'); return u as SystemId })
  const r = object(o.research, `${path}.research`, ['done', 'current'])
  const project = (v: unknown, p: string) => { const x = id(v, p); if (!PROJECTS_BY_ID.has(x)) throw new SaveParseError(p, 'expected a project'); return x }
  const done = slugs(r.done, `${path}.research.done`).map((d, i) => project(d, `${path}.research.done[${i}]`))
  let current: Ship['research']['current'] = null
  if (r.current !== null) {
    const cur = object(r.current, `${path}.research.current`, ['id', 'left'])
    current = { id: project(cur.id, `${path}.research.current.id`), left: count(cur.left, `${path}.research.current.left`) }
    if (current.left < 1 || current.left > 3) throw new SaveParseError(`${path}.research.current.left`, 'expected 1–3')
  }
  return { decks, width, modules, unlocked, powered, research: { done, current } }
}

function parseWallet(value: unknown, path: string): Wallet {
  const o = object(value, path, ['credits', 'alloy', 'data'])
  return { credits: count(o.credits, `${path}.credits`), alloy: count(o.alloy, `${path}.alloy`), data: count(o.data, `${path}.data`) }
}

function parsePost(value: unknown, path: string, keys: readonly string[] = ['module', 'index']): Obj & Post {
  const o = object(value, path, keys)
  const module = id(o.module, `${path}.module`) as Post['module']
  const kinds = MODULE_POSTS[module]
  const index = count(o.index, `${path}.index`)
  if (!kinds || index >= kinds.length) throw new SaveParseError(path, 'expected a post aboard')
  return { ...o, module, index }
}
function parseHeld(value: unknown, path: string): HeldPost {
  const o = parsePost(value, path, ['module', 'index', 'since', 'mastery'])
  return { module: o.module, index: o.index, since: count(o.since, `${path}.since`), mastery: count(o.mastery, `${path}.mastery`) }
}
function parsePresets(value: unknown, path: string): DutyPreset[] {
  if (!Array.isArray(value) || value.length > 2) throw new SaveParseError(path, 'expected two presets at most')
  return value.map((v, i) => {
    const o = object(v, `${path}[${i}]`, ['name', 'posts'])
    const name = id(o.name, `${path}[${i}].name`)
    if (name.length > 24) throw new SaveParseError(`${path}[${i}].name`, 'expected 24 characters at most')
    const posts = object(o.posts, `${path}[${i}].posts`, Object.keys((o.posts ?? {}) as Obj))
    return { name, posts: Object.fromEntries(Object.entries(posts).map(([k, p]) => { outfits([Number(k)], `${path}[${i}].posts`); const x = parsePost(p, `${path}[${i}].posts.${k}`); return [k, { module: x.module, index: x.index }] })) }
  })
}
function parseMeal(value: unknown, path: string): Meal {
  if (typeof value !== 'string' || !(value in MEALS)) throw new SaveParseError(path, 'expected a meal')
  return value as Meal
}
function parseCamaraderie(value: unknown, path: string): Record<string, number> {
  const o = object(value, path, Object.keys((value ?? {}) as Obj))
  return Object.fromEntries(Object.entries(o).map(([k, v]) => { if (!/^\d+-\d+$/.test(k)) throw new SaveParseError(`${path}.${k}`, 'expected a pair of outfit ids'); return [k, count(v, `${path}.${k}`)] }))
}
function parseLog(value: unknown, path: string): ShipLog {
  const o = object(value, path, ['watch', 'lines', 'gains', 'read', 'reports'])
  if (!Array.isArray(o.lines) || o.lines.length > 80) throw new SaveParseError(`${path}.lines`, 'expected a list')
  if (o.reports !== undefined && (!Array.isArray(o.reports) || o.reports.length > 4)) throw new SaveParseError(`${path}.reports`, 'expected a list')
  const reports = (o.reports as unknown[] | undefined)?.map((r, i) => {
    const x = object(r, `${path}.reports[${i}]`, ['op', 'title', 'squad', 'outcome', 'text'])
    if (!['full', 'partial', 'thin'].includes(x.outcome as string)) throw new SaveParseError(`${path}.reports[${i}].outcome`, 'expected full, partial or thin')
    for (const k of ['title', 'text'] as const) if (typeof x[k] !== 'string' || (x[k] as string).length > 160) throw new SaveParseError(`${path}.reports[${i}].${k}`, 'expected text')
    return { op: id(x.op, `${path}.reports[${i}].op`), title: x.title as string, squad: id(x.squad, `${path}.reports[${i}].squad`), outcome: x.outcome as Outcome, text: x.text as string }
  })
  if (typeof o.read !== 'boolean') throw new SaveParseError(`${path}.read`, 'expected true or false')
  return {
    watch: count(o.watch, `${path}.watch`), gains: parseWallet(o.gains, `${path}.gains`), read: o.read, ...(reports ? { reports } : {}),
    lines: o.lines.map((l, i) => {
      const x = object(l, `${path}.lines[${i}]`, ['outfit', 'post', 'text', 'half'])
      if (!POST_KINDS.includes(x.post as PostKind)) throw new SaveParseError(`${path}.lines[${i}].post`, 'expected a post')
      if (typeof x.text !== 'string' || x.text.length > 160) throw new SaveParseError(`${path}.lines[${i}].text`, 'expected text')
      if (typeof x.half !== 'boolean') throw new SaveParseError(`${path}.lines[${i}].half`, 'expected true or false')
      return { outfit: outfits([x.outfit], `${path}.lines[${i}].outfit`)[0]!, post: x.post as PostKind, text: x.text, half: x.half }
    }),
  }
}
function parsePartners(value: unknown, path: string, aboard: readonly number[]): Partnership[] {
  if (!Array.isArray(value) || value.length > 150) throw new SaveParseError(path, 'expected a list')
  const seen = new Set<number>()
  return value.map((v, i) => {
    const o = object(v, `${path}[${i}]`, ['a', 'b', 'level'])
    const [a, b] = outfits([o.a, o.b], `${path}[${i}]`)
    if (a! >= b! || !aboard.includes(a!) || !aboard.includes(b!)) throw new SaveParseError(`${path}[${i}]`, 'expected two Umas aboard, the lower id first')
    if (seen.has(a!) || seen.has(b!)) throw new SaveParseError(`${path}[${i}]`, 'one partner each')
    seen.add(a!); seen.add(b!)
    if (![1, 2, 3].includes(o.level as number)) throw new SaveParseError(`${path}[${i}].level`, 'expected 1–3')
    return { a: a!, b: b!, level: o.level as 1 | 2 | 3 }
  })
}

function parseSquads(value: unknown, path: string, aboard: readonly number[]): Squad[] {
  if (!Array.isArray(value) || value.length > 4) throw new SaveParseError(path, 'expected four squads at most')
  const seen = new Set<number>(), ids = new Set<string>()
  return value.map((v, i) => {
    const p = `${path}[${i}]`
    const o = object(v, p, ['id', 'name', 'banner', 'leader', 'members', 'cohesion'])
    const sid = id(o.id, `${p}.id`)
    if (ids.has(sid)) throw new SaveParseError(`${p}.id`, 'already a squad')
    ids.add(sid)
    const name = id(o.name, `${p}.name`)
    if (name.length > 24) throw new SaveParseError(`${p}.name`, 'expected 24 characters at most')
    const members = outfits(o.members, `${p}.members`)
    if (members.length < 1 || members.length > 4) throw new SaveParseError(`${p}.members`, 'expected one to four')
    for (const m of members) { if (!aboard.includes(m)) throw new SaveParseError(`${p}.members`, `${m} isn't aboard`); if (seen.has(m)) throw new SaveParseError(`${p}.members`, `${m} is in two squads`); seen.add(m) }
    const [leader] = outfits([o.leader], `${p}.leader`)
    if (!members.includes(leader!)) throw new SaveParseError(`${p}.leader`, 'expected a member')
    return { id: sid, name, banner: id(o.banner, `${p}.banner`), leader: leader!, members, cohesion: count(o.cohesion, `${p}.cohesion`) }
  })
}
function parseRuns(value: unknown, path: string, squads: readonly Squad[]): OperationRun[] {
  if (!Array.isArray(value) || value.length > 4) throw new SaveParseError(path, 'expected a list')
  return value.map((v, i) => {
    const o = object(v, `${path}[${i}]`, ['id', 'squad', 'back'])
    const squad = id(o.squad, `${path}[${i}].squad`)
    if (!squads.some((s) => s.id === squad)) throw new SaveParseError(`${path}[${i}].squad`, 'expected a squad')
    return { id: id(o.id, `${path}[${i}].id`), squad, back: count(o.back, `${path}[${i}].back`) }
  })
}
function parseStanding(value: unknown, path: string): Record<string, number> {
  const o = object(value, path, Object.keys((value ?? {}) as Obj))
  return Object.fromEntries(Object.entries(o).map(([k, v]) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < -2 || v > 2) throw new SaveParseError(`${path}.${k}`, 'expected −2 to 2')
    return [id(k, path), v]
  }))
}

function parseEvent(value: unknown, path: string): PendingEvent {
  const o = object(value, path, ['id', 'region'])
  return { id: id(o.id, `${path}.id`), region: o.region === null ? null : id(o.region, `${path}.region`) }
}

const REVEALS: readonly string[] = ['gift', 'styles', ...TOPICS.map((t) => `topic:${t}`)]

function parseCabin(value: unknown, path: string): Cabin {
  const o = object(value, path, ['slots', 'revealed', 'request'])
  const slots = object(o.slots, `${path}.slots`, SLOTS)
  const out = emptyCabin()
  for (const slot of SLOTS) {
    const v = slots[slot]
    if (v === null || v === undefined) continue
    const item = ITEMS_BY_ID.get(id(v, `${path}.slots.${slot}`))
    if (!placeable(item) || item.slot !== slot) throw new SaveParseError(`${path}.slots.${slot}`, `expected a ${slot} item`)
    out.slots[slot] = item.id
  }
  if (!Array.isArray(o.revealed) || o.revealed.length > REVEALS.length) throw new SaveParseError(`${path}.revealed`, 'expected a list')
  out.revealed = o.revealed.map((r, i) => { if (!REVEALS.includes(r as string)) throw new SaveParseError(`${path}.revealed[${i}]`, 'expected gift, styles or topic:…'); return r as Reveal })
  if (o.request !== null && !LINE_SLOTS.includes(o.request as Exclude<Slot, 'keepsake'>)) throw new SaveParseError(`${path}.request`, 'expected a slot or null')
  out.request = o.request as Slot | null
  return out
}

function parseItems(value: unknown, path: string): Stock {
  const o = object(value, path, Object.keys((value ?? {}) as Obj))
  return Object.fromEntries(Object.entries(o).map(([k, v]) => {
    if (!ITEMS_BY_ID.has(k)) throw new SaveParseError(`${path}.${k}`, 'expected an item')
    const n = count(v, `${path}.${k}`)
    if (n < 1 || n > 9999) throw new SaveParseError(`${path}.${k}`, 'expected 1–9999')
    return [k, n]
  }))
}

function parseVisits(value: unknown, path: string): Visits {
  const o = object(value, path, ['watch', 'used'])
  return { watch: count(o.watch, `${path}.watch`), used: count(o.used, `${path}.used`) }
}

function parseCrew(value: unknown, path: string, version: 8): CrewMember[]
function parseCrew(value: unknown, path: string, version: 6): CrewMemberV6[]
function parseCrew(value: unknown, path: string, version: 5): CrewMemberV5[]
function parseCrew(value: unknown, path: string, version: 4): CrewMemberV4[]
function parseCrew(value: unknown, path: string, version: 4 | 5 | 6 | 8): (CrewMember | CrewMemberV6 | CrewMemberV5 | CrewMemberV4)[] {
  const keys = ['outfit', 'xp', 'role', 'rig', 'presets', 'strain', ...(version >= 5 ? ['bond'] : []), ...(version >= 6 ? ['cabin'] : []), ...(version >= 8 ? ['post', 'heroine', 'expeditionOnly'] : [])]
  if (!Array.isArray(value) || value.length > 300) throw new SaveParseError(path, 'expected a list of crew members')
  const seen = new Set<number>()
  const heroines = new Set<string>()
  return value.map((v, i) => {
    const p = `${path}[${i}]`
    const o = object(v, p, keys)
    const [outfit] = outfits([o.outfit], `${p}.outfit`)
    if (seen.has(outfit!)) throw new SaveParseError(`${p}.outfit`, 'already aboard')
    seen.add(outfit!)
    const heroine = o.heroine === undefined ? undefined : id(o.heroine, `${p}.heroine`)
    if (heroine !== undefined) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(heroine) || heroines.has(heroine)) throw new SaveParseError(`${p}.heroine`, 'expected a unique heroine board id')
      heroines.add(heroine)
    }
    if (o.expeditionOnly !== undefined && (o.expeditionOnly !== true || !heroine)) throw new SaveParseError(p + '.expeditionOnly', 'expected a restricted heroine')
    if (o.role !== null && !ROLES.includes(o.role as Role)) throw new SaveParseError(`${p}.role`, `expected one of ${ROLES.join(', ')} or null`)
    if (!Array.isArray(o.presets) || o.presets.length > MAX_PRESETS) throw new SaveParseError(`${p}.presets`, `expected at most ${MAX_PRESETS}`)
    const strain = count(o.strain, `${p}.strain`)
    if (strain > STRAIN_REST) throw new SaveParseError(`${p}.strain`, `expected 0–${STRAIN_REST}`)
    return {
      outfit: outfit!, ...(heroine ? { heroine } : {}), ...(o.expeditionOnly === true ? { expeditionOnly: true as const } : {}), xp: count(o.xp, `${p}.xp`), role: o.role as Role | null, rig: o.rig === null ? null : parseRig(o.rig, `${p}.rig`),
      presets: o.presets.map((x, j) => {
        const q = object(x, `${p}.presets[${j}]`, ['name', 'rig'])
        const name = id(q.name, `${p}.presets[${j}].name`)
        if (name.length > PRESET_NAME_MAX) throw new SaveParseError(`${p}.presets[${j}].name`, `expected ${PRESET_NAME_MAX} characters at most`)
        return { name, rig: parseRig(q.rig, `${p}.presets[${j}].rig`) }
      }),
      strain,
      ...(version >= 5 ? { bond: parseBond(o.bond, `${p}.bond`) } : {}),
      ...(version >= 6 ? { cabin: parseCabin(o.cabin, `${p}.cabin`) } : {}),
      ...(version >= 8 ? { post: o.post === null ? null : parseHeld(o.post, `${p}.post`) } : {}),
    } as CrewMember
  })
}

function parseMission(value: unknown, path: string): MissionState | null {
  if (value === null) return null
  const o = object(value, path, ['id', 'chapter', 'step', 'squad', 'battle', 'won', 'callUp'])
  if (!MISSION_STEPS.includes(o.step as MissionStep)) throw new SaveParseError(`${path}.step`, `expected one of ${MISSION_STEPS.join(', ')}`)
  const squad = outfits(o.squad, `${path}.squad`)
  let battle: MissionState['battle'] = null
  if (o.battle !== null) {
    const b = object(o.battle, `${path}.battle`, ['input', 'actions'])
    if (typeof b.input !== 'object' || b.input === null || Array.isArray(b.input)) throw new SaveParseError(`${path}.battle.input`, 'expected an object')
    if (!Array.isArray(b.actions) || b.actions.length > 2000) throw new SaveParseError(`${path}.battle.actions`, 'expected a list')
    const input = b.input as Partial<BattleInput> | null
    if (input?.rulesVersion === EXPEDITION_RULES_VERSION || input?.map?.schemaVersion === 2) {
      const allies = Array.isArray(input.units) ? input.units.filter(unit => unit?.side === 'squad') : []
      const spawns = new Set(allies.map(unit => unit.spawn))
      if (input.rulesVersion !== EXPEDITION_RULES_VERSION || input.map?.schemaVersion !== 2
        || !Array.isArray(input.map.spawns?.squad) || input.map.spawns.squad.length !== EXPEDITION_SQUAD_SIZE
        || allies.length !== EXPEDITION_SQUAD_SIZE || new Set(allies.map(unit => unit.id)).size !== EXPEDITION_SQUAD_SIZE
        || spawns.size !== EXPEDITION_SQUAD_SIZE || allies.some(unit => !Number.isInteger(unit.spawn) || unit.spawn < 0 || unit.spawn >= EXPEDITION_SQUAD_SIZE)
        || squad.length !== EXPEDITION_SQUAD_SIZE || new Set(squad).size !== EXPEDITION_SQUAD_SIZE) {
        throw new SaveParseError(`${path}.battle.input`, 'expected ten distinct expedition members and deployment slots')
      }
      // Rigs, map geometry and recorded actions are validated by the versioned reducer on resume.
    }
    battle = { input: b.input, actions: b.actions }
  }
  if (o.won !== null && typeof o.won !== 'boolean') throw new SaveParseError(`${path}.won`, 'expected true, false or null')
  let callUp: MissionState['callUp']
  if (o.callUp !== undefined) {
    const field = path + '.callUp'
    const row = object(o.callUp, field, ['members', 'stations'])
    const members = outfits(row.members, field + '.members')
    if (!members.length || new Set(members).size !== members.length) throw new SaveParseError(field, 'expected distinct call-up members')
    const stations = row.stations === undefined ? undefined : Object.fromEntries(
      Object.entries(object(row.stations, field + '.stations', COMMAND_STATIONS)).map(([station, member]) =>
        [station, member === null ? null : outfits([member], field + '.stations.' + station)[0]!]),
    )
    const assigned = Object.values(stations ?? {}).filter(member => member !== null)
    if (new Set(assigned).size !== assigned.length) throw new SaveParseError(field, 'duplicate temporary station officer')
    callUp = { members, ...(stations ? { stations } : {}) }
  }
  return { id: id(o.id, `${path}.id`), chapter: id(o.chapter, `${path}.chapter`), step: o.step as MissionStep,
    squad, battle, won: o.won as boolean | null, ...(callUp ? { callUp } : {}) }
}

function parseWorlds(value: unknown, path: string): SaveV3['worlds'] {
  const o = object(value, path, ['current', 'known', 'missions'])
  const known = object(o.known, `${path}.known`, Object.keys((o.known ?? {}) as Obj))
  return {
    current: o.current === null ? null : id(o.current, `${path}.current`),
    known: Object.fromEntries(Object.entries(known).map(([k, v]) => {
      const w = object(v, `${path}.known.${k}`, ['cleared'])
      return [id(k, `${path}.known`), { cleared: slugs(w.cleared, `${path}.known.${k}.cleared`) }]
    })),
    missions: slugs(o.missions, `${path}.missions`),
  }
}

function parseAccount(value: unknown, path: string): Account {
  const o = object(value, path, ['uid', 'createdAt', 'updatedAt'])
  return { uid: id(o.uid, `${path}.uid`), createdAt: timestamp(o.createdAt, `${path}.createdAt`), updatedAt: timestamp(o.updatedAt, `${path}.updatedAt`) }
}

/** The version a stored or sent value claims, or 0 when it claims none. */
export function versionOf(value: unknown): number {
  const v = (value as { version?: unknown } | null)?.version
  return typeof v === 'number' && Number.isSafeInteger(v) ? v : 0
}

/** Parses a save of any version this game has written and returns the current one, migrating as it goes. A version from
 * a newer app is refused, so an old client never half-reads a newer save. Never moves `account.updatedAt`. */
export function parseSave(value: unknown, path = 'save'): Save {
  const version = versionOf(value)
  if (version > SAVE_VERSION) throw new SaveParseError(`${path}.version`, `version ${version} is newer than this app (${SAVE_VERSION})`)
  if (version < 20) {
    if (value && typeof value === 'object' && 'expedition' in value) throw new SaveParseError(path, 'unknown version 20 keys')
    return { ...parseSaveV19(value, path), version: 20, expedition: null }
  }
  const { expedition, ...rest } = object(value, path, Object.keys(value as Obj))
  const base = parseSaveV19({ ...rest, version: 19 }, path)
  if (expedition === null) return { ...base, version: 20, expedition: null }
  const field = path + '.expedition'
  const data = object(expedition, field, ['duo', 'ship', 'members', 'fuel', 'provisions'])
  if (!Array.isArray(data.members) || data.members.length !== EXPEDITION_SQUAD_SIZE) {
    throw new SaveParseError(field + '.members', 'expected ten expedition members')
  }
  const members: ExpeditionMember[] = data.members.map((raw, index): ExpeditionMember => {
    const item = field + '.members[' + index + ']'
    if ((raw as { role?: unknown } | null)?.role === 'uma') {
      const row = object(raw, item, ['role', 'outfit'])
      const outfit = count(row.outfit, item + '.outfit')
      if (!base.crew.some(member => member.outfit === outfit && !member.heroine)) throw new SaveParseError(item, 'expected a recruited Uma')
      return { role: 'uma', outfit }
    }
    const row = object(raw, item, ['role', 'heroine'])
    const role = row.role
    if (role !== 'boss-ally' && role !== 'melee-shield' && role !== 'ranged-medic' && role !== 'long-range') {
      throw new SaveParseError(item, 'invalid expedition role')
    }
    const heroine = id(row.heroine, item + '.heroine')
    if (role === 'boss-ally' && !base.crew.some(member => member.heroine === heroine && member.expeditionOnly)) {
      throw new SaveParseError(item, 'expected a resident Boss Ally')
    }
    return { role, heroine }
  })
  if (new Set(members.map(member => member.role === 'uma' ? member.outfit : member.heroine)).size !== EXPEDITION_SQUAD_SIZE
    || ['uma', 'boss-ally', 'melee-shield', 'ranged-medic', 'long-range'].some(role => members.filter(member => member.role === role).length !== 2)) {
    throw new SaveParseError(field + '.members', 'expected two distinct members in each role')
  }
  return { ...base, version: 20, expedition: { duo: id(data.duo, field + '.duo'), ship: id(data.ship, field + '.ship'), members,
    fuel: bounded(data.fuel, field + '.fuel', SHIP_CARGO_MAX), provisions: bounded(data.provisions, field + '.provisions', SHIP_CARGO_MAX) } }
}

function parseSaveV19(value: unknown, path: string): SaveV19 {
  const version = versionOf(value)
  if (version > SAVE_VERSION) throw new SaveParseError(`${path}.version`, `version ${version} is newer than this app (${SAVE_VERSION})`)
  if (version < 19) {
    if (value && typeof value === 'object' && 'commandCinema' in value) throw new SaveParseError(path, 'unknown version 19 keys')
    return migrateV18(parseSaveV18(value, path))
  }
  const raw = object(value, path, Object.keys(value as Obj))
  const { commandCinema, ...older } = raw
  const base = parseSaveV18({ ...older, version: 18 }, path)
  const cinema = object(commandCinema, path + '.commandCinema', ['fast', 'retries', 'pending'])
  if (typeof cinema.fast !== 'boolean') throw new SaveParseError(path + '.commandCinema.fast', 'expected boolean')
  const pending = cinema.pending === null ? null : (() => {
    const row = object(cinema.pending, path + '.commandCinema.pending', ['encounter', 'turn', 'beat'])
    const field = path + '.commandCinema.pending'
    const encounter = id(row.encounter, field + '.encounter'), turn = bounded(row.turn, field + '.turn', 12), beat = bounded(row.beat, field + '.beat', 3)
    if (!turn || !base.mission?.battle || base.mission.id !== encounter || !['battle', 'results'].includes(base.mission.step)
      || base.mission.battle.actions.length !== turn || !base.mission.battle.input || typeof base.mission.battle.input !== 'object'
      || !('officers' in base.mission.battle.input) || !('reactor' in base.mission.battle.input)) throw new SaveParseError(path + '.commandCinema.pending', 'expected the latest committed ship order')
    return { encounter, turn, beat }
  })()
  return { ...base, version: 19, commandCinema: { fast: cinema.fast, retries: bounded(cinema.retries, path + '.commandCinema.retries', 1000), pending } }
}

function parseSaveV18(value: unknown, path: string): SaveV18 {
  const version = versionOf(value)
  if (version > SAVE_VERSION) throw new SaveParseError(`${path}.version`, `version ${version} is newer than this app (${SAVE_VERSION})`)
  if (version < 18) {
    if (value && typeof value === 'object' && 'management' in value) throw new SaveParseError(path, 'unknown version 18 keys')
    return migrateV17(parseSaveV17(value, path))
  }
  const raw = object(value, path, Object.keys(value as Obj))
  const { management, ...older } = raw
  const base = parseSaveV17({ ...older, version: 17 }, path)
  const state = object(management, `${path}.management`, ['sequence', 'receipts', 'acknowledged'])
  const sequence = count(state.sequence, `${path}.management.sequence`)
  if (!Array.isArray(state.receipts) || state.receipts.length > 32) throw new SaveParseError(path, 'expected at most 32 management receipts')
  let previous = 0
  const receipts: ManagementReceipt[] = state.receipts.map((value, index) => {
    const field = `${path}.management.receipts[${index}]`
    const row = object(value, field, ['sequence', 'day', 'kind', 'subject', 'port', 'destination', 'amount', 'officer'])
    const number = count(row.sequence, field), day = count(row.day, field), amount = count(row.amount, field)
    if (!number || number <= previous || number > sequence || !day || day > base.campaignDay.day || !amount) throw new SaveParseError(field, 'invalid receipt order, day or amount')
    if (!MANAGEMENT_EVENTS.includes(row.kind as ManagementReceipt['kind']) || !['ship', 'hangar', 'port'].includes(row.destination as string)) throw new SaveParseError(field, 'invalid receipt kind or destination')
    previous = number
    const officer = row.officer === undefined ? undefined : count(row.officer, field)
    if (officer === 0) throw new SaveParseError(field, 'expected an officer id')
    return { sequence: number, day, amount, kind: row.kind as ManagementReceipt['kind'], subject: id(row.subject, field),
      port: row.port === null ? null : id(row.port, field), destination: row.destination as ManagementReceipt['destination'], ...(officer ? { officer } : {}) }
  })
  const acknowledged = slugs(state.acknowledged, `${path}.management.acknowledged`)
  if (acknowledged.length > 2048 || new Set(acknowledged).size !== acknowledged.length) throw new SaveParseError(path, 'invalid management acknowledgements')
  return { ...base, version: 18, management: { sequence, receipts, acknowledged } }
}

function parseSaveV17(value: unknown, path: string): SaveV17 {
  const version = versionOf(value)
  if (version > SAVE_VERSION) throw new SaveParseError(`${path}.version`, `version ${version} is newer than this app (${SAVE_VERSION})`)
  if (version < 17) {
    if (value && typeof value === 'object' && 'cabinVisits' in value) throw new SaveParseError(path, 'unknown version 17 keys')
    return migrateV16(parseSaveV16(value, path))
  }
  const raw = object(value, path, Object.keys(value as Obj))
  const { cabinVisits, ...older } = raw
  const day = object(raw.campaignDay, `${path}.campaignDay`, ['day', 'pending'])
  let pending = null
  if ((day.pending as { kind?: unknown } | null)?.kind === 'cabin') {
    try { pending = parseCabinNight(day.pending) } catch (error) { throw new SaveParseError(`${path}.campaignDay`, error instanceof Error ? error.message : 'invalid cabin night') }
    if (raw.pairScene !== null || raw.mission !== null) throw new SaveParseError(`${path}.campaignDay`, 'another activity is already pending')
  }
  const base = parseSaveV16({ ...older, version: 16, ...(pending ? { campaignDay: { day: day.day, pending: null } } : {}) }, path)
  const counts = object(cabinVisits, `${path}.cabinVisits`, Object.keys((cabinVisits ?? {}) as Obj))
  if (Object.keys(counts).length > 1000) throw new SaveParseError(`${path}.cabinVisits`, 'too many visit counters')
  return { ...base, version: 17, campaignDay: pending ? { day: base.campaignDay.day, pending } : base.campaignDay,
    cabinVisits: Object.fromEntries(Object.entries(counts).map(([key, value]) => [id(key, `${path}.cabinVisits`), bounded(value, `${path}.cabinVisits.${key}`, 1000000)])) }
}

function parseSaveV16(value: unknown, path: string): SaveV16 {
  const version = versionOf(value)
  if (version > SAVE_VERSION) throw new SaveParseError(`${path}.version`, `version ${version} is newer than this app (${SAVE_VERSION})`)
  if (version < 11) return migrateV15(migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(parseV10(value, path)))))))
  const raw = object(value, path, Object.keys(value as Obj))
  const { campaignDay, campaignSupply, commandCrew, pairScene, campaignGear, campaignProjects, commandTraining, ...rest } = raw
  if (version < 16 && ('campaignProjects' in raw || 'commandTraining' in raw)) throw new SaveParseError(path, 'unknown campaign version 16 keys')
  if (version < 15 && 'campaignGear' in raw) throw new SaveParseError(path, 'unknown keys campaignGear')
  if (version < 14 && 'pairScene' in raw) throw new SaveParseError(path, 'unknown keys pairScene')
  if (version < 13 && 'commandCrew' in raw) throw new SaveParseError(path, 'unknown keys commandCrew')
  const base = parseV10({ ...rest, version: 10 }, path)
  if (version >= 14) {
    const day = parseCampaignDay(campaignDay, `${path}.campaignDay`, true)
    const pending = pairScene === null ? null : object(pairScene, `${path}.pairScene`, ['pair', 'scene'])
    if (pending && (day.pending || base.mission)) throw new SaveParseError(`${path}.pairScene`, 'another activity is already pending')
    const v14: SaveV14 = { ...base, version: 14, campaignDay: day, campaignSupply: parseCampaignSupply(campaignSupply, `${path}.campaignSupply`, day.day),
      commandCrew: parseCommandCrew(commandCrew, `${path}.commandCrew`, day.day),
      pairScene: pending ? { pair: id(pending.pair, `${path}.pairScene.pair`), scene: id(pending.scene, `${path}.pairScene.scene`) } : null }
    const v15: SaveV15 = version === 14 ? migrateV14(v14) : { ...v14, version: 15, campaignGear: parseCampaignGear(campaignGear, `${path}.campaignGear`) }
    if (version < 16) return migrateV15(v15)
    const projects = object(campaignProjects, `${path}.campaignProjects`, Object.keys((campaignProjects ?? {}) as Obj))
    const training = object(commandTraining, `${path}.commandTraining`, Object.keys((commandTraining ?? {}) as Obj))
    return { ...v15, version: 16,
      campaignProjects: Object.fromEntries(Object.entries(projects).map(([key, value]) => [id(key, `${path}.campaignProjects`), bounded(value, `${path}.campaignProjects.${key}`, 30)])),
      commandTraining: Object.fromEntries(Object.entries(training).map(([key, value]) => {
        const field = `${path}.commandTraining.${key}`
        if (!/^[1-9][0-9]*$/.test(key) || !Number.isSafeInteger(Number(key))) throw new SaveParseError(field, 'expected an outfit id')
        const rows = object(value, field, COMMAND_STATIONS)
        return [key, Object.fromEntries(Object.entries(rows).map(([station, raw]) => [station, parseDrills(raw, `${field}.${station}`, day.day)]))]
      })) }
  }
  const day = parseCampaignDay(campaignDay, `${path}.campaignDay`)
  if (version === 11) {
    if ('campaignSupply' in raw) throw new SaveParseError(path, 'unknown keys campaignSupply')
    return migrateV15(migrateV14(migrateV13(migrateV12(migrateV11({ ...base, campaignDay: day, version: 11 })))))
  }
  const v12: SaveV12 = { ...base, campaignDay: day, version: 12, campaignSupply: parseCampaignSupply(campaignSupply, `${path}.campaignSupply`, day.day) }
  return migrateV15(migrateV14(migrateV13(version === 12 ? migrateV12(v12) : { ...v12, version: 13, commandCrew: parseCommandCrew(commandCrew, `${path}.commandCrew`, day.day) })))
}

function parseCampaignGear(value: unknown, path: string): CampaignGear {
  const gear = object(value, path, ['alloy', 'parts'])
  const parts = slugs(gear.parts, `${path}.parts`)
  if (new Set(parts).size !== parts.length || parts.some((part) => !PARTS_BY_ID.has(part))) {
    throw new SaveParseError(`${path}.parts`, 'expected distinct known rig parts')
  }
  return { alloy: bounded(gear.alloy, `${path}.alloy`, CAMPAIGN_WORKSHOP_ALLOY_MAX), parts }
}

function parseCommandCrew(value: unknown, path: string, day: number): CommandCrew {
  const raw = object(value, path, COMMAND_STATIONS)
  const crew: CommandCrew = {}
  const assigned = new Set<number>()
  for (const station of COMMAND_STATIONS) {
    if (!(station in raw)) continue
    const field = `${path}.${station}`
    const officer = object(raw[station], field, ['outfit', 'drills', 'trainedDay'])
    const outfit = count(officer.outfit, `${field}.outfit`), drills = count(officer.drills, `${field}.drills`)
    const trainedDay = officer.trainedDay === null ? null : count(officer.trainedDay, `${field}.trainedDay`)
    if (outfit === 0 || assigned.has(outfit) || drills > MAX_DRILLS || (trainedDay !== null && (trainedDay === 0 || trainedDay > day))) {
      throw new SaveParseError(field, 'expected a distinct assigned officer and a valid drill record')
    }
    crew[station] = { outfit, drills, trainedDay }
    assigned.add(outfit)
  }
  return crew
}

function parseDrills(value: unknown, path: string, day: number) {
  const o = object(value, path, ['drills', 'trainedDay'])
  const drills = bounded(o.drills, `${path}.drills`, MAX_DRILLS)
  const trainedDay = o.trainedDay === null ? null : bounded(o.trainedDay, `${path}.trainedDay`, day)
  if (trainedDay === 0) throw new SaveParseError(path, 'expected a trained campaign day')
  return { drills, trainedDay }
}

function parseCampaignSupply(value: unknown, path: string, day: number): CampaignSupply | null {
  if (value === null) return null
  const o = object(value, path, ['port', 'stores', 'fuel', 'provisions', 'shortfall', 'reliefDay'])
  const records = object(o.stores, `${path}.stores`, Object.keys((o.stores ?? {}) as Obj))
  const stores = Object.fromEntries(Object.entries(records).map(([port, value]) => {
    const field = `${path}.stores.${port}`
    const stock = object(value, field, SUPPLY_KINDS)
    return [id(port, field), { fuel: bounded(stock.fuel, `${field}.fuel`, PORT_STOCK_MAX),
      provisions: bounded(stock.provisions, `${field}.provisions`, PORT_STOCK_MAX), alloy: bounded(stock.alloy, `${field}.alloy`, PORT_STOCK_MAX) }]
  }))
  return { port: id(o.port, `${path}.port`), stores, fuel: bounded(o.fuel, `${path}.fuel`, SHIP_CARGO_MAX),
    provisions: bounded(o.provisions, `${path}.provisions`, SHIP_CARGO_MAX), shortfall: bounded(o.shortfall, `${path}.shortfall`, SHIP_CARGO_MAX),
    reliefDay: o.reliefDay === null ? null : bounded(o.reliefDay, `${path}.reliefDay`, day) }
}

function parseCampaignDay(value: unknown, path: string): CampaignDay<SoloNight>
function parseCampaignDay(value: unknown, path: string, allowPair: true): CampaignDay
function parseCampaignDay(value: unknown, path: string, allowPair = false): CampaignDay {
  const o = object(value, path, ['day', 'pending'])
  const day = count(o.day, `${path}.day`)
  if (day === 0) throw new SaveParseError(`${path}.day`, 'expected day 1 or later')
  if (o.pending === null) return { day, pending: null }
  const pendingPath = `${path}.pending`
  const kind = (o.pending as { kind?: unknown } | null)?.kind
  if (allowPair && (kind === 'pair-visit' || kind === 'pair-morning')) {
    const p = object(o.pending, pendingPath, kind === 'pair-visit' ? ['kind', 'pair', 'scene', 'morning'] : ['kind', 'pair', 'scene'])
    const pair = id(p.pair, `${pendingPath}.pair`), scene = id(p.scene, `${pendingPath}.scene`)
    return { day, pending: kind === 'pair-morning' ? { kind, pair, scene }
      : { kind, pair, scene, morning: p.morning === null ? null : id(p.morning, `${pendingPath}.morning`) } }
  }
  if (kind !== 'visit' && kind !== 'morning') throw new SaveParseError(`${pendingPath}.kind`, 'expected visit or morning')
  const p = object(o.pending, pendingPath, kind === 'visit' ? ['kind', 'companion', 'scene', 'morning', 'pathChoice'] : ['kind', 'companion', 'scene'])
  const companion = count(p.companion, `${pendingPath}.companion`)
  if (companion === 0) throw new SaveParseError(`${pendingPath}.companion`, 'expected an outfit id')
  const scene = id(p.scene, `${pendingPath}.scene`)
  const pathChoice = p.pathChoice
  if (pathChoice !== undefined && pathChoice !== 'heart' && pathChoice !== 'trust') throw new SaveParseError(`${pendingPath}.pathChoice`, 'expected Heart or Trust')
  return { day, pending: kind === 'morning' ? { kind, companion, scene }
    : { kind, companion, scene, morning: p.morning === null ? null : id(p.morning, `${pendingPath}.morning`), ...(pathChoice ? { pathChoice } : {}) } }
}

function parseV10(value: unknown, path: string): SaveV10 {
  const version = versionOf(value)
  if (version === 1) {
    const o = object(value, path, ['version', 'account'])
    return migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3(migrateV2(migrateV1({ version: 1, account: parseAccount(o.account, `${path}.account`) })))))))))
  }
  if (version === 2) {
    const o = object(value, path, ['version', 'account', 'story'])
    return migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3(migrateV2({ version: 2, account: parseAccount(o.account, `${path}.account`), story: parseStory(o.story, `${path}.story`) }))))))))
  }
  if (version < 3 || version > 10) throw new SaveParseError(`${path}.version`, `expected 1–${SAVE_VERSION}`)
  const base = ['version', 'account', 'crew', 'ship', 'worlds', 'story', 'mission']
  const o = object(value, path, [...base, ...(version >= 5 ? ['captain', 'watch', 'inbox'] : []), ...(version >= 6 ? ['items', 'visits'] : []), ...(version >= 7 ? ['wallet'] : []),
    ...(version >= 8 ? ['dutyPresets', 'meal', 'camaraderie', 'log', 'event'] : []), ...(version >= 9 ? ['partners'] : []), ...(version >= 10 ? ['squads', 'operations', 'operationsWon', 'standing'] : [])])
  if (version >= 7) {
    const v7 = {
      account: parseAccount(o.account, `${path}.account`), worlds: parseWorlds(o.worlds, `${path}.worlds`), story: parseStory(o.story, `${path}.story`), mission: parseMission(o.mission, `${path}.mission`),
      captain: parseCaptain(o.captain, `${path}.captain`), watch: count(o.watch, `${path}.watch`), inbox: outfits(o.inbox, `${path}.inbox`),
    }
    const v7rest = { items: parseItems(o.items, `${path}.items`), visits: parseVisits(o.visits, `${path}.visits`), ship: parseShip(o.ship, `${path}.ship`), wallet: parseWallet(o.wallet, `${path}.wallet`) }
    if (version === 7) return migrateV9(migrateV8(migrateV7({ version: 7, ...v7, ...v7rest, crew: parseCrew(o.crew, `${path}.crew`, 6) })))
    const v8 = {
      version: 8 as const, ...v7, ...v7rest, crew: parseCrew(o.crew, `${path}.crew`, 8), dutyPresets: parsePresets(o.dutyPresets, `${path}.dutyPresets`),
      meal: o.meal === null ? null : parseMeal(o.meal, `${path}.meal`), camaraderie: parseCamaraderie(o.camaraderie, `${path}.camaraderie`),
      log: o.log === null ? null : parseLog(o.log, `${path}.log`), event: o.event === null ? null : parseEvent(o.event, `${path}.event`),
    }
    if (version === 8) return migrateV9(migrateV8(v8))
    const v9 = { ...v8, version: 9 as const, partners: parsePartners(o.partners, `${path}.partners`, v8.crew.map((m) => m.outfit)) }
    if (version === 9) return migrateV9(v9)
    const aboard = v9.crew.map((m) => m.outfit), squads = parseSquads(o.squads, `${path}.squads`, aboard)
    return { ...v9, version: 10, squads, operations: parseRuns(o.operations, `${path}.operations`, squads), operationsWon: slugs(o.operationsWon, `${path}.operationsWon`), standing: parseStanding(o.standing, `${path}.standing`) }
  }
  const ship = object(o.ship, `${path}.ship`, ['rooms'])
  const rooms = slugs(ship.rooms, `${path}.ship.rooms`)
  for (const [i, r] of rooms.entries()) if (!ROOM_IDS.includes(r as RoomId)) throw new SaveParseError(`${path}.ship.rooms[${i}]`, 'expected a room')
  const rest = {
    account: parseAccount(o.account, `${path}.account`), ship: { rooms: rooms as RoomId[] },
    worlds: parseWorlds(o.worlds, `${path}.worlds`), story: parseStory(o.story, `${path}.story`), mission: parseMission(o.mission, `${path}.mission`),
  }
  if (version === 3) return migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3({ version: 3, ...rest, crew: outfits(o.crew, `${path}.crew`) })))))))
  if (version === 4) return migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4({ version: 4, ...rest, crew: parseCrew(o.crew, `${path}.crew`, 4) }))))))
  const v5 = { ...rest, captain: parseCaptain(o.captain, `${path}.captain`), watch: count(o.watch, `${path}.watch`), inbox: outfits(o.inbox, `${path}.inbox`) }
  if (version === 5) return migrateV9(migrateV8(migrateV7(migrateV6(migrateV5({ version: 5, ...v5, crew: parseCrew(o.crew, `${path}.crew`, 5) })))))
  return migrateV9(migrateV8(migrateV7(migrateV6({ version: 6, ...v5, crew: parseCrew(o.crew, `${path}.crew`, 6), items: parseItems(o.items, `${path}.items`), visits: parseVisits(o.visits, `${path}.visits`) }))))
}

/** The body of `PUT /api/save`. */
export function parseSavePut(value: unknown): SavePut {
  const o = object(value, 'body', ['baseRevision', 'save'])
  return { baseRevision: count(o.baseRevision, 'body.baseRevision'), save: parseSave(o.save, 'body.save'), sentVersion: versionOf(o.save) }
}

/** The envelope `GET /api/save` returns, as the client reads it. */
export function parseSaveEnvelope(value: unknown): SaveEnvelope {
  const o = object(value, 'envelope', ['revision', 'save'])
  return { revision: count(o.revision, 'envelope.revision'), save: o.save === null ? null : parseSave(o.save, 'envelope.save') }
}
