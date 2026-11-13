// The production store against an in-memory Firestore: the `cyber` database by name, revisions checked in a transaction,
// the save stored as JSON text, a backup before a newer version replaces a stored one, and the rescue. Invented data only.
import { newSave, touched, type Save } from '@cyber/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { RevisionConflict } from './save.repository'

type Doc = Record<string, unknown>
const store = new Map<string, Doc>()
const databases: string[] = []
const SERVER_TIME = { serverTimestamp: true }

vi.mock('firebase-admin/app', () => ({ getApps: () => [{ name: 'app' }], initializeApp: () => ({ name: 'app' }) }))
vi.mock('firebase-admin/firestore', () => {
  const snapshot = (path: string) => ({ exists: store.has(path), data: () => (store.has(path) ? structuredClone(store.get(path)) : undefined) })
  const ref = (path: string) => ({ path, get: async () => snapshot(path), set: async (data: Doc) => { store.set(path, structuredClone(data)) } })
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const writes: [string, Doc][] = []
      const result = await fn({ get: async (r: { path: string }) => snapshot(r.path), set: (r: { path: string }, data: Doc) => { writes.push([r.path, data]) } })
      for (const [path, data] of writes) store.set(path, structuredClone(data))
      return result
    },
  }
  return {
    getFirestore: (_app: unknown, database: string) => { databases.push(database); return db },
    FieldValue: { serverTimestamp: () => SERVER_TIME },
  }
})

const T0 = '2026-11-08T12:00:00.000Z'
const T1 = '2026-11-08T12:05:00.000Z'

describe('the Firestore save store', () => {
  beforeEach(() => { store.clear(); databases.length = 0 })

  it('opens the database it is given, never (default)', async () => {
    await new FirestoreSaveRepository('cyber').load('u')
    expect(databases).toEqual(['cyber'])
  })

  it('stores the save as JSON text with its revision, and never touches account.updatedAt', async () => {
    const repo = new FirestoreSaveRepository('cyber')
    const save = touched(newSave('u', T0), T1)
    expect(await repo.put('u', 0, save, 1)).toEqual({ revision: 1, save })
    const doc = store.get('saves/u')!
    expect(doc).toEqual({ revision: 1, save: JSON.stringify(save), storedAt: SERVER_TIME })
    expect((JSON.parse(doc.save as string) as Save).account.updatedAt).toBe(T1)
    expect(await repo.load('u')).toEqual({ revision: 1, save })
  })

  it('refuses a stale revision with what is stored, writing nothing', async () => {
    const repo = new FirestoreSaveRepository('cyber')
    await repo.put('u', 0, newSave('u', T0), 1)
    const before = structuredClone(store.get('saves/u'))
    const error = await repo.put('u', 5, newSave('u', T1), 1).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RevisionConflict)
    expect((error as RevisionConflict).current).toEqual({ revision: 1, save: newSave('u', T0) })
    expect(store.get('saves/u')).toEqual(before)
  })

  it('refuses an upload older than the stored version (uma-rpg D45)', async () => {
    store.set('saves/u', { revision: 2, save: JSON.stringify({ version: 1, account: newSave('u', T0).account }) })
    await expect(new FirestoreSaveRepository('cyber').put('u', 2, newSave('u', T1), 0)).rejects.toBeInstanceOf(RevisionConflict)
  })

  it('makes no backup while the version stays the same', async () => {
    const repo = new FirestoreSaveRepository('cyber')
    await repo.put('u', 0, newSave('u', T0), 1)
    await repo.put('u', 1, touched(newSave('u', T0), T1), 1)
    expect([...store.keys()].filter((k) => k.startsWith('saveBackups/'))).toEqual([])
  })

  it('keeps a refused upload in saveRescues, newest only', async () => {
    const repo = new FirestoreSaveRepository('cyber')
    await repo.rescue('u', { first: true }, 'one')
    await repo.rescue('u', { second: true }, 'two')
    expect(store.get('saveRescues/u')).toEqual({ upload: JSON.stringify({ second: true }), reason: 'two', rescuedAt: SERVER_TIME })
  })
})
