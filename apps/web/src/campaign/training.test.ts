import { armed, chooseAction, supportFrom } from '@cyber/battle'
import { newSave, parseSave } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { act, resume, startSession } from '../battle/session'
import { deploy, finishBattle, recordAction, retry } from '../mission/director'
import { settleTraining, TRAINING_EXPANSION, TRAINING_MAIN, trainingInput } from './training'

const loadouts = TRAINING_MAIN.flatMap((main) => TRAINING_EXPANSION.map((expansion) => ({ main: main.id, expansion: expansion.id })))

describe('campaign Training', () => {
  it.each(loadouts)('can win and replay with $main and $expansion', ({ main, expansion }) => {
    const input = trainingInput(9000101, 'Trainee', main, expansion)
    const open = startSession(input).session
    let session = open
    for (let count = 0; count < 80 && !session.state.result; count++) {
      const next = act(session, chooseAction(session.state))
      if ('error' in next) throw new Error(next.error)
      session = next.session
    }
    expect(session.state.result?.winner).toBe('squad')
    expect(resume(input, session.actions)).toEqual(session)
  })

  it('keeps the Bulwark and Med mounts usable after arm damage', () => {
    for (const expansion of TRAINING_EXPANSION) {
      const input = trainingInput(9000101, 'Trainee', 'hand-greatblade', expansion.id)
      const { state } = startSession(input).session
      const trainee = state.units[0]!
      expect(armed(input.units[0]!, trainee, 'right')?.halfAccuracy).toBe(false)
      trainee.hp.leftArm = 0
      expect(armed(input.units[0]!, trainee, 'right')?.halfAccuracy).toBe(true)
      expect(supportFrom(state, trainee.id, [trainee.x, trainee.y]).map((option) => option.kind))
        .toContain(expansion.id === 'back-bulwark' ? 'barrier' : 'mend')
    }
  })

  it('retries a loss and settles a win once with the same day and supplies', () => {
    const save = newSave('training-test', '2026-11-17T00:00:00.000Z')
    const input = trainingInput(9000101, 'Trainee', 'hand-rifle', 'back-med')
    const ready = { ...save, mission: { id: 'deck-exercise', chapter: 'first-watch', step: 'deploy' as const, squad: [9000101], battle: null, won: null } }
    const battle = deploy(ready, input)
    const action = chooseAction(startSession(input).session.state)
    const reloaded = parseSave(JSON.parse(JSON.stringify(recordAction(battle, action))))
    expect(reloaded.mission?.battle?.actions).toEqual([action])
    const loss = finishBattle(reloaded, false)
    expect(settleTraining(loss)).toBe(loss)
    expect(retry(loss).mission?.battle).toEqual({ input, actions: [] })
    const cleared = settleTraining(finishBattle(retry(loss), true))
    expect(cleared.mission).toBe(null)
    expect(cleared.worlds.missions).toEqual(['deck-exercise'])
    expect(cleared.campaignDay).toEqual(save.campaignDay)
    expect(cleared.wallet).toEqual(save.wallet)
    expect(settleTraining(cleared)).toBe(cleared)
  })
})
