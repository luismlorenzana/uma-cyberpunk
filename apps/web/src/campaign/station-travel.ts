import { campaignJourney, jumpRoute, shipCapabilities, startSupply, type CampaignBook, type Save, type SupplyRoute } from '@cyber/domain'
import { advanceStationWatches, cutterArrival, stationOf } from './watch'

/** Navigation and recruitment use the same allowed legs, costs and watch boundaries. */
export function stationJourney(save: Save, book: CampaignBook, destination: string) {
  const network = book.supply
  if (!network) return null
  const stock = save.campaignSupply ?? startSupply(network)
  const drives = shipCapabilities(save.ship)
  const flags = save.story.flags
  const stops: { route: SupplyRoute; port: string }[] = []
  const visited = new Set<string>()
  let at = stock.port
  while (at !== destination) {
    if (visited.has(at)) return null
    visited.add(at)
    const next = campaignJourney(network, at, destination, drives, flags)?.first
    const route = next && network.routes.find(row => row.from === at && row.to === next || row.to === at && row.from === next)
    if (!next || !route) return null
    stops.push({ route, port: next })
    at = next
  }
  const fuel = stops.reduce((total, stop) => total + stop.route.fuel, 0)
  const departure = stationOf(save, book).absoluteWatch
  return { destination, fuel, watches: stops.length, affordable: stock.fuel >= fuel, departure, arrival: departure + stops.length, stops }
}

export function flyStationJourney(save: Save, book: CampaignBook, destination: string, firstOnly = false): Save {
  if (!book.supply || save.mission || save.expedition || save.campaignDay.pending || save.pairScene) return save
  const plan = stationJourney(save, book, destination)
  if (!plan?.stops.length || !firstOnly && !plan.affordable) return save
  const stops = firstOnly ? plan.stops.slice(0, 1) : plan.stops
  const drives = shipCapabilities(save.ship)
  let next = save
  for (const { route } of stops) {
    const stock = next.campaignSupply ?? startSupply(book.supply)
    const landed = jumpRoute(stock, route, drives, next.story.flags)
    if (landed === stock) return save
    // The cutter crew are off the station for the leg even when its destination is the anchor.
    const depart = cutterArrival(next, book, undefined, true)
    const advanced = advanceStationWatches({ ...depart, campaignSupply: landed }, book, 1, true)
    next = advanced
  }
  return cutterArrival(next, book)
}
