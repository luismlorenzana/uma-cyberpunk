// Movement, line of fire, the damage formula, Guard, counters, Crossfire, Cover, Rig Break and Hold on (CY4).
import { describe, expect, it } from 'vitest'
import { coverFor, crossfireFor, damageOf, strikeOf } from './attack'
import { applyBattleAction } from './battle'
import { RIG, S, W } from './fixtures'
import { reachable } from './move'
import { facingOf, inReach as reachOn, lineOfFire as lineOn } from './sight'
import { mapBoard } from './terrain'
import type { BattleMap, Tile as T, Weapon } from './types'

const lineOfFire = (map: BattleMap, a: T, b: T) => lineOn(mapBoard(map), a, b)
const inReach = (map: BattleMap, w: Weapon, a: T, b: T) => reachOn(mapBoard(map), w, a, b)
import { edit, setup, unitOf } from './test-kit'
import { TUNING } from './tuning'
import type { Cue } from './types'

const flat = (c: string) => Array.from({ length: 8 }, () => c.repeat(8))
const tiles = (r: ReturnType<typeof reachable>) => r.map((x) => `${x.to[0]},${x.to[1]}`).sort()
const kinds = (cues: Cue[]) => cues.map((c) => c.kind)

describe('movement', () => {
  it('reaches Move tiles over flat ground, staying put included', () => {
    const state = setup([{ id: 'a', at: [3, 7] }], [{ id: 'e', at: [7, 0] }])
    const r = reachable(state, 'a')
    expect(r.some((x) => x.to[0] === 3 && x.to[1] === 7 && x.path.length === 1)).toBe(true)
    expect(Math.max(...r.map((x) => x.path.length - 1))).toBe(TUNING.move[3])
  })
  it('climbs or drops one level a step, and broken Legs stay level and move 1', () => {
    const heights = ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00002000']
    const state = setup([{ id: 'a', at: [3, 7] }], [{ id: 'e', at: [7, 0] }], { heights })
    expect(tiles(reachable(state, 'a'))).not.toContain('4,7')
    const terraced = ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00001000']
    const up = setup([{ id: 'a', at: [3, 7] }], [{ id: 'e', at: [7, 0] }], { heights: terraced })
    expect(tiles(reachable(up, 'a'))).toContain('4,7')
    const lame = edit(up, 'a', (u) => { u.hp.legs = 0 })
    expect(tiles(reachable(lame, 'a'))).toEqual(['2,7', '3,6', '3,7'])
  })
  it('stops on entering a tile next to an enemy, and never passes one', () => {
    const state = setup([{ id: 'a', at: [3, 7] }], [{ id: 'e', at: [3, 5] }])
    const r = reachable(state, 'a')
    expect(r.find((x) => x.to[0] === 3 && x.to[1] === 6)).toBeDefined()
    expect(tiles(r)).not.toContain('3,5')
    // 3,4 lies past the enemy: around it would cost more than Move once the zone stops her.
    expect(r.find((x) => x.to[0] === 2 && x.to[1] === 4)).toBeUndefined()
  })
  it('passes through her own side but never ends on it, and never enters a solid tile', () => {
    const t = flat('.').map((row, y) => (y === 6 ? '#######.' : row))
    const state = setup([{ id: 'a', at: [3, 7] }, { id: 'b', at: [4, 7] }], [{ id: 'e', at: [7, 0] }], { tiles: t })
    const r = tiles(reachable(state, 'a'))
    expect(r).not.toContain('4,7')
    expect(r).toContain('5,7')
    expect(r.some((k) => k.endsWith(',6') && k !== '7,6')).toBe(false)
  })
})

