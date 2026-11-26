import { hash32 } from '@cyber/battle'
import { advanceStationWatches, settleCampaignDay, stationOf } from './watch'
import { awayMembers, COMMAND_STATIONS, developedPort, managementReceipt, shipmentAt, loadShipment, type CommandStation, type Speaker, expeditionReadiness, SHIP_CARGO_MAX, startSupply, type CampaignBook, type CampaignQuest, type ExpeditionRun, type FixedDuo, type Save } from '@cyber/domain'
import { COMMAND_HULL, stationRoom } from '@cyber/domain'
import { focusExpeditionCrew, initializeCampaignCurve } from './progression'

export function expeditionForQuest(book: CampaignBook, quest: string, activeDuo?: string): FixedDuo | undefined {
  if (book.fourAct?.transit?.quests.includes(quest)) return activeDuo ? book.fourAct.duos.get(activeDuo) : undefined
  return [...book.fourAct?.duos.values() ?? []].find(duo => {
    const route = duo.expedition?.route
    return route && (route.launch === quest || route.return === quest || route.stops.includes(quest))
  })
}

export function expeditionQuestBlock(save: Save, book: CampaignBook, quest: string, duo: FixedDuo | undefined,
  complete: (q: CampaignQuest) => boolean): string | null {
  const transit = book.fourAct?.transit
  const gateQuest = transit?.quests.includes(quest)
  if (save.expedition) {
    if (save.expedition.berthed) return 'Resume the expedition from its berth'
    if (save.expedition.duo !== duo?.id) return 'Finish the active expedition'
    const route = duo.expedition?.route
    if (route?.launch === quest) return 'Already launched'
    if (transit && route && !save.story.flags.includes(transit.flag)) {
      const after = route.transitAfter ?? route.launch
      if (gateQuest) {
        const stage = book.quests.find(entry => entry.id === after)
        return stage && complete(stage) ? null : 'Finish departure'
      }
      if (quest !== after && route.stops.indexOf(quest) >= 0
        && route.stops.indexOf(quest) < route.stops.indexOf(after)) return null
      if (quest !== after) return 'Cross the Gate first'
    }
    return null
  }
  if (gateQuest) return 'Launch the expedition first'
  if (!duo) return null
  const plan = duo.expedition?.route
  if (plan?.launch !== quest || !book.fourAct || !book.supply) return 'Launch the expedition first'
  const progress = expeditionReadiness(book.fourAct, duo.id, new Set(book.quests.filter(complete).map(q => q.id)))!
  if (progress.capitals < 5) return 'Liberate all five capitals'
  if (progress.returned < 6) return 'Bring back all six lieutenants'
  if (progress.cleared < 2) return 'Clear both Generals'
  if (save.fleet?.[duo.id]?.condition === 'commissioning') return 'Wait for the shipyard to finish this cutter'
  if (save.fleet?.[duo.id]?.condition === 'parked') return 'Resume the cutter from the shipyard'
  if (book.stationStory && !save.fleet?.[duo.id]) return 'Commission the cutter in the shipyard'
  const away = awayMembers(save.operations, save.squads)
  if (duo.umas.some(outfit => !save.crew.some(member => member.outfit === outfit) || away.includes(outfit))) return 'Muster both expedition leads'
  if (duo.expedition?.members.some(member => member.role === 'boss-ally'
    && !save.crew.some(crew => crew.heroine === member.heroine && crew.expeditionOnly))) return 'Muster both cleared Generals'
  const stock = save.campaignSupply ?? startSupply(book.supply)
  const port = book.quests.find(entry => entry.id === plan.launch)?.port
  if (port && stock.port !== port) return 'Return to the launch berth'
  if (stock.fuel < plan.cargo.fuel || stock.provisions < plan.cargo.provisions) return 'Load more expedition supplies'
  return null
}

