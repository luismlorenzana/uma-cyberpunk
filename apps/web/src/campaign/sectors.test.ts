import { describe, expect, it } from 'vitest'
import { campaignSupport, formerDisposition, fundPortProject, newMember, newSave, parseSave, sectorAssignment, seeScene, startSupply,
  type CampaignBook, type CampaignSector, type PortProject } from '@cyber/domain'
import { assignFleetDuty } from './sectors'
import { finishCampaignDialogue, questAvailable } from './quests'
import { assignOfficer, drillOfficer } from './command'
import { settleCampaignDay } from './watch'

const outfit = 9000001
const sector: CampaignSector = { id: 'yard', title: 'Yard', port: 'local', officer: outfit, qualification: 'shields',
  liberation: 'liberate', appointment: 'assign', alloy: 2, contribution: 'Protect the repair rig', retirement: 'retire',
  former: { speaker: 'witness', custody: 'held', released: 'release', aboard: 'guest', ashore: 'resident' } }
const amounts = { fuel: 0, provisions: 0, alloy: 0 }
const project: PortProject = { id: 'depot', title: 'Depot', sector: sector.id, alloy: 4, days: 2,
  production: { ...amounts, provisions: 3 }, upkeep: { ...amounts, alloy: 1 } }
const opening = { id: 'start', title: 'Start', scene: 'opening' }
const liberated = { id: 'liberate', title: 'Liberate', scene: 'liberated', after: 'start', port: 'local' }
const appointment = { id: 'assign', title: 'Appoint', scene: 'appointed', after: 'liberate', port: 'local' }
const joint = { id: 'joint', title: 'Joint watch', scene: 'joint-watch', after: 'assign', requires: ['discovery'], port: 'local' }
const discovery = { id: 'discovery', title: 'Discovery', scene: 'found', after: 'start', port: 'local' }
const supply = { after: 'start', start: 'local', routes: [], ports: [{ id: 'local', name: 'Local', scene: 'land',
  produces: amounts, upkeep: amounts, reserve: amounts, stock: { fuel: 9, provisions: 9, alloy: 9 } }] }
const book: CampaignBook = { opening: opening.id, quests: [opening, liberated, appointment, joint, discovery], draft: true,
  supply, projects: [project], sectors: [sector], pairs: [], assets: [], art: [], scenes: new Map(), commands: new Map(), ground: new Map(),
  story: { casting: { schemaVersion: 1, crewOrder: [outfit], leads: [], heroines: [], minor: [] }, worlds: {}, chapters: {},
    calls: {}, bonds: {}, events: {}, files: {} } }

function checkpoint() {
  const save = newSave('preview', '2026-11-17T00:00:00Z')
  return { ...save, crew: [newMember(outfit)], campaignSupply: startSupply(supply),
    story: seeScene(seeScene(save.story, opening.scene), liberated.scene), commandCrew: { pilot: { outfit, drills: 1, trainedDay: 1 } } }
}

describe('authored sector progress', () => {
  it('moves an officer to her own sector and keeps custody and the joint prerequisite independent', () => {
    const ready = checkpoint()
    const appointed = finishCampaignDialogue(ready, book, appointment, [{ kind: 'flag', flag: 'held', set: true }], 'local')
    expect(sectorAssignment(book, appointed.story, sector)).toBe('command')
    expect(formerDisposition(book, appointed.story, sector)).toBe('In local custody')
    expect(appointed.crew).toEqual(ready.crew)
    expect(appointed.commandCrew).toEqual({})
    expect(campaignSupport(book, appointed).ashore.has(outfit)).toBe(true)
    expect(questAvailable(appointed, book, joint, 'local')).toBe(false)
    const discovered = finishCampaignDialogue(appointed, book, discovery, [], 'local')
    expect(questAvailable(discovered, book, joint, 'local')).toBe(true)
    expect(assignFleetDuty(discovered, book, sector, true)).toBe(discovered)
  })

  it('starts and settles production once across reload', () => {
    const ready = finishCampaignDialogue(checkpoint(), book, appointment, [], 'local')
    const funded = fundPortProject(ready, book, project)
    expect(funded.wallet.alloy).toBe(ready.wallet.alloy - 4)
    expect(fundPortProject(funded, book, project)).toBe(funded)
    const first = parseSave(settleCampaignDay(funded, { day: 2, pending: null }, book))
    const completed = settleCampaignDay(first, { day: 3, pending: null }, book)
    expect(completed.campaignProjects.depot).toBe(0)
    expect(completed.campaignSupply?.stores.local?.provisions).toBe(12)
    expect(settleCampaignDay(completed, { day: 3, pending: null }, book)).toEqual(completed)
  })

  it('preserves per-station drill history through reassignment', () => {
    const save = { ...checkpoint(), mission: { id: 'test', chapter: 'test', step: 'deploy' as const, squad: [outfit], battle: null, won: null } }
    const switched = assignOfficer(save, 'shields', outfit)
    const trained = parseSave(drillOfficer(switched, 'shields'))
    expect(assignOfficer(trained, 'pilot', outfit).commandCrew.pilot?.drills).toBe(1)
    expect(trained.commandTraining[outfit]?.shields?.drills).toBe(1)
  })
})