describe('line of fire and reach', () => {
  it('is blocked by a solid tile or higher ground between, never by units', () => {
    const state = setup([{ id: 'a', at: [1, 4] }], [{ id: 'e', at: [5, 4] }])
    const map = state.input.map
    expect(lineOfFire(map, [1, 4], [5, 4])).toBe(true)
    const walled = { ...map, tiles: map.tiles.map((r, y) => (y === 4 ? '...#....' : r)) }
    expect(lineOfFire(walled, [1, 4], [5, 4])).toBe(false)
    const ridge = { ...map, heights: map.heights.map((r, y) => (y === 4 ? '00010000' : r)) }
    expect(lineOfFire(ridge, [1, 4], [5, 4])).toBe(false)
    const perch = { ...ridge, heights: ridge.heights.map((r, y) => (y === 4 ? '02010000' : r)) }
    expect(lineOfFire(perch, [1, 4], [5, 4])).toBe(true)
  })
  it('lets Melee and Short reach two levels up or down, and gives Long +1 range from two levels up', () => {
    const state = setup([{ id: 'a', at: [1, 4] }], [{ id: 'e', at: [2, 4] }])
    const map = { ...state.input.map, heights: state.input.map.heights.map((r, y) => (y === 4 ? '03000000' : r)) }
    expect(inReach(map, W.blade, [1, 4], [2, 4])).toBe(false)
    const two = { ...map, heights: map.heights.map((r, y) => (y === 4 ? '02000000' : r)) }
    expect(inReach(two, W.blade, [1, 4], [2, 4])).toBe(true)
    expect(inReach(two, W.missiles, [1, 4], [8 - 1, 4])).toBe(true) // range 6 + 1 from two levels up
    expect(inReach(state.input.map, W.missiles, [0, 4], [7, 4])).toBe(false)
  })
  it('sorts where an attack lands: front, side (diagonals included) or back', () => {
    expect(facingOf([3, 3], 'S', [3, 5])).toBe('front')
    expect(facingOf([3, 3], 'S', [3, 1])).toBe('back')
    expect(facingOf([3, 3], 'S', [5, 3])).toBe('side')
    expect(facingOf([3, 3], 'S', [4, 4])).toBe('side')
    expect(facingOf([3, 3], 'E', [6, 4])).toBe('front')
  })
})

describe('damage', () => {
  const base = { power: 10, meleeBonus: 0, facing: 'front' as const, heightDiff: 0, coat: false, crit: false, guard: 0 }
  it('multiplies by the side (+25%), the back (+50%), height (±10% a level), a Coat (×0.5) and a crit (×1.5)', () => {
    expect(damageOf(base)).toBe(10)
    expect(damageOf({ ...base, facing: 'side' })).toBe(12)
    expect(damageOf({ ...base, facing: 'back' })).toBe(15)
    expect(damageOf({ ...base, heightDiff: 2 })).toBe(12)
    expect(damageOf({ ...base, heightDiff: -1 })).toBe(9)
    expect(damageOf({ ...base, coat: true })).toBe(5)
    expect(damageOf({ ...base, crit: true })).toBe(15)
    expect(damageOf({ ...base, guard: 40 })).toBe(6)
    expect(damageOf({ ...base, power: 1, coat: true, guard: 40 })).toBe(1)
  })
  it('adds 2 a Power band to Melee, and the Guard cuts from the front and side only', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: { bands: { speed: 5, stamina: 3, power: 4, guts: 3, wit: 3 } } }], [{ id: 'v', at: [3, 4], facing: 'S', opts: { loadout: { ...RIG.vanguard(), coat: null } } }])
    const front = strikeOf(state, 'a', 'right', 'v', [3, 5])!
    expect(front.facing).toBe('front')
    expect(front.guard).toBe(40)
    expect(front.damage).toBe(Math.floor((12 + 8) * 0.6))
    const behind = edit(state, 'v', (u) => { u.facing = 'N' })
    const back = strikeOf(behind, 'a', 'right', 'v', [3, 5])!
    expect(back.facing).toBe('back')
    expect(back.guard).toBe(0)
    expect(back.damage).toBe(Math.floor(20 * 1.5))
  })
  it('works out hit %: accuracy + 3 a Wit band − 2 a Speed band evasion − 25 when aimed, within 5–95', () => {
    const state = setup([{ id: 'g', at: [3, 6], opts: { loadout: RIG.gunner() } }], [{ id: 'e', at: [3, 4], opts: { bands: { speed: 4, stamina: 3, power: 3, guts: 3, wit: 3 } } }])
    expect(strikeOf(state, 'g', 'right', 'e', [3, 6])!.hit).toBe(75 + 9 - 8)
    expect(strikeOf(state, 'g', 'right', 'e', [3, 6], { aim: 'legs' })!.hit).toBe(75 + 9 - 8 - 25)
    const lame = edit(state, 'e', (u) => { u.hp.legs = 0 })
    expect(strikeOf(lame, 'g', 'right', 'e', [3, 6])!.hit).toBe(84)
    expect(strikeOf(lame, 'g', 'right', 'e', [3, 6], { aim: 'core' })!.weights).toEqual({ core: 100, leftArm: 0, rightArm: 0, legs: 0 })
  })
  it('sends a broken part’s share to the Core', () => {
    const state = setup([{ id: 'a', at: [3, 5] }], [{ id: 'e', at: [3, 4] }])
    const broken = edit(state, 'e', (u) => { u.hp.leftArm = 0 })
    expect(strikeOf(broken, 'a', 'right', 'e', [3, 5])!.weights).toEqual({ core: 75, leftArm: 0, rightArm: 15, legs: 10 })
  })
})

