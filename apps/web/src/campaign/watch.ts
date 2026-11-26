import {
  awayMembers, canTakeOrdinaryAssignment, crewSpeaker, campaignSupport, campaignUpkeep, COMMAND_HULL, developedPort, earn, firstStation,
  managementReceipt, observeManagement, projectCompleteFlag, setFlag, SHIP_CARGO_MAX, startSupply, STARTING_STATION_RESERVES,
  STATION_RESERVE_MAX, stationRoom, supplyNight, tickStation, WATCHES_PER_DAY,
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
    const result = tickStation(state, new Set(stationWorkers(next, book, inTransit)))
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
    if (next.campaignDay.day < day) next = settleSupplyDay(next, { ...next.campaignDay, day }, book)
  }
  return next
}

function settleSupplyDay(save: Save, day: CampaignDay, book: CampaignBook): Save {
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
  const supply = supplyNight(save.campaignSupply ?? startSupply(network), { ...network, ports }, save.story.flags,
    { ...support, provisions: campaignUpkeep(book, save, support.ashore) })
  if (!support.ashore.size) return observeManagement(save, passAWatch({ ...next, campaignSupply: supply }, book.story), book)
  const crew = save.crew.filter(({ outfit }) => !support.ashore.has(outfit))
  const watched = passAWatch({ ...next, campaignSupply: supply, crew }, book.story)
  const aboard = new Map(watched.crew.map((member) => [member.outfit, member]))
  return observeManagement(save, { ...watched, crew: save.crew.map((member) => aboard.get(member.outfit) ?? member) }, book)
}
