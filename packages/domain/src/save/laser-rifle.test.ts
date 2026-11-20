import { applyBattleAction, battleStateHash, chooseAction, replayBattle, startBattle, type BattleInput } from '@cyber/battle'
import { describe, expect, it } from 'vitest'
import { battle, RIG, unit } from '../../../battle/src/fixtures'
import { issuedCampaignRig } from '../campaign-gear'
import { newMember } from '../crew/crew'
import { rigProblem } from '../crew/parts'
import { newSave, parseSave } from './save'

const stamp = '2026-11-20T12:00:00.000Z'

describe('two-handed Laser rifle save compatibility', () => {
  it.each([
    { left: 'hand-buckler', right: 'hand-rifle', next: 'hand-rifle' },
    { left: 'hand-rifle', right: null, next: 'hand-rifle' },
    { left: 'hand-rifle', right: 'hand-blade', next: 'hand-blade' },
    { left: 'hand-rifle', right: 'hand-rifle', next: 'hand-rifle' },
    { left: null, right: 'hand-rifle', next: 'hand-rifle' },
  ])('reconciles left=$left right=$right in worn gear and presets', ({ left, right, next }) => {
    const rig = { ...issuedCampaignRig(), leftHand: left, rightHand: right }
    const source = {
      ...newSave('rifle-test', stamp),
      crew: [{ ...newMember(9000001), rig, presets: [{ name: 'Old fitting', rig }] }],
      campaignGear: { alloy: 7, parts: ['hand-marksman', 'back-sniper'] },
      worlds: { current: 'port', known: { port: { cleared: ['berth'] } }, missions: ['first-watch'] },
    }
    const raw = JSON.parse(JSON.stringify(source))
    const parsed = parseSave(raw)
    const expected = { ...rig, leftHand: null, rightHand: next }
    expect(parsed.crew[0]?.rig).toEqual(expected)
    expect(parsed.crew[0]?.presets[0]?.rig).toEqual(expected)
    expect(rigProblem(expected)).toBeNull()
    expect(parsed).toEqual({ ...source, crew: [{ ...source.crew[0]!, rig: expected, presets: [{ name: 'Old fitting', rig: expected }] }] })
    expect(parseSave(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed)
    expect(raw).toEqual(source)
  })

  it('normalizes older save versions without changing a frozen one-hand rifle battle or its replay', () => {
    const input = battle([unit('ally', 'squad', 0, { loadout: RIG.trooper() }), unit('foe', 'enemy', 0)], { version: 3 })
    const initial = startBattle(input).state
    const action = chooseAction(initial)
    const resolved = applyBattleAction(initial, action)
    expect(resolved.error).toBeNull()
    const source = {
      ...newSave('rifle-test', stamp),
      crew: [{ ...newMember(9000001), rig: { ...issuedCampaignRig(), leftHand: 'hand-buckler' } }],
      mission: { id: 'boarding', chapter: 'campaign', step: 'battle', squad: [9000001], battle: { input, actions: [action] }, won: null },
    }
    const { commandCinema: _cinema, management: _management, cabinVisits: _visits, ...v16 } = source
    for (const saved of [source, { ...v16, version: 16 }]) {
      const parsed = parseSave(JSON.parse(JSON.stringify(saved)))
      expect(parsed.crew[0]?.rig?.leftHand).toBeNull()
      expect(parsed.mission?.battle).toEqual(source.mission.battle)
      const replay = replayBattle(parsed.mission!.battle!.input as BattleInput, parsed.mission!.battle!.actions as [typeof action])
      expect(replay.error).toBeNull()
      expect(battleStateHash(replay.state)).toBe(battleStateHash(resolved.state))
      expect(parsed.account).toEqual(source.account)
    }
  })
})
