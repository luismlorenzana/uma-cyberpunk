import { describe, expect, it } from 'vitest'
import { STARTER_STOCK } from '../cabins/items'
import { HULL_TUNING, shipWith } from '../ship/hull'
import { newSave, parseSave, parseSaveEnvelope, parseSavePut, resolveConflict, SAVE_VERSION, SaveParseError, touched, versionOf } from './save'

const T0 = '2026-11-08T12:00:00.000Z'
const T1 = '2026-11-08T12:05:00.000Z'

const EMPTY = { flags: [], leads: [], files: {}, anomalies: {}, seen: [] }
const V3_REST = { crew: [], ship: { rooms: ['bridge', 'hangar', 'quarters', 'log'] }, worlds: { current: null, known: {}, missions: [] }, mission: null }
const V5_REST = { ...V3_REST, captain: { name: 'Captain', pronouns: 'they', romance: 'ask', named: false }, watch: 0, inbox: [] }
const V6_REST = { ...V5_REST, items: { ...STARTER_STOCK }, visits: { watch: 0, used: 0 } }
const V7_REST = { ...V6_REST, ship: shipWith(['bridge', 'hangar', 'quarters', 'log', 'engineering']), wallet: HULL_TUNING.starterWallet }
const BOND = { rank: 1, rapport: 0, path: null, seen: [] }
const CABIN = { slots: { bed: null, desk: null, wall: null, floor: null, light: null, keepsake: null }, revealed: [], request: null }

