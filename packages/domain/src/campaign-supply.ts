export const SUPPLY_KINDS = ['fuel', 'provisions', 'alloy'] as const
export type SupplyKind = typeof SUPPLY_KINDS[number]
export type Supplies = Record<SupplyKind, number>

export interface SupplyPort {
  id: string
  name: string
  scene: string
  stock: Supplies
  produces: Supplies
  upkeep: Supplies
  reserve: Supplies
}

export interface SupplyRoute {
  from: string
  to: string
  fuel: number
  needs?: string
}

export interface SupplyNetwork {
  after: string
  start: string
  ports: SupplyPort[]
  routes: SupplyRoute[]
}

export interface CampaignSupply {
  port: string
  stores: Record<string, Supplies>
  fuel: number
  provisions: number
  shortfall: number
  reliefDay: number | null
}

export const SHIP_PROVISIONS_PER_NIGHT = 2
export const SHIPMENT_SIZE = 4
export const SHIP_CARGO_MAX = 99
export const PORT_STOCK_MAX = 999

export function startSupply(network: SupplyNetwork): CampaignSupply {
  return { port: network.start, stores: {}, fuel: 6, provisions: 4, shortfall: 0, reliefDay: null }
}

export const storesAt = (supply: CampaignSupply, port: SupplyPort): Supplies => supply.stores[port.id] ?? port.stock

/** A dock keeps its reserve and enough to pay its next upkeep before offering a shipment. */
export function shipmentAt(supply: CampaignSupply, port: SupplyPort, kind: SupplyKind): number {
  if (supply.port !== port.id) return 0
  const available = Math.max(0, storesAt(supply, port)[kind] - port.reserve[kind] - port.upkeep[kind])
  return Math.min(SHIPMENT_SIZE, available, kind === 'alloy' ? SHIPMENT_SIZE : SHIP_CARGO_MAX - supply[kind])
}

export function loadShipment(supply: CampaignSupply, port: SupplyPort, kind: SupplyKind): { supply: CampaignSupply; alloy: number } | null {
  const count = shipmentAt(supply, port, kind)
  if (count === 0) return null
  const stock = storesAt(supply, port)
  const next = { ...supply, stores: { ...supply.stores, [port.id]: { ...stock, [kind]: stock[kind] - count } } }
  if (kind !== 'alloy') next[kind] += count
  return { supply: next, alloy: kind === 'alloy' ? count : 0 }
}

export function jumpRoute(supply: CampaignSupply, route: SupplyRoute, capabilities: readonly string[]): CampaignSupply {
  if (supply.fuel < route.fuel || (route.needs && !capabilities.includes(route.needs))) return supply
  const port = route.from === supply.port ? route.to : route.to === supply.port ? route.from : null
  return port ? { ...supply, port, fuel: supply.fuel - route.fuel } : supply
}

/** A night first produces and pays locally; the ship then pays its provisions bill. */
export function supplyNight(supply: CampaignSupply, network: SupplyNetwork): CampaignSupply {
  const stores = { ...supply.stores }
  for (const port of network.ports) {
    const stock = storesAt(supply, port)
    const next = { ...stock }
    for (const kind of SUPPLY_KINDS) next[kind] = Math.min(PORT_STOCK_MAX, Math.max(0, stock[kind] + port.produces[kind] - port.upkeep[kind]))
    stores[port.id] = next
  }
  return { ...supply, stores,
    provisions: Math.max(0, supply.provisions - SHIP_PROVISIONS_PER_NIGHT),
    shortfall: Math.max(0, SHIP_PROVISIONS_PER_NIGHT - supply.provisions) }
}

/** A civilian tender can cover one stopgap per day when the ship is short on fuel or food. */
export function requestRelief(supply: CampaignSupply, day: number): CampaignSupply {
  if (supply.reliefDay === day || (supply.fuel >= 3 && supply.provisions >= SHIP_PROVISIONS_PER_NIGHT)) return supply
  return { ...supply, reliefDay: day, fuel: Math.max(3, supply.fuel), provisions: Math.max(SHIP_PROVISIONS_PER_NIGHT, supply.provisions) }
}
