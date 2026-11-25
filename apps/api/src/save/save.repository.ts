import type { Save, SaveEnvelope } from '@cyber/domain'

/** A stale write: the stored revision moved on. Carries what's stored so the client can reconcile (uma-rpg D32). */
export class RevisionConflict extends Error {
  readonly current: SaveEnvelope
  constructor(current: SaveEnvelope) {
    super(`revision conflict: stored ${current.revision}`)
    this.name = 'RevisionConflict'
    this.current = current
  }
}

// One snapshot document per account, copied from uma-rpg's save service at 30a322a: a local JSON file in dev, Firestore's
// `cyber` database in production. The server stores what the client sends and never writes into a save itself.
export interface SaveRepository {
  load(uid: string): Promise<SaveEnvelope>
  /**
   * Stores `save` as `baseRevision + 1` when the stored revision equals `baseRevision` and the client's version isn't
   * older than the stored one (uma-rpg D45); otherwise RevisionConflict with what's stored.
   */
  put(uid: string, baseRevision: number, save: Save, sentVersion: number): Promise<SaveEnvelope>
  /** Keeps an upload this server refused, as sent, in place of the one kept before (uma-rpg D260): the device may hold
   * the only copy. */
  rescue(uid: string, upload: unknown, reason: string): Promise<void>
}

export const SAVE_REPOSITORY = Symbol('SAVE_REPOSITORY')
export const CAMPAIGN_SAVE_REPOSITORY = Symbol('CAMPAIGN_SAVE_REPOSITORY')
export const PILOT_SAVE_REPOSITORY = Symbol('PILOT_SAVE_REPOSITORY')

export const FOUR_ACT_SAVE_REPOSITORY = Symbol('FOUR_ACT_SAVE_REPOSITORY')

export const EMPTY_ENVELOPE: SaveEnvelope = { revision: 0, save: null }
