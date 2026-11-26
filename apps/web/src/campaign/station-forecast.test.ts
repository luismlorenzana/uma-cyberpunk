import { COMMAND_HULL, firstStation, newSave, parseCampaignBook, requestRelief, startSupply, STAND_IN_FILES,
  type CampaignBook, type FixedDuo, type SupplyNetwork } from '@cyber/domain'
import { expect, it } from 'vitest'
import { expeditionLaunchBudget, requestTenderRelief, resumeVoyage, tendAtBerth } from './expedition'
import { forecastStation, stationBuildForecast } from './station-forecast'
import { advanceStationWatches, repairStarterCutter } from './watch'

const supply: SupplyNetwork = {
  after: 'opening', start: 'relay', routes: [],
  ports: [{ id: 'relay', name: 'Relay', scene: 'opening', stock: { fuel: 0, provisions: 0, alloy: 0 },
    produces: { fuel: 3, provisions: 4, alloy: 0 }, upkeep: { fuel: 0, provisions: 0, alloy: 0 },
    reserve: { fuel: 0, provisions: 0, alloy: 0 } }],
}
const duo: FixedDuo = {
  id: 'relay-duo', system: 'relay', umas: [9000301, 9000302], returns: [],
  expedition: { ship: 'test-cutter', members: [], route: { name: 'Relay expedition', launch: 'launch',
    stops: ['approach'], return: 'return', cargo: { fuel: 5, provisions: 6 } } },
}
const calls = { evade: 'Evade', brace: 'Brace', fire: 'Fire', intercept: 'Intercept', strike: 'Strike', reroute: 'Reroute' }
const book: CampaignBook = {
  ...parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': { schemaVersion: 1, draft: true,
    opening: 'opening', quests: [{ id: 'opening', title: 'First Watch', scene: 'sw1-ch1-s1' }], art: [], assets: [] } }),
  supply, fourAct: { schemaVersion: 1, systems: new Map(), arcs: new Map(), duos: new Map([[duo.id, duo]]),
    personalQuestOwners: new Map(), transit: { flag: 'gate-open', quests: ['crossing'] } },
  stationStory: { transition: new Map(), observances: [], commandWatches: new Map([['gate-patrol', 2]]) },
  quests: [
    { id: 'launch', title: 'Launch', scene: 'launch', port: 'relay' },
    { id: 'crossing', title: 'Cross the Gate', scene: 'crossing', encounter: 'gate-patrol' },
    { id: 'approach', title: 'Approach', scene: 'approach', encounter: 'blockade' },
    { id: 'return', title: 'Return', scene: 'return', port: 'relay' },
  ],
  commands: new Map([
    ['gate-patrol', { id: 'gate-patrol', transport: 10, enemy: 10, threats: [], calls, cost: { fuel: 2, provisions: 2 } }],
    ['blockade', { id: 'blockade', transport: 10, enemy: 10, threats: [], calls, cost: { fuel: 2, provisions: 3 } }],
  ]),
}

function start() {
  return { ...newSave('captain', '2026-11-26T00:00:00Z'), campaignSupply: startSupply(supply), station: firstStation(1, 'relay') }
}

it('previews power and ration consequences with the live settlement path, without advancing the save', () => {
  const blank = start()
  const save = { ...blank, wallet: { ...blank.wallet, alloy: 36 }, station: { ...blank.station, rooms: { fabrication: 0 },
    reserves: { fuel: 0, provisions: 1 }, automaticRations: false } }
  expect(stationBuildForecast(save, book, 'shipyard')).toEqual({
    at: 4, power: { supply: 4, used: 2 }, berths: 20, powered: false, stock: 0,
  })
  const preview = forecastStation(save, book, 3)
  expect(preview.dawns.get(3)).toMatchObject({ due: 2, short: 1, reserves: 0 })
  expect(preview.final).toEqual(advanceStationWatches(save, book, 3))
  expect(save.station.absoluteWatch).toBe(0)
  expect(save.station.reserves.provisions).toBe(1)
})

it('advances exactly one berth watch and restocks the port only when that watch crosses dawn', () => {
  const save = { ...start(), expedition: { duo: duo.id, ship: 'test-cutter', fuel: 0, provisions: 0, members: [], berthed: true as const } }
  const free = tendAtBerth(save, book)
  expect(free.station?.absoluteWatch).toBe(1)
  expect(free.campaignDay.day).toBe(1)
  expect(free.campaignSupply?.stores).toEqual(save.campaignSupply.stores)
  const dawn = tendAtBerth(tendAtBerth(free, book), book)
  expect(dawn.station?.absoluteWatch).toBe(3)
  expect(dawn.campaignDay.day).toBe(2)
  expect(dawn.campaignSupply?.stores.relay).toMatchObject({ fuel: 3, provisions: 4 })
})

it('budgets the Gate exactly once and shows the authored departure margin and earliest return', () => {
  const save = start()
  expect(expeditionLaunchBudget(save, book, duo, new Set())).toMatchObject({
    departure: { fuel: 5, provisions: 6 }, fuel: 4, provisions: 5, fuelMargin: 1, provisionMargin: 1, watches: 5, at: 5,
  })
  const crossed = { ...save, story: { ...save.story, flags: ['gate-open'] } }
  expect(expeditionLaunchBudget(crossed, book, duo, new Set())).toMatchObject({
    fuel: 2, provisions: 3, fuelMargin: 3, provisionMargin: 3, watches: 3, at: 3,
  })
})

it('repairs the starter cutter at a remote dock for one Ship Alloy and one watch, with free service at Home', () => {
  const blank = start()
  const current = { ...blank, station: { ...blank.station, anchor: 'home', integrity: 4 }, wallet: { ...blank.wallet, alloy: 1 } }
  const repaired = repairStarterCutter(current, book)
  expect(repaired.station?.integrity).toBe(COMMAND_HULL)
  expect(repaired.station?.absoluteWatch).toBe(1)
  expect(repaired.wallet.alloy).toBe(0)
  expect(repaired.campaignSupply).toEqual(current.campaignSupply)
  expect(repairStarterCutter(repaired, book)).toBe(repaired)
  const empty = { ...current, wallet: repaired.wallet }
  expect(repairStarterCutter(empty, book)).toBe(empty)
  expect(repairStarterCutter({ ...empty, station: { ...empty.station, anchor: 'relay' } }, book).station?.integrity).toBe(COMMAND_HULL)
})

it('shares the daily relief limit and adds emergency supplies only to the stranded expedition cutter', () => {
  const save = { ...start(), expedition: { duo: duo.id, ship: 'test-cutter', fuel: 0, provisions: 0, members: [],
    berthed: true as const, towFuelDue: true as const } }
  const supplied = requestTenderRelief(save, book)
  expect(supplied.expedition).toMatchObject({ fuel: 3, provisions: 2, towFuelDue: true })
  expect(supplied.campaignSupply).toEqual({ ...save.campaignSupply, reliefDay: save.campaignDay.day })
  expect(supplied.station?.absoluteWatch).toBe(save.station.absoluteWatch)
  expect(requestRelief(supplied.campaignSupply!, save.campaignDay.day)).toBe(supplied.campaignSupply)
  expect(requestTenderRelief(supplied, book)).toBe(supplied)
  expect(resumeVoyage(supplied, book).expedition?.fuel).toBe(2)
})
