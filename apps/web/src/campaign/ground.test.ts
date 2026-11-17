import { chooseAction } from '@cyber/battle'
import {
  newSave, parseSave, startSupply, storesAt, supplyNight,
  type CommandAction, type CommandEncounter, type GroundEncounter, type Save, type StoryPack, type SupplyNetwork,
} from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { act, resume, startSession } from '../battle/session'
import { finishBattle, retry } from '../mission/director'
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
