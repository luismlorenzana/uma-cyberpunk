// The bands, the map format, the rig and its loadout, and the timeline (CY4). Invented stand-ins only.
import { describe, expect, it } from 'vitest'
import { applyBattleAction, createBattle, startBattle } from './battle'
import { battle, OPEN, RIG, S, unit, W, YARD } from './fixtures'
import { BattleInputError, parseMap } from './map'
import { armed, capacityOf, isLight, loadOf, maxHpOf, moveOf } from './rig'
import { timeline, upcomingAfter } from './timeline'
import { bandOf, TUNING } from './tuning'
import type { BattleState, UnitInput } from './types'

const errorPath = (fn: () => unknown): string => {
  try {
    fn()
  } catch (e) {
    if (e instanceof BattleInputError) return e.path
    throw e
  }
  throw new Error('no error')
}

describe('bands', () => {
  it('turns a 5★ stat into its band at 70, 90, 110, 130 and 150', () => {
    expect([0, 69, 70, 89, 90, 110, 129, 130, 149, 150, 400].map(bandOf)).toEqual([1, 1, 1, 1, 2, 3, 3, 4, 4, 5, 5])
  })
})

describe('the map format', () => {
  it('parses a good map', () => expect(parseMap(YARD)).toEqual(YARD))
  it('names the path of what is wrong', () => {
    expect(errorPath(() => parseMap({ ...YARD, width: 5 }))).toBe('map.width')
    expect(errorPath(() => parseMap({ ...YARD, heights: YARD.heights.map((r, y) => (y === 3 ? `4${r.slice(1)}` : r)) }))).toBe('map.heights[3][0]')
    expect(errorPath(() => parseMap({ ...YARD, tiles: YARD.tiles.map((r, y) => (y === 2 ? `${r.slice(0, 9)}x` : r)) }))).toBe('map.tiles[2][9]')
    expect(errorPath(() => parseMap({ ...YARD, spawns: { ...YARD.spawns, squad: YARD.spawns.squad.slice(0, 4) } }))).toBe('map.spawns.squad')
    expect(errorPath(() => parseMap({ ...YARD, spawns: { ...YARD.spawns, enemy: [[4, 4]] } }))).toBe('map.spawns.enemy[0]')
    expect(errorPath(() => parseMap({ ...YARD, spawns: { ...YARD.spawns, enemy: [[1, 8]] } }))).toBe('map.spawns')
    expect(errorPath(() => parseMap({ ...YARD, extra: 1 }))).toBe('map')
  })
})

