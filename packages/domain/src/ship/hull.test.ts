import { describe, expect, it } from 'vitest'
import {
  addDeck, deckSlots, earn, freePlace, HULL_TUNING, installedSystems, moduleLevel, openModule, openRooms, passWatch, placeModule, placeProblem, powerChoice,
  reactorPips, researchProblem, resultsPay, shipCapabilities, shipWith, startResearch, upgradeModule, upgradeProblem, type Ship, type Wallet,
} from './hull'
import { MODULES, PROJECTS, PROJECTS_BY_ID } from './modules'

const RICH: Wallet = { credits: 99_999, alloy: 9_999, data: 9_999 }
const start = () => shipWith(['bridge', 'hangar', 'quarters', 'log', 'engineering'])
/** Passes watches until every build and the Lab's project are done. */
const settle = (ship: Ship, watches = 3) => { let s = ship; for (let i = 0; i < watches; i++) s = passWatch(s).ship; return s }

describe('the tables', () => {
  it('hold the seven rooms, Engineering, seven more rooms and five systems; every research unlock names a project', () => {
    expect(MODULES).toHaveLength(20)
    expect(MODULES.filter((m) => m.kind === 'system')).toHaveLength(5)
    for (const m of MODULES) if (typeof m.unlock === 'object') expect(PROJECTS_BY_ID.has(m.unlock.research)).toBe(true)
    for (const p of PROJECTS) for (const n of p.needs) expect(PROJECTS_BY_ID.has(n)).toBe(true)
  })
})

describe('the hull (TC62)', () => {
  it('a new game: two decks of five, five rooms placed, Engineering at level 1 with 3 pips', () => {
    const s = start()
    expect(s.decks).toBe(2)
    expect(s.width).toBe(5)
    expect(s.modules.every((m) => m.level === 1)).toBe(true)
    expect(reactorPips(s)).toBe(3)
    expect(s.unlocked).toEqual(expect.arrayContaining(['lab', 'galley', 'battery', 'sensors']))
    expect(openRooms(s)).toEqual(expect.arrayContaining(['bridge', 'hangar', 'quarters', 'log']))
  })
  it('places a module in a free slot, paying, and builds it over its watches', () => {
    const s0 = start(), at = freePlace(s0, 'galley')!
    const placed = placeModule(s0, RICH, 'galley', at.deck, at.slot)!
    expect(placed.wallet.credits).toBe(RICH.credits - 200)
    expect(moduleLevel(placed.ship, 'galley')).toBe(0)
    const one = passWatch(placed.ship)
    expect(one.report.built).toEqual([])
    const two = passWatch(one.ship)
    expect(two.report.built).toEqual([{ id: 'galley', level: 1 }])
    expect(moduleLevel(two.ship, 'galley')).toBe(1)
  })
  it('refuses a taken slot, a locked module, a second build at once and an empty wallet', () => {
    const s0 = start()
    expect(placeProblem(s0, RICH, 'galley', 0, 0)).toMatch(/taken/)
    expect(placeProblem(s0, RICH, 'medbay', 1, 4)).toMatch(/unlocked/)
    expect(placeProblem(s0, { credits: 10, alloy: 0, data: 0 }, 'galley', 1, 4)).toMatch(/wallet/)
    const busy = placeModule(s0, RICH, 'galley', 1, 4)!
    expect(placeProblem(busy.ship, busy.wallet, 'lab', 1, 3)).toMatch(/busy/)
  })
  it('a two-slot module needs two free slots side by side', () => {
    let s = { ...start(), unlocked: [...start().unlocked, 'garden' as const] }
    expect(placeProblem(s, RICH, 'garden', 1, 4)).toMatch(/two free slots/)
    const at = freePlace(s, 'garden')!
    s = placeModule(s, RICH, 'garden', at.deck, at.slot)!.ship
    expect(deckSlots(s, at.deck).filter((x) => x === 'garden')).toHaveLength(2)
  })
  it('upgrades a level over watches; level 3 waits on its family’s research', () => {
    let s = start()
    s = upgradeModule(s, RICH, 'engineering')!.ship
    s = settle(s)
    expect(moduleLevel(s, 'engineering')).toBe(2)
    expect(reactorPips(s)).toBe(5)
    expect(upgradeProblem(s, RICH, 'engineering')).toMatch(/Core Refit/)
    s = { ...s, research: { done: ['core-3'], current: null } }
    s = settle(upgradeModule(s, RICH, 'engineering')!.ship)
    expect(reactorPips(s)).toBe(7)
  })
  it('a lead’s room is placed at once when a slot is free, else only unlocked', () => {
    const s = openModule(start(), 'comms')
    expect(moduleLevel(s, 'comms')).toBe(1)
    const full: Ship = { ...start(), decks: 1, modules: start().modules.filter((m) => m.deck === 0) }
    const crowded = openModule(full, 'simpod')
    expect(crowded.unlocked).toContain('simpod')
    expect(moduleLevel(crowded, 'simpod')).toBe(0)
  })
  it('a refit adds a deck, to six at most', () => {
    let s = start()
    for (let i = 0; i < 9; i++) s = addDeck(s)
    expect(s.decks).toBe(HULL_TUNING.maxDecks)
  })
})

