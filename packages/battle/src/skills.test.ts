// The five chance skills (TC22, CY5): each fires at its forecast % within two points over 2,000 seeds; one chain at
// most. And a version-2 battle with every flag off plays exactly as version 1.
import { describe, expect, it } from 'vitest'
import { applyBattleAction, replayBattle, startBattle } from './battle'
import { battle, RIG, unit, W, YARD } from './fixtures'
import { forecast, type Forecast } from './forecast'
import { greedyTurn } from './golden/policy'
import { setup } from './test-kit'
import type { BattleAction, ChanceSkill, ChanceSkills, Cue, Loadout } from './types'

const fast = { speed: 5 as const, stamina: 5 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }
const slow = { ...fast, speed: 1 as const }

function rate(skill: ChanceSkill, skills: ChanceSkills, loadout: Loadout, defender: Partial<Parameters<typeof unit>[3]> = {}, defenderSkills?: ChanceSkills) {
  let fired = 0, expected = 0, chains = 0
  for (let i = 0; i < 2000; i++) {
    const s = setup([{ id: 'a', at: [3, 4], opts: { bands: fast, skills, loadout } }], [{ id: 'e', at: [3, 3], facing: 'S', opts: { bands: { ...slow, stamina: 5 }, loadout: RIG.brawler(), ...defender, ...(defenderSkills ? { skills: defenderSkills } : {}) } }], { version: 2, seed: `skill-${skill}-${i}` })
    const turn = { kind: 'turn' as const, unit: 'a', act: { kind: 'attack' as const, with: 'right' as const, target: 'e' }, face: 'N' as const }
    expected = (forecast(s, turn) as Forecast).skills[skill] ?? 0
    const cues: Cue[] = applyBattleAction(s, turn).cues
    const own = cues.filter((c) => c.kind === 'skill' && c.unit === 'a')
    if (cues.some((c) => c.kind === 'skill' && c.skill === skill)) fired++
    if (own.length > 1) chains++
  }
  return { rate: fired / 20, expected, chains }
}

describe('chance skills', () => {
  it('Burst adds rounds to a Short weapon at its forecast %', () => {
    const r = rate('burst', { burst: 20 }, { ...RIG.gunner(), rightHand: W.rifle })
    expect(r.expected).toBe(35)
    expect(Math.abs(r.rate - r.expected)).toBeLessThanOrEqual(2)
  })
  it('Double strikes again with Melee at its forecast %', () => {
    const r = rate('double', { double: 15 }, RIG.striker())
    expect(Math.abs(r.rate - r.expected)).toBeLessThanOrEqual(2)
  })
  it('Switch fires the other hand at its forecast %, one chain at most', () => {
    const r = rate('switch', { double: 10, switch: 20 }, RIG.brawler())
    expect(r.chains).toBe(0)
    // Switch only rolls when Double didn't fire.
    const expectedSwitch = r.expected * (1 - 25 / 100)
    expect(Math.abs(r.rate - expectedSwitch)).toBeLessThanOrEqual(2)
  })
  it('Stun stuns on a hit at its forecast %, given a hit', () => {
    const r = rate('stun', { stun: 25 }, { ...RIG.striker(), rightHand: { ...W.blade, accuracy: 150 } })
    // Rolled after a landing hit (95%), and not counting impact Stuns (a blade is P).
    expect(Math.abs(r.rate - r.expected * 0.95)).toBeLessThanOrEqual(2)
  })
  it('First lets the defender counter before the attack at its forecast %', () => {
    let fired = 0, expected = 0, before = 0
    for (let i = 0; i < 2000; i++) {
      const s = setup([{ id: 'a', at: [3, 4], opts: { bands: fast } }], [{ id: 'e', at: [3, 3], facing: 'S', opts: { bands: { ...slow, stamina: 5 }, loadout: RIG.brawler(), skills: { first: 20 } } }], { version: 2, seed: `first-${i}` })
      const turn = { kind: 'turn' as const, unit: 'a', act: { kind: 'attack' as const, with: 'right' as const, target: 'e' }, face: 'N' as const }
      expected = (forecast(s, turn) as Forecast).skills.first ?? 0
      const cues = applyBattleAction(s, turn).cues
      if (cues.some((c) => c.kind === 'skill' && c.skill === 'first')) {
        fired++
        const counter = cues.findIndex((c) => c.kind === 'counter'), main = cues.findIndex((c) => c.kind === 'attack' && c.role === 'main')
        if (counter < main || main === -1) before++
      }
    }
    expect(Math.abs(fired / 20 - expected)).toBeLessThanOrEqual(2)
    expect(before).toBe(fired)
  })
})

describe('rules version 2 with every flag off', () => {
  it('plays exactly as version 1', () => {
    // No props, items, bench, factions, skills, Stride or Holds; no cover or grating tiles; and no impact or fire weapons,
    // since version 2's impact Stun and Fire from F hits are always on.
    const pierceLauncher = { ...RIG.gunner(), back: { kind: 'launcher' as const, load: 3, weapon: { ...W.missiles, type: 'P' as const }, ammo: 3 } }
    const units = [
      unit('s1', 'squad', 0, { bands: { ...slow, speed: 4 } }), unit('g1', 'squad', 1, { loadout: pierceLauncher }),
      unit('e1', 'enemy', 0, { loadout: { ...RIG.trooper(), rightHand: W.rifle } }), unit('e2', 'enemy', 1, { bands: { ...slow, speed: 4 }, loadout: RIG.striker() }),
    ]
    const v1 = battle(units, { map: YARD, seed: 'parity' })
    let state = startBattle(v1).state
    const actions: BattleAction[] = []
    for (let i = 0; i < 200 && !state.result; i++) {
      const a = greedyTurn(state)
      actions.push(a)
      state = applyBattleAction(state, a).state
    }
    const one = replayBattle(v1, actions), two = replayBattle({ ...v1, rulesVersion: 2 }, actions)
    expect(two.error).toBeNull()
    expect(two.cues).toEqual(one.cues)
    expect(two.state.units).toEqual(one.state.units)
    expect(one.state.result).not.toBeNull()
  })
})
