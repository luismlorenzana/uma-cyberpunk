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
