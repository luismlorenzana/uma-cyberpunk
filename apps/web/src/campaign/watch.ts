import {
  awayMembers, canTakeOrdinaryAssignment, crewSpeaker, campaignSupport, campaignUpkeep, COMMAND_HULL, developedPort, earn, firstStation,
  managementReceipt, observeManagement, projectCompleteFlag, setFlag, SHIP_CARGO_MAX, startSupply, STARTING_STATION_RESERVES,
  STATION_RESERVE_MAX, stationRoom, storesAt, supplyNight, tickStation, WATCHES_PER_DAY,
  type CampaignBook, type CampaignDay, type Save, type Speaker,
} from '@cyber/domain'
import { passAWatch } from '../mission/director'
import { syncStationCustody } from './station-custody'

export function settleCampaignDay(save: Save, day: CampaignDay, book: CampaignBook): Save {
  if (book.fourAct && day.day > save.campaignDay.day) {
    const station = stationOf(save, book)
    const until = (day.day - 1) * WATCHES_PER_DAY
    const advanced = advanceStationWatches(save, book, until - station.absoluteWatch)
    return { ...advanced, campaignDay: day }
  }
  return settleSupplyDay(save, day, book)
}

export function stationOf(save: Save, book: CampaignBook) {
  return save.station ?? firstStation(save.campaignDay.day, book.supply?.start)
}

export function voyageCrew(save: Save) {
  const members = new Set<Speaker>()
  const add = (run: Save['expedition'] | undefined) => {
    for (const member of run?.members ?? []) members.add(member.role === 'uma' ? member.outfit : member.heroine)
  }
  add(save.expedition)
  for (const hull of Object.values(save.fleet ?? {})) if (hull.condition === 'parked') add(hull.run)
  return members
}

function stationPresent(save: Save, book: CampaignBook, inTransit = false): Save['crew'] {
  const station = stationOf(save, book)
  const away = new Set(awayMembers(save.operations, save.squads))
  const ashore = campaignSupport(book, save).ashore
  const deployed = voyageCrew(save)
  if (inTransit || save.campaignSupply?.port && station.anchor !== save.campaignSupply.port) {
    for (const outfit of station.travellers ?? []) deployed.add(outfit)
    const recruit = book.recruits?.find(row => row.signOn === station.recruit)
    if (recruit) deployed.add(recruit.outfit)
    for (const outfit of save.mission?.squad ?? []) deployed.add(outfit)
  }
  return save.crew.filter(member => !away.has(member.outfit) && !ashore.has(member.outfit) && !deployed.has(crewSpeaker(member)) && !deployed.has(member.outfit))
}

function residentLieutenants(save: Save) {
  const away = voyageCrew(save)
  return (save.station?.lieutenantResidents ?? []).filter(actor => !away.has(actor))
}

export function stationResidentCount(save: Save, book: CampaignBook, inTransit = false) {
  return stationPresent(save, book, inTransit).length + residentLieutenants(save).length
}

export function stationRations(save: Save, book: CampaignBook, inTransit = false) {
  return 2 + Math.floor(stationResidentCount(save, book, inTransit) / 20)
}

export function cutterRations(save: Save, book: CampaignBook) {
  const station = stationOf(save, book)
  return save.expedition || !save.campaignSupply || save.campaignSupply.port === station.anchor
    ? 0 : 1 + Math.floor((station.travellers?.length ?? 0) / 10)
}

export function stationWorkers(save: Save, book: CampaignBook, inTransit = false): number[] {
  return stationPresent(save, book, inTransit).filter(canTakeOrdinaryAssignment).map(member => member.outfit)
}

export function transferStationStock(save: Save, book: CampaignBook, kind: 'fuel' | 'provisions', load: boolean): Save {
  if (save.mission || save.expedition || save.campaignDay.pending || save.pairScene) return save
  const station = stationOf(save, book)
  const stock = save.campaignSupply
  if (!stock || stock.port !== station.anchor) return save
  const reserves = station.reserves ?? STARTING_STATION_RESERVES
  const amount = Math.min(4, load ? reserves[kind] : stock[kind],
    load ? SHIP_CARGO_MAX - stock[kind] : STATION_RESERVE_MAX - reserves[kind])
  if (amount <= 0) return save
  return managementReceipt({ ...save,
    station: { ...station, reserves: { ...reserves, [kind]: reserves[kind] + (load ? -amount : amount) } },
    campaignSupply: { ...stock, [kind]: stock[kind] + (load ? amount : -amount) },
  }, { kind: 'shipment', subject: kind, destination: load ? 'ship' : 'station', amount })
}

export function cutterArrival(save: Save, book: CampaignBook, aboard?: number, departing = false): Save {
  if (!book.fourAct || !save.campaignSupply) return save
  const state = stationOf(save, book)
  const travellers = !departing && save.campaignSupply.port === state.anchor ? [] : [...new Set([
    ...state.travellers ?? [], ...Object.values(save.commandCrew).map(officer => officer.outfit), ...(aboard === undefined ? [] : [aboard]),
  ])].slice(0, 50)
  return { ...save, station: { ...state, travellers } }
}

export function repairStarterCutter(save: Save, book: CampaignBook): Save {
  const station = stationOf(save, book)
  if (save.mission || save.expedition || save.campaignDay.pending || save.pairScene || save.campaignSupply?.port !== station.anchor
    || (station.integrity ?? COMMAND_HULL) === COMMAND_HULL) return save
  return advanceStationWatches({ ...save, station: { ...station, integrity: COMMAND_HULL } }, book, 1)
}

