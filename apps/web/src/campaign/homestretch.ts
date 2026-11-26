import { campaignJourney, jumpRoute, shipCapabilities, startSupply, type CampaignBook, type CampaignQuest, type Save } from '@cyber/domain'
import { questAvailable, questComplete } from './quests'

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
  return { destination, fuel: route.fuel, affordable: stock.fuel >= route.fuel, stops }
}

export function travelForHomeQuest(save: Save, book: CampaignBook, quest: CampaignQuest): Save {
  const travel = homeQuestTravel(save, book, quest)
  if (!travel?.affordable || !travel.stops.length || !book.supply) return save
  const stock = save.campaignSupply ?? startSupply(book.supply)
  const drives = shipCapabilities(save.ship)
  const arrival = travel.stops.reduce((supply, leg) => jumpRoute(supply, leg, drives, save.story.flags), stock)
  return arrival.port === travel.destination ? { ...save, campaignSupply: arrival } : save
}

/** The authored lead order reserves a berth. The saved sign-on assigns that berth to its occupant. */
export function homestretchCabins(book: CampaignBook, save: Save) {
  const aboard = new Set(save.crew.filter(member => !member.expeditionOnly).map(member => member.outfit))
  return (book.recruits ?? []).flatMap(({ outfit }, index) => aboard.has(outfit) ? [{ outfit, berth: index + 1 }] : [])
}

