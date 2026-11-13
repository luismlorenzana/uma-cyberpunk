// The golden replays (CY4, BP5): each file holds a battle's input, its actions, every cue and the final state's hash.
// Replaying must give exactly the same, so a rule or a number that changes by accident fails here, naming the battle.
// `UPDATE_GOLDEN=1 pnpm test` rewrites the files (the greedy player makes new actions); the commit says why.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyBattleAction, battleStateHash, replayBattle, startBattle } from '../battle'
import type { BattleAction, BattleInput, Cue } from '../types'
import { GOLDEN } from './battles'
import { greedyTurn } from './policy'

interface GoldenFile { name: string; input: BattleInput; actions: BattleAction[]; cues: Cue[][]; result: unknown; hash: string }

const UPDATE = process.env.UPDATE_GOLDEN === '1'
const file = (name: string) => join(__dirname, `${name}.json`)

function record(name: string, input: BattleInput): GoldenFile {
  const start = startBattle(input)
  let state = start.state
  const actions: BattleAction[] = [], cues: Cue[][] = [start.cues]
  for (let i = 0; i < 300 && !state.result; i++) {
    const action = greedyTurn(state)
    const r = applyBattleAction(state, action)
    if (r.error) throw new Error(`${name}: the greedy player made an illegal turn: ${r.error}`)
    actions.push(action)
    cues.push(r.cues)
    state = r.state
  }
  return { name, input, actions, cues, result: state.result, hash: battleStateHash(state) }
}

describe('golden replays', () => {
  it('has at least six battles on two maps', () => {
    expect(Object.keys(GOLDEN).length).toBeGreaterThanOrEqual(6)
    expect(new Set(Object.values(GOLDEN).map((g) => g.map.id)).size).toBe(2)
  })
  for (const [name, input] of Object.entries(GOLDEN)) {
    it(`${name} replays to the same cues and state`, () => {
      if (UPDATE || !existsSync(file(name))) writeFileSync(file(name), `${JSON.stringify(record(name, input))}\n`)
      const golden = JSON.parse(readFileSync(file(name), 'utf8')) as GoldenFile
      const replay = replayBattle(golden.input, golden.actions)
      expect(replay.error, `${name}: replay stopped`).toBeNull()
      expect(replay.state.result, `${name}: the battle should end`).not.toBeNull()
      expect(replay.cues, `${name}: the cues changed`).toEqual(golden.cues)
      expect(battleStateHash(replay.state), `${name}: the final state changed`).toBe(golden.hash)
    })
  }
})
