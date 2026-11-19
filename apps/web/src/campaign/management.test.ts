import {
  newMember, newSave, parseSave, startSupply, storesAt,
  type Scene, type CampaignBook, type CampaignWorkshop, type Save, type SupplyNetwork,
} from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { groundInput } from './training'
import { settleCampaignDay } from './watch'
import { craftCampaignPart, fitCampaignPart, fittedGroundRig, sendWorkshopAlloy } from './workshop'
import { fundPortProject, developedPort, freePlace, moduleAt, observeManagement, placeModule } from '@cyber/domain'
import { acknowledgeManagement, locationAvailable, locationPropVisible, locationState, managementReports } from './management'

const outfit = 9000301
const second = 9000302
const mission = { id: 'boarding', place: 'relay', objective: { kind: 'defeat-leader' as const }, brief: 'Reach the commander.',
  enemies: [], fixedSquad: [outfit], side: [], scenario: 'quarantine-board-cargo' }
const workshop: CampaignWorkshop = { after: 'workshop', port: 'relay', missions: [mission.id], recipes: [
  { part: 'arm-guard', slot: 'leftArm', alloy: 3, icon: 'guard' },
  { part: 'back-missiles', slot: 'back', alloy: 4, icon: 'pod' },
] }
const port = { id: 'relay', name: 'Relay', scene: 'landing',
  stock: { fuel: 10, provisions: 10, alloy: 11 }, produces: { fuel: 1, provisions: 1, alloy: 2 },
  upkeep: { fuel: 1, provisions: 1, alloy: 1 }, reserve: { fuel: 0, provisions: 0, alloy: 2 } }
const supply: SupplyNetwork = { after: 'recruitment', start: 'relay', ports: [port], routes: [] }
const baseBook: CampaignBook = {
  opening: 'recruitment', draft: true, assets: [], art: [], scenes: new Map(), commands: new Map(), pairs: [], workshop, supply,
  quests: [
    { id: 'recruitment', title: 'Recruitment', scene: 'recruited' },
    { id: 'convoy', title: 'Convoy debrief', scene: 'convoy-cleared', after: 'recruitment' },
    { id: 'workshop', title: 'Workshop', scene: 'workshop-tour', after: 'recruitment', port: 'relay' },
  ],
  ground: new Map([[mission.id, { id: mission.id, title: 'Boarding', alternate: { flag: 'emitter', scenario: 'quarantine-board-maintenance',
    label: 'Hatch open' }, win: {} }]]),
  story: { casting: { schemaVersion: 1, leads: [], crewOrder: [outfit, second], heroines: [], minor: [] }, worlds: {},
    chapters: { relay: { id: 'relay', schemaVersion: 1, world: 'relay', leads: [outfit], number: 2, danger: 1, needs: [],
      scenes: [], missions: [mission], debrief: { steps: [] } } }, files: {}, calls: {}, bonds: {}, events: {} },
}

const facility = { id: 'facility', title: 'Depot', family: 'planet' as const, entry: { kind: 'project' as const, project: 'depot' }, scene: 'room',
  visual: { slot: 'facility', fallback: 'plate' }, states: { building: { slot: 'building', fallback: 'plate' }, complete: { slot: 'complete', fallback: 'plate' } } }
const hangar = { ...facility, id: 'hangar', title: 'Hangar', family: 'operations' as const, entry: { kind: 'workshop' as const },
  prop: { asset: 'crate', when: 'hangar-alloy' as const, x: 0, y: 0, width: 100, height: 50 } }
const project = { id: 'depot', title: 'Depot', sector: 'local', alloy: 4, days: 2,
  production: { fuel: 0, provisions: 3, alloy: 0 }, upkeep: { fuel: 0, provisions: 0, alloy: 1 } }
const roomScene = { id: 'room', place: 'relay', trigger: { arrive: 'relay' }, cast: [], steps: [{ kind: 'narrate' as const, text: 'The work ledger is open.' }] }
const book: CampaignBook = { ...baseBook, projects: [project], sectors: [{ id: 'local', title: 'Local command', port: 'relay', officer: outfit,
  qualification: 'pilot', liberation: 'convoy', appointment: 'appoint', alloy: 0, contribution: 'Keep the civilian service open' }],
  quests: [...baseBook.quests, { id: 'appoint', title: 'Appoint', scene: 'appointed' }],
  scenes: new Map<string, Scene>([['room', roomScene], ['officer-report', { ...roomScene, id: 'officer-report', steps: [{ kind: 'line', speaker: outfit, text: 'Here is the local receipt.' }] }]]),
  management: { after: 'recruitment', locations: [facility, hangar], reports: [
    { kind: 'shipment', destination: 'hangar', location: 'hangar', scene: 'officer-report', fallback: 'room' },
    { kind: 'fitted', location: 'hangar', scene: 'officer-report', fallback: 'room' },
    { kind: 'project-complete', location: 'facility', scene: 'room', fallback: 'room' },
  ] } }
