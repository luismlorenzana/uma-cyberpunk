// uma-cyberpunk's save (CY3, TC11): local first in Dexie, synced through `cyber-api`. Nothing carries over from any
// other game (P4, TC14). Copied from uma-quest's at cc42fd1 (its Q14, D11), itself from uma-rpg's at 30a322a (its D32,
// D45, D260), cut to one account. Every change to the shape is a new version with its migration and tests: `parseSave`
// takes any version this game ever wrote and returns the current one, and never moves `account.updatedAt`.

import type { Role } from '@cyber/battle'
import { MAX_PRESETS, newMember, PRESET_NAME_MAX, ROLES, STRAIN_REST, type CrewMember } from '../crew/crew'
import { PARTS_BY_ID, RIG_SLOTS, SLOT_KIND, type Rig } from '../crew/parts'
import { OPEN_FROM_START, ROOM_IDS, type RoomId } from '../ship/rooms'
import { emptyStory, type StoryState } from '../story/state'

/** The save's version now: 2 adds the story state (CY9); 3 the crew, the ship, the worlds and the mission (CY10); 4 each
 * crew member's record (CY11). */
export const SAVE_VERSION = 4

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

/** v4 (CY11): each crew member's record (XP, role, rig, saved loadouts, Strain) in place of her bare outfit id. */
export interface SaveV4 extends Omit<SaveV3, 'version' | 'crew'> {
  version: 4
  /** In join order. */
  crew: CrewMember[]
}

/** The save as the app and the API use it: always the current version. */
export type Save = SaveV4

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
  return migrateV3(migrateV2({ version: 2, account: { uid, createdAt: now, updatedAt: now }, story: emptyStory() }))
}

/** v3 to v4: each outfit id aboard becomes her record with no XP, her default role, "best for her role", no saved
 * loadouts and no Strain; the rest as it was (`updatedAt` untouched). Pure; runs on the device. */
export function migrateV3(save: SaveV3): SaveV4 {
  return { ...save, version: 4, account: { ...save.account }, crew: save.crew.map(newMember) }
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

function parseCrew(value: unknown, path: string): CrewMember[] {
  if (!Array.isArray(value) || value.length > 300) throw new SaveParseError(path, 'expected a list of crew members')
  const seen = new Set<number>()
  return value.map((v, i) => {
    const p = `${path}[${i}]`
    const o = object(v, p, ['outfit', 'xp', 'role', 'rig', 'presets', 'strain'])
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
    }
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
  if (version === 1) {
    const o = object(value, path, ['version', 'account'])
    return migrateV3(migrateV2(migrateV1({ version: 1, account: parseAccount(o.account, `${path}.account`) })))
  }
  if (version === 2) {
    const o = object(value, path, ['version', 'account', 'story'])
    return migrateV3(migrateV2({ version: 2, account: parseAccount(o.account, `${path}.account`), story: parseStory(o.story, `${path}.story`) }))
  }
  if (version !== 3 && version !== 4) throw new SaveParseError(`${path}.version`, `expected 1–${SAVE_VERSION}`)
  const o = object(value, path, ['version', 'account', 'crew', 'ship', 'worlds', 'story', 'mission'])
  const ship = object(o.ship, `${path}.ship`, ['rooms'])
  const rooms = slugs(ship.rooms, `${path}.ship.rooms`)
  for (const [i, r] of rooms.entries()) if (!ROOM_IDS.includes(r as RoomId)) throw new SaveParseError(`${path}.ship.rooms[${i}]`, 'expected a room')
  const rest = {
    account: parseAccount(o.account, `${path}.account`), ship: { rooms: rooms as RoomId[] },
    worlds: parseWorlds(o.worlds, `${path}.worlds`), story: parseStory(o.story, `${path}.story`), mission: parseMission(o.mission, `${path}.mission`),
  }
  if (version === 3) return migrateV3({ version: 3, ...rest, crew: outfits(o.crew, `${path}.crew`) })
  return { version: 4, ...rest, crew: parseCrew(o.crew, `${path}.crew`) }
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