describe('the save', () => {
  it('is version 7', () => expect(SAVE_VERSION).toBe(7))

  it('starts an account with both dates at now, an empty story, no crew and the rooms open from the start', () => {
    expect(newSave('u1', T0)).toEqual({ version: 7, account: { uid: 'u1', createdAt: T0, updatedAt: T0 }, story: EMPTY, ...V7_REST })
  })

  it('moves only updatedAt on a change', () => {
    const save = newSave('u1', T0)
    expect(touched(save, T1)).toEqual({ version: 7, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story: EMPTY, ...V7_REST })
    expect(save.account.updatedAt).toBe(T0)
  })

  it('opens a v1 save as v3 with account.updatedAt unchanged (CY9, CY10)', () => {
    const v1 = { version: 1, account: { uid: 'u1', createdAt: T0, updatedAt: T1 } }
    expect(parseSave(v1)).toEqual({ version: 7, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story: EMPTY, ...V7_REST })
  })

  it('opens a v2 save as v3: the same account and story, the new fields empty (the migration, CY10)', () => {
    const story = { flags: ['a'], leads: [], files: {}, anomalies: {}, seen: ['s1'] }
    const v2 = { version: 2, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, story }
    expect(parseSave(v2)).toEqual({ version: 7, account: v2.account, story, ...V7_REST })
  })

  it('opens a v3 save as v4: each outfit id aboard becomes her record, the rest and updatedAt as they were (CY11)', () => {
    const { captain: _cap, watch: _wat, inbox: _inb, items: _ite, visits: _vis, wallet: _wal, ...v5base } = newSave('u1', T0)
    const v3 = {
      ...v5base, version: 3, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, crew: [9000003, 9000001],
      ship: { rooms: ['bridge', 'hangar', 'quarters', 'log', 'comms'] }, worlds: { current: 'sw1', known: { sw1: { cleared: [] } }, missions: ['m1'] },
      mission: { id: 'm2', chapter: 'c1', step: 'battle', squad: [9000001], battle: { input: { seed: 'x' }, actions: [] }, won: null },
    }
    const v5 = parseSave(JSON.parse(JSON.stringify(v3)))
    expect(v5.version).toBe(7)
    expect(v5.account.updatedAt).toBe(T1)
    expect(v5.crew).toEqual([
      { outfit: 9000003, xp: 0, role: null, rig: null, presets: [], strain: 0, bond: BOND, cabin: CABIN },
      { outfit: 9000001, xp: 0, role: null, rig: null, presets: [], strain: 0, bond: BOND, cabin: CABIN },
    ])
    expect(v5.ship.modules.map((m) => m.id)).toEqual(['bridge', 'log', 'comms', 'engineering', 'hangar', 'quarters'])
    const { captain: _c, watch: _w, inbox: _i, items: _it, visits: _v, wallet: _wa, ship: _s, ...rest } = v5
    expect({ ...rest, crew: v3.crew, version: 3, ship: v3.ship }).toEqual(v3)
  })

  it('opens a v4 save as v5: a default captain to name, watch 0, an empty inbox, every Uma at bond rank 1, updatedAt as it was (CY13)', () => {
    const { captain: _c, watch: _w, inbox: _i, items: _it, visits: _v, wallet: _wa, ...base } = newSave('u1', T0)
    const v4 = { ...base, ship: { rooms: ['bridge', 'hangar', 'quarters', 'log'] }, version: 4, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, crew: [{ outfit: 9000001, xp: 120, role: 'striker', rig: null, presets: [], strain: 2 }] }
    const v5 = parseSave(JSON.parse(JSON.stringify(v4)))
    expect(v5).toMatchObject({ version: 7, account: { updatedAt: T1 }, captain: V5_REST.captain, watch: 0, inbox: [] })
    expect(v5.crew[0]).toEqual({ ...v4.crew[0], bond: BOND, cabin: CABIN })
  })

  it('opens a v5 save as v6: every cabin empty, the starter kit, no visits used this watch, updatedAt as it was (CY14)', () => {
    const { items: _it, visits: _v, wallet: _wa, ...base } = newSave('u1', T0)
    const v5 = { ...base, ship: { rooms: ['bridge', 'hangar', 'quarters', 'log'] }, version: 5, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, watch: 4, crew: [{ outfit: 9000001, xp: 120, role: 'striker', rig: null, presets: [], strain: 2, bond: { rank: 3, rapport: 10, path: null, seen: [2] } }] }
    const v6 = parseSave(JSON.parse(JSON.stringify(v5)))
    expect(v6).toMatchObject({ version: 7, account: { updatedAt: T1 }, watch: 4, items: STARTER_STOCK, visits: { watch: 4, used: 0 } })
    expect(v6.crew[0]).toEqual({ ...v5.crew[0], cabin: CABIN })
  })

  it('opens a v6 save as v7: the open rooms and Engineering on two decks at level 1, the starter wallet, updatedAt as it was (CY15)', () => {
    const { wallet: _wa, ...base } = newSave('u1', T0)
    const v6 = { ...base, version: 6, account: { uid: 'u1', createdAt: T0, updatedAt: T1 }, ship: { rooms: ['bridge', 'hangar', 'quarters', 'log', 'store', 'comms', 'simpod'] } }
    const v7 = parseSave(JSON.parse(JSON.stringify(v6)))
    expect(v7).toMatchObject({ version: 7, account: { updatedAt: T1 }, wallet: HULL_TUNING.starterWallet })
    expect(v7.ship.decks).toBe(2)
    expect(v7.ship.modules).toHaveLength(8)
    expect(v7.ship.modules.every((m) => m.level === 1 && m.building === null)).toBe(true)
    expect(v7.ship.research).toEqual({ done: [], current: null })
  })

  it('leaves a v7 save as it is, a mission in progress, a crew record, her bond, her cabin, a build and research included', () => {
    const rig = { core: 'core-frame', leftArm: 'arm-standard', rightArm: 'arm-standard', legs: 'legs-standard', back: 'back-thruster', visor: 'visor-basic', leftHand: null, rightHand: 'hand-blade', coat: 'coat-p' }
    const v4 = {
      ...newSave('u1', T0), captain: { name: 'Rin', pronouns: 'she', romance: 'friends', named: true }, watch: 7, inbox: [9000001],
      crew: [{ outfit: 9000001, xp: 120, role: 'striker', rig, presets: [{ name: 'Fast', rig }], strain: 2, bond: { rank: 8, rapport: 40, path: 'trust', seen: [2, 4, 6, 8] },
        cabin: { slots: { ...CABIN.slots, bed: 'cozy-bed', keepsake: 'keepsake-photo' }, revealed: ['gift', 'topic:racing'], request: 'light' } }],
      items: { 'cozy-bed': 1, 'gift-buns': 3 }, visits: { watch: 7, used: 2 }, wallet: { credits: 120, alloy: 4, data: 15 },
      ship: { ...shipWith(['bridge', 'hangar', 'quarters', 'log', 'comms', 'engineering']), powered: ['battery'], research: { done: ['reactor-1'], current: { id: 'hull-1', left: 2 } },
        modules: [...shipWith(['bridge', 'hangar', 'quarters', 'log', 'comms', 'engineering']).modules, { id: 'galley', deck: 1, slot: 3, level: 0, building: { level: 1, left: 2 } }] },
      worlds: { current: 'sw1', known: { sw1: { cleared: ['sw1-docks'] } }, missions: ['m1'] },
      mission: { id: 'm2', chapter: 'c1', step: 'battle', squad: [9000001], battle: { input: { seed: 'x' }, actions: [{ kind: 'turn' }] }, won: null },
    }
    expect(parseSave(JSON.parse(JSON.stringify(v4)))).toEqual(v4)
    expect(() => parseSave({ ...v4, ship: { ...v4.ship, modules: [...v4.ship.modules, { id: 'spa', deck: 1, slot: 4, level: 1, building: null }] } })).toThrow(/expected a module/)
    expect(() => parseSave({ ...v4, ship: { ...v4.ship, modules: [...v4.ship.modules, { id: 'lab', deck: 0, slot: 0, level: 1, building: null }] } })).toThrow(/overlaps/)
    expect(() => parseSave({ ...v4, ship: { ...v4.ship, modules: [...v4.ship.modules, { id: 'lab', deck: 1, slot: 4, level: 0, building: null }] } })).toThrow(/level 0 only while building/)
    expect(() => parseSave({ ...v4, ship: { ...v4.ship, powered: ['bridge'] } })).toThrow(/battle system/)
    expect(() => parseSave({ ...v4, ship: { ...v4.ship, decks: 9 } })).toThrow(/decks/)
    expect(() => parseSave({ ...v4, wallet: { credits: -1, alloy: 0, data: 0 } })).toThrow(/wallet.credits/)
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
    expect(() => parseSave({ ...v4, crew: [{ ...member, cabin: { ...member.cabin, slots: { ...member.cabin.slots, bed: 'cozy-rug' } } }] })).toThrow(/slots.bed: expected a bed item/)
    expect(() => parseSave({ ...v4, crew: [{ ...member, cabin: { ...member.cabin, revealed: ['secrets'] } }] })).toThrow(/revealed/)
    expect(() => parseSave({ ...v4, crew: [{ ...member, cabin: { ...member.cabin, request: 'keepsake' } }] })).toThrow(/request/)
    expect(() => parseSave({ ...v4, items: { 'gold-bar': 1 } })).toThrow(/expected an item/)
    expect(() => parseSave({ ...v4, items: { 'cozy-bed': 0 } })).toThrow(/1–9999/)
    expect(() => parseSave({ ...v4, visits: { watch: 1 } })).toThrow(/visits/)
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
    expect(() => parseSave({ version: 8, account: newSave('u1', T0).account })).toThrow(/newer than this app/)
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
    expect(put).toEqual({ baseRevision: 3, save: newSave('u1', T0), sentVersion: 7 })
    expect(() => parseSavePut({ baseRevision: -1, save: newSave('u1', T0) })).toThrow('body.baseRevision')
    expect(() => parseSavePut({ baseRevision: 0, save: newSave('u1', T0), extra: 1 })).toThrow(/unknown keys extra/)
  })
  it('parses the envelope the API returns, empty or full', () => {
    expect(parseSaveEnvelope({ revision: 0, save: null })).toEqual({ revision: 0, save: null })
    expect(parseSaveEnvelope({ revision: 2, save: newSave('u1', T0) })).toEqual({ revision: 2, save: newSave('u1', T0) })
  })
})