describe('the rig and its loadout', () => {
  const vanguard = unit('v', 'squad', 0, { loadout: RIG.vanguard() })
  it('adds Load against Capacity: 10 + 2 a Power band + the Core and Back bonuses', () => {
    expect(loadOf(vanguard.loadout)).toBe(23)
    expect(capacityOf(vanguard)).toBe(24)
    expect(capacityOf({ ...vanguard, bands: { ...vanguard.bands, power: 5 } })).toBe(28)
  })
  it('refuses a unit over Capacity, naming it', () => {
    const heavy = unit('h', 'squad', 0, { loadout: { ...RIG.vanguard(), core: { load: 6 } } })
    expect(errorPath(() => createBattle(battle([heavy, unit('e', 'enemy', 0)])))).toBe('units[0].loadout')
  })
  it('gives a light rig +1 Move at 70% load or less', () => {
    const light = unit('l', 'squad', 0, { loadout: { ...RIG.striker(), back: { kind: 'none', load: 0 } } })
    expect(isLight(light)).toBe(true) // 11 of 16
    expect(isLight(unit('s', 'squad', 0))).toBe(false) // 13 of 16
    const hp = maxHpOf(light)
    expect(moveOf(light, { hp })).toBe(TUNING.move[3] + 1)
  })
  it('sets part HP from Stamina: base + a band each, from the tuning table', () => {
    const hp = (p: 'core' | 'leftArm' | 'legs') => TUNING.partHp[p].base + 2 * TUNING.partHp[p].perBand
    expect(maxHpOf(unit('a', 'squad', 0, { bands: { ...unit('a', 'squad', 0).bands, stamina: 2 } }))).toEqual({ core: hp('core'), leftArm: hp('leftArm'), rightArm: hp('leftArm'), legs: hp('legs') })
  })
  it('takes away what each broken part carries (TC17)', () => {
    const u: UnitInput = unit('u', 'squad', 0, { loadout: RIG.brawler() })
    const whole = { core: 60, leftArm: 30, rightArm: 30, legs: 38 }
    expect(armed(u, { hp: whole, ammo: 0 }, 'left')?.weapon).toBe(W.blade)
    expect(armed(u, { hp: { ...whole, leftArm: 0 }, ammo: 0 }, 'left')).toBeNull()
    expect(armed(u, { hp: { ...whole, leftArm: 0 }, ammo: 0 }, 'right')?.weapon).toBe(W.knuckles)
    expect(armed(u, { hp: { ...whole, leftArm: 0, rightArm: 0 }, ammo: 0 }, 'right')).toBeNull()
    const two = unit('t', 'squad', 0, { loadout: { ...RIG.striker(), rightHand: W.greatblade } })
    expect(armed(two, { hp: whole, ammo: 0 }, 'right')).toEqual({ weapon: W.greatblade, halfAccuracy: false })
    expect(armed(two, { hp: { ...whole, leftArm: 0 }, ammo: 0 }, 'right')).toEqual({ weapon: W.greatblade, halfAccuracy: true })
    expect(moveOf(u, { hp: { ...whole, legs: 0 } })).toBe(1)
  })
  it('refuses a two-handed weapon over a full left hand and a Long weapon in a hand', () => {
    const both = unit('t', 'squad', 0, { loadout: { ...RIG.striker(), rightHand: W.greatblade, leftHand: S.buckler } })
    expect(errorPath(() => createBattle(battle([both, unit('e', 'enemy', 0)])))).toBe('units[0].loadout.leftHand')
    const long = unit('t', 'squad', 0, { loadout: { ...RIG.striker(), rightHand: W.missiles } })
    expect(errorPath(() => createBattle(battle([long, unit('e', 'enemy', 0)])))).toBe('units[0].loadout.rightHand')
  })
})

describe('the battle input', () => {
  it('refuses an unknown rules version, a bad objective and a doubled spawn', () => {
    const units = [unit('a', 'squad', 0), unit('e', 'enemy', 0)]
    expect(errorPath(() => createBattle({ ...battle(units), rulesVersion: 6 }))).toBe("rulesVersion")
    expect(errorPath(() => createBattle(battle(units, { objective: { kind: 'defeatLeader' } })))).toBe('objective')
    expect(errorPath(() => createBattle(battle(units, { objective: { kind: 'reach', tile: [9, 9] } })))).toBe('objective.tile')
    expect(errorPath(() => createBattle(battle([...units, unit('b', 'squad', 0)])))).toBe('units[2].spawn')
  })
})

