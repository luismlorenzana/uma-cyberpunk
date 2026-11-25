// The device save (copied from uma-rpg at 30a322a, its D32 and D260): one Dexie row holding the whole save, its last
// synced revision and a dirty flag. Safety copies sit beside it: a save kept on this device before anything replaced it,
// the newest five for each account.
import type { Dexie, Table } from 'dexie'
import { parseSave, type Save } from '@cyber/domain'
import { saveScope } from '../app/campaign'

export interface SaveRow {
  id: 'main'
  /** Whose save this is; a different signed-in uid never reads it. */
  uid: string
  /** The server revision this save is based on (0 = never synced). */
  revision: number
  save: Save
  /** Changed since the last successful sync. */
  dirty: boolean
  /** When the server last held everything here, so "synced at" survives a restart. */
  lastSyncedAt: string | null
}

/** Why a safety copy exists: a newer save replaced unsynced changes, the player restored an older copy over it, or this
 * device's save couldn't be read (kept as it was, for a later build that can). */
export type SafetyReason = 'replaced' | 'restore' | 'unreadable'
export interface SafetyCopy {
  id?: number
  uid: string
  reason: SafetyReason
  at: string
  revision: number
  save: unknown
}
/** The safety copies an account keeps on a device. */
export const SAFETY_COPIES = 5

let databasePromise: Promise<Dexie> | null = null
function database(): Promise<Dexie> {
  databasePromise ??= (async () => {
    const { default: DexieDb } = await import('dexie')
    const name = { legacy: 'uma-cyberpunk', current: 'uma-cyberpunk-campaign', pilot: 'uma-cyberpunk-campaign-pilot', 'four-act': 'uma-cyberpunk-campaign-four-act' }[saveScope]
    const opened = new DexieDb(name)
    opened.version(1).stores({ save: 'id', safety: '++id, uid' })
    return opened
  })().catch((error: unknown) => {
    databasePromise = null
    throw error
  })
  return databasePromise
}
const saveTable = async (): Promise<Table<SaveRow, string>> => (await database()).table<SaveRow, string>('save')
const safetyTable = async (): Promise<Table<SafetyCopy, number>> => (await database()).table<SafetyCopy, number>('safety')

/** The account's safety copies, newest first. */
export async function safetyCopies(uid: string): Promise<SafetyCopy[]> {
  try {
    return (await (await safetyTable()).where('uid').equals(uid).sortBy('id')).reverse()
  } catch {
    return []
  }
}

/** Keeps a save, dropping the account's oldest past `SAFETY_COPIES`. False when it couldn't be kept: nothing may then
 * replace it. */
export async function addSafetyCopy(copy: Omit<SafetyCopy, 'id'>): Promise<boolean> {
  try {
    const table = await safetyTable()
    await table.add(copy)
    const stale = (await safetyCopies(copy.uid)).slice(SAFETY_COPIES).flatMap((c) => (c.id === undefined ? [] : [c.id]))
    await table.bulkDelete(stale)
    return true
  } catch {
    return false
  }
}

/** One safety copy, or null. */
export async function readSafetyCopy(id: number): Promise<SafetyCopy | null> {
  try {
    return (await (await safetyTable()).get(id)) ?? null
  } catch {
    return null
  }
}

export async function removeSafetyCopy(id: number): Promise<void> {
  try {
    await (await safetyTable()).delete(id)
  } catch {
    // Kept: a spare copy is harmless.
  }
}

export async function readSaveRow(uid: string): Promise<SaveRow | null> {
  let row: SaveRow | undefined
  try {
    row = await (await saveTable()).get('main')
    if (!row || row.uid !== uid) return null
    // Older app versions stored older save versions: parse migrates them. An unreadable row is kept as a safety copy,
    // since boot then falls back to the server's save and writes over it.
    return { ...row, lastSyncedAt: row.lastSyncedAt ?? null, save: parseSave(row.save) }
  } catch {
    if (row?.uid === uid) await addSafetyCopy({ uid, reason: 'unreadable', at: new Date().toISOString(), revision: row.revision, save: row.save })
    return null
  }
}

export async function writeSaveRow(row: SaveRow): Promise<void> {
  try {
    await (await saveTable()).put(row)
  } catch {
    // IndexedDB unavailable (private mode): the store still holds the save and sync still backs it up.
  }
}

/** For tests: empties both tables. */
export async function clearDevice(): Promise<void> {
  await (await saveTable()).clear()
  await (await safetyTable()).clear()
}
