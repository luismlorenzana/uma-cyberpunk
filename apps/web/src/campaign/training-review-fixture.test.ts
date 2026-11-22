import { applyBattleAction, battleStateHash, type Dir } from '@cyber/battle'
import { expect, it } from 'vitest'
import { resume } from '../battle/session'
import { TRAINING_REVIEWS, trainingReview } from './training-review-fixture'

it.each(TRAINING_REVIEWS)('replays %s on legal Training Deck inputs in four facings', review => {
  for (const facing of ['N', 'E', 'S', 'W'] satisfies Dir[]) {
    const replay = trainingReview(9000101, review, facing)
    expect(replay.input.map.id).toBe('training-deck')
    const open = resume(replay.input, replay.prefix)
    if ('error' in open) throw new Error(open.error)
    const result = applyBattleAction(open.state, replay.action)
    expect(result.error).toBe(replay.error)
    expect(result.cues).toEqual(replay.cues)
    if (!result.error) {
      const restored = resume(replay.input, [...replay.prefix, replay.action])
      if ('error' in restored) throw new Error(restored.error)
      expect(battleStateHash(restored.state)).toBe(battleStateHash(result.state))
    }
  }
})

it('uses one mixed rig for a left burst, a right strike, and one Back ammo spend', () => {
  const replay = trainingReview(9000101, 'mixed-back', 'N')
  const all = [...replay.prefix, replay.action]
  const open = resume(replay.input, [])
  if ('error' in open) throw new Error(open.error)
  const trainee = replay.input.units.find(unit => unit.id === 'trainee')!
  expect(trainee.frozenRig).toMatchObject({ leftHand: 'hand-pistol', rightHand: 'hand-blade', back: 'back-missiles' })
  let state = open.state
  const strikes: string[] = [], pulses: number[] = [], ammo: number[] = []
  for (const action of all) {
    const result = applyBattleAction(state, action)
    expect(result.error).toBeNull()
    const strike = result.cues.find(cue => cue.kind === 'attack' && cue.unit === 'trainee')
    if (strike?.kind === 'attack') {
      strikes.push(`${strike.with}/${strike.band}`)
      pulses.push(result.cues.filter(cue => (cue.kind === 'hit' || cue.kind === 'miss') && cue.unit === 'trainee').length)
      ammo.push(result.state.units.find(unit => unit.id === 'trainee')!.ammo)
    }
    state = result.state
  }
  expect(strikes).toEqual(['left/short', 'right/melee', 'back/long'])
  expect(pulses).toEqual([4, 1, 1])
  expect(ammo).toEqual([3, 3, 2])
})
