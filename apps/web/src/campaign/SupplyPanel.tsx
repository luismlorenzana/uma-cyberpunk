import {
  CAPABILITY_NAME, managementReceipt, observeManagement, earn, freePlace, jumpRoute, loadShipment, moduleAt, MODULES_BY_ID, placeModule, placeProblem, requestRelief,
  shipCapabilities, shipmentAt, startSupply, storesAt, SUPPLY_KINDS,
  type CampaignSupply, type Save, type SupplyNetwork, type SupplyPort, type World,
} from '@cyber/domain'
import { updateSave } from '../save/game'

const button = 'min-h-11 rounded-lg px-3 text-sm font-semibold text-white'
const action = `${button} bg-white/10 disabled:opacity-50`
const label = { fuel: 'Fuel', provisions: 'Provisions', alloy: 'Alloy' }
const drive = MODULES_BY_ID.get('engines')!.levels[0]

function driveBay(save: Save) {
  const ship = { ...save.ship, unlocked: [...new Set([...save.ship.unlocked, 'engines' as const])] }
  const location = freePlace(ship, 'engines')
  const problem = location ? placeProblem(ship, save.wallet, 'engines', location.deck, location.slot) : 'Needs a free slot'
  return { ship, location, problem }
}

export function SupplyPanel({ save, network, supply, port, worlds, upkeep }: {
  save: Save; network: SupplyNetwork; supply: CampaignSupply; port: SupplyPort; worlds: Record<string, World>; upkeep: number
}) {
  const drives = shipCapabilities(save.ship)
  const flags = save.story.flags
  const engine = moduleAt(save.ship, 'engines')
  const bay = driveBay(save)
  const liberated = port.liberation && save.story.flags.includes(port.liberation.flag) ? port.liberation : null
  const mapped = network.ports.every(({ id }) => worlds[id]?.x !== undefined && worlds[id]?.y !== undefined)
  function change(action: (s: Save, stock: CampaignSupply) => Save) {
    void updateSave((current) => {
      const stock = current.campaignSupply ?? startSupply(network)
      if (stock.port !== port.id || current.mission || current.campaignDay.pending || current.pairScene) return current
      return observeManagement(current, action(current, stock))
    })
  }
  return <section className="space-y-3 rounded-xl border border-white/15 bg-white/5 p-3" aria-label="Star map and supply">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-lg font-bold">Star map</h2>
      <p className="text-sm">Docked at {port.name}</p>
    </div>
    {liberated && <p className="text-sm font-semibold text-cyan-200">Liberated · +{liberated.alloy} alloy each night</p>}
    <ul className={mapped ? 'relative aspect-[2.3] rounded-lg bg-[#080c19]' : 'grid grid-cols-2 gap-2 sm:grid-cols-3'} aria-label="Landing ports">
      {mapped && network.routes.map((route) => {
        const from = worlds[route.from]!, to = worlds[route.to]!
        const dx = to.x! - from.x!, dy = (to.y! - from.y!) / 2.3
        const locked = (route.needs && !drives.includes(route.needs)) || (route.flag && !flags.includes(route.flag))
        return <li key={`${route.from}:${route.to}`} aria-hidden="true" className={`pointer-events-none absolute origin-left border-t ${locked ? 'border-dashed border-white/35' : 'border-cyan-200/40'}`}
          style={{ left: `${from.x}%`, top: `${from.y}%`, width: `${Math.hypot(dx, dy)}%`, transform: `rotate(${Math.atan2(dy, dx)}rad)` }} />
      })}
      {network.ports.map((destination) => {
        const route = network.routes.find(({ from, to }) => (from === port.id && to === destination.id) || (to === port.id && from === destination.id))
        const jump = route && jumpRoute(supply, route, drives, flags)
        const status = destination.id === port.id ? 'Docked' : !route ? 'Via another port'
          : route.flag && !flags.includes(route.flag) ? 'Awaiting clearance' : route.needs && !drives.includes(route.needs)
          ? `Needs ${CAPABILITY_NAME[route.needs]}` : `${supply.fuel < route.fuel ? 'Needs ' : ''}${route.fuel} fuel`
        return <li key={destination.id} className={mapped ? 'absolute -translate-x-1/2 -translate-y-1/2' : ''}
          style={mapped ? { left: `${worlds[destination.id]!.x}%`, top: `${worlds[destination.id]!.y}%` } : undefined}>
          <button type="button" className={`${button} w-full bg-[#18263b] py-1 text-left ring-1 ${destination.id === port.id ? 'ring-cyan-300' : 'ring-white/15 disabled:text-white/65'}`}
            disabled={!jump || jump === supply} onClick={() => {
            if (!route) return
            change((current, stock) => {
              const next = jumpRoute(stock, route, shipCapabilities(current.ship), current.story.flags)
              return next === stock ? current : { ...current, campaignSupply: next }
            })
          }}><span className="block">{destination.name}</span><span className="block font-normal text-white/75">{status}</span></button>
        </li>
      })}
    </ul>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Ship cargo">
      <span>Fuel {supply.fuel}</span><span>Provisions {supply.provisions}</span><span>Alloy {save.wallet.alloy}</span>
      <span>Nightly upkeep {upkeep} {upkeep === 1 ? 'provision' : 'provisions'}</span>
    </div>
    {supply.shortfall > 0 && <p className="text-sm text-[#ffa7b7]">Last night’s shortfall {supply.shortfall} provisions</p>}
    <div>
      <h3 className="font-semibold">Port stock</h3>
      <div className="grid grid-cols-3 gap-2">
        {SUPPLY_KINDS.map((kind) => {
          const count = shipmentAt(supply, port, kind)
          return <div key={kind} className="space-y-1">
            <p className="text-sm">{label[kind]} {storesAt(supply, port)[kind]}</p>
            <button type="button" className={action} disabled={count === 0} onClick={() => change((current, stock) => {
              const shipment = loadShipment(stock, port, kind)
              return shipment ? managementReceipt({ ...current, campaignSupply: shipment.supply, wallet: earn(current.wallet, { alloy: shipment.alloy }) },
                { kind: 'shipment', subject: kind, destination: 'ship', amount: shipmentAt(stock, port, kind) }) : current
            })}>Load {count} {label[kind].toLowerCase()}</button>
          </div>
        })}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {requestRelief(supply, save.campaignDay.day) !== supply && <button type="button" className={action} onClick={() => change((current, stock) => {
        const next = requestRelief(stock, current.campaignDay.day)
        return next === stock ? current : managementReceipt({ ...current, campaignSupply: next },
          { kind: 'relief', subject: 'supplies', destination: 'ship', amount: next.fuel - stock.fuel + next.provisions - stock.provisions })
      })}>Request relief · up to 3 fuel and 2 provisions</button>}
      {engine ? <p className="text-sm">{engine.building ? `Long-range drive · ${engine.building.left} nights left` : 'Long-range drive fitted'}</p>
        : <button type="button" className={action} disabled={bay.problem !== null} onClick={() => change((current, stock) => {
          const { ship, location } = driveBay(current)
          const built = location && placeModule(ship, current.wallet, 'engines', location.deck, location.slot)
          return built ? { ...current, ...built, campaignSupply: stock } : current
        })}>Fit drive · {drive.cost.credits} cr · {drive.cost.alloy} alloy · {drive.cost.data} data</button>}
    </div>
  </section>
}
