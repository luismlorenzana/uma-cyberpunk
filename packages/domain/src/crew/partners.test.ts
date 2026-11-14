import { describe, expect, it } from 'vitest'
import { shipWith } from '../ship/hull'
import { sortieOrders, sortieSystems } from '../ship/sortie'
import { addCamaraderie, makePartners, partnerLevelFor, partnerOfOutfit, partnerProblem, settlePartners } from './partners'

describe('partners (TC58)', () => {
  it('levels by camaraderie: 1 at 100, 2 at 250, 3 at 500 with the project', () => {
    expect([99, 100, 250, 500].map((c) => partnerLevelFor(c, false))).toEqual([0, 1, 2, 2])
    expect(partnerLevelFor(500, true)).toBe(3)
  })
  it('one partner each, from 100 camaraderie', () => {
    const cam = { '1-2': 120, '1-3': 300, '2-3': 50 }
    expect(partnerProblem([], cam, 2, 3)).toMatch(/50 of 100/)
    let p = makePartners([], cam, 2, 1, false)
    expect(p).toEqual([{ a: 1, b: 2, level: 1 }])
    expect(partnerProblem(p, cam, 1, 3)).toMatch(/One partner each/)
    expect(partnerOfOutfit(p, 2)).toBe(1)
    p = settlePartners(p, addCamaraderie(cam, new Map([['1-2', 200]])), false)
    expect(p[0]!.level).toBe(2)
  })
})

describe('a sortie’s ship (TC59, TC64)', () => {
  const base = () => shipWith(['bridge', 'hangar', 'quarters', 'log', 'engineering'])
  it('two Orders at Bridge level 1, Sure shot and Call her name always; each powered system’s support', () => {
    expect(sortieOrders(base(), false)).toEqual({ slots: 2, kinds: ['sure', 'resonance'] })
    const s = { ...base(), modules: [...base().modules, { id: 'battery' as const, deck: 1, slot: 3, level: 2, building: null }], powered: ['battery' as const] }
    expect(sortieOrders(s, false).kinds).toContain('strike')
    expect(sortieSystems(s, (post) => (post === 'gunner' ? 4 : null))).toEqual([{ id: 'battery', level: 2, band: 4 }])
  })
  it('Field Repairs gives Reboot; Ship Uplink a slot', () => {
    const s = { ...base(), research: { done: ['tactics-1', 'tactics-2', 'tactics-3'], current: null } }
    expect(sortieOrders(s, false)).toMatchObject({ slots: 3 })
    expect(sortieOrders(s, false).kinds).toContain('reboot')
  })
})
