import { awayMembers, campaignJourney, campaignSupport, crewSpeaker, jumpRoute, shipCapabilities, startSupply, stationCapacity, TEMPORARY_BERTHS, type CampaignBook, type CampaignQuest, type Save, type Speaker } from '@cyber/domain'
import { questAvailable, questComplete } from './quests'
import { advanceStationWatches, cutterArrival, stationOf } from './watch'

/** Resolve the same fuel and route gates as Navigation before making a recruitment trip. */
export function homeQuestTravel(save: Save, book: CampaignBook, quest: CampaignQuest) {
  const network = book.supply
  const departure = network && book.quests.find(q => q.id === network.after)
  if (!network || !departure || !questComplete(save, departure, book) || save.mission || save.expedition
    || save.campaignDay.pending || save.pairScene) return null

  const stock = save.campaignSupply ?? startSupply(network)
  const destination = quest.port ?? stock.port
  if (!questAvailable(save, book, quest, destination)) return null

  const drives = shipCapabilities(save.ship)
  const route = campaignJourney(network, stock.port, destination, drives, save.story.flags)
  if (!route) return null
  let at = stock.port
  const stops = []
  while (at !== destination) {
    const next = campaignJourney(network, at, destination, drives, save.story.flags)?.first
    if (!next) return null
    const leg = network.routes.find(row => (row.from === at && row.to === next) || (row.to === at && row.from === next))
    if (!leg) return null
    stops.push(leg)
    at = next
  }
  return { destination, fuel: route.fuel, watches: stops.length, affordable: stock.fuel >= route.fuel, stops }
}

export function travelForHomeQuest(save: Save, book: CampaignBook, quest: CampaignQuest): Save {
  const travel = homeQuestTravel(save, book, quest)
  if (!travel?.affordable || !book.supply) return save
  const stock = save.campaignSupply ?? startSupply(book.supply)
  const drives = shipCapabilities(save.ship)
  const arrival = travel.stops.reduce((supply, leg) => jumpRoute(supply, leg, drives, save.story.flags), stock)
  if (arrival.port !== travel.destination) return save
  const recruit = book.fourAct && book.recruits?.some(row => row.signOn === quest.id)
  const moved = arrival === stock ? save : cutterArrival({ ...save, campaignSupply: arrival }, book)
  const prepared = recruit ? { ...moved, station: { ...stationOf(moved, book), recruit: quest.id } } : moved
  return advanceStationWatches(prepared, book, travel.watches)
}

export function closeRecruitment(save: Save, quest?: string): Save {
  if (!save.station?.recruit || (quest && save.station.recruit !== quest)) return save
  const { recruit: _recruit, ...station } = save.station
  return { ...save, station }
}

/** Slots follow each signed-on Uma's join order. New habs provide permanent rooms for earlier guest rooms. */
export function homestretchCabins(book: CampaignBook, save: Save) {
  const known = new Set((book.recruits ?? []).map(({ outfit }) => outfit))
  const station = stationOf(save, book)
  const capacity = stationCapacity(station)
  const eligible = save.crew.filter(member => known.has(member.outfit) || member.expeditionOnly && member.heroine)
    .map(member => ({ actor: crewSpeaker(member), outfit: member.outfit }))
  const occupants: { actor: Speaker; outfit?: number }[] = [
    ...eligible, ...(station.lieutenantResidents ?? []).map(actor => ({ actor })),
  ]
  const taken = new Set(Object.entries(station.preferredCabins ?? {}).flatMap(([key, berth]) =>
    berth <= capacity && occupants.some(({ actor }) => String(actor) === key) ? [berth] : []))
  const unavailable = new Set([...awayMembers(save.operations, save.squads), ...campaignSupport(book, save).ashore,
    ...station.travellers ?? []])
  const deployed = new Set(save.expedition?.members.map(member => member.role === 'uma' ? member.outfit : member.heroine))
  let free = 1, reserve = 1
  return occupants.map(({ actor, outfit }) => {
    const preferred = station.preferredCabins && Object.hasOwn(station.preferredCabins, actor)
      ? station.preferredCabins[actor] : undefined
    const away = deployed.has(actor) || outfit !== undefined && unavailable.has(outfit)
    if (preferred && preferred <= capacity) return { actor, outfit, berth: preferred, temporary: false, away }
    while (taken.has(free)) free++
    if (free <= capacity) return { actor, outfit, berth: free++, temporary: false, away }
    return { actor, outfit, berth: reserve <= TEMPORARY_BERTHS ? reserve++ : undefined, temporary: true, away }
  }).sort((a, b) => Number(a.temporary) - Number(b.temporary) || (a.berth ?? Infinity) - (b.berth ?? Infinity))
}

export function setLieutenantResidence(save: Save, book: CampaignBook, actor: string, aboard: boolean): Save {
  if (save.mission || save.expedition || save.campaignDay.pending || save.pairScene) return save
  const station = stationOf(save, book)
  const current = station.lieutenantResidents ?? []
  if (current.includes(actor) === aboard) return save
  const returned = [...book.fourAct?.duos.values() ?? []].flatMap(duo => duo.returns.find(row => row.heroine === actor) ?? [])
  if (!returned.length || returned.some(row => {
    const quest = book.quests.find(quest => quest.id === row.quest)
    return !quest || !questComplete(save, quest, book)
  })) return save
  if (aboard && homestretchCabins(book, save).length >= stationCapacity(station)) return save
  const preferredCabins = { ...station.preferredCabins }
  if (!aboard) delete preferredCabins[actor]
  return { ...save, station: { ...station, preferredCabins,
    lieutenantResidents: aboard ? [...current, actor] : current.filter(key => key !== actor) } }
}

export function moveHomeCabin(save: Save, book: CampaignBook, actor: Speaker, berth: number): Save {
  if (save.mission || save.expedition || save.campaignDay.pending || save.pairScene) return save
  const station = stationOf(save, book)
  if (!Number.isInteger(berth) || berth < 1 || berth > stationCapacity(station)) return save
  const cabins = homestretchCabins(book, save)
  const moving = cabins.find(row => row.actor === actor)
  if (!moving || moving.away || cabins.some(row => !row.temporary && row.berth === berth)) return save
  const permanent = Object.fromEntries(cabins.flatMap(row =>
    !row.temporary && row.actor !== actor && row.berth ? [[row.actor, row.berth] as const] : []))
  return { ...save, station: { ...station, preferredCabins: { ...permanent, [actor]: berth } } }
}

