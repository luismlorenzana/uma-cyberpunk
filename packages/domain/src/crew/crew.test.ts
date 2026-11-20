import { capacityOf, loadOf, type Bands, type Role } from '@cyber/battle'
import { describe, expect, it } from 'vitest'
import {
  afterMission, bandsOf, bestRig, bestStyle, changeRole, defaultRole, levelOf, newMember, rigStats, ROLES, savePreset, wearPreset, type OutfitInfo,
} from './crew'
import { BACK_ROLE, loadoutOf, PARTS_BY_ID, ROLE_BACK, STARTER_PARTS, type Rig } from './parts'
import { STAND_IN_OUTFITS } from './stand-in'

const grades = (front: string, pace: string, late: string, end: string) => ({ front, pace, late, end }) as OutfitInfo['strategy']
const info = (strategy: OutfitInfo['strategy']): OutfitInfo => ({ stats: { speed: 110, stamina: 110, power: 110, guts: 110, wit: 110 }, strategy })
const BANDS: Bands[] = [1, 2, 3, 4, 5].flatMap((p) => [1, 3, 5].map((s) => ({ speed: s as Bands['speed'], stamina: 3, power: p as Bands['power'], guts: 3, wit: 3 })))

describe('the bands from 5★ stats (TC4)', () => {
  it('maps each stat on the thresholds 70, 90, 110, 130 and 150', () => {
    expect(bandsOf({ speed: 69, stamina: 90, power: 129, guts: 130, wit: 150 })).toEqual({ speed: 1, stamina: 2, power: 3, guts: 4, wit: 5 })
  })
  it('gives every stand-in outfit 550 at 5★ and her own spread', () => {
    for (const o of Object.values(STAND_IN_OUTFITS)) expect(Object.values(o.stats).reduce((a, b) => a + b, 0)).toBe(550)
    expect(bandsOf(STAND_IN_OUTFITS[9000003]!.stats)).toEqual({ speed: 2, stamina: 3, power: 4, guts: 2, wit: 1 })
  })
})

describe('the default role (TC5) and Stride (TC46)', () => {
  it('takes the story tag first', () => expect(defaultRole('medic', info(grades('A', 'G', 'G', 'G')))).toBe('medic'))
  it('else the best running style: Front Striker, Pace Vanguard, Late Gunner, End Netrunner', () => {
    expect(defaultRole(undefined, info(grades('A', 'B', 'C', 'D')))).toBe('striker')
    expect(defaultRole(undefined, info(grades('C', 'A', 'B', 'D')))).toBe('vanguard')
    expect(defaultRole(undefined, info(grades('C', 'B', 'S', 'D')))).toBe('gunner')
    expect(defaultRole(undefined, info(grades('G', 'G', 'G', 'A')))).toBe('netrunner')
  })
  it('breaks ties toward the earlier style', () => {
    expect(bestStyle(grades('B', 'A', 'A', 'A'))).toBe('pace')
    expect(bestStyle(grades('C', 'C', 'C', 'C'))).toBe('front')
    expect(defaultRole(undefined, info(grades('E', 'E', 'A', 'A')))).toBe('gunner')
  })
  it('is Striker with nothing known', () => expect(defaultRole(undefined, null)).toBe('striker'))
})

describe('Capacity and the light rig, through @cyber/battle (TC18)', () => {
  const rig: Rig = { core: 'core-frame', leftArm: 'arm-standard', rightArm: 'arm-standard', legs: 'legs-standard', back: 'back-thruster', visor: 'visor-basic', leftHand: null, rightHand: 'hand-blade', coat: 'coat-p' }
  it('adds the parts up and reads Capacity from Power, the Core and the Back unit', () => {
    const s = rigStats(rig, { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 })
    expect([s.load, s.capacity, s.left, s.over]).toEqual([14, 16, 2, false])
    const heavy = rigStats({ ...rig, core: 'core-harness', back: 'back-bulwark' }, { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 })
    expect([heavy.load, heavy.capacity]).toEqual([17, 24])
  })
  it('gives +1 Move at 70% load or less, and not above', () => {
    const b: Bands = { speed: 3, stamina: 3, power: 5, guts: 3, wit: 3 } // Capacity 20: light at 14 or less
    const light = rigStats(rig, b)
    expect([light.load, light.light, light.move]).toEqual([14, true, 5])
    const heavier = rigStats({ ...rig, legs: 'legs-runner' }, b)
    expect([heavier.load, heavier.light, heavier.move]).toEqual([15, false, 5]) // runner legs +1, no light bonus
  })
  it('names why she can\'t deploy: over Capacity, or a two-handed weapon with a full left hand', () => {
    const b: Bands = { speed: 3, stamina: 3, power: 1, guts: 3, wit: 3 }
    expect(rigStats({ ...rig, core: 'core-harness', legs: 'legs-anchor', leftHand: 'hand-tower' }, b).problem).toMatch(/Load 21 is over Capacity 16/)
    expect(rigStats({ ...rig, rightHand: 'hand-greatblade', leftHand: 'hand-buckler' }, b).problem).toMatch(/two-handed/)
  })
  it('shows a weapon\'s hit and damage before a swap', () => {
    const s = rigStats({ ...rig, rightHand: 'hand-rifle' }, { speed: 3, stamina: 3, power: 3, guts: 3, wit: 4 })
    expect(s.weapons).toEqual([
      { mount: 'Right hand', name: 'Laser rifle', band: 'short', hit: 87, damage: 6, hits: 3 },
    ])
    expect(s.problem).toBeNull()
    expect(rigStats({ ...rig, rightHand: 'hand-rifle', leftHand: 'hand-buckler' }, { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 }).problem).toMatch(/two-handed/)
  })
})