export function expeditionWatchScene(save: Save, book: CampaignBook, complete: ReadonlySet<string>) {
  const active = save.expedition
  if (!active || active.berthed || save.mission || save.campaignDay.pending) return null
  const route = book.fourAct?.duos.get(active.duo)?.expedition?.route
  const watch = route?.watch
  if (!route || !watch || !complete.has(watch.after)) return null
  const upcoming = route.stops.find(id => {
    if (complete.has(id)) return false
    const encounter = book.quests.find(quest => quest.id === id)?.encounter
    return encounter !== undefined && book.commands.has(encounter)
  })
  const encounter = book.quests.find(quest => quest.id === upcoming)?.encounter
  const cost = encounter ? book.commands.get(encounter)?.cost : undefined
  const shortfall = !!cost && (active.fuel < cost.fuel || active.provisions < cost.provisions)
  const scene = shortfall ? watch.shortfall : watch.rest
  const aboard = new Set(active.members.map(member => member.role === 'uma' ? member.outfit : member.heroine))
  const cast = book.scenes.get(scene)?.cast
  const present = cast?.every(member => {
    const actor = member.outfit ?? member.heroine
    return actor === undefined || aboard.has(actor)
  })
  return present && !save.story.seen.includes(scene) ? { scene, shortfall } : null
}

export function commitExpedition(save: Save, book: CampaignBook, quest: string, duo?: FixedDuo): Save {
  const formation = duo?.expedition, plan = formation?.route
  if (!duo || !formation || !plan || !book.supply) return save
  const stock = save.campaignSupply ?? startSupply(book.supply)
  if (quest === plan.launch && !save.expedition) {
    const hull = save.fleet?.[duo.id]
    if (hull?.condition === 'commissioning' || hull?.condition === 'parked' || stock.fuel < plan.cargo.fuel || stock.provisions < plan.cargo.provisions) return save
    const integrity = hull?.integrity
    const prepared = focusExpeditionCrew(initializeCampaignCurve(save, book), formation.members)
    const launched = { ...prepared, expedition: { duo: duo.id, ship: formation.ship, members: formation.members,
      ...(hull?.reinforced ? { reinforced: true as const } : {}),
      fuel: plan.cargo.fuel, provisions: plan.cargo.provisions, ...(integrity === undefined ? {} : { integrity }) },
      campaignSupply: { ...stock, fuel: stock.fuel - plan.cargo.fuel, provisions: stock.provisions - plan.cargo.provisions } }
    return book.stationStory ? advanceStationWatches(launched, book, 1) : launched
  }
  if (quest === plan.return && save.expedition?.duo === duo.id) {
    const run = { ...save.expedition, fuel: 0, provisions: 0 }
    const returned: Save = { ...save, expedition: null, campaignSupply: { ...stock,
      fuel: Math.min(SHIP_CARGO_MAX, stock.fuel + save.expedition.fuel),
      provisions: Math.min(SHIP_CARGO_MAX, stock.provisions + save.expedition.provisions) },
      ...(book.stationStory || save.fleet?.[duo.id] ? { fleet: { ...save.fleet, [duo.id]: { ship: run.ship, condition: 'returned', run } } } : {}) }
    return book.stationStory ? advanceStationWatches(returned, book, 1) : returned
  }
  return save
}

export const COMMISSIONING_BERTHS = 2

export function commissioningBerthsUsed(save: Save) {
  return Object.values(save.fleet ?? {}).filter(hull => hull.condition === 'commissioning').length
}

