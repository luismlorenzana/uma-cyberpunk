import { chooseAction, legalTurns, type TurnAction } from '@cyber/battle'
import {
  newSave, parseSave, startSupply, storesAt, supplyNight,
  type CommandAction, type CommandEncounter, type GroundEncounter, type Save, type StoryPack, type SupplyNetwork,
} from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { act, resume, startSession } from '../battle/session'
import { deploy, finishBattle, recordAction, retry } from '../mission/director'
import { issueCommand, launchCommand, settleCommand } from './command'
import { settleGround } from './ground'
import { groundInput } from './training'

const assault: CommandEncounter = {
  id: 'approach', cost: { fuel: 1, provisions: 2 }, transport: 7, enemy: 8,
  assault: { emitter: 4, disabledFlag: 'emitter-disabled', call: 'Emitter disabled.' },
  threats: [{ section: 'fore', power: 4, fighters: 1 }, { section: 'aft', power: 5, fighters: 2 },
    { section: 'fore', power: 6, fighters: 2 }, { section: 'aft', power: 6, fighters: 1 }],
  calls: { evade: 'Evade', brace: 'Brace', fire: 'Fire', intercept: 'Intercept', strike: 'Strike', reroute: 'Reroute' },
}
const keepSupplies = { fuel: 2, provisions: 2, alloy: 2 }
const port = { id: 'relay', name: 'Relay', scene: 'landing', stock: keepSupplies, reserve: keepSupplies, upkeep: keepSupplies,
  produces: { ...keepSupplies, alloy: 3 }, liberation: { flag: 'liberated', alloy: 2 } }
const network: SupplyNetwork = { start: port.id, after: 'landing', ports: [port], routes: [] }
const pack: StoryPack = { casting: { schemaVersion: 1, leads: [], crewOrder: [], heroines: [], minor: [] }, worlds: {}, chapters: {},
  calls: {}, bonds: {}, events: {}, files: { manifest: { id: 'manifest', schemaVersion: 1, lines: [{ text: 'Gate route', redacted: false }] } } }
const outfit = 9000771

function ready(id: string): Save {
  return { ...newSave('captain', '2026-11-17T19:00:00Z'),
    mission: { chapter: 'relay', id, step: 'deploy', squad: [outfit], battle: null, won: null } }
}

