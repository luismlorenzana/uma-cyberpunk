// Cabins headless (CY14): visits through the save (three a watch, the fourth refused), reveals, invitations from rank 4,
// decorating and theme kits, granting a request, a first win's item and Comfort's rest; and the looks index.
import { comfortOf, missionItem, newMember, newSave, parsePack, STAND_IN_FILES, VISIT_TUNING, type Save, type StoryPack } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { crewViews, infoFrom } from '../crew/view'
import { lookPath, parseLooks } from '../looks/looks'
import { closeResults } from '../mission/director'
import { applyThemeKit, comfortFor, grantItem, lightsFrom, placeItem, tastesFor, visit, visitsLeftNow } from './cabins'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const T0 = '2026-11-13T00:00:00.000Z'
const crewSave = (...outfits: number[]): Save => ({ ...newSave('u', T0), crew: outfits.map(newMember) })
const views = (s: Save) => crewViews(s, pack, infoFrom(null), (o) => `Uma ${o}`)
const viewOf = (s: Save, o: number) => views(s).find((v) => v.outfit === o)!
const memberOf = (s: Save, o: number) => s.crew.find((m) => m.outfit === o)!

describe('visits through the save (TC61)', () => {
  it('a loved topic pays full rapport and reveals it; three visits a watch, the fourth refused until the next', () => {
    let s = crewSave(9000001, 9000002)
    const tastes = tastesFor(pack, viewOf(s, 9000001))
    expect(tastes.topics).toEqual(['racing', 'food']) // the stand-in writes Lead A's
    const r = visit(s, pack, viewOf(s, 9000001), { kind: 'talk', topic: 'racing' })!
    expect(r.result.rapport).toBe(VISIT_TUNING.talkLoved)
    expect(r.result.revealed).toEqual(['topic:racing'])
    expect(r.result.lines[0]).toMatch(/ring docks|corridor/) // her written small talk
    s = r.save
    expect(memberOf(s, 9000001).bond.rapport).toBe(VISIT_TUNING.talkLoved)
    const other = visit(s, pack, viewOf(s, 9000001), { kind: 'talk', topic: 'history' })!
    expect(other.result.rapport).toBe(VISIT_TUNING.talkLoved / 2)
    expect(other.result.revealed).toEqual([])
    s = other.save
    s = visit(s, pack, viewOf(s, 9000002), { kind: 'talk', topic: 'crew' })!.save
    expect(visitsLeftNow(s)).toBe(0)
    expect(visit(s, pack, viewOf(s, 9000001), { kind: 'talk', topic: 'racing' })).toBeNull()
    s = { ...s, watch: s.watch + 1 }
    expect(visitsLeftNow(s)).toBe(3)
    expect(visit(s, pack, viewOf(s, 9000001), { kind: 'talk', topic: 'racing' })).not.toBeNull()
  })
  it('a gift leaves the stock, pays by her favourite kind and reveals it', () => {
    const s = crewSave(9000001)
    const r = visit(s, pack, viewOf(s, 9000001), { kind: 'gift', item: 'gift-buns' })! // Lead A loves snacks
    expect(r.result.rapport).toBe(VISIT_TUNING.giftFavourite)
    expect(r.result.revealed).toEqual(['gift'])
    expect(r.save.items['gift-buns']).toBeUndefined()
    expect(visit(r.save, pack, viewOf(r.save, 9000001), { kind: 'gift', item: 'gift-buns' })).toBeNull()
  })
  it('decorating together, she picks from the stock for an empty slot and reveals her styles', () => {
    const s = crewSave(9000003)
    const r = visit(s, pack, viewOf(s, 9000003), { kind: 'decorate' })!
    expect(r.result.placed).not.toBeNull()
    expect(r.result.revealed).toEqual(['styles'])
    expect(memberOf(r.save, 9000003).cabin.slots[r.result.placed!.slot]).toBe(r.result.placed!.item)
  })
  it('an invitation waits for rank 4, then pays +40 and sheds a point of Strain', () => {
    let s = crewSave(9000001)
    expect(visit(s, pack, viewOf(s, 9000001), { kind: 'invite' })).toBeNull()
    s = { ...s, crew: s.crew.map((m) => ({ ...m, strain: 2, bond: { ...m.bond, rank: 4 } })) }
    const r = visit(s, pack, viewOf(s, 9000001), { kind: 'invite' })!
    expect(r.result).toMatchObject({ rapport: VISIT_TUNING.invite, strainShed: 1 })
    expect(memberOf(r.save, 9000001).strain).toBe(1)
  })
  it('Comfort 4 earns half again', () => {
    let s = crewSave(9000001)
    const sporty = ['bed', 'desk', 'wall', 'floor', 'light'].map((slot) => `sporty-${slot}`)
    s = { ...s, items: Object.fromEntries(sporty.map((id) => [id, 1])) }
    s = applyThemeKit(s, pack, viewOf(s, 9000001))
    expect(comfortFor(pack, viewOf(s, 9000001)).lights).toBe(4)
    expect(visit(s, pack, viewOf(s, 9000001), { kind: 'talk', topic: 'racing' })!.result.rapport).toBe(Math.round(VISIT_TUNING.talkLoved * 1.5))
  })
})