export function commissionCutter(save: Save, book: CampaignBook, duo: FixedDuo, complete: ReadonlySet<string>, reinforced = false): Save {
  if (!book.fourAct || !duo.expedition || save.fleet?.[duo.id] || save.expedition || save.mission || save.campaignDay.pending || save.pairScene
    || stationRoom(stationOf(save, book), 'shipyard') !== 'active' || commissioningBerthsUsed(save) >= COMMISSIONING_BERTHS
    || reinforced && save.wallet.alloy < TENDER_ARMOR_ALLOY) return save
  if (save.campaignSupply?.port !== stationOf(save, book).anchor) return save
  const ready = expeditionReadiness(book.fourAct, duo.id, complete)
  if (!ready || ready.capitals < 5 || ready.returned < 6 || ready.cleared < 2) return save
  const wallet = reinforced ? { ...save.wallet, alloy: save.wallet.alloy - TENDER_ARMOR_ALLOY } : save.wallet
  return { ...save, wallet, fleet: { ...save.fleet, [duo.id]: { ship: duo.expedition.ship, condition: 'commissioning', watches: 2,
    ...(reinforced ? { reinforced: true } : {}) } } }
}

export function parkCutter(save: Save, book: CampaignBook): Save {
  const berth = expeditionBerth(save, book)
  if (!berth?.run.berthed) return save
  const run = berth.run
  return { ...save, expedition: null, fleet: { ...save.fleet, [run.duo]: { ship: run.ship, condition: 'parked', run } } }
}

export function restoreParkedCutter(save: Save, book: CampaignBook, duoId: string): Save {
  if (save.expedition || save.mission || save.campaignDay.pending || save.pairScene) return save
  const entry = save.fleet?.[duoId]
  if (entry?.condition !== 'parked' || !entry.run?.berthed || book.fourAct?.duos.get(duoId)?.expedition?.ship !== entry.ship) return save
  const restored: Save = { ...save, expedition: entry.run,
    fleet: { ...save.fleet, [duoId]: { ship: entry.ship, condition: 'commissioned' } } }
  return expeditionBerth(restored, book) ? restored : save
}

export const TENDER_ARMOR_ALLOY = 3

export function expeditionPlan(save: Save, book: CampaignBook, complete: ReadonlySet<string>) {
  const run = save.expedition
  const route = run && book.fourAct?.duos.get(run.duo)?.expedition?.route
  if (!route) return null
  const index = new Map(book.quests.map(quest => [quest.id, quest]))
  const transit = book.fourAct?.transit
  const stops = [...route.stops]
  if (transit && !save.story.flags.includes(transit.flag)) {
    const departure = route.transitAfter ?? route.launch
    stops.splice(stops.indexOf(departure) + 1, 0, ...transit.quests)
  }
  const ordered = [route.launch, ...stops, route.return].flatMap(id => index.get(id) ?? [])
  const remaining = ordered.filter(row => !complete.has(row.id))
  const cost = remaining.reduce((total, row) => {
    const command = row.encounter && book.commands.get(row.encounter)
    return command ? { fuel: total.fuel + command.cost.fuel, provisions: total.provisions + command.cost.provisions } : total
  }, { fuel: 0, provisions: 0 })
  return { route, remaining, current: ordered.findLast(row => complete.has(row.id)), watch: expeditionWatchScene(save, book, complete), ...cost }
}

export function expeditionBerth(save: Save, book: CampaignBook) {
  const run = save.expedition
  const route = run && book.fourAct?.duos.get(run.duo)?.expedition?.route
  if (!run || !route || !book.supply || save.mission || save.campaignDay.pending || save.pairScene) return null
  const main = save.campaignSupply ?? startSupply(book.supply)
  const origin = book.quests.find(row => row.id === route.launch)?.port
  const port = book.supply.ports.find(row => row.id === main.port)
  return port && port.id === origin ? { run, main, port: developedPort(book, save, port) } : null
}

export function berthVoyage(save: Save, book: CampaignBook): Save {
  const berth = expeditionBerth(save, book)
  if (!berth || berth.run.berthed) return save
  if (berth.run.fuel + berth.main.fuel === 0) return { ...save, expedition: { ...berth.run, berthed: true, towFuelDue: true } }
  const fromTender = Number(berth.run.fuel > 0)
  return { ...save, expedition: { ...berth.run, berthed: true, fuel: berth.run.fuel - fromTender },
    campaignSupply: { ...berth.main, fuel: berth.main.fuel - (1 - fromTender) } }
}

