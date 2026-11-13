// Tech, the Holds, the impact Stun and each enemy's fate (CY5, rules version 2).
import { describe, expect, it } from 'vitest'
import { applyBattleAction, createBattle } from './battle'
import { battle, RIG, RIG2, unit, W } from './fixtures'
import { forecast, type Forecast } from './forecast'
import { techChance } from './tech'
import { edit, setup, unitOf } from './test-kit'
import { TUNING } from './tuning'
import type { BattleState, Cue, TurnAction } from './types'

const fast = { speed: 5 as const, stamina: 3 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }
const slow = { ...fast, speed: 1 as const }
const net = { bands: { ...fast, wit: 4 as const }, loadout: RIG2.netrunner(), chargeCap: 3 }

/** The first seed whose turn lands (or misses) as wanted. */
function seedWhere(make: (seed: string) => BattleState, turn: TurnAction, want: (cues: Cue[]) => boolean) {
  for (let i = 0; i < 200; i++) {
    const r = applyBattleAction(make(`s${i}`), turn)
    if (r.error) throw new Error(r.error)
    if (want(r.cues)) return r
  }
  throw new Error('no seed')
}

describe('Tech', () => {
  it('has a chance of 50% + 5% a Wit band − 10% a Guts band, clamped 5–95%', () => {
    const s = setup([{ id: 'n', at: [3, 6], opts: net }], [{ id: 'e', at: [3, 3], opts: { bands: { ...slow, guts: 2 } } }], { version: 2 })
    expect(techChance(s, 'n', 'e')).toBe(50 + 20 - 20)
  })
  it('Stun costs 2 Charge and takes her next turn; it is never countered', () => {
    const make = (seed: string) => edit(setup([{ id: 'n', at: [3, 6], opts: net }], [{ id: 'e', at: [3, 3], opts: { bands: slow, loadout: RIG.brawler() } }], { version: 2, seed }), 'n', (u) => { u.charge = 3 })
    const turn: TurnAction = { kind: 'turn', unit: 'n', act: { kind: 'tech', tech: 'stun', target: 'e' }, face: 'N' }
    const r = seedWhere(make, turn, (c) => c.some((x) => x.kind === 'stunned'))
    expect(r.cues).toContainEqual({ kind: 'charge', unit: 'n', from: 3, to: 1, why: 'tech' })
    expect(r.cues.some((c) => c.kind === 'counter')).toBe(false)
    let s = r.state
    const all: Cue[] = [...r.cues]
    for (let i = 0; i < 4; i++) {
      const next = applyBattleAction(s, { kind: 'turn', unit: s.active!, act: { kind: 'none' }, face: 'N' })
      all.push(...next.cues)
      s = next.state
    }
    expect(all).toContainEqual({ kind: 'skipped', unit: 'e', why: 'stunned' })
  })
  it('Jam takes 1 Charge from her', () => {
    const make = (seed: string) => edit(setup([{ id: 'n', at: [3, 6], opts: net }], [{ id: 'e', at: [3, 3], opts: { bands: slow } }], { version: 2, seed }), 'e', (u) => { u.charge = 2 })
    const r = seedWhere(make, { kind: 'turn', unit: 'n', act: { kind: 'tech', tech: 'jam', target: 'e' }, face: 'N' }, (c) => c.some((x) => x.kind === 'tech' && x.landed))
    expect(r.cues).toContainEqual({ kind: 'charge', unit: 'e', from: 2, to: 1, why: 'jam' })
  })
  it('Jack-Out frees an adjacent heroine below 30% Core; she counts as beaten, her whole parts are salvage', () => {
    const make = (seed: string) => edit(edit(setup([{ id: 'n', at: [3, 4], opts: net }], [{ id: 'h', at: [3, 3], opts: { bands: slow, hold: 'collar' } }, { id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2, seed }), 'n', (u) => { u.charge = 3 }), 'h', (u) => { u.hp.core = 10; u.hp.leftArm = 0 })
    const turn: TurnAction = { kind: 'turn', unit: 'n', act: { kind: 'tech', tech: 'jackout', target: 'h' }, face: 'N' }
    const r = seedWhere(make, turn, (c) => c.some((x) => x.kind === 'freed'))
    expect(r.cues).toContainEqual({ kind: 'freed', unit: 'h', by: 'jackout' })
    expect(unitOf(r.state, 'h').status).toBe('freed')
    const notLow = edit(make('s0'), 'h', (u) => { u.hp.core = 50 })
    expect(applyBattleAction(notLow, turn).error).toMatch(/above 30%/)
  })
  it('its forecast % matches the resolved rate within two points over 2,000 seeds', () => {
    let landed = 0
    let expected = 0
    for (let i = 0; i < 2000; i++) {
      const s = edit(setup([{ id: 'n', at: [3, 6], opts: net }], [{ id: 'e', at: [3, 3], opts: { bands: { ...slow, guts: 3 } } }], { version: 2, seed: `tech-${i}` }), 'n', (u) => { u.charge = 3 })
      const turn: TurnAction = { kind: 'turn', unit: 'n', act: { kind: 'tech', tech: 'jam', target: 'e' }, face: 'N' }
      expected = (forecast(s, turn) as Forecast).tech!.chance
      if (applyBattleAction(s, turn).cues.some((c) => c.kind === 'tech' && c.landed)) landed++
    }
    expect(Math.abs(landed / 20 - expected)).toBeLessThanOrEqual(2)
  })
})

describe('the Holds', () => {
  it('breaks an Anchor by aimed hits: she is freed, not broken', () => {
    const gunner = { bands: fast, loadout: { ...RIG.gunner(), rightHand: { ...W.rifle, type: 'I' as const, accuracy: 150, power: 40 } } }
    const s = setup([{ id: 'g', at: [3, 6], opts: gunner }], [{ id: 'h', at: [3, 4], opts: { bands: slow, hold: 'anchor', holdHp: 30 } }, { id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2 })
    expect(unitOf(s, 'h').holdHp).toBe(30)
    const turn: TurnAction = { kind: 'turn', unit: 'g', act: { kind: 'attack', with: 'right', target: 'h', aim: 'hold' }, face: 'N' }
    const f = forecast(s, turn) as Forecast
    expect(f.attack?.hold?.breaks).toBe('will')
    expect(f.attack?.parts).toEqual([])
    const r = applyBattleAction(s, turn)
    expect(r.cues.some((c) => c.kind === 'holdHit')).toBe(true)
    expect(r.cues).toContainEqual({ kind: 'freed', unit: 'h', by: 'hold' })
    expect(r.cues.some((c) => c.kind === 'hit')).toBe(false)
  })
  it('lists each enemy as freed, broken or standing with her salvage when the battle ends', () => {
    const killer = { bands: fast, loadout: { ...RIG.striker(), rightHand: { ...W.blade, accuracy: 150, power: 300 } } }
    const make = (seed: string) => edit(setup([{ id: 'a', at: [3, 5], opts: killer }], [{ id: 'e', at: [3, 4], facing: 'N', opts: { bands: slow } }], { version: 2, seed }), 'e', (u) => { u.hp.leftArm = 0; u.hp.rightArm = 0; u.hp.legs = 0 })
    const r = seedWhere(make, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' }, (c) => c.some((x) => x.kind === 'ended'))
    expect(r.state.result?.enemies).toEqual([{ id: 'e', fate: 'broken', salvage: [] }])
  })
})

describe('the impact Stun', () => {
  it('lets an impact hit on the Core stun in rules version 2, never in version 1', () => {
    const brawler = { bands: fast, loadout: { ...RIG.brawler(), rightHand: { ...W.knuckles, accuracy: 150 } } }
    let v2Stuns = 0, v1Stuns = 0
    for (let i = 0; i < 400; i++) {
      for (const version of [1, 2]) {
        const s = setup([{ id: 'a', at: [3, 5], opts: brawler }], [{ id: 'e', at: [3, 4], facing: 'N', opts: { bands: { ...slow, stamina: 5 } } }], { version, seed: `i${i}` })
        const r = applyBattleAction(s, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e', aim: undefined }, face: 'N' })
        if (r.cues.some((c) => c.kind === 'stunned')) version === 2 ? v2Stuns++ : v1Stuns++
      }
    }
    expect(v1Stuns).toBe(0)
    // About 10% of Core hits, and the Core takes 60% of Melee hits.
    expect(v2Stuns).toBeGreaterThan(400 * 0.6 * 0.95 * (TUNING.impactStun / 100) * 0.6)
    expect(v2Stuns).toBeLessThan(400 * 0.6 * (TUNING.impactStun / 100) * 1.5)
  })
})

describe('rules version 1', () => {
  it('refuses version 2 fields', () => {
    expect(() => createBattle(battle([unit('a', 'squad', 0, { stride: 'break' }), unit('e', 'enemy', 0)]))).toThrow(/needs rules version 2/)
    expect(() => createBattle(battle([unit('a', 'squad', 0), unit('e', 'enemy', 0)], { items: { cell: 1 } }))).toThrow(/needs rules version 2/)
  })
})