const fast = { speed: 5 as const, stamina: 3 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }

describe('counters', () => {
  it('come back from the front or side when the defender has Charge and a weapon in reach', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: { bands: fast } }], [{ id: 'e', at: [3, 4], facing: 'S', opts: { loadout: RIG.brawler() } }])
    const r = applyBattleAction(state, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' })
    expect(r.error).toBeNull()
    expect(kinds(r.cues)).toContain('counter')
    expect(r.cues).toContainEqual({ kind: 'charge', unit: 'e', from: 1, to: 0, why: 'counter' })
  })
  it('never come from behind, against Long, or without Charge', () => {
    const behind = setup([{ id: 'a', at: [3, 5], opts: { bands: fast } }], [{ id: 'e', at: [3, 4], facing: 'N', opts: { loadout: RIG.brawler() } }])
    expect(kinds(applyBattleAction(behind, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' }).cues)).not.toContain('counter')
    const spent = edit(setup([{ id: 'a', at: [3, 5], opts: { bands: fast } }], [{ id: 'e', at: [3, 4], opts: { loadout: RIG.brawler() } }]), 'e', (u) => { u.charge = 0 })
    expect(kinds(applyBattleAction(spent, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' }).cues)).not.toContain('counter')
    const long = setup([{ id: 'g', at: [3, 7], opts: { bands: fast, loadout: RIG.gunner() } }], [{ id: 'e', at: [3, 3], opts: { loadout: RIG.trooper() } }])
    const r = applyBattleAction(long, { kind: 'turn', unit: 'g', act: { kind: 'attack', with: 'back', target: 'e' }, face: 'N' })
    expect(r.error).toBeNull()
    expect(kinds(r.cues)).not.toContain('counter')
    expect(unitOf(r.state, 'g').ammo).toBe(2)
  })
})

describe('Crossfire', () => {
  it('brings an ally on the far side in (a pincer), paying 1 Charge', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: { bands: fast } }, { id: 'b', at: [3, 3] }], [{ id: 'e', at: [3, 4], opts: { loadout: RIG.brawler() } }])
    expect(crossfireFor(state, 'a', [3, 5], 'e')).toEqual([{ unit: 'b', mount: 'right', how: 'pincer' }])
    const r = applyBattleAction(state, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' })
    expect(r.cues).toContainEqual({ kind: 'crossfire', unit: 'b', target: 'e', how: 'pincer' })
    expect(r.cues).toContainEqual({ kind: 'charge', unit: 'b', from: 1, to: 0, why: 'crossfire' })
  })
  it('brings in a Short or Long weapon with a line of fire (a link), two at most, in timeline order', () => {
    const state = setup([
      { id: 'a', at: [3, 5], opts: { bands: fast } },
      { id: 'g1', at: [1, 4], opts: { loadout: RIG.gunner(), bands: { ...fast, speed: 2 } } },
      { id: 'g2', at: [5, 4], opts: { loadout: RIG.gunner(), bands: { ...fast, speed: 4 } } },
      { id: 'g3', at: [3, 2], opts: { loadout: RIG.gunner(), bands: { ...fast, speed: 3 } } },
    ], [{ id: 'e', at: [3, 4] }])
    expect(crossfireFor(state, 'a', [3, 5], 'e').map((j) => j.unit)).toEqual(['g2', 'g3'])
    const unlinked = edit(state, 'g2', (u) => { u.link = false })
    expect(crossfireFor(unlinked, 'a', [3, 5], 'e').map((j) => j.unit)).toEqual(['g3', 'g1'])
  })
  it('works for enemies too', () => {
    const state = setup([{ id: 'a', at: [3, 4] }], [{ id: 'e', at: [3, 3], opts: { bands: fast } }, { id: 'f', at: [3, 5], opts: { loadout: RIG.brawler() } }], { active: 'e' })
    expect(crossfireFor(state, 'e', [3, 3], 'a')).toEqual([{ unit: 'f', mount: 'right', how: 'pincer' }])
  })
})

describe('Cover', () => {
  it('lets an adjacent ally with a shield take the hit for 1 Charge, when the target can’t guard it', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: { bands: fast } }], [{ id: 'e', at: [3, 4], opts: { loadout: RIG.brawler() } }, { id: 'v', at: [4, 4], opts: { loadout: RIG.vanguard() } }])
    expect(coverFor(state, 'e', 'front')).toBe('v')
    const r = applyBattleAction(state, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' })
    expect(r.cues).toContainEqual({ kind: 'cover', unit: 'v', for: 'e', attacker: 'a' })
    expect(r.cues.filter((c) => c.kind === 'hit').every((c) => c.kind === 'hit' && c.target === 'v')).toBe(true)
    expect(kinds(r.cues)).not.toContain('counter')
  })
  it('doesn’t step in when the target’s own shield guards it', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: { bands: fast } }], [{ id: 'e', at: [3, 4], opts: { loadout: RIG.trooper() } }, { id: 'v', at: [4, 4], opts: { loadout: RIG.vanguard() } }])
    expect(coverFor(state, 'e', 'front')).toBeNull()
    expect(coverFor(state, 'e', 'back')).toBe('v')
  })
})

