import { describe, expect, it } from 'vitest'
import { afterMission, bestStyle, newMember } from '../crew/crew'
import { STAND_IN_OUTFITS } from '../crew/stand-in'
import { parseBondFile, parseCasting, parsePack } from '../story/parse'
import { STAND_IN_FILES } from '../story/stand-in'
import {
  COMFORT_TUNING, comfortOf, decorateRapport, deriveTastes, giftRapport, grantRequest, pickFor, place, restedStrain, takeGift, talkLine, talkRapport, talkTopics,
  themeKit, useVisit, visitRapport, visitRequest, visitsLeft, VISIT_TUNING, type Tastes,
} from './cabins'
import { emptyCabin, FURNITURE, GIFTS, ITEMS, ITEMS_BY_ID, KEEPSAKES, LINE_SLOTS, missionItem, STARTER_STOCK, DECOR_STYLES, TOPICS, type Cabin } from './items'

const BANDS = { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 } as const
const TASTES: Tastes = { favourite: 'sporty', disliked: 'cozy', gift: 'snacks', topics: ['racing', 'food'] }
const furnished = (style: string, keepsake: string | null = null): Cabin => ({
  ...emptyCabin(), slots: { ...Object.fromEntries(LINE_SLOTS.map((s) => [s, `${style}-${s}`])), keepsake } as Cabin['slots'],
})

describe('the items', () => {
  it('are six lines of five, six keepsakes and twelve gifts, every id unique', () => {
    expect(FURNITURE).toHaveLength(30)
    for (const style of DECOR_STYLES) expect(FURNITURE.filter((f) => f.style === style).map((f) => f.slot)).toEqual(LINE_SLOTS)
    expect(KEEPSAKES).toHaveLength(6)
    expect(GIFTS).toHaveLength(12)
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
  })
  it('a new game owns two of each slot in Classic and Cozy, and a gift of each kind', () => {
    expect(Object.entries(STARTER_STOCK).filter(([id]) => ITEMS_BY_ID.get(id)?.kind === 'furniture')).toHaveLength(10)
    expect(STARTER_STOCK['classic-bed']).toBe(2)
    expect(Object.keys(STARTER_STOCK).filter((id) => id.startsWith('gift-'))).toHaveLength(6)
  })
  it('a won mission brings the same item each time', () => {
    expect(missionItem('sw1-m1')).toBe(missionItem('sw1-m1'))
    expect(ITEMS_BY_ID.has(missionItem('anything'))).toBe(true)
  })
})

describe('tastes', () => {
  it('derive the same way every time for the same Uma, with the disliked style the favourite’s opposite', () => {
    for (const [id, info] of Object.entries(STAND_IN_OUTFITS)) {
      const a = deriveTastes(Number(id), bestStyle(info.strategy), 'striker', BANDS), b = deriveTastes(Number(id), bestStyle(info.strategy), 'striker', BANDS)
      expect(a).toEqual(b)
      expect(a.disliked).not.toBe(a.favourite)
      expect(a.topics[0]).not.toBe(a.topics[1])
    }
    expect(deriveTastes(123456, null, 'medic', BANDS)).toEqual(deriveTastes(123456, null, 'medic', BANDS))
  })
  it('come from the casting when the story writes them, checked strictly', () => {
    const casting = parseCasting({ schemaVersion: 1, leads: [], tastes: { '9000001': TASTES } })
    expect(casting.tastes?.['9000001']).toEqual(TASTES)
    expect(() => parseCasting({ schemaVersion: 1, leads: [], tastes: { '9000001': { ...TASTES, disliked: 'sporty' } } })).toThrow(/other than her favourite/)
    expect(() => parseCasting({ schemaVersion: 1, leads: [], tastes: { '9000001': { ...TASTES, topics: ['racing', 'racing'] } } })).toThrow(/two different topics/)
    expect(() => parseCasting({ schemaVersion: 1, leads: [], tastes: { '9000001': { ...TASTES, gift: 'gold' } } })).toThrow(/gift/)
  })
  it('the stand-in writes tastes for all four Umas and small talk for Lead A, and still parses', () => {
    const { pack, errors } = parsePack(STAND_IN_FILES)
    expect(errors).toEqual([])
    expect(Object.keys(pack!.casting.tastes ?? {})).toHaveLength(4)
    expect(pack!.bonds['9000001']!.talk?.racing?.length).toBeGreaterThan(0)
  })
  it('small talk takes known topics and short lines only', () => {
    const base = { schemaVersion: 1, outfit: 9000001, scenes: [] }
    expect(parseBondFile({ ...base, talk: { music: ['A line.'] } }).talk).toEqual({ music: ['A line.'] })
    expect(() => parseBondFile({ ...base, talk: { gossip: ['x'] } })).toThrow(/unknown keys gossip/)
    expect(() => parseBondFile({ ...base, talk: { music: ['x'.repeat(161)] } })).toThrow(/160/)
  })
})