describe('decorating and requests', () => {
  it('places and removes by hand, changing Comfort on the spot', () => {
    let s = crewSave(9000002)
    const before = comfortFor(pack, viewOf(s, 9000002)).points
    s = placeItem(s, 9000002, 'bed', 'cozy-bed')
    expect(comfortFor(pack, viewOf(s, 9000002)).points).toBeGreaterThan(before)
    expect(s.items['cozy-bed']).toBe(1)
    s = placeItem(s, 9000002, 'bed', null)
    expect(s.items['cozy-bed']).toBe(2)
    expect(placeItem(s, 9000002, 'bed', 'neon-bed')).toBe(s) // not in the stock
  })
  it('granting a request fills the slot and pays', () => {
    let s = crewSave(9000002)
    s = { ...s, crew: s.crew.map((m) => ({ ...m, cabin: { ...m.cabin, request: 'light' } })) }
    s = grantItem(s, pack, 9000002, 'cozy-light')
    expect(memberOf(s, 9000002).cabin).toMatchObject({ request: null, slots: { light: 'cozy-light' } })
    expect(memberOf(s, 9000002).bond.rapport).toBe(VISIT_TUNING.request)
  })
})

describe('a mission’s close (CY14)', () => {
  const missionSave = (s: Save, won: boolean): Save => ({ ...s, mission: { id: 'sw1-m1', chapter: 'sw1-ch1', step: 'results', squad: [9000001], battle: null, won } })
  it('a first win brings its item; a repeat doesn’t', () => {
    const s = closeResults(missionSave(crewSave(9000001), true))
    const id = missionItem('sw1-m1')
    expect(s.items[id]).toBe((newSave('u', T0).items[id] ?? 0) + 1)
    const again = closeResults({ ...missionSave(s, true) })
    expect(again.items[id]).toBe(s.items[id])
  })
  it('resting in a comfortable cabin sheds Strain', () => {
    let s = crewSave(9000001, 9000002)
    s = { ...s, crew: s.crew.map((m) => ({ ...m, strain: 2 })), items: Object.fromEntries(['bed', 'desk', 'wall', 'floor', 'light'].map((x) => [`cozy-${x}`, 1])) }
    s = applyThemeKit(s, pack, viewOf(s, 9000002)) // Lead B loves Cozy: a full set
    expect(comfortOf(memberOf(s, 9000002).cabin, tastesFor(pack, viewOf(s, 9000002))).lights).toBeGreaterThanOrEqual(3)
    const closed = closeResults(missionSave(s, false), pack, null, lightsFrom(pack, views(s)))
    expect(memberOf(closed, 9000001).strain).toBe(3) // fought
    expect(memberOf(closed, 9000002).strain).toBeLessThan(2) // rested in comfort
  })
})

describe('the looks index (D25)', () => {
  const index = { looks: [
    { id: 'a-quarters', character: 'Uma A', outfit: 'quarters', path: 'images/uma-a-quarters.0123456789abcdef.png' },
    { id: 'bad', character: 'Uma A', outfit: 'swimsuit', path: 'images/x.0123456789abcdef.png' },
    { id: 'evil', character: 'Uma A', outfit: 'armor', path: '../secret.png' },
  ] }
  it('keeps known looks with servable paths and finds hers by name', () => {
    const entries = parseLooks(index)
    expect(entries).toHaveLength(1)
    expect(lookPath(entries, 'uma a', 'quarters')).toBe('looks/images/uma-a-quarters.0123456789abcdef.png')
    expect(lookPath(entries, 'Uma A', 'armor')).toBeNull()
    expect(lookPath(entries, undefined, 'quarters')).toBeNull()
    expect(parseLooks(null)).toEqual([])
  })
})
