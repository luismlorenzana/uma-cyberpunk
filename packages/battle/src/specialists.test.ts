import { describe, expect, it } from 'vitest'
import { applyBattleAction, createBattle, replayBattle } from './battle'
import { forecast } from './forecast'
import { RIG, W } from './fixtures'
import { quickPatchTargets } from './specialists'
import { edit, setup, unitOf } from './test-kit'
import type { BattleAction, TurnAction } from './types'

const laser = { ...RIG.trooper(), leftHand: null, rightHand: { ...W.rifle, twoHanded: true, accuracy: 150 } }
const sniper = { ...RIG.trooper(), leftHand: null, rightHand: null, back: {
  kind: 'launcher' as const, load: 2, weapon: { ...W.missiles, range: [4, 7] as const, accuracy: 150 }, ammo: 4,
} }
const shot = (unit: string, target: string, mode?: 'area' | 'suppress', withMount: 'right' | 'back' = 'right'): TurnAction => ({
  kind: 'turn', unit, act: { kind: 'attack', with: withMount, target, mode }, face: 'N',
})

describe('version 5 specialists', () => {
  it('spends one patch without committing the turn and cannot revive, patch twice or use an older ruleset', () => {
    const state = setup([{ id: 'a', at: [1, 2], opts: { loadout: laser, specialty: { kind: 'laser', rank: 1, subclass: 'heal' } } },
      { id: 'b', at: [2, 2] }], [{ id: 'e', at: [2, 0] }], { version: 5, active: 'a' })
    const wounded = edit(state, 'b', (u) => { u.hp.core = 9 })
    const action: BattleAction = { kind: 'quickPatch', unit: 'a', target: 'b' }
    const r = applyBattleAction(wounded, action)
    expect(r.error).toBeNull()
    expect(r.state.turn).toBe(wounded.turn)
    expect(r.state.active).toBe('a')
    expect(unitOf(r.state, 'b').hp.core).toBe(15)
    expect(unitOf(r.state, 'a').charge).toBe(unitOf(wounded, 'a').charge - 1)
    expect(unitOf(wounded, 'b').hp.core).toBe(9)
    expect(applyBattleAction(r.state, action).error).toBeTruthy()
    expect(quickPatchTargets(edit(wounded, 'b', (u) => { u.status = 'down' }), 'a')).toEqual([])
    expect(() => createBattle({ ...state.input, rulesVersion: 4 })).toThrow(/specialty/)
  })

  it('gates area by rank and distance and forecasts only orthogonal enemies', () => {
    const battle = (rank: number) => setup([{ id: 'a', at: [2, 4], opts: { loadout: laser, specialty: { kind: 'laser', rank } } },
      { id: 'b', at: [2, 1] }], [{ id: 'e', at: [2, 2] }, { id: 'near', at: [3, 2] }, { id: 'far', at: [3, 1] }],
    { version: 5, active: 'a' })
    const area = shot('a', 'e', 'area')
    expect(forecast(battle(4), area)).toMatchObject({ error: 'That firing mode is unavailable' })
    expect(forecast(battle(5), { ...area, to: [2, 3] })).toMatchObject({ error: 'e is out of reach' })
    const ready = edit(battle(5), 'a', (u) => { u.charge = 3 })
    expect(forecast(ready, area)).toMatchObject({ attack: { hits: 1 }, splash: { targets: ['near'] }, charge: { a: 1 } })
    expect(forecast(battle(5), shot('a', 'e'))).not.toHaveProperty('splash')
  })

  it('spends a sniper round to suppress a cluster and interrupt its committed windup, then replays the same cues', () => {
    // A faster enemy announces its attack before the Sniper's first activation.
    const base = setup([{ id: 'a', at: [3, 5], opts: { loadout: sniper, specialty: { kind: 'sniper' } } }],
      [{ id: 'e', at: [3, 1], opts: { bands: { speed: 5, power: 3, stamina: 3, wit: 3, guts: 3 },
        loadout: sniper, specialty: { kind: 'windup' } } }, { id: 'neighbor', at: [2, 1] }],
    { version: 5, seed: 'suppress-proof' })
    const prepare: BattleAction = { kind: 'turn', unit: 'e', face: 'S', act: { kind: 'prepare', with: 'back', target: 'a' } }
    const announced = applyBattleAction(base, prepare)
    expect(announced.error).toBeNull()
    expect(announced.cues).toContainEqual({ kind: 'prepared', unit: 'e', target: 'a' })
    const untilSniper: BattleAction[] = announced.state.active === 'a' ? [] : [
      { kind: 'turn', unit: announced.state.active!, face: 'S', act: { kind: 'none' } },
    ]
    const primed = replayBattle(base.input, [prepare, ...untilSniper])
    expect(primed.state.active).toBe('a')
    const attack = shot('a', 'e', 'suppress', 'back')
    expect(forecast(primed.state, attack)).toMatchObject({ suppression: { targets: ['e', 'neighbor'], interrupts: ['e'] }, charge: { a: 2 } })
    const r = applyBattleAction(primed.state, attack)
    expect(r.error).toBeNull()
    expect(unitOf(r.state, 'a').ammo).toBe(3)
    expect(r.cues).toContainEqual({ kind: 'suppressed', unit: 'a', target: 'e', interrupted: true })
    expect(unitOf(r.state, 'e').windup).toBeUndefined()
    expect(replayBattle(base.input, [prepare, ...untilSniper, attack]).state).toEqual(r.state)
  })
})
