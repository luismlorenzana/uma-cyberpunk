// The AI (CY6): never idles, takes a sure Rig Break over chip damage, leaves a marked tile, plays the same twice, finishes
// every scenario within 60 rounds, and decides inside its budget.
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chooseTurn } from './ai'
import { applyBattleAction, battleStateHash, startBattle } from './battle'
import { RIG, W } from './fixtures'
import { scenarioInput } from './scenario'
import { loadScenarios } from './scenarios'
import { edit, setup } from './test-kit'
import { TUNING } from './tuning'
import type { BattleInput, BattleState } from './types'

const fast = { speed: 5 as const, stamina: 3 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }
const slow = { ...fast, speed: 1 as const }
const ROOT = join(__dirname, '../../..')

/** Plays a battle AI against AI; stops at the end or after `rounds` rounds. */
export function playOut(input: BattleInput, rounds = 60): BattleState {
  let state = startBattle(input).state
  while (!state.result && state.time < rounds * TUNING.roundTicks) {
    const r = applyBattleAction(state, chooseTurn(state))
    if (r.error) throw new Error(`${input.seed}: the AI made an illegal turn: ${r.error}`)
    state = r.state
  }
  return state
}

describe('the AI', () => {
  it('never idles: with no attack it advances on the nearest foe', () => {
    const s = setup([{ id: 'a', at: [3, 7], opts: { bands: fast } }], [{ id: 'e', at: [3, 0], opts: { bands: slow } }], { version: 2 })
    const t = chooseTurn(s)
    expect(t.to).toBeDefined()
    expect(Math.abs(t.to![1] - 0)).toBeLessThan(7)
  })
  it('takes a sure Rig Break over chip damage', () => {
    const s = edit(setup([{ id: 'a', at: [3, 5], opts: { bands: fast, loadout: { ...RIG.striker(), rightHand: { ...W.blade, power: 40 } } } }],
      [{ id: 'weak', at: [2, 4], facing: 'N', opts: { bands: slow } }, { id: 'tough', at: [4, 4], facing: 'N', opts: { bands: { ...slow, stamina: 5 } } }], { version: 2 }),
      'weak', (u) => { u.hp.core = 5; u.hp.leftArm = 0; u.hp.rightArm = 0; u.hp.legs = 0 })
    const t = chooseTurn(s)
    expect(t.act.kind === 'attack' && t.act.target).toBe('weak')
  })
  it('leaves a tile the volley has marked', () => {
    const s = edit(setup([{ id: 'a', at: [3, 6], opts: { bands: fast } }], [{ id: 'e', at: [3, 0], opts: { bands: slow, faction: 'steel-muster', loadout: RIG.trooper() } }], { version: 2, factions: ['steel-muster'] }), 'a', () => {})
    s.field!.volley = { meter: 0, marked: [[3, 6]], at: s.time + 100 }
    const t = chooseTurn(s)
    expect(t.to).toBeDefined()
    expect(t.to![0] === 3 && t.to![1] === 6).toBe(false)
  })
  it('plays the same battle twice', () => {
    const { maps, scenarios } = loadScenarios(ROOT)
    const mirror = scenarios.find((s) => s.id === 'mirror')!
    const input = scenarioInput(mirror, maps[mirror.map]!, 7)
    expect(battleStateHash(playOut(input))).toBe(battleStateHash(playOut(input)))
  })
})

describe('the scenarios', () => {
  const { maps, scenarios } = loadScenarios(ROOT)
  it('there are eight, nameless, on four maps (and the board\'s two)', () => {
    expect(scenarios.map((s) => s.id).sort()).toEqual(['arena', 'chain', 'free', 'high-ground', 'melee-ranged', 'mirror', 'muster-underlevels', 'sandbox-muster'])
    expect(Object.keys(maps).sort()).toEqual(['arena', 'flat-14', 'heights-14', 'underlevels', 'underlevels-14', 'yard'])
    for (const s of scenarios) for (const u of s.input.units) expect(u.ref?.kind ?? 'standin').toBe('standin')
  })
  for (const s of scenarios) {
    it(`${s.id} plays to an end within 60 rounds for three seeds`, () => {
      for (const seed of [1, 2, 3]) {
        const end = playOut(scenarioInput(s, maps[s.map]!, seed))
        expect(end.result, `${s.id} seed ${seed} stalled`).not.toBeNull()
      }
    })
  }
})

describe('the budget', () => {
  // 50 ms on the phone; CI is held to a tenth of that.
  it('decides inside its time: 13 units on 12 × 12', () => {
    const { maps, scenarios } = loadScenarios(ROOT)
    const s = scenarios.find((x) => x.id === 'muster-underlevels')!
    let state = startBattle(scenarioInput(s, maps[s.map]!, 1)).state
    const times: number[] = []
    for (let i = 0; i < 40 && !state.result; i++) {
      const t0 = performance.now()
      const turn = chooseTurn(state)
      times.push(performance.now() - t0)
      state = applyBattleAction(state, turn).state
    }
    times.sort((a, b) => a - b)
    const median = times[Math.floor(times.length / 2)]!
    console.log(`AI decision: median ${median.toFixed(2)} ms, worst ${times[times.length - 1]!.toFixed(2)} ms over ${times.length}`)
    expect(median).toBeLessThan(5)
  })
})