describe('Rig Break and Hold on', () => {
  const strong = { loadout: { ...RIG.striker(), rightHand: { ...W.blade, accuracy: 150, power: 200 } }, bands: fast }
  it('kneels at Core 0, then extracts on her next turn', () => {
    let state = setup([{ id: 'a', at: [3, 5], opts: strong }], [{ id: 'e', at: [3, 4], facing: 'N', opts: { bands: { ...fast, speed: 1 } } }, { id: 'f', at: [7, 0] }])
    state = edit(state, 'e', (u) => { u.hp.core = 1; u.hp.leftArm = 0; u.hp.rightArm = 0; u.hp.legs = 0 })
    const r = applyBattleAction(state, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' })
    expect(kinds(r.cues)).toContain('rigBreak')
    expect(unitOf(r.state, 'e').status).toBe('down')
    let s = r.state
    const seen: Cue[] = []
    for (let i = 0; i < 10 && unitOf(s, 'e').status === 'down'; i++) {
      const next = applyBattleAction(s, { kind: 'turn', unit: s.active!, act: { kind: 'none' }, face: 'N' })
      seen.push(...next.cues)
      s = next.state
    }
    expect(unitOf(s, 'e').status).toBe('out')
    expect(seen).toContainEqual({ kind: 'extracted', unit: 'e' })
  })
  it('gives Guts band 4 one Hold on: she survives at Core 1', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: strong }], [{ id: 'e', at: [3, 4], facing: 'N', opts: { bands: { ...fast, speed: 1, guts: 4 } } }])
    const aimed = edit(state, 'e', (u) => { u.hp.leftArm = 0; u.hp.rightArm = 0; u.hp.legs = 0 })
    const r = applyBattleAction(aimed, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' })
    expect(kinds(r.cues)).toContain('holdOn')
    expect(unitOf(r.state, 'e').hp.core).toBe(1)
    expect(unitOf(r.state, 'e').holdOnUsed).toBe(true)
  })
})

describe('shields', () => {
  it('a buckler cuts 20% and a tower 40%', () => {
    expect(S.buckler.guard).toBe(20)
    expect(S.tower.guard).toBe(40)
  })
})