describe('Comfort', () => {
  it('adds each item, +2 for her favourite style, −1 for the one she dislikes, +2 for a full line', () => {
    const sporty = comfortOf(furnished('sporty'), TASTES)
    const line = FURNITURE.filter((f) => f.style === 'sporty').reduce((n, f) => n + f.comfort, 0)
    expect(sporty).toEqual({ points: line + 5 * COMFORT_TUNING.favourite + COMFORT_TUNING.set, lights: 4, set: 'sporty' })
    const cozy = comfortOf(furnished('cozy'), TASTES)
    expect(cozy.points).toBe(FURNITURE.filter((f) => f.style === 'cozy').reduce((n, f) => n + f.comfort, 0) - 5 + COMFORT_TUNING.set)
    expect(comfortOf(emptyCabin(), TASTES)).toEqual({ points: 0, lights: 0, set: null })
    const mixed = { ...furnished('sporty'), slots: { ...furnished('sporty').slots, bed: 'classic-bed' } }
    expect(comfortOf(mixed, TASTES).set).toBeNull()
  })
  it('reaches five lights with her favourite line and a keepsake', () => {
    expect(comfortOf(furnished('sporty', 'keepsake-trophy'), TASTES).lights).toBe(5)
  })
  it('lets her shed Strain resting: 1 at three lights even below 3, all of it at five', () => {
    expect(restedStrain(2, 0)).toBe(2)
    expect(restedStrain(3, 0)).toBe(0)
    expect(restedStrain(2, 3)).toBe(1)
    expect(restedStrain(1, 3)).toBe(0)
    expect(restedStrain(2, 5)).toBe(0)
    const crew = [{ ...newMember(1), strain: 2 }, { ...newMember(2), strain: 2 }, { ...newMember(3), strain: 2 }]
    const lights: Record<number, number> = { 1: 0, 2: 3, 3: 5 }
    expect(afterMission(crew, [], 10, (m) => restedStrain(m.strain, lights[m.outfit]!)).map((m) => m.strain)).toEqual([2, 1, 0])
    expect(afterMission(crew, [1], 10, (m) => restedStrain(m.strain, 5))[0]!.strain).toBe(3)
  })
})

describe('decorating', () => {
  it('moves items between the stock and the cabin, never past what’s owned', () => {
    const a = place(emptyCabin(), { 'cozy-bed': 1 }, 'bed', 'cozy-bed')!
    expect(a.cabin.slots.bed).toBe('cozy-bed')
    expect(a.stock).toEqual({})
    expect(place(a.cabin, a.stock, 'bed', 'cozy-bed')).toBeNull()
    expect(place(emptyCabin(), { 'cozy-bed': 1 }, 'desk', 'cozy-bed')).toBeNull()
    const b = place(a.cabin, { 'classic-bed': 1 }, 'bed', 'classic-bed')!
    expect(b.stock).toEqual({ 'cozy-bed': 1 })
    expect(place(b.cabin, b.stock, 'bed', null)!.stock).toEqual({ 'cozy-bed': 1, 'classic-bed': 1 })
  })
  it('she picks her favourite style first, never the one she dislikes when anything else fits', () => {
    expect(pickFor('bed', { 'cozy-bed': 1, 'classic-bed': 1, 'sporty-bed': 1 }, TASTES)!.id).toBe('sporty-bed')
    expect(pickFor('bed', { 'cozy-bed': 1, 'classic-bed': 1 }, TASTES)!.id).toBe('classic-bed')
    expect(pickFor('desk', {}, TASTES)).toBeNull()
  })
  it('a theme kit furnishes her favourite line from the stock in one tap', () => {
    const stock = Object.fromEntries(FURNITURE.filter((f) => f.style === 'sporty').map((f) => [f.id, 1]))
    const kit = themeKit(emptyCabin(), stock, TASTES)
    expect(comfortOf(kit.cabin, TASTES).set).toBe('sporty')
    expect(kit.stock).toEqual({})
  })
})

