// The ship as a build through the save (CY15): a Galley placed and built over two watches, Engineering's upgrade adding
// pips, power toggles refused over the reactor, a project unlocking a module, the wallet paid by results.
import { freePlace, moduleLevel, newSave, reactorPips, type Save } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { closeResults, passAWatch } from '../mission/director'
import { placeOnShip, researchOnShip, togglePower, upgradeOnShip } from './build'

const T0 = '2026-11-13T00:00:00.000Z'
const rich = (): Save => ({ ...newSave('u', T0), wallet: { credits: 99_999, alloy: 9_999, data: 9_999 } })
const build = (s: Save, id: Parameters<typeof placeOnShip>[1]) => { const at = freePlace(s.ship, id)!; return placeOnShip(s, id, at.deck, at.slot) }
const watches = (s: Save, n: number) => { let x = s; for (let i = 0; i < n; i++) x = passAWatch(x); return x }

describe('the ship through the save', () => {
  it('a Galley is placed and built over two watches, and the wallet pays for it', () => {
    let s = build(rich(), 'galley')
    expect(s.wallet.credits).toBe(99_999 - 200)
    expect(moduleLevel(s.ship, 'galley')).toBe(0)
    s = watches(s, 1)
    expect(moduleLevel(s.ship, 'galley')).toBe(0)
    s = watches(s, 1)
    expect(moduleLevel(s.ship, 'galley')).toBe(1)
  })
  it('Engineering’s upgrade adds pips; the third system over the reactor is refused', () => {
    let s = rich()
    s = watches(build(s, 'battery'), 2)
    s = watches(build(s, 'sensors'), 2)
    s = { ...s, ship: { ...s.ship, unlocked: [...s.ship.unlocked, 'shield'] } }
    s = watches(build(s, 'shield'), 2)
    s = togglePower(togglePower(s, 'battery'), 'sensors')
    expect(s.ship.powered).toEqual(['battery', 'sensors'])
    expect(togglePower(s, 'shield')).toBe(s) // 1 + 1 + 2 > 3 pips
    s = watches(upgradeOnShip(s, 'engineering'), 2)
    expect(reactorPips(s.ship)).toBe(5)
    expect(togglePower(s, 'shield').ship.powered).toEqual(['battery', 'sensors', 'shield'])
  })
  it('a research project finishes over its watches and unlocks a module', () => {
    let s = watches(build(rich(), 'lab'), 2)
    s = researchOnShip(s, 'medbay')
    expect(s.ship.research.current?.id).toBe('medbay')
    s = watches(s, 1)
    expect(s.ship.unlocked).toContain('medbay')
  })
  it('results pay credits, Alloy and Data, and a watch passes builds along', () => {
    let s = build(rich(), 'galley')
    const before = s.wallet
    s = closeResults({ ...s, mission: { id: 'm', chapter: 'c', step: 'results', squad: [], battle: null, won: false } })
    expect(s.wallet.data).toBe(before.data + 5)
    expect(s.ship.modules.find((m) => m.id === 'galley')!.building!.left).toBe(1)
  })
})
