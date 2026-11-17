import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore'
import { parseSave, versionOf, type Save, type SaveEnvelope } from '@cyber/domain'
import { EMPTY_ENVELOPE, RevisionConflict, type SaveRepository } from './save.repository'

// Production persistence in the `cyber` database (FIRESTORE_DATABASE): `saves/{uid}` = { revision, save, storedAt },
// revision-checked inside a transaction. `save` is JSON text (uma-rpg D260: Firestore refuses a list inside a list).
// `storedAt` is the server's clock for the document only; the save's own `account.updatedAt` is never touched here.
// When a newer save version replaces a stored one, the stored document is first copied to `saveBackups/{uid}-v{n}`
// (uma-rpg D69), so a migration can be undone by hand. An upload this server refuses waits in `saveRescues/{uid}`,
// newest only (uma-rpg D260).
const storedSave = (data: { save?: unknown } | undefined): unknown => (typeof data?.save === 'string' ? JSON.parse(data.save) as unknown : data?.save)
const legacyCollections = { saves: 'saves', backups: 'saveBackups', rescues: 'saveRescues' }
const campaignCollections = { saves: 'campaignSaves', backups: 'campaignSaveBackups', rescues: 'campaignSaveRescues' }

export class FirestoreSaveRepository implements SaveRepository {
  private firestore: Firestore | null = null

  private readonly collections: typeof legacyCollections

  constructor(private readonly databaseId: string, campaign = false) {
    this.collections = campaign ? campaignCollections : legacyCollections
  }

  private db(): Firestore {
    if (!this.firestore) this.firestore = getFirestore(getApps()[0] ?? initializeApp(), this.databaseId)
    return this.firestore
  }

  private static envelope(snapshot: DocumentSnapshot): SaveEnvelope {
    if (!snapshot.exists) return EMPTY_ENVELOPE
    const data = snapshot.data() as { revision?: unknown; save?: unknown }
    return { revision: Number(data.revision ?? 0), save: parseSave(storedSave(data)) }
  }

  async load(uid: string): Promise<SaveEnvelope> {
    return FirestoreSaveRepository.envelope(await this.db().collection(this.collections.saves).doc(uid).get())
  }

  put(uid: string, baseRevision: number, save: Save, sentVersion: number): Promise<SaveEnvelope> {
    const db = this.db()
    const ref = db.collection(this.collections.saves).doc(uid)
    return db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref)
      const current = FirestoreSaveRepository.envelope(snapshot)
      const storedVersion = snapshot.exists ? versionOf(storedSave(snapshot.data() as { save?: unknown })) : 0
      if (current.revision !== baseRevision || sentVersion < storedVersion) throw new RevisionConflict(current)
      if (snapshot.exists && save.version > storedVersion) {
        tx.set(db.collection(this.collections.backups).doc(`${uid}-v${storedVersion}`), { ...snapshot.data(), backedUpAt: FieldValue.serverTimestamp() })
      }
      const next = { revision: baseRevision + 1, save }
      tx.set(ref, { revision: next.revision, save: JSON.stringify(save), storedAt: FieldValue.serverTimestamp() })
      return next
    })
  }

  async rescue(uid: string, upload: unknown, reason: string): Promise<void> {
    await this.db().collection(this.collections.rescues).doc(uid).set({ upload: JSON.stringify(upload), reason, rescuedAt: FieldValue.serverTimestamp() })
  }
}
