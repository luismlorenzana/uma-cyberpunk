import { describe, expect, it } from 'vitest'
import { newSave, parseSave, parseSaveEnvelope, parseSavePut, resolveConflict, SAVE_VERSION, SaveParseError, touched, versionOf } from './save'

const T0 = '2026-11-08T12:00:00.000Z'
const T1 = '2026-11-08T12:05:00.000Z'

const EMPTY = { flags: [], leads: [], files: {}, anomalies: {}, seen: [] }

describe('save v2', () => {
  it('is version 2', () => expect(SAVE_VERSION).toBe(2))

  it('starts an account with both dates at now and an empty story', () => {
    expect(newSave('u1', T0)).toEqual({ version: 2, account: { uid: 'u1', createdAt: T0, updatedAt: T0 }, story: EMPTY })
  })

  it('moves only updatedAt on a change', () => {
    const save = newSave('u1', T0)
    expect(touched(save, T1)).toEqual({ version: 2, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story: EMPTY })
    expect(save.account.updatedAt).toBe(T0)
  })

  it('opens a v1 save as v2 with account.updatedAt unchanged (the migration, CY9)', () => {
    const v1 = { version: 1, account: { uid: 'u1', createdAt: T0, updatedAt: T1 } }
    expect(parseSave(v1)).toEqual({ version: 2, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story: EMPTY })
  })

  it('carries the story state, strictly', () => {
    const save = { ...newSave('u1', T0), story: { flags: ['a'], leads: ['b'], files: { 'f-1': [0, 2] }, anomalies: { x: true }, seen: ['s'] } }
    expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
    expect(() => parseSave({ ...save, story: { ...save.story, extra: 1 } })).toThrow(SaveParseError)
    expect(() => parseSave({ ...save, story: { ...save.story, anomalies: { x: 'open' } } })).toThrow(/true or false/)
  })

  it('round-trips through JSON', () => {
    const save = newSave('u1', T0)
    expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
  })

  it('never moves updatedAt while parsing', () => {
    expect(parseSave(touched(newSave('u1', T0), T1)).account.updatedAt).toBe(T1)
  })
})

describe('the conflict rule (uma-rpg D32)', () => {
  const older = newSave('u1', T0)
  const newer = touched(older, T1)
  it('keeps the save changed last, whole', () => {
    expect(resolveConflict(older, newer)).toBe(newer)
    expect(resolveConflict(newer, older)).toBe(newer)
  })
  it("keeps this device's on a tie", () => {
    const other = newSave('u1', T0)
    expect(resolveConflict(older, other)).toBe(older)
  })
})

describe('parsing', () => {
  it('refuses unknown keys, so an older client never half-writes a newer save', () => {
    expect(() => parseSave({ ...newSave('u1', T0), gold: 5 })).toThrow(/unknown keys gold/)
    expect(() => parseSave({ version: 1, account: { ...newSave('u1', T0).account, name: 'x' } })).toThrow(/save\.account: unknown keys name/)
  })
  it('refuses a version newer than this app', () => {
    expect(() => parseSave({ version: 3, account: newSave('u1', T0).account })).toThrow(/newer than this app/)
  })
  it('refuses a missing or broken version', () => {
    expect(() => parseSave({ account: newSave('u1', T0).account })).toThrow(SaveParseError)
    expect(() => parseSave(null)).toThrow(SaveParseError)
  })
  it('refuses bad dates and an empty uid, naming the path', () => {
    expect(() => parseSave({ version: 1, account: { uid: 'u1', createdAt: 'soon', updatedAt: T0 } })).toThrow('save.account.createdAt')
    expect(() => parseSave({ version: 1, account: { uid: '', createdAt: T0, updatedAt: T0 } })).toThrow('save.account.uid')
  })
  it('reads the version a value claims', () => {
    expect(versionOf({ version: 1 })).toBe(1)
    expect(versionOf({ version: '1' })).toBe(0)
    expect(versionOf(null)).toBe(0)
  })
  it('parses an upload with the version sent', () => {
    const put = parseSavePut({ baseRevision: 3, save: newSave('u1', T0) })
    expect(put).toEqual({ baseRevision: 3, save: newSave('u1', T0), sentVersion: 2 })
    expect(() => parseSavePut({ baseRevision: -1, save: newSave('u1', T0) })).toThrow('body.baseRevision')
    expect(() => parseSavePut({ baseRevision: 0, save: newSave('u1', T0), extra: 1 })).toThrow(/unknown keys extra/)
  })
  it('parses the envelope the API returns, empty or full', () => {
    expect(parseSaveEnvelope({ revision: 0, save: null })).toEqual({ revision: 0, save: null })
    expect(parseSaveEnvelope({ revision: 2, save: newSave('u1', T0) })).toEqual({ revision: 2, save: newSave('u1', T0) })
  })
})