describe('power (TC62)', () => {
  const withSystems = () => {
    let s = start()
    for (const id of ['battery', 'sensors'] as const) { const at = freePlace(s, id)!; s = settle(placeModule(s, RICH, id, at.deck, at.slot)!.ship) }
    s = { ...s, unlocked: [...s.unlocked, 'shield'] }
    const at = freePlace(s, 'shield')!
    return settle(placeModule(s, RICH, 'shield', at.deck, at.slot)!.ship)
  }
  it('powers systems within the reactor’s pips and refuses a third over them', () => {
    const s = withSystems()
    expect(installedSystems(s)).toEqual(['battery', 'sensors', 'shield'])
    expect(powerChoice(s, ['battery', 'sensors'])).toEqual(['battery', 'sensors'])
    expect(powerChoice(s, ['battery', 'sensors', 'shield'])).toBeNull()
    expect(powerChoice(s, ['drones'])).toEqual([]) // not installed: dropped
  })
  it('the capabilities follow the modules running: sensors and the storm shielding', () => {
    expect(shipCapabilities(start())).toEqual([])
    expect(shipCapabilities(withSystems())).toEqual(['sensors', 'storm'])
  })
})

describe('research (TC63)', () => {
  const withLab = () => { const s = start(), at = freePlace(s, 'lab')!; return settle(placeModule(s, RICH, 'lab', at.deck, at.slot)!.ship) }
  it('needs a Lab, one project at a time, its prerequisites and its Data', () => {
    expect(researchProblem(start(), RICH, 'medbay')).toMatch(/Lab/)
    const s = withLab()
    expect(researchProblem(s, RICH, 'reactor-2')).toMatch(/Reactor I/)
    expect(researchProblem(s, { ...RICH, data: 5 }, 'medbay')).toMatch(/Data/)
    const going = startResearch(s, RICH, 'medbay')!
    expect(going.wallet.data).toBe(RICH.data - 30)
    expect(researchProblem(going.ship, going.wallet, 'hull-1')).toMatch(/busy/)
  })
  it('a finished project unlocks its module; Hull I adds a deck; Reactor I adds a pip', () => {
    let s = withLab()
    s = settle(startResearch(s, RICH, 'medbay')!.ship)
    expect(s.unlocked).toContain('medbay')
    expect(s.research.done).toContain('medbay')
    s = settle(startResearch(s, RICH, 'hull-1')!.ship)
    expect(s.decks).toBe(3)
    s = settle(startResearch(s, RICH, 'reactor-1')!.ship)
    expect(reactorPips(s)).toBe(4)
  })
})

describe('the wallet', () => {
  it('results pay credits, Alloy from salvage, and Data 5 a battle or 10 a win; no upkeep', () => {
    expect(resultsPay(150, 3, true)).toEqual({ credits: 150, alloy: 3, data: 10 })
    expect(resultsPay(0, 0, false)).toEqual({ credits: 0, alloy: 0, data: 5 })
    expect(earn({ credits: 1, alloy: 2, data: 3 }, { data: 5 })).toEqual({ credits: 1, alloy: 2, data: 8 })
  })
})