export function resumeVoyage(save: Save, book: CampaignBook): Save {
  const berth = expeditionBerth(save, book)
  if (!berth?.run.berthed || berth.run.towFuelDue && berth.run.fuel < 1) return save
  const { berthed: _, towFuelDue, ...run } = berth.run
  return { ...save, expedition: { ...run, fuel: run.fuel - Number(!!towFuelDue) } }
}

export function tendAtBerth(save: Save, book: CampaignBook): Save {
  if (!expeditionBerth(save, book)?.run.berthed) return save
  return settleCampaignDay(save, { ...save.campaignDay, day: save.campaignDay.day + 1 }, book)
}

export function repairExpeditionCutter(save: Save, book: CampaignBook): Save {
  const berth = expeditionBerth(save, book)
  if (!berth?.run.berthed || (berth.run.integrity ?? COMMAND_HULL) === COMMAND_HULL) return save
  return advanceStationWatches({ ...save, expedition: { ...berth.run, integrity: COMMAND_HULL } }, book, 1)
}

export function loadTender(save: Save, book: CampaignBook, kind: 'fuel' | 'provisions'): Save {
  const berth = expeditionBerth(save, book)
  if (!berth?.run.berthed) return save
  const cargo = { ...berth.main, fuel: berth.run.fuel, provisions: berth.run.provisions }
  const count = shipmentAt(cargo, berth.port, kind, 8)
  const shipment = loadShipment(cargo, berth.port, kind, 8)
  if (!shipment) return save
  return managementReceipt({ ...save, expedition: { ...berth.run, [kind]: berth.run[kind] + count },
    campaignSupply: { ...berth.main, stores: shipment.supply.stores } },
    { kind: 'shipment', subject: 'tender-' + kind, destination: 'ship', amount: count })
}

export function fitExpeditionHull(save: Save, book: CampaignBook): Save {
  const berth = expeditionBerth(save, book)
  if (!berth?.run.berthed || berth.run.reinforced || save.wallet.alloy < TENDER_ARMOR_ALLOY) return save
  return managementReceipt({ ...save, expedition: { ...berth.run, reinforced: true }, wallet: { ...save.wallet, alloy: save.wallet.alloy - TENDER_ARMOR_ALLOY } },
    { kind: 'fitted', subject: 'tender-escort', destination: 'ship', amount: 1 })
}

const defaultStations = { pilot: 0, shields: 1, gunnery: 2, engineering: 3 }
export const expeditionStations = (run: ExpeditionRun) => run.stations ?? defaultStations
const specialties = { uma: 'pilot', 'boss-ally': 'gunnery', 'melee-shield': 'shields', 'ranged-medic': 'engineering', 'long-range': 'gunnery' } as const

export function expeditionOfficer(run: ExpeditionRun, station: CommandStation): { speaker: Speaker; drills: number } {
  const member = run.members[expeditionStations(run)[station]]!
  return { speaker: member.role === 'uma' ? member.outfit : member.heroine,
    drills: 1 + Number(specialties[member.role] === station) }
}

export function setExpeditionOfficer(save: Save, station: CommandStation, index: number): Save {
  const run = save.expedition
  if (!run || run.berthed || save.mission?.step !== 'deploy' || !Number.isInteger(index) || !run.members[index]) return save
  const stations = { ...expeditionStations(run) }
  if (stations[station] === index) return save
  const other = COMMAND_STATIONS.find(key => stations[key] === index)
  if (other) stations[other] = stations[station]
  stations[station] = index
  return { ...save, expedition: { ...run, stations } }
}

/** The expedition's temporary squad keys are distinct from ordinary crew records. The unit's identity stays in its ref. */
export const expeditionSquad = (run: ExpeditionRun): number[] =>
  run.members.map(member => member.role === 'uma' ? member.outfit : 10_000_000_000 + hash32(member.heroine))
