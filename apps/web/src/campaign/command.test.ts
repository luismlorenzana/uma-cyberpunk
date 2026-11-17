import { newMember, newSave, parseSave, resumeCommand, type CampaignSupply, type CommandAction, type CommandEncounter, type Save } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { retry } from '../mission/director'
import { assignOfficer, drillOfficer, issueCommand, launchCommand, settleCommand } from './command'

const encounter: CommandEncounter = {
  id: 'relay-convoy', cost: { fuel: 1, provisions: 2 }, transport: 6, enemy: 15,
  threats: [{ section: 'fore', power: 5, fighters: 2 }, { section: 'aft', power: 8, fighters: 3 },
    { section: 'fore', power: 8, fighters: 4 }, { section: 'aft', power: 9, fighters: 1 }],
  calls: { evade: 'Turning', brace: 'Shielding', fire: 'Firing', intercept: 'Intercepting', strike: 'Striking', reroute: 'Rerouting' },
}
const stock: CampaignSupply = { port: 'relay', stores: {}, fuel: 6, provisions: 4, shortfall: 0, reliefDay: null }
const outf = 9000701

const ready = (): Save => ({ ...newSave('captain', '2026-11-17T19:00:00Z'), crew: [newMember(outf)], campaignSupply: stock,
  mission: { chapter: 'relay', id: encounter.id, step: 'deploy', squad: [outf], battle: null, won: null } })

describe('campaign ship command', () => {
  it('freezes assigned skills and charges launch only once', () => {
    const assigned = assignOfficer(ready(), 'gunnery', outf)
    const trained = drillOfficer(assigned, 'gunnery')
    expect(drillOfficer(trained, 'gunnery')).toBe(trained)
    const loaded = parseSave(JSON.parse(JSON.stringify(trained)))
    const battle = launchCommand(loaded, stock, encounter)
    expect(battle.campaignSupply).toMatchObject({ fuel: 5, provisions: 2 })
    expect(battle.mission?.battle?.input).toMatchObject({ officers: { gunnery: 1, pilot: 0, shields: 0, engineering: 0 } })
    expect(launchCommand(battle, stock, encounter)).toBe(battle)
    const short = { ...stock, fuel: 0 }
    expect(launchCommand(loaded, short, encounter)).toBe(loaded)
  })

  it('loses unprotected, retries for free, resumes and wins with focused fire', () => {
    let save = launchCommand(ready(), stock, encounter)
    const evade: CommandAction = { order: 'evade', shields: 1, guns: 1, fighters: 1 }
    const fire: CommandAction = { order: 'fire', shields: 0, guns: 3, fighters: 0 }
    for (let turn = 0; turn < 3; turn++) save = issueCommand(save, encounter.id, turn, evade)
    expect(save.mission?.won).toBe(false)
    save = retry(save)
    const first = issueCommand(save, encounter.id, 0, fire)
    expect(issueCommand(first, encounter.id, 0, fire)).toBe(first)
    save = parseSave(JSON.parse(JSON.stringify(first)))
    const replay = resumeCommand(save.mission?.battle?.input, save.mission!.battle!.actions)
    expect(replay?.state).toMatchObject({ turn: 1, enemy: 10, transport: 4 })
    save = issueCommand(issueCommand(save, encounter.id, 1, fire), encounter.id, 2, fire)
    expect(save.mission?.won).toBe(true)
    expect(save.campaignSupply).toMatchObject({ fuel: 5, provisions: 2 })
    const cleared = settleCommand(save, encounter.id)
    expect(cleared.worlds.missions).toEqual([encounter.id])
    expect(cleared.mission).toBeNull()
    expect(settleCommand(cleared, encounter.id)).toBe(cleared)
  })

  it('rejects power overdrafts and applies fighter and engineering orders', () => {
    const save = launchCommand(ready(), stock, encounter)
    expect(issueCommand(save, encounter.id, 0, { order: 'fire', shields: 1, guns: 2, fighters: 1 })).toBe(save)
    const blocked = issueCommand(save, encounter.id, 0, { order: 'intercept', shields: 1, guns: 1, fighters: 1 })
    const rerouted = issueCommand(blocked, encounter.id, 1, { order: 'reroute', shields: 2, guns: 0, fighters: 1 })
    const first = resumeCommand(blocked.mission!.battle!.input, blocked.mission!.battle!.actions)
    const second = resumeCommand(rerouted.mission!.battle!.input, rerouted.mission!.battle!.actions)
    expect(first?.state.last?.intercepted).toBe(2)
    expect(second?.state.power).toBe(4)
  })
})
