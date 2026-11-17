// uma-cyberpunk's save (CY3, TC11): local first in Dexie, synced through `cyber-api`. Nothing carries over from any
// other game (P4, TC14). Copied from uma-quest's at cc42fd1 (its Q14, D11), itself from uma-rpg's at 30a322a (its D32,
// D45, D260), cut to one account. Every change to the shape is a new version with its migration and tests: `parseSave`
// takes any version this game ever wrote and returns the current one, and never moves `account.updatedAt`.

import type { Role } from '@cyber/battle'
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
import { emptyStory, type StoryState } from '../story/state'
import { firstCampaignDay, type CampaignDay } from '../campaign-day'

/** The save's version now: 2 adds the story state (CY9); 3 the crew, the ship, the worlds and the mission (CY10); 4 each
 * crew member's record (CY11); 5 the captain, the watch, the inbox and each Uma's bond (CY13); 6 each Uma's cabin, the
 * item stock and the visits (CY14); 7 the ship as a build and the wallet (CY15); 8 duties: posts, presets, the meal,
 * camaraderie, the ship log and a jump's pending event (CY16); 9 partners (CY17); 10 squads, operations and faction
 * standing (CY18); 11 the campaign day and its pending evening or morning scene (CY21). */
export const SAVE_VERSION = 11

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
  campaignDay: CampaignDay
}

/** The save as the app and the API use it: always the current version. */
export type Save = SaveV11

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
  return migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3(migrateV2({ version: 2, account: { uid, createdAt: now, updatedAt: now }, story: emptyStory() })))))))))
}

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
  const keys = ['outfit', 'xp', 'role', 'rig', 'presets', 'strain', ...(version >= 5 ? ['bond'] : []), ...(version >= 6 ? ['cabin'] : []), ...(version >= 8 ? ['post'] : [])]
  if (!Array.isArray(value) || value.length > 300) throw new SaveParseError(path, 'expected a list of crew members')
  const seen = new Set<number>()
  return value.map((v, i) => {
    const p = `${path}[${i}]`
    const o = object(v, p, keys)
    const [outfit] = outfits([o.outfit], `${p}.outfit`)
    if (seen.has(outfit!)) throw new SaveParseError(`${p}.outfit`, 'already aboard')
    seen.add(outfit!)
    if (o.role !== null && !ROLES.includes(o.role as Role)) throw new SaveParseError(`${p}.role`, `expected one of ${ROLES.join(', ')} or null`)
    if (!Array.isArray(o.presets) || o.presets.length > MAX_PRESETS) throw new SaveParseError(`${p}.presets`, `expected at most ${MAX_PRESETS}`)
    const strain = count(o.strain, `${p}.strain`)
    if (strain > STRAIN_REST) throw new SaveParseError(`${p}.strain`, `expected 0–${STRAIN_REST}`)
    return {
      outfit: outfit!, xp: count(o.xp, `${p}.xp`), role: o.role as Role | null, rig: o.rig === null ? null : parseRig(o.rig, `${p}.rig`),
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
  const o = object(value, path, ['id', 'chapter', 'step', 'squad', 'battle', 'won'])
  if (!MISSION_STEPS.includes(o.step as MissionStep)) throw new SaveParseError(`${path}.step`, `expected one of ${MISSION_STEPS.join(', ')}`)
  let battle: MissionState['battle'] = null
  if (o.battle !== null) {
    const b = object(o.battle, `${path}.battle`, ['input', 'actions'])
    if (typeof b.input !== 'object' || b.input === null || Array.isArray(b.input)) throw new SaveParseError(`${path}.battle.input`, 'expected an object')
    if (!Array.isArray(b.actions) || b.actions.length > 2000) throw new SaveParseError(`${path}.battle.actions`, 'expected a list')
    battle = { input: b.input, actions: b.actions }
  }
  if (o.won !== null && typeof o.won !== 'boolean') throw new SaveParseError(`${path}.won`, 'expected true, false or null')
  return { id: id(o.id, `${path}.id`), chapter: id(o.chapter, `${path}.chapter`), step: o.step as MissionStep, squad: outfits(o.squad, `${path}.squad`), battle, won: o.won as boolean | null }
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
  if (version < 11) return migrateV10(parseV10(value, path))
  const raw = object(value, path, Object.keys(value as Obj))
  const { campaignDay, ...rest } = raw
  return { ...parseV10({ ...rest, version: 10 }, path), version: 11, campaignDay: parseCampaignDay(campaignDay, `${path}.campaignDay`) }
}

function parseCampaignDay(value: unknown, path: string): CampaignDay {
  const o = object(value, path, ['day', 'pending'])
  const day = count(o.day, `${path}.day`)
  if (day === 0) throw new SaveParseError(`${path}.day`, 'expected day 1 or later')
  if (o.pending === null) return { day, pending: null }
  const pendingPath = `${path}.pending`
  const kind = (o.pending as { kind?: unknown } | null)?.kind
  if (kind !== 'visit' && kind !== 'morning') throw new SaveParseError(`${pendingPath}.kind`, 'expected visit or morning')
  const p = object(o.pending, pendingPath, kind === 'visit' ? ['kind', 'companion', 'scene', 'morning'] : ['kind', 'companion', 'scene'])
  const companion = count(p.companion, `${pendingPath}.companion`)
  if (companion === 0) throw new SaveParseError(`${pendingPath}.companion`, 'expected an outfit id')
  const scene = id(p.scene, `${pendingPath}.scene`)
  return { day, pending: kind === 'morning' ? { kind, companion, scene }
    : { kind, companion, scene, morning: p.morning === null ? null : id(p.morning, `${pendingPath}.morning`) } }
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
