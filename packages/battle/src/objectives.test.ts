// The four objectives and the loss (CY4).
import { describe, expect, it } from 'vitest'
import { applyBattleAction, startBattle } from './battle'
import { RIG, W } from './fixtures'
import { edit, setup, unitOf } from './test-kit'
import type { BattleState, Cue } from './types'

const fast = { speed: 5 as const, stamina: 3 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }
const killer = { loadout: { ...RIG.striker(), rightHand: { ...W.blade, accuracy: 150, power: 300 } }, bands: fast }
const ended = (cues: Cue[]) => cues.find((c) => c.kind === 'ended')
/** Every limb broken, so a hit can only land on the Core; then the first seed whose attack hits (95% at most). */
function finisher(make: (seed: string) => BattleState, target: string, action: Parameters<typeof applyBattleAction>[1]) {
  for (let i = 0; ; i++) {
    const state = edit(make(`s${i}`), target, (u) => { u.hp.leftArm = 0; u.hp.rightArm = 0; u.hp.legs = 0 })
    const r = applyBattleAction(state, action)
    if (r.cues.some((c) => c.kind === 'rigBreak')) return r
  }
}

describe('objectives', () => {
  it('defeat all: the battle ends the moment the last enemy breaks', () => {
    const r = finisher((seed) => setup([{ id: 'a', at: [3, 5], opts: killer }], [{ id: 'e', at: [3, 4], facing: 'N' }], { seed }), 'e',
      { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' })
    expect(ended(r.cues)).toEqual({ kind: 'ended', winner: 'squad', reason: 'objective' })
    expect(r.cues).toContainEqual({ kind: 'objective', objective: 'defeatAll', value: 1, of: 1 })
    expect(r.state.active).toBeNull()
    expect(applyBattleAction(r.state, { kind: 'turn', unit: 'a', act: { kind: 'none' }, face: 'N' }).error).toBe('the battle is over')
  })
  it('defeat the leader: her Rig Break wins with others still standing', () => {
    const r = finisher((seed) => setup([{ id: 'a', at: [3, 5], opts: killer }], [{ id: 'boss', at: [3, 4], facing: 'N', opts: { leader: true } }, { id: 'e', at: [7, 0] }], { seed, objective: { kind: 'defeatLeader' } }), 'boss',
      { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'boss' }, face: 'N' })
    expect(ended(r.cues)?.kind).toBe('ended')
    expect(unitOf(r.state, 'e').status).toBe('active')
  })
  it('reach a tile: stepping on it ends the battle at once', () => {
    const state = setup([{ id: 'a', at: [3, 7], opts: { bands: fast } }], [{ id: 'e', at: [7, 0] }], { objective: { kind: 'reach', tile: [3, 4] } })
    const r = applyBattleAction(state, { kind: 'turn', unit: 'a', to: [3, 4], act: { kind: 'wait' }, face: 'N' })
    expect(r.error).toBeNull()
    expect(ended(r.cues)).toEqual({ kind: 'ended', winner: 'squad', reason: 'objective' })
    expect(r.cues.map((c) => c.kind)).not.toContain('waited')
  })
  it('hold for N rounds: the squad wins when the clock passes them', () => {
    let state: BattleState = setup([{ id: 'a', at: [3, 7] }], [{ id: 'e', at: [7, 0] }], { objective: { kind: 'hold', rounds: 3 } })
    const all: Cue[] = [...startBattle(state.input).cues]
    for (let i = 0; i < 20 && !state.result; i++) {
      const r = applyBattleAction(state, { kind: 'turn', unit: state.active!, act: { kind: 'none' }, face: 'N' })
      all.push(...r.cues)
      state = r.state
    }
    expect(state.result).toEqual({ winner: 'squad', reason: 'objective' })
    expect(state.time).toBeGreaterThanOrEqual(300)
    expect(all.filter((c) => c.kind === 'objective').map((c) => c.kind === 'objective' && c.value)).toEqual([1, 2, 3])
  })
  it('is lost when every squad unit is out', () => {
    const r = finisher((seed) => setup([{ id: 'a', at: [3, 5], facing: 'S' }], [{ id: 'e', at: [3, 4], opts: killer }], { seed, active: 'e' }), 'a',
      { kind: 'turn', unit: 'e', act: { kind: 'attack', with: 'right', target: 'a' }, face: 'S' })
    expect(ended(r.cues)).toEqual({ kind: 'ended', winner: 'enemy', reason: 'defeated' })
  })
})
