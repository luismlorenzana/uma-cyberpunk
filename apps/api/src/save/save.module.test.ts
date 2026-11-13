import { describe, expect, it } from 'vitest'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { saveRepository } from './save.module'

const config = (values: Record<string, string>) => ({ get: <T>(key: string) => values[key] as T })

describe('the save store choice', () => {
  it('is the local file in dev', () => expect(saveRepository(config({}))).toBeInstanceOf(LocalSaveRepository))
  it('is Firestore with PERSISTENCE=firestore and a database', () => {
    expect(saveRepository(config({ PERSISTENCE: 'firestore', FIRESTORE_DATABASE: 'cyber' }))).toBeInstanceOf(FirestoreSaveRepository)
  })
  it("refuses Firestore without a database, rather than using uma-rpg's (default)", () => {
    expect(() => saveRepository(config({ PERSISTENCE: 'firestore' }))).toThrow(/FIRESTORE_DATABASE/)
  })
})
