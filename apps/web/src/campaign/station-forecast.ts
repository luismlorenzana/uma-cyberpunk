import { buildStationRoom, STARTING_STATION_RESERVES, stationCapacity, stationPower, stationRoom,
  STATION_MODULES, WATCHES_PER_DAY, type CampaignBook, type Save, type StationModule } from '@cyber/domain'
import { advanceStationWatches, cutterRations, stationOf, stationRations } from './watch'

export function forecastStation(save: Save, book: CampaignBook, watches: number) {
  const initial = stationOf(save, book)
  const duties = new Map<number, NonNullable<typeof initial.report>>()
  const dawns = new Map<number, { due: number; short: number; reserves: number; cutterDue: number; cutterShort: number; cutterStock: number }>()
  let current = save
  if (initial.report) duties.set(initial.report.at, initial.report)
  for (let offset = 0; offset < watches; offset++) {
    const previous = current
    current = advanceStationWatches(previous, book, 1)
    const station = stationOf(current, book)
    if (station.report?.at === station.absoluteWatch - 1) duties.set(station.report.at, station.report)
    if (current.campaignDay.day > previous.campaignDay.day && book.stationStory) {
      dawns.set(station.absoluteWatch, {
        due: stationRations(current, book), short: station.rationShortfall ?? 0,
        reserves: (station.reserves ?? STARTING_STATION_RESERVES).provisions,
        cutterDue: cutterRations(current, book), cutterShort: current.campaignSupply?.shortfall ?? 0,
        cutterStock: current.campaignSupply?.provisions ?? 0,
      })
    }
  }
  return { duties, dawns, final: current }
}

export function nextStationDawn(save: Save, book: CampaignBook) {
  const now = stationOf(save, book).absoluteWatch
  return forecastStation(save, book, WATCHES_PER_DAY - now % WATCHES_PER_DAY).dawns.values().next().value
}

export function stationBuildForecast(save: Save, book: CampaignBook, room: StationModule) {
  const station = stationOf(save, book)
  const candidate = buildStationRoom(station, save.wallet, room)
  const left = station.rooms[room] || (candidate ? STATION_MODULES[room].watches : 0)
  if (!left) return
  const planned = candidate ? { ...save, ...candidate } : save
  const { final } = forecastStation(planned, book, left)
  const completed = stationOf(final, book)
  return { at: completed.absoluteWatch, power: stationPower(completed), berths: stationCapacity(completed),
    powered: stationRoom(completed, room) === 'active', stock: final.wallet.alloy }
}
