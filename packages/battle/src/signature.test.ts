import { expect, it } from 'vitest'
import { applyBattleAction, replayBattle } from './battle'
import { forecast } from './forecast'
import { RIG } from './fixtures'
import { chooseAction } from './ai'
import { edit, setup, unitOf } from './test-kit'
import type { Signature, TurnAction } from './types'

const signature: Signature = { id: 'focused', label: 'Focused Strike', mount: 'right', charge: 2, power: 7 }
const identity = { id: signature.id, label: signature.label }
const attack = (unit: string, target: string): TurnAction =>
  ({ kind: 'turn', unit, face: 'N', act: { kind: 'attack', target, with: 'right', signature: true } })

it('uses the same mounted strike in forecast and resolution, spends Charge and allows one use', () => {
  const state = edit(setup([{ id: 'lead', at: [2, 3], opts: { signature, loadout: RIG.trooper() } }],
    [{ id: 'enemy', at: [2, 1] }], { active: 'lead', version: 6 }), 'lead', unit => { unit.charge = 2 })
  const action = attack('lead', 'enemy')
  const preview = forecast(state, action)
  expect(preview).toMatchObject({ signature: signature.label, charge: { lead: 2 }, attack: { hits: 3 } })
  const result = applyBattleAction(state, action)
  expect(result.error).toBeNull()
  expect(result.cues).toContainEqual(expect.objectContaining({ kind: 'attack', unit: 'lead', signature: identity }))
  expect(result.cues).toContainEqual(expect.objectContaining({ kind: 'charge', unit: 'lead', why: 'signature', from: 2, to: 0 }))
  expect(unitOf(result.state, 'lead').signatureUsed).toBe(true)
  expect(forecast(edit(state, 'lead', unit => { unit.charge = 1 }), action)).toHaveProperty('error')
  expect(forecast(edit(state, 'lead', unit => { unit.hp.rightArm = 0 }), action)).toHaveProperty('error')
  expect(forecast(edit(state, 'lead', unit => { unit.signatureUsed = true }), action)).toHaveProperty('error')
})

it('warns before an enemy signature, replays the same target, and cancels when the target steps off', () => {
  const state = setup([{ id: 'lead', at: [2, 3], opts: { bands: { speed: 2, stamina: 5, power: 3, guts: 3, wit: 3 } } }],
    [{ id: 'boss', at: [2, 1], opts: { signature, loadout: RIG.trooper(), bands: { speed: 4, stamina: 3, power: 3, guts: 3, wit: 3 } } }],
    { version: 6 })
  expect(state.active).toBe('boss')
  expect(chooseAction(state)).toMatchObject({ act: { signature: true } })
  const action = attack('boss', 'lead')
  const warned = applyBattleAction(state, action)
  expect(warned.cues).toContainEqual({ kind: 'signatureWarning', unit: 'boss', tile: [2, 3], label: signature.label })
  expect(warned.cues.some(cue => cue.kind === 'attack')).toBe(false)
  const stay: TurnAction = { kind: 'turn', unit: 'lead', face: 'N', act: { kind: 'none' } }
  const hit = applyBattleAction(warned.state, stay)
  expect(hit.cues).toContainEqual(expect.objectContaining({ kind: 'attack', unit: 'boss', target: 'lead', signature: identity }))
  expect(replayBattle(state.input, [action, stay]).state).toEqual(hit.state)
  const dodge = applyBattleAction(warned.state, { ...stay, to: [3, 3] })
  expect(dodge.cues).toContainEqual({ kind: 'signatureCanceled', unit: 'boss' })
  expect(dodge.cues.some(cue => cue.kind === 'attack')).toBe(false)
  const disarmed = applyBattleAction(edit(warned.state, 'boss', unit => { unit.hp.rightArm = 0 }), stay)
  expect(disarmed.cues).toContainEqual({ kind: 'signatureCanceled', unit: 'boss' })
})
