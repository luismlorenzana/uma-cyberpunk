// Resume (CY8): a battle closed mid-turn reopens on the same state, by replaying its stored row; and the cut-in's speeds.
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { battleStateHash, chooseTurn, parseScenario, scenarioInput, type BattleMap } from '@cyber/battle'
import { describe, expect, it } from 'vitest'
import { clearBattle, readBattle, writeBattle } from '../sandbox/store'
import { cutInSpeed } from './playback'
import { act, resume, startSession } from './session'

const root = resolve(__dirname, '../../../..')
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), 'utf8'))
const map = json('scenarios/maps/underlevels-14.json') as BattleMap
const scenario = parseScenario(json('scenarios/sandbox-muster.json'), { 'underlevels-14': map })

describe('resume', () => {
  it('reopens a stored battle on exactly the same state', async () => {
    const input = scenarioInput(scenario, map, 1)
    let s = startSession(input).session
    for (let i = 0; i < 14 && !s.state.result; i++) {
      const r = act(s, chooseTurn(s.state))
      if ('error' in r) throw new Error(r.error)
      s = r.session
    }
    await writeBattle({ id: 'current', scenario, input, actions: s.actions, rulesVersion: input.rulesVersion, updatedAt: new Date().toISOString(), startedAt: new Date().toISOString() })
    const row = await readBattle()
    expect(row?.actions.length).toBe(s.actions.length)
    const back = resume(row!.input, row!.actions)
    expect('error' in back).toBe(false)
    if ('error' in back) return
    expect(battleStateHash(back.state)).toBe(battleStateHash(s.state))
    expect(back.tally).toEqual(s.tally)
    await clearBattle()
    expect(await readBattle()).toBeNull()
  })
  it('says so when the stored actions no longer replay, so Restart can be offered', () => {
    const input = scenarioInput(scenario, map, 1)
    const r = resume(input, [{ kind: 'turn', unit: 'nobody', act: { kind: 'none' }, face: 'N' }])
    expect('error' in r).toBe(true)
  })
})

describe('the cut-in', () => {
  it('plays Full the first time a weapon is seen and always for the leader, Quick after, never when off', () => {
    const state = startSession(scenarioInput(scenario, map, 1)).session.state
    const cue = { kind: 'attack', unit: 'gunner-a', target: 'android-1', with: 'right', band: 'short', role: 'main', facing: 'front' } as const
    expect(cutInSpeed('auto', new Set(), cue, state)).toBe('full')
    expect(cutInSpeed('auto', new Set(['gunner-a:right']), cue, state)).toBe('quick')
    expect(cutInSpeed('auto', new Set(['gunner-a:right']), { ...cue, target: 'key-1' }, state)).toBe('full')
    expect(cutInSpeed('off', new Set(), cue, state)).toBe('off')
  })
})