export function advanceStationWatches(save: Save, book: CampaignBook, count: number, inTransit = false): Save {
  if (!book.fourAct || !Number.isSafeInteger(count) || count <= 0) return save
  let next = save
  for (let watch = 0; watch < count; watch++) {
    const state = stationOf(next, book)
    const priorDay = next.campaignDay.day - 1
    const visited = state.lastContact ? new Set(next.crew.filter(member =>
      state.lastContact?.[crewSpeaker(member)] === priorDay).map(member => member.outfit)) : undefined
    const result = tickStation(state, new Set(stationWorkers(next, book, inTransit)), book.stationStory ? {
      residents: stationResidentCount(next, book, inTransit),
      visited,
      lieutenantSupplies: residentLieutenants(next).filter(actor => state.lastContact?.[actor] === priorDay).length,
    } : undefined)
    const stock = next.campaignSupply
    const carriesCutter = !inTransit && !next.expedition && !next.mission && stock?.port === state.anchor
      && result.station.anchor !== state.anchor
    next = { ...next, station: result.station, wallet: earn(next.wallet, { credits: 0, alloy: result.alloy, data: result.data }),
      ...(stock && carriesCutter ? { campaignSupply: { ...stock, port: result.station.anchor } } : {}) }
    if (state.rooms['secure-ward'] === 1) next = syncStationCustody(next, book, result.station)
    if (stationRoom(state, 'shipyard') === 'active' && next.fleet) {
      const fleet = { ...next.fleet }
      for (const [duo, hull] of Object.entries(fleet)) {
        if (hull.condition !== 'commissioning' || hull.watches === undefined) continue
        const { watches, ...vessel } = hull
        fleet[duo] = watches > 1 ? { ...hull, watches: watches - 1 } : { ...vessel, condition: 'commissioned' }
      }
      next = { ...next, fleet }
    }
    if (result.infirmary) {
      const patient = stationPresent(next, book, inTransit).reduce<Save['crew'][number] | undefined>((chosen, member) =>
        member.strain > (chosen?.strain ?? 0) ? member : chosen, undefined)
      if (patient) next = { ...next, crew: next.crew.map(member => member === patient ? { ...patient, strain: patient.strain - 1 } : member) }
    }
    const day = Math.floor(result.station.absoluteWatch / WATCHES_PER_DAY) + 1
    if (next.campaignDay.day < day) next = settleSupplyDay(next, { ...next.campaignDay, day }, book, inTransit)
  }
  return next
}

function settleSupplyDay(save: Save, day: CampaignDay, book: CampaignBook, inTransit = false): Save {
  const next = { ...save, campaignDay: day }
  const network = book.supply
  if (day.day < save.campaignDay.day) return save
  if (day.day === save.campaignDay.day || !network) return next
  for (const project of book.projects ?? []) {
    const left = next.campaignProjects[project.id]
    if (!left) continue
    next.campaignProjects = { ...next.campaignProjects, [project.id]: left - 1 }
    if (left === 1) next.story = setFlag(next.story, projectCompleteFlag(project.id))
  }
  const support = campaignSupport(book, save)
  const ports = network.ports.map((port) => developedPort(book, next, port))
  let supply = supplyNight(save.campaignSupply ?? startSupply(network), { ...network, ports }, save.story.flags,
    { ...support, provisions: book.stationStory ? (inTransit ? Math.max(1, cutterRations(save, book)) : cutterRations(save, book))
      : campaignUpkeep(book, save, support.ashore) })
  if (book.stationStory) {
    const station = stationOf(save, book)
    const reserves = station.reserves ?? STARTING_STATION_RESERVES
    const due = stationRations(save, book, inTransit)
    const fromReserve = Math.min(due, reserves.provisions)
    let shortfall = due - fromReserve
    const anchor = ports.find(port => port.id === station.anchor)
    if (shortfall > 0 && station.automaticRations !== false && anchor) {
      const stores = storesAt(supply, anchor)
      const fromDock = Math.min(shortfall, Math.max(0, stores.provisions - anchor.reserve.provisions - anchor.upkeep.provisions))
      supply = { ...supply, stores: { ...supply.stores, [anchor.id]: { ...stores, provisions: stores.provisions - fromDock } } }
      shortfall -= fromDock
    }
    next.station = { ...station, reserves: { ...reserves, provisions: reserves.provisions - fromReserve }, rationShortfall: shortfall }
    if (station.lastContact) next.crew = save.crew.map(member =>
      member.strain > 0 && station.lastContact?.[crewSpeaker(member)] === day.day - 1 ? { ...member, strain: member.strain - 1 } : member)
  }
  if (!support.ashore.size) return observeManagement(save, passAWatch({ ...next, campaignSupply: supply }, book.story), book)
  const crew = next.crew.filter(({ outfit }) => !support.ashore.has(outfit))
  const watched = passAWatch({ ...next, campaignSupply: supply, crew }, book.story)
  const aboard = new Map(watched.crew.map((member) => [member.outfit, member]))
  return observeManagement(save, { ...watched, crew: next.crew.map((member) => aboard.get(member.outfit) ?? member) }, book)
}
