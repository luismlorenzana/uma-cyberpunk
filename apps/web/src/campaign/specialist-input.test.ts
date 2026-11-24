import { chooseAction, createBattle, type BattleAction, type BattleInput } from '@cyber/battle'
import { chooseSubclass, newMember, newSave, trainingOf, type GroundCombat, type Save, type StoryPack } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { act, resume, startSession } from '../battle/session'
import { deploy, finishBattle } from '../mission/director'
import { SCENARIOS } from '../mission/battleInput'
import { settleGround } from './ground'
import { formationReady, specialistInput } from './specialist-input'

const now = '2026-11-24T00:00:00.000Z'
const outfits = Array.from({ length: 8 }, (_, i) => 9000201 + i)
const story = { casting: { labels: {} }, files: {} } as StoryPack
const ready = (): Save => ({
  ...newSave('specialists', now), crew: outfits.map(newMember),
  mission: { id: 'test-ground', chapter: 'test', step: 'deploy', squad: outfits.slice(0, 5), battle: null, won: null },
})
const formation: Extract<GroundCombat, { kind: 'combined' }> = {
  kind: 'combined', windups: ['commander'], members: [
    { role: 'laser', outfit: outfits[0] }, { role: 'wing', heroine: 'ally-one', requires: 'ally-one-ready' },
    { role: 'shield', outfit: outfits[2] }, { role: 'laser', outfit: outfits[1] },
    { role: 'wing', heroine: 'ally-two', requires: 'ally-two-ready' }, { role: 'shield', outfit: outfits[3] },
    { role: 'sniper', outfit: outfits[4] }, { role: 'medic', outfit: outfits[5] },
    { role: 'medic', outfit: outfits[6] }, { role: 'sniper', outfit: outfits[7] },
  ],
}

describe('campaign specialist deployment and settlement', () => {
  it('deploys a saved Rank 1 subclass and advances a settled early clear only once', () => {
    const save = chooseSubclass(ready(), outfits[0]!, 'heal')
    const input = specialistInput({ scenario: 'specialist-practice', combat: { kind: 'uma' }, save, story, outfits: [outfits[0]!], shifted: false })
    expect(input.units.filter(({ side }) => side === 'squad')).toHaveLength(1)
    expect(input.units[0]?.specialty).toEqual({ kind: 'laser', rank: 1, subclass: 'heal' })
    const won = finishBattle(deploy(save, input), true)
    const boss = { id: 'test-ground', title: 'Practice', win: {} }
    const settled = settleGround(won, boss, story)
    expect(trainingOf(settled, outfits[0]!)).toEqual({ rank: 2, subclass: 'heal' })
    expect(settleGround({ ...settled, mission: won.mission }, boss, story).combatTraining).toEqual(settled.combatTraining)
  })

  it('gates the authored ten roles, drops the active subclass, and can finish and replay the priority fight', () => {
    const save = chooseSubclass(ready(), outfits[0]!, 'heal')
    expect(formationReady(save, formation, true)).toBe(false)
    const shifted = { ...save, story: { ...save.story, flags: ['ally-one-ready', 'ally-two-ready'] } }
    const input = specialistInput({ scenario: 'combined-strike', combat: formation, save: shifted, story, outfits, shifted: true })
    expect(input.units.filter(({ side }) => side === 'squad')).toHaveLength(10)
    expect(input.units[0]?.specialty).toEqual({ kind: 'laser', rank: 6 })
    expect(input.units[1]?.ref).toEqual({ kind: 'heroine', id: 'ally-one' })
    expect(input.units.find(({ id }) => id === 'commander')?.specialty).toEqual({ kind: 'windup' })
    expect(() => createBattle({ ...input, rulesVersion: 4 })).toThrow()
    let session = startSession(input).session
    for (let i = 0; i < 400 && !session.state.result; i++) {
      const next = act(session, chooseAction(session.state))
      if ('error' in next) throw new Error(next.error)
      session = next.session
    }
    expect(session.state.result).not.toBeNull()
    const restored = resume(JSON.parse(JSON.stringify(input)) as BattleInput, JSON.parse(JSON.stringify(session.actions)) as BattleAction[])
    expect(restored).toEqual(session)
    expect(SCENARIOS['combined-strike']?.input.objective.kind).toBe('defeatLeader')
  })
})
