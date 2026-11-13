import { describe, expect, it } from 'vitest'
import { newSave, parseSave, parseSaveEnvelope, parseSavePut, resolveConflict, SAVE_VERSION, SaveParseError, touched, versionOf } from './save'

const T0 = '2026-11-08T12:00:00.000Z'
const T1 = '2026-11-08T12:05:00.000Z'

const EMPTY = { flags: [], leads: [], files: {}, anomalies: {}, seen: [] }
const V3_REST = { crew: [], ship: { rooms: ['bridge', 'hangar', 'quarters', 'log'] }, worlds: { current: null, known: {}, missions: [] }, mission: null }

describe('save v3', () => {
  it('is version 3', () => expect(SAVE_VERSION).toBe(3))

  it('starts an account with both dates at now, an empty story, no crew and the rooms open from the start', () => {
    expect(newSave('u1', T0)).toEqual({ version: 3, account: { uid: 'u1', createdAt: T0, updatedAt: T0 }, story: EMPTY, ...V3_REST })
  })

  it('moves only updatedAt on a change', () => {
    const save = newSave('u1', T0)
    expect(touched(save, T1)).toEqual({ version: 3, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story: EMPTY, ...V3_REST })
    expect(save.account.updatedAt).toBe(T0)
  })

  it('opens a v1 save as v3 with account.updatedAt unchanged (CY9, CY10)', () => {
    const v1 = { version: 1, account: { uid: 'u1', createdAt: T0, updatedAt: T1 } }
    expect(parseSave(v1)).toEqual({ version: 3, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story: EMPTY, ...V3_REST })
  })

  it('opens a v2 save as v3: the same account and story, the new fields empty (the migration, CY10)', () => {
    const story = { flags: ['a'], leads: [], files: {}, anomalies: {}, seen: ['s1'] }
    const v2 = { version: 2, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story }
    expect(parseSave(v2)).toEqual({ version: 3, account: v2.account, story, ...V3_REST })
  })

  it('leaves a v3 save as it is, a mission in progress included', () => {
    const v3 = {
      ...newSave('u1', T0), crew: [9000001], ship: { rooms: ['bridge', 'hangar', 'quarters', 'log', 'comms'] },
      worlds: { current: 'sw1', known: { sw1: { cleared: ['sw1-docks'] } }, missions: ['m1'] },
      mission: { id: 'm2', chapter: 'c1', step: 'battle', squad: [9000001], battle: { input: { seed: 'x' }, actions: [{ kind: 'turn' }] }, won: null },
    }
    expect(parseSave(JSON.parse(JSON.stringify(v3)))).toEqual(v3)
    expect(() => parseSave({ ...v3, ship: { rooms: ['spa'] } })).toThrow(/expected a room/)
    expect(() => parseSave({ ...v3, mission: { ...v3.mission, step: 'lunch' } })).toThrow(/mission.step/)
  })

  it('carries the story state, strictly', () => {
    const save = { ...newSave('u1', T0), story: { flags: ['a'], leads: ['b'], files: { 'f-1': [0, 2] }, anomalies: { x: true }, seen: ['s'] } } as ReturnType<typeof newSave>
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
    expect(() => parseSave({ version: 4, account: newSave('u1', T0).account })).toThrow(/newer than this app/)
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
    expect(put).toEqual({ baseRevision: 3, save: newSave('u1', T0), sentVersion: 3 })
    expect(() => parseSavePut({ baseRevision: -1, save: newSave('u1', T0) })).toThrow('body.baseRevision')
    expect(() => parseSavePut({ baseRevision: 0, save: newSave('u1', T0), extra: 1 })).toThrow(/unknown keys extra/)
  })
  it('parses the envelope the API returns, empty or full', () => {
    expect(parseSaveEnvelope({ revision: 0, save: null })).toEqual({ revision: 0, save: null })
    expect(parseSaveEnvelope({ revision: 2, save: newSave('u1', T0) })).toEqual({ revision: 2, save: newSave('u1', T0) })
  })
})