describe('visits', () => {
  it('three a watch, reset when the watch moves on', () => {
    let v = { watch: 4, used: 0 }
    for (let i = 0; i < 3; i++) { expect(visitsLeft(v, 4)).toBe(3 - i); v = useVisit(v, 4) }
    expect(visitsLeft(v, 4)).toBe(0)
    expect(visitsLeft(v, 5)).toBe(VISIT_TUNING.perWatch)
    expect(useVisit(v, 5)).toEqual({ watch: 5, used: 1 })
  })
  it('a loved topic gives full rapport and any other half; Comfort 4 adds half again', () => {
    expect(talkRapport('racing', TASTES)).toBe(VISIT_TUNING.talkLoved)
    expect(talkRapport('history', TASTES)).toBe(VISIT_TUNING.talkLoved / 2)
    expect(visitRapport(30, 4)).toBe(45)
    expect(visitRapport(30, 3)).toBe(30)
  })
  it('offers three different topics, most often one she loves', () => {
    let loved = 0
    for (let w = 0; w < 30; w++) {
      const topics = talkTopics(TASTES, 9000001, w, 0)
      expect(new Set(topics).size).toBe(3)
      for (const t of topics) expect(TOPICS).toContain(t)
      if (topics.some((t) => TASTES.topics.includes(t))) loved++
    }
    expect(loved).toBeGreaterThan(12)
  })
  it('a favourite gift pays more, and the gift leaves the stock', () => {
    expect(giftRapport(ITEMS_BY_ID.get('gift-buns'), TASTES)).toBe(VISIT_TUNING.giftFavourite)
    expect(giftRapport(ITEMS_BY_ID.get('gift-novel'), TASTES)).toBe(VISIT_TUNING.giftOther)
    expect(takeGift({ 'gift-buns': 1 }, 'gift-buns')).toEqual({})
    expect(takeGift({}, 'gift-buns')).toBeNull()
    expect(takeGift({ 'cozy-bed': 1 }, 'cozy-bed')).toBeNull()
    expect(decorateRapport(ITEMS_BY_ID.get('sporty-bed'), TASTES)).toBe(VISIT_TUNING.decorateFavourite)
  })
  it('about one visit in five ends with a request; granting it fills the slot', () => {
    let asked = 0
    for (let w = 0; w < 100; w++) if (visitRequest(emptyCabin(), 9000002, w, 0)) asked++
    expect(asked).toBeGreaterThan(8)
    expect(asked).toBeLessThan(35)
    const cabin = { ...emptyCabin(), request: 'light' as const }
    const granted = grantRequest(cabin, { 'cozy-light': 1 }, 'cozy-light')!
    expect(granted.cabin).toMatchObject({ request: null, slots: { light: 'cozy-light' } })
    expect(grantRequest(cabin, { 'cozy-bed': 1 }, 'cozy-bed')).toBeNull()
  })
  it('says her written small talk when the story has it, else the pool', () => {
    expect(talkLine('racing', { racing: ['Mine.'] }, true, 1)).toBe('Mine.')
    expect(typeof talkLine('stars', undefined, true, 1)).toBe('string')
  })
})
