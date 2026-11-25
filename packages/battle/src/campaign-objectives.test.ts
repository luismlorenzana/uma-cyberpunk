import { describe, expect, it } from 'vitest'
import { applyBattleAction, battleStateHash, replayBattle, startBattle } from './battle'
import { battle, placed, RIG, RIG2, unit, W } from './fixtures'
import { legalTurns } from './legal'
import { edit, unitOf } from './test-kit'
import type { BattleInput, TalkContact, TurnAction } from './types'

const fast = { speed: 5, stamina: 3, power: 3, guts: 3, wit: 5 } as const
const slow = { ...fast, speed: 1, guts: 1 } as const
const blade = { ...RIG.striker(), visor: { load: 1, aim: true }, rightHand: { ...W.blade, power: 300, accuracy: 150 } }
const attack: TurnAction = { kind: 'turn', unit: 'lead', act: { kind: 'attack', target: 'officer', with: 'right', aim: 'core' }, face: 'N' }
const talk = (unit: string, target = 'officer'): TurnAction => ({ kind: 'turn', unit, act: { kind: 'talk', target }, face: 'N' })
const contact = { actor: 'lead', target: 'officer', requires: 'actorHit', hint: 'Land a hit before talking.', outcome: 'officer-released', brokenOutcome: 'officer-home' } as const

function setup(seed: string, objective: BattleInput['objective'], version = 5, contacts?: readonly TalkContact[]): BattleInput {
  return {
    ...battle([
      unit('lead', 'squad', 0, { bands: fast, loadout: blade }),
      unit('staff', 'squad', 1, { bands: slow }),
      unit('officer', 'enemy', 0, { bands: slow, hold: 'collar', leader: true, facing: 'N' }),
    ], { version, objective, seed, map: placed([[3, 5], [4, 4]], [[3, 4]]) }),
    ...(contacts ? { talk: contacts } : {}),
  }
}

function breakCore(make: (seed: string) => BattleInput) {
  for (let i = 0; i < 80; i++) {
    const input = make(`collar-${i}`)
    const outcome = applyBattleAction(startBattle(input).state, attack)
    if (outcome.cues.some((c) => c.kind === 'rigBreak')) return { input, ...outcome }
  }
  throw new Error('No Core break')
}

describe('the opt-in Collar rescue', () => {
  it('frees the marked leader on Rig Break while older free-leader replays lose at the same break', () => {
    const r = breakCore((seed) => setup(seed, { kind: 'freeLeader', collar: 'rigBreak' }))
    expect(r.cues).toContainEqual({ kind: 'freed', unit: 'officer', by: 'rigBreak' })
    expect(unitOf(r.state, 'officer')).toMatchObject({ status: 'freed', holdHp: 0 })
    expect(r.state.result).toMatchObject({ winner: 'squad', enemies: [{ id: 'officer', fate: 'freed', freedBy: 'rigBreak' }] })
    expect(replayBattle(r.input, [attack]).cues[1]).toEqual(r.cues)
    const old = setup(r.input.seed, { kind: 'freeLeader' }, 4)
    const legacyReplay = replayBattle(old, [attack])
    expect(legacyReplay.error).toBeNull()
    expect(unitOf(legacyReplay.state, 'officer').status).toBe('down')
    expect(legacyReplay.state.result?.winner).toBe('enemy')
    expect(legacyReplay.cues[1]?.some((c) => c.kind === 'freed')).toBe(false)
  })

  it('preserves missed and successful Jack-Outs without recording capture for a miss', () => {
    const action: TurnAction = { kind: 'turn', unit: 'lead', act: { kind: 'tech', target: 'officer', tech: 'jackout' }, face: 'N' }
    const seen = new Set<boolean>()
    for (let i = 0; i < 80 && seen.size < 2; i++) {
      const base = setup(`jack-${i}`, { kind: 'freeLeader', collar: 'rigBreak' })
      const input = { ...base, units: base.units.map((u) => u.id === 'lead' ? { ...u, loadout: RIG2.netrunner() } : u) }
      const state = edit(edit(startBattle(input).state, 'lead', (u) => { u.charge = 3 }), 'officer', (u) => { u.hp.core = 1 })
      const r = applyBattleAction(state, action)
      const cue = r.cues.find((c) => c.kind === 'tech')
      if (!cue) throw new Error(r.error ?? 'Missing Jack-Out cue')
      seen.add(cue.landed)
      expect(r.state.result?.winner).toBe(cue.landed ? 'squad' : undefined)
      expect(r.cues.some((c) => c.kind === 'freed' && c.by === 'jackout')).toBe(cue.landed)
      if (cue.landed) expect(r.state.result?.enemies?.[0]?.freedBy).toBe('jackout')
    }
    expect([...seen]).toHaveLength(2)
  })
})