function recruited(): Save {
  const save = newSave('captain', '2026-11-17T00:00:00Z')
  return { ...save, crew: [newMember(outfit), newMember(second)], campaignSupply: startSupply(supply),
    story: { ...save.story, seen: ['recruited', 'workshop-tour'] } }
}
const restored = (save: Save) => parseSave(JSON.parse(JSON.stringify(save)))

describe('campaign management locations', () => {
  it('keeps reserves and destinations separate through a paid fitting into a real boarding loadout', () => {
    let save = recruited()
    expect(locationState(save, book, hangar)).toBe('ready')
    expect(locationPropVisible(save, book, hangar)).toBe(false)
    save = restored(sendWorkshopAlloy(save, book))
    expect(storesAt(save.campaignSupply!, port).alloy).toBe(7)
    expect(save.campaignGear.alloy).toBe(4)
    expect(save.wallet).toEqual(recruited().wallet)
    expect(save.management.receipts.at(-1)).toMatchObject({ kind: 'shipment', destination: 'hangar', amount: 4 })
    expect(locationState(save, book, hangar)).toBe('stocked')
    expect(locationPropVisible(save, book, hangar)).toBe(true)
    save = restored(craftCampaignPart(save, book, 'arm-guard'))
    expect(save.campaignGear.alloy).toBe(1)
    expect(locationState(save, book, hangar)).toBe('stocked') // Owning a part is not fitting it.
    expect(craftCampaignPart(save, book, 'arm-guard')).toBe(save)
    save = restored(fitCampaignPart(save, book, outfit, 'arm-guard', true))
    expect(locationState(save, book, hangar)).toBe('fitted')
    const rig = fittedGroundRig(save.crew[0]!.rig, mission.scenario)!
    const input = groundInput(mission.scenario, outfit, 'Lead', 'hand-rifle', 'back-bulwark', undefined, [], rig)
    expect(input.units.find(unit => unit.side === 'squad')!.loadout.leftArm.hp).toBe(6)
    expect(fitCampaignPart(save, book, outfit, 'arm-guard', true)).toBe(save)
    const sequence = save.management.sequence
    save = restored(fitCampaignPart(save, book, outfit, 'arm-guard', false))
    expect(locationState(save, book, hangar)).toBe('stocked')
    expect(save.management.sequence).toBe(sequence)
    save = sendWorkshopAlloy(sendWorkshopAlloy(save, book), book)
    expect(storesAt(save.campaignSupply!, port).alloy).toBe(port.reserve.alloy + port.upkeep.alloy)
    expect(sendWorkshopAlloy(save, book)).toBe(save)
  })

  it('requires local appointments and real funding, completes once at night and survives reload or an old pack', () => {
    let save = recruited()
    expect(locationAvailable(save, book, facility)).toBe(false)
    save = { ...save, story: { ...save.story, seen: [...save.story.seen, 'appointed'] }, wallet: { ...save.wallet, alloy: 3 } }
    expect(locationAvailable(save, book, facility)).toBe(true)
    expect(fundPortProject(save, book, project)).toBe(save)
    save = { ...save, wallet: { ...save.wallet, alloy: 4 } }
    save = restored(fundPortProject(save, book, project))
    expect(save.wallet.alloy).toBe(0)
    expect(locationState(save, book, facility)).toBe('building')
    expect(locationState({ ...save, story: { ...save.story, flags: ['project-ready-depot'] } }, book, facility)).toBe('building')
    expect(developedPort(book, save, port).produces.provisions).toBe(port.produces.provisions)
    expect(fundPortProject(save, book, project)).toBe(save)
    save = restored(settleCampaignDay(save, { day: 2, pending: null }, book))
    expect(locationState(save, book, facility)).toBe('building')
    save = restored(settleCampaignDay(save, { day: 3, pending: null }, book))
    expect(locationState(save, book, facility)).toBe('complete')
    expect(developedPort(book, save, port).produces.provisions).toBe(port.produces.provisions + 3)
    const report = managementReports(save, book, facility)[0]!
    expect(report.event).toMatchObject({ kind: 'project-complete', day: 3, port: 'relay' })
    const supplyBefore = save.campaignSupply, sequence = save.management.sequence
    save = restored(acknowledgeManagement(save, report.key))
    expect(managementReports(save, book, facility)).toEqual([])
    expect(save.campaignSupply).toEqual(supplyBefore)
    save = settleCampaignDay(save, save.campaignDay, book)
    expect(save.management.sequence).toBe(sequence)
    expect(settleCampaignDay(save, { day: 2, pending: null }, book)).toBe(save)
    expect(locationAvailable(save, { ...book, management: undefined }, facility)).toBe(false)
    expect(locationAvailable(save, book, facility)).toBe(true)
  })

  it('records a remote project completion at its home port, not the ship’s current dock', () => {
    const funded = fundPortProject({ ...recruited(), story: { ...recruited().story, seen: ['recruited', 'appointed'] } }, book, project)
    const away = { ...funded, campaignProjects: { depot: 1 }, campaignSupply: { ...funded.campaignSupply!, port: 'other' } }
    const complete = settleCampaignDay(away, { day: 2, pending: null }, book)
    expect(complete.management.receipts.at(-1)).toMatchObject({ subject: 'depot', port: 'relay' })
    expect(managementReports(complete, book, facility)).toEqual([])
  })

  it('uses a present officer only, and persists optional report acknowledgement independently of art', () => {
    let save = sendWorkshopAlloy(recruited(), book)
    expect(managementReports(save, book, hangar)[0]!.scene).toBe('officer-report')
    const ashore = { ...save, story: { ...save.story, seen: [...save.story.seen, 'appointed'] } }
    expect(managementReports(ashore, book, hangar)[0]!.scene).toBe('room')
    save = fitCampaignPart(craftCampaignPart(save, book, 'arm-guard'), book, second, 'arm-guard', true)
    expect(managementReports(save, book, hangar).find(report => report.event.kind === 'fitted')!.scene).toBe('room')
    const report = managementReports(save, book, hangar)[0]!
    const acknowledged = restored(acknowledgeManagement(save, report.key))
    expect(acknowledgeManagement(acknowledged, report.key)).toBe(acknowledged)
    expect(managementReports(acknowledged, book, hangar).some(row => row.key === report.key)).toBe(false)
    expect(acknowledged.campaignGear).toEqual(save.campaignGear)
    expect(acknowledged.ship).toEqual(save.ship)
  })

  it('shows shared rooms and custody only for the saved residence and actual local custody decision', () => {
    const sector = { ...book.sectors![0]!, former: { speaker: 'witness', custody: 'held', released: 'release', aboard: 'guest', ashore: 'resident' },
      shared: { after: 'appoint', visit: 'joint-visit', morning: 'joint-morning' } }
    const current = { ...book, sectors: [sector] }
    const shared = { ...facility, entry: { kind: 'shared' as const } }, custody = { ...facility, entry: { kind: 'custody' as const } }
    let save = recruited()
    expect(locationAvailable(save, current, shared)).toBe(false)
    save = { ...save, story: { ...save.story, seen: [...save.story.seen, 'convoy-cleared', 'joint-visit'], flags: ['guest'] } }
    expect(locationAvailable(save, current, shared)).toBe(true)
    expect(locationAvailable({ ...save, crew: [] }, current, shared)).toBe(false)
    expect(locationAvailable({ ...save, story: { ...save.story, seen: [...save.story.seen, 'appointed'] } }, current, shared)).toBe(false)
    save = { ...save, story: { ...save.story, flags: ['held'] } }
    expect(locationAvailable(save, current, custody)).toBe(true)
    expect(locationAvailable({ ...save, story: { ...save.story, flags: ['release'] } }, current, custody)).toBe(false)
  })

  it('shows a drive only after the paid build completes, never on reservation or repeated observation', () => {
    let save = recruited()
    const ship = { ...save.ship, unlocked: [...save.ship.unlocked, 'engines' as const] }, slot = freePlace(ship, 'engines')!
    const built = placeModule(ship, { credits: 300, alloy: 20, data: 10 }, 'engines', slot.deck, slot.slot)!
    save = restored(observeManagement(save, { ...save, ...built }))
    expect(moduleAt(save.ship, 'engines')!.level).toBe(0)
    expect(locationState(save, book, { ...facility, entry: { kind: 'module', module: 'engineering' } })).toBe('building')
    expect(save.management.receipts.at(-1)!.kind).toBe('refit-start')
    save = restored(settleCampaignDay(save, { day: 2, pending: null }, book))
    expect(moduleAt(save.ship, 'engines')!.building).not.toBeNull()
    save = restored(settleCampaignDay(save, { day: 3, pending: null }, book))
    expect(moduleAt(save.ship, 'engines')!.level).toBe(1)
    expect(locationState(save, book, { ...facility, entry: { kind: 'module', module: 'engineering' } })).toBe('complete')
    expect(save.management.receipts.at(-1)).toMatchObject({ kind: 'refit-complete', subject: 'engines', amount: 1 })
    expect(observeManagement(save, { ...save })).toEqual(save)
    expect(save.wallet).toEqual({ credits: 0, alloy: 0, data: 0 })
  })
})
