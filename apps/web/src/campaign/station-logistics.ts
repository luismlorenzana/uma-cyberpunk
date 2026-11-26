import {
  developedPort, managementReceipt, STARTING_STATION_RESERVES, STATION_DELIVERY_SLOTS,
  STATION_RESERVE_MAX, storesAt, type CampaignBook, type Save, type StationDelivery,
} from '@cyber/domain'
import { questComplete } from './quests'
import { stationJourney } from './station-travel'
import { stationOf } from './watch'

export function stationDelivery(save: Save, book: CampaignBook, kind: StationDelivery['kind']): StationDelivery | undefined {
  const stock = save.campaignSupply
  if (!stock || save.mission || save.expedition || save.campaignDay.pending || save.pairScene) return
  const station = stationOf(save, book)
  if ((station.deliveries?.length ?? 0) >= STATION_DELIVERY_SLOTS) return
  const base = book.supply?.ports.find(port => port.id === stock.port)
  const active = base && [...book.fourAct?.duos.values() ?? []].some(duo => {
    const quest = duo.local && book.quests.find(row => row.id === duo.local?.base)
    return quest?.port === base.id && questComplete(save, quest, book)
  })
  if (!base || !active) return
  const route = stationJourney(save, book, station.move?.to ?? station.anchor)
  if (!route) return
  const port = developedPort(book, save, base)
  const onHand = storesAt(stock, port)[kind]
  const reserve = (station.reserves ?? STARTING_STATION_RESERVES)[kind]
  const incoming = (station.deliveries ?? []).reduce((amount, order) => amount + (kind === order.kind ? order.amount : 0), 0)
  const amount = Math.min(8, STATION_RESERVE_MAX - reserve - incoming, onHand - port.reserve[kind] - port.upkeep[kind])
  if (amount <= 0) return
  return { from: base.id, kind, amount, at: Math.max(route.departure + 1, route.arrival, station.move?.at ?? 0) }
}

export function dispatchStationDelivery(save: Save, book: CampaignBook, kind: StationDelivery['kind']): Save {
  const order = stationDelivery(save, book, kind)
  const stock = save.campaignSupply
  const port = order && book.supply?.ports.find(row => row.id === order.from)
  if (!order || !stock || !port) return save
  const goods = storesAt(stock, port)
  const station = stationOf(save, book)
  return managementReceipt({ ...save,
    campaignSupply: { ...stock, stores: { ...stock.stores, [port.id]: { ...goods, [kind]: goods[kind] - order.amount } } },
    station: { ...station, deliveries: [...station.deliveries ?? [], order] },
  }, { kind: 'shipment', subject: kind, destination: 'station', amount: order.amount, port: order.from })
}