describe('encounter-authored Talk', () => {
  it('requires the named actor, a legal adjacent tile and the authored target state', () => {
    const available = { ...contact, requires: 'active' } as const
    const s = startBattle(setup('talk', { kind: 'defeatLeader' }, 5, [available])).state
    expect(legalTurns(s).some(({ act }) => act.kind === 'talk')).toBe(true)
    expect(applyBattleAction({ ...s, active: 'staff' }, talk('staff')).error).toMatch(/no Talk/)
    expect(applyBattleAction(s, { ...talk('lead'), to: [3, 7] }).error).toMatch(/next to/)
    expect(applyBattleAction(startBattle(setup('talk', { kind: 'defeatLeader' }, 5, [contact])).state, talk('lead')).error).toBe(contact.hint)
    const r = applyBattleAction(s, talk('lead'))
    expect(r.state.result).toMatchObject({ winner: 'squad', enemies: [{ id: 'officer', talk: contact.outcome, fate: 'freed', salvage: [] }] })
    expect(r.state.turn).toBe(s.turn + 1)
    expect(applyBattleAction(r.state, talk('lead')).cues).toEqual([])
  })

  it('uses only the named ally’s hit for the Rival and replays the choice exactly', () => {
    const weakBlade = { ...blade, rightHand: { ...blade.rightHand, power: 5 } }
    const make = (seed: string): BattleInput => {
      const base = setup(seed, { kind: 'defeatLeader' }, 5, [contact])
      return { ...base, units: base.units.map((u) => u.side === 'squad' ? { ...u, loadout: weakBlade } : u) }
    }
    const wait = (unit: string): TurnAction => ({ kind: 'turn', unit, act: { kind: 'none' }, face: 'N' })
    for (let i = 0; i < 80; i++) {
      const input = make(`rival-${i}`)
      const initial = startBattle(input).state
      const offActor = applyBattleAction({ ...initial, active: 'staff' }, { ...attack, unit: 'staff' })
      const hit = applyBattleAction(initial, attack)
      if (!offActor.cues.some((c) => c.kind === 'hit') || !hit.cues.some((c) => c.kind === 'hit')) continue
      expect(unitOf(offActor.state, 'officer').talkHit).toBeUndefined()
      let state = hit.state
      const actions: TurnAction[] = [attack]
      while (state.active !== 'lead' && actions.length < 6) {
        const action = wait(state.active!)
        actions.push(action)
        state = applyBattleAction(state, action).state
      }
      expect(legalTurns(state).some(({ act }) => act.kind === 'talk')).toBe(true)
      const result = applyBattleAction(state, talk('lead'))
      expect(result.cues.filter((c) => c.kind === 'talked')).toEqual([
        { kind: 'talked', unit: 'lead', target: contact.target, outcome: contact.outcome },
      ])
      expect(result.state.result?.winner).toBe('squad')
      const replay = replayBattle(JSON.parse(JSON.stringify(input)), [...actions, talk('lead')])
      expect(replay.error).toBeNull()
      expect(battleStateHash(replay.state)).toBe(battleStateHash(result.state))
      return
    }
    throw new Error('No pair of landed hits')
  })

  it('wins by breaking the leader’s rig and reports the authored home outcome', () => {
    const r = breakCore((seed) => setup(seed, { kind: 'defeatLeader' }, 5, [contact]))
    expect(r.state.result).toMatchObject({ winner: 'squad', enemies: [{ id: 'officer', fate: 'broken', home: contact.brokenOutcome }] })
    expect(r.state.result?.enemies?.[0]?.talk).toBeUndefined()
  })

  it('rejects legacy Talk, duplicate targets and contacts with no possible named actor', () => {
    expect(() => startBattle(setup('talk', { kind: 'defeatLeader' }, 4, [contact]))).toThrow(/version 5/)
    expect(() => startBattle(setup('talk', { kind: 'defeatLeader' }, 5, [contact, contact]))).toThrow(/unique/)
    expect(() => startBattle(setup('talk', { kind: 'defeatLeader' }, 5, [{ ...contact, actor: 'missing' }]))).toThrow(/squad unit/)
  })
})