describe('the approach and liberation', () => {
  it.each([false, true])('can clear the patrol and preserve the emitter outcome (%s)', (targetEmitter) => {
    const supply = startSupply(network)
    const fire: CommandAction = { order: 'fire', guns: 3, shields: 0, fighters: 0 }
    let save = launchCommand(ready(assault.id), supply, assault)
    let turn = 0
    if (targetEmitter) save = issueCommand(save, assault.id, turn++, { ...fire, target: 'emitter' })
    save = issueCommand(save, assault.id, turn++, fire)
    save = parseSave(JSON.parse(JSON.stringify(save)))
    save = issueCommand(save, assault.id, turn, fire)
    expect(save.mission?.won).toBe(true)
    save = settleCommand(save, assault.id)
    expect(save.story.flags.includes('emitter-disabled')).toBe(targetEmitter)
    expect(save.campaignSupply).toMatchObject({ fuel: supply.fuel - 1, provisions: supply.provisions - 2 })
  })

  it('loses when the approach window closes, and retries the frozen encounter without an outcome or another charge', () => {
    let save = launchCommand(ready(assault.id), startSupply(network), assault)
    const screen: CommandAction = { order: 'intercept', guns: 0, fighters: 2, shields: 1 }
    for (let turn = 0; turn < assault.threats.length; turn++) save = issueCommand(save, assault.id, turn, screen)
    expect(save.mission?.won).toBe(false)
    expect(settleCommand(save, assault.id)).toBe(save)
    const again = retry(save)
    expect(again.campaignSupply).toEqual(save.campaignSupply)
    expect(again.mission?.battle).toEqual({ input: save.mission?.battle?.input, actions: [] })
  })

  it.each([
    ['quarantine-board-cargo', 'back-bulwark', [1, 6]],
    ['quarantine-board-maintenance', 'back-bulwark', [5, 3]],
    ['quarantine-clear-station', 'back-deck', [1, 6]],
  ] as const)('wins and replays the authored %s scenario', (scenario, expansion, start) => {
    const input = groundInput(scenario, outfit, 'Trainee', 'hand-greatblade', expansion)
    let { session } = startSession(input)
    expect([session.state.units[0]?.x, session.state.units[0]?.y]).toEqual(start)
    for (let turn = 0; turn < 70 && !session.state.result; turn++) {
      const next = act(session, chooseAction(session.state))
      if ('error' in next) throw new Error(next.error)
      session = next.session
    }
    expect(session.state.result?.winner).toBe('squad')
    expect(resume(input, session.actions)).toEqual(session)
    if (expansion === 'back-deck') expect(session.state.field?.hacked).toContain('manifest-console')
  })

  it('captures the named Collar leader once after a resumed victory on the existing boarding map', () => {
    const ground: GroundEncounter = { id: 'rescue', title: 'Rescue', win: { flag: 'rescued-officer' },
      rescue: { unit: 'station-commander', heroine: 'test-officer', label: 'Officer' } }
    const input = groundInput('quarantine-board-cargo', outfit, 'Trainee', 'hand-greatblade', 'back-bulwark', undefined, [], undefined, ground)
    expect(input.objective).toEqual({ kind: 'freeLeader', collar: 'rigBreak' })
    expect(input.units.find((u) => u.id === ground.rescue?.unit)).toMatchObject({ hold: 'collar', ref: { kind: 'heroine', id: 'test-officer' } })
    let { session } = startSession(input)
    let save = deploy(ready(ground.id), input)
    expect(settleGround(finishBattle(save, true), ground, pack)).toMatchObject({ story: { flags: [] } })
    for (let turn = 0; turn < 80 && !session.state.result; turn++) {
      const action = chooseAction(session.state)
      const next = act(session, action)
      if ('error' in next) throw new Error(next.error)
      save = recordAction(save, action)
      session = next.session
    }
    expect(session.state.result).toMatchObject({ winner: 'squad', enemies: expect.arrayContaining([
      expect.objectContaining({ id: 'station-commander', fate: 'freed', freedBy: expect.stringMatching(/hold|rigBreak/) }),
    ]) })
    save = parseSave(JSON.parse(JSON.stringify(finishBattle(save, true))))
    expect(resume(input, session.actions)).toEqual(session)
    const settled = settleGround(save, ground, pack)
    expect(settled.story.flags).toEqual(['rescued-officer'])
    expect(settled.worlds.missions).toEqual([ground.id])
    expect(settleGround(settled, ground, pack)).toBe(settled)
  })

  it('freezes the released ally and three named contacts on a separate drydock formation', () => {
    const released = 'partner-released', paired = 'pair-established'
    const ground: GroundEncounter = {
      id: 'parley', title: 'Parley', win: { flag: 'port-won' },
      formation: {
        lead: { unit: 'trainee', outfit }, duoWhen: paired,
        ally: { unit: 'ally', heroine: 'test-ally', label: 'Ally', released, at: [0, 6], main: 'hand-greatblade', back: 'back-thruster' },
        opponents: [
          { unit: 'station-commander', from: 'station-commander', heroine: 'test-rival', label: 'Rival' },
          { unit: 'cargo-sentry', from: 'cargo-sentry', heroine: 'test-loyal', label: 'Loyal' },
          { unit: 'registrar', from: 'cargo-sentry', heroine: 'test-doubter', label: 'Doubter', at: [6, 3] },
        ],
      },
      talk: [
        { actor: 'trainee', target: 'station-commander', requires: 'actorHit', hint: 'Land a hit.', outcome: 'rival-freed', brokenOutcome: 'rival-home' },
        { actor: 'ally', target: 'cargo-sentry', requires: 'active', hint: 'Send the ally.', outcome: 'loyal-freed', brokenOutcome: 'loyal-home' },
        { actor: 'trainee', target: 'registrar', requires: 'active', hint: 'Send the lead.', outcome: 'doubter-freed', brokenOutcome: 'doubter-home' },
      ],
    }
    const deployFormation = (flags: string[]) => groundInput('drydock-command', outfit, 'Lead', 'hand-rifle', 'back-bulwark', undefined, [], undefined, ground, flags)
    expect(() => deployFormation([])).toThrow(/cleared/)
    const input = deployFormation([released, paired])
    expect(input.units.map((unit) => [unit.side, unit.ref?.id])).toEqual([
      ['squad', String(outfit)], ['squad', 'test-ally'], ['enemy', 'test-rival'], ['enemy', 'test-loyal'], ['enemy', 'test-doubter'],
    ])
    expect(input.units.slice(0, 2).map((u) => u.partner)).toEqual([{ unit: 'ally', level: 3 }, { unit: 'trainee', level: 3 }])
    expect(deployFormation([released]).units.slice(0, 2).every((unit) => !unit.partner)).toBe(true)
    const original = groundInput('drydock-command', outfit, 'Lead', 'hand-rifle', 'back-bulwark')
    expect(original.units).toHaveLength(3)
    expect(original.map.spawns.enemy).toHaveLength(2)
    const next = (session: ReturnType<typeof startSession>['session']): TurnAction => {
      const state = session.state, unit = state.active!
      const options = legalTurns(state)
      const talk = options.find(({ act }) => act.kind === 'talk')
      if (talk) return { kind: 'turn', unit, to: talk.to, act: talk.act, face: 'N' }
      const active = state.units.find((u) => u.id === unit)!
      if (active.side === 'enemy') return { kind: 'turn', unit, act: { kind: 'none' }, face: 'S' }
      const targetId = unit === 'ally' ? 'cargo-sentry' : state.units.find((u) => u.id === 'registrar')?.status === 'active' ? 'registrar' : 'station-commander'
      const target = state.units.find((u) => u.id === targetId)!
      if (unit === 'ally' && target.status !== 'active' || target.id === 'station-commander' && state.units.find((u) => u.id === 'cargo-sentry')?.status === 'active') {
        return { kind: 'turn', unit, act: { kind: 'none' }, face: 'N' }
      }
      const shot = options.find(({ act }) => act.kind === 'attack' && act.target === target.id)
      if (target.id === 'station-commander' && shot?.act.kind === 'attack') return { kind: 'turn', unit, to: shot.to, act: { ...shot.act, aim: 'core' }, face: 'N' }
      const closest = options.filter(({ act }) => act.kind === 'none').sort((a, b) =>
        Math.abs(a.to[0] - target.x) + Math.abs(a.to[1] - target.y) - Math.abs(b.to[0] - target.x) - Math.abs(b.to[1] - target.y))[0]!
      return { kind: 'turn', unit, to: closest.to, act: closest.act, face: 'N' }
    }
    let { session } = startSession(input)
    let save = deploy(ready(ground.id), input)
    for (let i = 0; !session.state.result && i < 60; i++) {
      const action = next(session)
      const result = act(session, action)
      if ('error' in result) throw new Error(result.error)
      session = result.session
      save = recordAction(save, action)
    }
    expect(session.state.result?.winner).toBe('squad')
    expect(resume(input, session.actions)).toEqual(session)
    const settled = settleGround(parseSave(JSON.parse(JSON.stringify(finishBattle(save, true)))), ground, pack)
    expect(settled.story.flags).toEqual(expect.arrayContaining(['port-won', 'loyal-freed', 'doubter-freed']))
    expect(settleGround(settled, ground, pack)).toBe(settled)
  })

  it('records capture before liberation, then grants the evidence, payout and higher output once', () => {
    const capture: GroundEncounter = { id: 'boarding', title: 'Boarding', win: { flag: 'captured' } }
    const free: GroundEncounter = { id: 'station', title: 'Station', win: { flag: 'liberated', file: 'manifest', reward: { alloy: 6, credits: 80, data: 10 } } }
    const board = ready(capture.id)
    expect(settleGround(finishBattle(board, false), capture, pack).story.flags).toEqual([])
    const captured = settleGround(finishBattle(board, true), capture, pack)
    expect(captured.story.flags).toEqual(['captured'])
    expect(captured.story.files).toEqual({})
    const station = { ...captured, mission: ready(free.id).mission }
    const victory = finishBattle(station, true)
    const liberated = settleGround(victory, free, pack)
    const reloaded = parseSave(JSON.parse(JSON.stringify(liberated)))
    expect(reloaded.story.flags).toEqual(['captured', 'liberated'])
    expect(reloaded.story.files).toEqual({ manifest: [0] })
    expect(reloaded.wallet.alloy).toBe(station.wallet.alloy + 6)
    expect(settleGround(reloaded, free, pack)).toBe(reloaded)
    const before = supplyNight(startSupply(network), network, captured.story.flags)
    const after = supplyNight(startSupply(network), network, reloaded.story.flags)
    expect(storesAt(after, port).alloy - storesAt(before, port).alloy).toBe(2)
  })
})