describe('best for her role (TC18)', () => {
  it('is never over Capacity and always carries her role\'s Back unit, at every band', () => {
    for (const role of ROLES) for (const b of BANDS) {
      const rig = bestRig(role, b)
      const loadout = loadoutOf(rig)
      expect(loadOf(loadout), `${role} ${JSON.stringify(b)}`).toBeLessThanOrEqual(capacityOf({ bands: b, loadout }))
      const back = PARTS_BY_ID.get(rig.back!)
      expect(back?.slot === 'back' && BACK_ROLE[back.kind]).toBe(role)
      expect(rigStats(rig, b).problem).toBeNull()
      expect(rigStats(rig, b).weapons.some((w) => w.mount !== 'Back unit')).toBe(true)
    }
  }, 15_000) // Exhaustive role/band search can exceed five seconds on shared CI runners.
  it('suits the role: a Vanguard takes a shield, a Striker a melee weapon, a Gunner an Aim visor', () => {
    const b: Bands = { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 }
    const hand = (r: Rig) => [r.leftHand, r.rightHand].map((h) => (h ? PARTS_BY_ID.get(h) : undefined))
    expect(hand(bestRig('vanguard', b)).some((p) => p?.slot === 'hand' && p.item.kind === 'shield')).toBe(true)
    expect(hand(bestRig('striker', b)).some((p) => p?.slot === 'hand' && p.item.kind === 'weapon' && p.item.band === 'melee')).toBe(true)
    expect(bestRig('gunner', b).visor).toBe('visor-aim')
  })
  it('is the same every time', () => expect(bestRig('medic', { speed: 2, stamina: 4, power: 2, guts: 3, wit: 5 })).toEqual(bestRig('medic', { speed: 2, stamina: 4, power: 2, guts: 3, wit: 5 })))
})

describe('the crew record', () => {
  it('has about thirty starter parts with unique ids, every role\'s Back unit among them', () => {
    expect(STARTER_PARTS.length).toBeGreaterThanOrEqual(30)
    expect(new Set(STARTER_PARTS.map((p) => p.id)).size).toBe(STARTER_PARTS.length)
    for (const role of ROLES) expect(PARTS_BY_ID.get(ROLE_BACK[role])?.slot).toBe('back')
  })
  it('swaps the Back unit on a role change, keeping the rest', () => {
    const b: Bands = { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 }
    const rig = bestRig('striker', b)
    const m = { ...newMember(1), rig }
    const changed = changeRole(m, 'medic', rig)
    expect(changed.role).toBe('medic')
    expect(changed.rig).toEqual({ ...rig, back: 'back-med' })
    expect(changeRole({ ...newMember(1) }, 'gunner', rig).rig).toBeNull() // still "best for her role"
    const gunner = { ...newMember(1), rig: { ...rig, back: 'back-mortar' } }
    expect(changeRole(gunner, 'gunner', gunner.rig).rig?.back).toBe('back-mortar')
  })
  it('keeps three named loadouts', () => {
    const rig = bestRig('vanguard', { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 })
    let m = newMember(1)
    for (let i = 0; i < 4; i++) m = savePreset(m, i, `  Plan ${i}  `, rig)
    expect(m.presets.map((p) => p.name)).toEqual(['Plan 0', 'Plan 1', 'Plan 2'])
    expect(savePreset(m, 1, '', rig).presets[1]!.name).toBe('Loadout 2')
    expect(wearPreset(m, 2).rig).toEqual(rig)
  })
  it('adds Strain and XP after a mission; a rest at 3 clears it and earns half (TC27)', () => {
    const crew = [{ ...newMember(1), strain: 2 }, { ...newMember(2), strain: 3 }, { ...newMember(3), strain: 1 }]
    const after = afterMission(crew, [1], 101)
    expect(after.map((m) => [m.strain, m.xp])).toEqual([[3, 101], [0, 50], [1, 50]])
    expect(afterMission(after, [1], 0)[0]!.strain).toBe(3)
  })
  it('levels at a hundred XP each, to 50', () => expect([levelOf(0), levelOf(99), levelOf(100), levelOf(1e6)]).toEqual([1, 1, 2, 50]))
})

describe('every role', () => it('is one of five', () => expect(ROLES satisfies readonly Role[]).toHaveLength(5)))