describe('the timeline', () => {
  const fast = unit('fast', 'squad', 0, { bands: { speed: 5, stamina: 3, power: 3, guts: 3, wit: 3 } })
  const slow = unit('slow', 'enemy', 0, { bands: { speed: 1, stamina: 3, power: 3, guts: 3, wit: 3 } })
  const mid = unit('mid', 'enemy', 1, { bands: { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 } })
  it('fills clocks by Speed: the fast unit goes first and more often', () => {
    const state = createBattle(battle([fast, slow, mid]))
    expect(state.active).toBe('fast')
    const line = timeline(state)
    expect(line).toHaveLength(8)
    expect(line.filter((id) => id === 'fast').length).toBeGreaterThan(line.filter((id) => id === 'slow').length)
  })
  it('counts a round as 100 ticks, one turn at Speed band 3', () => {
    const { cues } = startBattle(battle([unit('a', 'squad', 0), unit('e', 'enemy', 0, { bands: { speed: 1, stamina: 3, power: 3, guts: 3, wit: 3 } })]))
    expect(cues[0]).toEqual({ kind: 'turnStarted', unit: 'a', round: 1 })
  })
  it('breaks ties by Speed band, then by the seed, the same way every time', () => {
    const a = unit('a', 'squad', 0), b = unit('b', 'enemy', 0)
    const first = createBattle(battle([a, b], { seed: 's1' })).active
    expect(createBattle(battle([a, b], { seed: 's1' })).active).toBe(first)
    const seeds = Array.from({ length: 20 }, (_, i) => createBattle(battle([a, b], { seed: `s${i}` })).active)
    expect(new Set(seeds).size).toBe(2)
  })
  it('shows the shift a Wait causes: she comes back sooner', () => {
    const state = createBattle(battle([unit('a', 'squad', 0), unit('b', 'enemy', 0), unit('c', 'enemy', 1)]))
    const after = upcomingAfter(state, 0)
    const waited = upcomingAfter(state, TUNING.waitClock)
    expect(waited.indexOf(state.active!)).toBeLessThan(after.indexOf(state.active!))
    const next = applyBattleAction(state, { kind: 'turn', unit: state.active!, act: { kind: 'wait' }, face: 'N' }).state
    expect(next.units.find((u) => u.id === state.active)!.clock).toBeGreaterThanOrEqual(TUNING.waitClock)
  })
})

describe('Charge', () => {
  it('starts at 1, gains 1 a turn, caps at 3, and a Wait adds 1 more', () => {
    let state: BattleState = createBattle(battle([unit('a', 'squad', 0, { bands: { speed: 5, stamina: 3, power: 3, guts: 3, wit: 3 } }), unit('e', 'enemy', 0, { bands: { speed: 1, stamina: 3, power: 3, guts: 3, wit: 3 } })]))
    const charge = () => state.units.find((u) => u.id === 'a')!.charge
    expect(charge()).toBe(2)
    const r = applyBattleAction(state, { kind: 'turn', unit: 'a', act: { kind: 'wait' }, face: 'N' })
    state = r.state
    expect(r.cues).toContainEqual({ kind: 'charge', unit: 'a', from: 2, to: 3, why: 'wait' })
    while (state.active !== 'a') state = applyBattleAction(state, { kind: 'turn', unit: state.active!, act: { kind: 'none' }, face: 'S' }).state
    expect(charge()).toBe(3)
  })
  it('toggles the link as a free action on her own turn only', () => {
    const state = createBattle(battle([unit('a', 'squad', 0, { bands: { speed: 5, stamina: 3, power: 3, guts: 3, wit: 3 } }), unit('e', 'enemy', 0)]))
    const r = applyBattleAction(state, { kind: 'link', unit: 'a', on: false })
    expect(r.error).toBeNull()
    expect(r.state.units[0]!.link).toBe(false)
    expect(r.state.active).toBe('a')
    expect(applyBattleAction(state, { kind: 'link', unit: 'e', on: false }).error).toMatch(/not e's turn/)
  })
})

describe('illegal actions', () => {
  it('return an error and change nothing', () => {
    const state = createBattle(battle([unit('a', 'squad', 0, { bands: { speed: 5, stamina: 3, power: 3, guts: 3, wit: 3 } }), unit('e', 'enemy', 0)], { map: OPEN }))
    for (const action of [
      { kind: 'turn', unit: 'e', act: { kind: 'none' }, face: 'N' },
      { kind: 'turn', unit: 'a', to: [0, 0], act: { kind: 'none' }, face: 'N' },
      { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' },
      { kind: 'turn', unit: 'a', act: { kind: 'none' }, face: 'X' },
    ] as const) {
      const r = applyBattleAction(state, action as never)
      expect(r.error).not.toBeNull()
      expect(r.state).toBe(state)
      expect(r.cues).toEqual([])
    }
  })
})
