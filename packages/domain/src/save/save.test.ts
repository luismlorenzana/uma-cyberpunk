import { describe, expect, it } from 'vitest'
import { newSave, parseSave, parseSaveEnvelope, parseSavePut, resolveConflict, SAVE_VERSION, SaveParseError, touched, versionOf } from './save'

const T0 = '2026-11-08T12:00:00.000Z'
const T1 = '2026-11-08T12:05:00.000Z'

const EMPTY = { flags: [], leads: [], files: {}, anomalies: {}, seen: [] }
const V3_REST = { crew: [], ship: { rooms: ['bridge', 'hangar', 'quarters', 'log'] }, worlds: { current: null, known: {}, missions: [] }, mission: null }
const V5_REST = { ...V3_REST, captain: { name: 'Captain', pronouns: 'they', romance: 'ask', named: false }, watch: 0, inbox: [] }
const BOND = { rank: 1, rapport: 0, path: null, seen: [] }

describe('the save', () => {
  it('is version 5', () => expect(SAVE_VERSION).toBe(5))

  it('starts an account with both dates at now, an empty story, no crew and the rooms open from the start', () => {
    expect(newSave('u1', T0)).toEqual({ version: 5, account: { uid: 'u1', createdAt: T0, updatedAt: T0 }, story: EMPTY, ...V5_REST })
  })

  it('moves only updatedAt on a change', () => {
    const save = newSave('u1', T0)
    expect(touched(save, T1)).toEqual({ version: 5, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story: EMPTY, ...V5_REST })
    expect(save.account.updatedAt).toBe(T0)
  })

  it('opens a v1 save as v3 with account.updatedAt unchanged (CY9, CY10)', () => {
    const v1 = { version: 1, account: { uid: 'u1', createdAt: T0, updatedAt: T1 } }
    expect(parseSave(v1)).toEqual({ version: 5, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story: EMPTY, ...V5_REST })
  })

  it('opens a v2 save as v3: the same account and story, the new fields empty (the migration, CY10)', () => {
    const story = { flags: ['a'], leads: [], files: {}, anomalies: {}, seen: ['s1'] }
    const v2 = { version: 2, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story }
    expect(parseSave(v2)).toEqual({ version: 5, account: v2.account, story, ...V5_REST })
  })

  it('opens a v3 save as v4: each outfit id aboard becomes her record, the rest and updatedAt as they were (CY11)', () => {
    const { captain: _cap, watch: _wat, inbox: _inb, ...v5base } = newSave('u1', T0)
    const v3 = {
      ...v5base, version: 3, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, crew: [9000003, 9000001],
      ship: { rooms: ['bridge', 'hangar', 'quarters', 'log', 'comms'] }, worlds: { current: 'sw1', known: { sw1: { cleared: [] } }, missions: ['m1'] },
      mission: { id: 'm2', chapter: 'c1', step: 'battle', squad: [9000001], battle: { input: { seed: 'x' }, actions: [] }, won: null },
    }
    const v5 = parseSave(JSON.parse(JSON.stringify(v3)))
    expect(v5.version).toBe(5)
    expect(v5.account.updatedAt).toBe(T1)
    expect(v5.crew).toEqual([
      { outfit: 9000003, xp: 0, role: null, rig: null, presets: [], strain: 0, bond: BOND },
      { outfit: 9000001, xp: 0, role: null, rig: null, presets: [], strain: 0, bond: BOND },
    ])
    const { captain: _c, watch: _w, inbox: _i, ...rest } = v5
    expect({ ...rest, crew: v3.crew, version: 3 }).toEqual(v3)
  })

  it('opens a v4 save as v5: a default captain to name, watch 0, an empty inbox, every Uma at bond rank 1, updatedAt as it was (CY13)', () => {
    const { captain: _c, watch: _w, inbox: _i, ...base } = newSave('u1', T0)
    const v4 = { ...base, version: 4, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, crew: [{ outfit: 9000001, xp: 120, role: 'striker', rig: null, presets: [], strain: 2 }] }
    const v5 = parseSave(JSON.parse(JSON.stringify(v4)))
    expect(v5).toMatchObject({ version: 5, account: { updatedAt: T1 }, captain: V5_REST.captain, watch: 0, inbox: [] })
    expect(v5.crew[0]).toEqual({ ...v4.crew[0], bond: BOND })
  })

  it('leaves a v5 save as it is, a mission in progress, a crew record and her bond included', () => {
    const rig = { core: 'core-frame', leftArm: 'arm-standard', rightArm: 'arm-standard', legs: 'legs-standard', back: 'back-thruster', visor: 'visor-basic', leftHand: null, rightHand: 'hand-blade', coat: 'coat-p' }
    const v4 = {
      ...newSave('u1', T0), captain: { name: 'Rin', pronouns: 'she', romance: 'friends', named: true }, watch: 7, inbox: [9000001],
      crew: [{ outfit: 9000001, xp: 120, role: 'striker', rig, presets: [{ name: 'Fast', rig }], strain: 2, bond: { rank: 8, rapport: 40, path: 'trust', seen: [2, 4, 6, 8] } }],
      ship: { rooms: ['bridge', 'hangar', 'quarters', 'log', 'comms'] },
      worlds: { current: 'sw1', known: { sw1: { cleared: ['sw1-docks'] } }, missions: ['m1'] },
      mission: { id: 'm2', chapter: 'c1', step: 'battle', squad: [9000001], battle: { input: { seed: 'x' }, actions: [{ kind: 'turn' }] }, won: null },
    }
    expect(parseSave(JSON.parse(JSON.stringify(v4)))).toEqual(v4)
    expect(() => parseSave({ ...v4, ship: { rooms: ['spa'] } })).toThrow(/expected a room/)
    expect(() => parseSave({ ...v4, mission: { ...v4.mission, step: 'lunch' } })).toThrow(/mission.step/)
    const member = v4.crew[0]!
    expect(() => parseSave({ ...v4, crew: [{ ...member, rig: { ...rig, back: 'hand-blade' } }] })).toThrow(/rig.back: expected a back part/)
    expect(() => parseSave({ ...v4, crew: [{ ...member, role: 'pilot' }] })).toThrow(/role/)
    expect(() => parseSave({ ...v4, crew: [{ ...member, strain: 4 }] })).toThrow(/strain/)
    expect(() => parseSave({ ...v4, crew: [member, member] })).toThrow(/already aboard/)
    expect(() => parseSave({ ...v4, crew: [{ ...member, presets: [1, 2, 3, 4] }] })).toThrow(/at most 3/)
    expect(() => parseSave({ ...v4, crew: [{ ...member, bond: { ...member.bond, rank: 11 } }] })).toThrow(/bond.rank/)
    expect(() => parseSave({ ...v4, crew: [{ ...member, bond: { ...member.bond, path: 'crush' } }] })).toThrow(/bond.path/)
    expect(() => parseSave({ ...v4, crew: [{ ...member, bond: { ...member.bond, seen: [3] } }] })).toThrow(/scene rank/)
    expect(() => parseSave({ ...v4, captain: { ...v4.captain, pronouns: 'xe' } })).toThrow(/pronouns/)
    expect(() => parseSave({ ...v4, captain: { ...v4.captain, name: 'x'.repeat(25) } })).toThrow(/captain.name/)
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
    expect(() => parseSave({ version: 6, account: newSave('u1', T0).account })).toThrow(/newer than this app/)
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
    expect(put).toEqual({ baseRevision: 3, save: newSave('u1', T0), sentVersion: 5 })
    expect(() => parseSavePut({ baseRevision: -1, save: newSave('u1', T0) })).toThrow('body.baseRevision')
    expect(() => parseSavePut({ baseRevision: 0, save: newSave('u1', T0), extra: 1 })).toThrow(/unknown keys extra/)
  })
  it('parses the envelope the API returns, empty or full', () => {
    expect(parseSaveEnvelope({ revision: 0, save: null })).toEqual({ revision: 0, save: null })
    expect(parseSaveEnvelope({ revision: 2, save: newSave('u1', T0) })).toEqual({ revision: 2, save: newSave('u1', T0) })
  })
})
