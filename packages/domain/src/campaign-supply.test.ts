import { describe, expect, it } from 'vitest'
import { jumpRoute, loadShipment, nextCampaignStop, requestRelief, shipmentAt, startSupply, storesAt, supplyNight, type SupplyNetwork } from './campaign-supply'
import { newSave, parseSave } from './save/save'

const relay = { id: 'relay', name: 'Relay', scene: 'hello-relay', stock: { fuel: 8, provisions: 9, alloy: 12 },
  produces: { fuel: 3, provisions: 2, alloy: 5 }, upkeep: { fuel: 2, provisions: 2, alloy: 1 }, reserve: { fuel: 3, provisions: 3, alloy: 2 } }
const route = { from: 'relay', to: 'yard', fuel: 2, needs: 'drive-1' }
const network: SupplyNetwork = { after: 'recruitment', start: 'relay', ports: [relay, { ...relay, id: 'yard' }], routes: [route] }
const NOW = '2026-11-17T19:00:00Z'

describe('campaign supply', () => {
  it('moves cargo once per order and keeps the dock’s upkeep and reserve', () => {
    const start = startSupply(network)
    const { supply } = loadShipment(start, relay, 'fuel')!
    expect(supply.fuel).toBe(9)
    expect(storesAt(supply, relay).fuel).toBe(5)
    expect(shipmentAt(supply, relay, 'fuel')).toBe(0)
    const alloy = loadShipment(supply, relay, 'alloy')!
    expect(alloy.alloy).toBe(4)
    expect(storesAt(alloy.supply, relay).alloy).toBe(8)
    expect(loadShipment(supply, network.ports[1]!, 'fuel')).toBeNull()
  })

  it('enforces route access, applies a night and makes relief available once per day', () => {
    const start = { ...startSupply(network), fuel: 0, provisions: 0 }
    const after = supplyNight(start, network)
    expect(storesAt(after, relay)).toEqual({ fuel: 9, provisions: 9, alloy: 16 })
    expect(after.shortfall).toBe(2)
    const recovered = requestRelief(after, 2)
    expect(recovered).toMatchObject({ fuel: 3, provisions: 2, reliefDay: 2 })
    expect(jumpRoute(recovered, route, [])).toBe(recovered)
    const docked = jumpRoute(recovered, route, ['drive-1'])
    expect(docked).toMatchObject({ port: 'yard', fuel: 1 })
    expect(requestRelief(docked, 2)).toBe(docked)
    expect(requestRelief(docked, 3).fuel).toBe(3)
  })

  it('preserves the ledger across saves and adds no ledger to a migrated v11 account', () => {
    const save = newSave('captain', NOW)
    const { cabinVisits: _cabins, campaignSupply: _supply, commandCrew: _command, pairScene: _pair, campaignGear: _gear, campaignProjects: _projects, commandTraining: _training, ...v11 } = save
    expect(parseSave({ ...v11, version: 11 })).toEqual(save)
    const campaignSupply = supplyNight(startSupply(network), network)
    expect(parseSave(JSON.parse(JSON.stringify({ ...save, campaignSupply }))).campaignSupply).toEqual(campaignSupply)
  })

  it('uses the same story clearance for jumping and route planning', () => {
    const flagged = { from: 'relay', to: 'yard', fuel: 1, flag: 'tender-cleared' }
    const networkWithClearance = { ...network, routes: [flagged] }
    const supply = startSupply(networkWithClearance)
    expect(jumpRoute(supply, flagged, [])).toBe(supply)
    expect(nextCampaignStop(networkWithClearance, 'relay', 'yard', [])).toBeNull()
    const flags = ['tender-cleared']
    expect(jumpRoute(supply, flagged, [], flags)).toMatchObject({ port: 'yard', fuel: 5 })
    expect(nextCampaignStop(networkWithClearance, 'relay', 'yard', [], flags)).toBe('yard')
  })
})
