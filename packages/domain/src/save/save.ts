// uma-cyberpunk's save (CY3, TC11): local first in Dexie, synced through `cyber-api`. Nothing carries over from any
// other game (P4, TC14). Copied from uma-quest's at cc42fd1 (its Q14, D11), itself from uma-rpg's at 30a322a (its D32,
// D45, D260), cut to one account. Every change to the shape is a new version with its migration and tests: `parseSave`
// takes any version this game ever wrote and returns the current one, and never moves `account.updatedAt`.

import { emptyStory, type StoryState } from '../story/state'

/** The save's version now: 2 adds the story state (CY9). */
export const SAVE_VERSION = 2

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

/** The save as the app and the API use it: always the current version. */
export type Save = SaveV2

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
  return { version: 2, account: { uid, createdAt: now, updatedAt: now }, story: emptyStory() }
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
    return migrateV1({ version: 1, account: parseAccount(o.account, `${path}.account`) })
  }
  if (version !== 2) throw new SaveParseError(`${path}.version`, `expected 1–${SAVE_VERSION}`)
  const o = object(value, path, ['version', 'account', 'story'])
  return { version: 2, account: parseAccount(o.account, `${path}.account`), story: parseStory(o.story, `${path}.story`) }
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
