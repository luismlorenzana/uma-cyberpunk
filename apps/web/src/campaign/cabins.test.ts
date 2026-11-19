import { describe, expect, it } from 'vitest'
import { newMember, newSave, parsePack, parseSave, startSupply, STAND_IN_FILES,
  type CabinEvening, type CabinNight, type CampaignBook, type Save, type SupplyNetwork } from '@cyber/domain'
import { cabinAvailable, cabinStage, canStay, chooseCabinOutcome, finishCabinScene, leaveCabinEarly, startCabinEvening } from './cabins'

const officer = 9000001, other = 9000002, now = '2026-11-19T12:00:00Z'
const cabin: CabinEvening = { id: 'first-cabin', source: { companion: officer }, chatRapport: 100,
  chats: { acquaintance: ['new-a', 'new-b'], friend: ['friend-a', 'friend-b'], partner: ['partner-a', 'partner-b'] },
  invitation: { scene: 'invitation', stay: 0, leave: 1, wait: 2 }, bed: ['bed-a', 'bed-b'],
  morning: { stay: 'stayed-morning', leave: 'left-morning' }, changeMind: 'changed-mind' }
const network: SupplyNetwork = { after: 'joined', start: 'port', ports: [{ id: 'port', name: 'Port', scene: 'port-scene',
  stock: { fuel: 8, provisions: 12, alloy: 8 }, produces: { fuel: 0, provisions: 0, alloy: 0 },
  upkeep: { fuel: 0, provisions: 0, alloy: 0 }, reserve: { fuel: 0, provisions: 0, alloy: 0 } }], routes: [] }
function fixture() {
  const { pack } = parsePack(STAND_IN_FILES)
  if (!pack) throw Error('Fixture story missing')
  const date = { companion: officer, after: 'joined', milestones: [], regular: { title: 'Chat', scene: 'legacy-chat', morning: 'legacy-morning' }, awards: [] }
  const book: CampaignBook = { opening: 'joined', draft: true, quests: [{ id: 'joined', title: 'Joined', scene: 'joined-scene' }],
    assets: [], art: [], scenes: new Map(), story: pack, pairs: [], commands: new Map(), ground: new Map(), dates: [date],
    supply: network, evening: { after: 'joined', visits: [] }, cabinEvenings: [cabin] }
  const empty = newSave('captain', now)
  const save: Save = { ...empty, crew: [officer, other].map(id => ({ ...newMember(id), bond: { rank: 10, path: 'heart', rapport: 0, seen: [] } })),
    campaignSupply: { ...startSupply(network), provisions: 8 }, story: { ...empty.story, seen: ['joined-scene'] } }
  return { book, save }
}
const restored = (save: Save): Save => parseSave(JSON.parse(JSON.stringify(save)))
function night(save: Save): CabinNight {
  const p = save.campaignDay.pending
  if (p?.kind !== 'cabin') throw Error('Expected cabin reservation')
  return p
}
const finish = (s: Save, b: CampaignBook) => restored(finishCabinScene(s, b, s.campaignDay.day, night(s), []))

describe('the authored campaign cabin evening', () => {
  it('awards a solo chat once per reserved evening, freezes its amount and keeps later-tier bonds progressing', () => {
    const { book, save } = fixture()
    save.crew[0]!.bond = { rank: 1, rapport: 0, path: null, seen: [] }
    save.crew[1]!.bond.rank = 1
    const started = restored(startCabinEvening(save, book, cabin, 1)), p = night(started)
    const updatedBook = { ...book, cabinEvenings: [{ ...cabin, chatRapport: 250 }] }
    let s = restored(finishCabinScene(started, updatedBook, 1, p, []))
    expect(s.crew[0]!.bond).toMatchObject({ rank: 2, rapport: 0 })
    expect(finishCabinScene(s, updatedBook, 1, p, [])).toBe(s)
    s = finish(s, book)
    s = startCabinEvening(s, book, cabin, 2)
    s = finish(s, book)
    expect(s.crew[0]!.bond).toMatchObject({ rank: 2, rapport: 100 })
    expect(s.crew[1]!.bond.rank).toBe(1)
  })
  it.each([0, 1])('persists choice %s, settles exactly one day/upkeep, then completes only its matching morning', index => {
    const { book, save } = fixture()
    let s = restored(startCabinEvening(save, book, cabin, 1))
    expect(s.campaignDay.day).toBe(1)
    expect(startCabinEvening(s, book, cabin, 1)).toBe(s)
    expect(s.cabinVisits['first-cabin-partner']).toBe(1)
    s = finish(s, book)
    const invitation = night(s)
    s = restored(chooseCabinOutcome(s, book, 1, invitation, index))
    expect(night(s).outcome).toBe(index === 0 ? 'stay' : 'leave')
    expect(chooseCabinOutcome(s, book, 1, invitation, 1 - index)).toBe(s)
    s = finish(s, book)
    if (index === 0) {
      expect(night(s).phase).toBe('bed')
      expect(s.campaignDay.day).toBe(1)
      s = finish(s, book)
    }
    expect(s.campaignDay.day).toBe(2)
    expect(s.campaignSupply?.provisions).toBe(6)
    expect(s.watch).toBe(save.watch + 1)
    expect(night(s).scene).toBe(index === 0 ? 'stayed-morning' : 'left-morning')
    expect(finishCabinScene(s, book, 1, invitation, [])).toBe(s)
    const morning = night(s)
    s = finish(s, book)
    expect(s.campaignDay).toEqual({ day: 2, pending: null })
    expect(s.campaignSupply?.provisions).toBe(6)
    expect(s.crew[1]?.bond.path).toBe('heart')
    expect(finishCabinScene(s, book, 2, morning, [])).toBe(s)
  })

  it('keeps more-time and a changed mind within the same reservation, including after a release swap', () => {
    const { book, save } = fixture()
    let s = finish(restored(startCabinEvening(save, book, cabin, 1)), book)
    s = restored(chooseCabinOutcome(s, book, 1, night(s), 2))
    s = finish(s, book)
    expect(night(s)).toMatchObject({ phase: 'invitation', round: 1, outcome: null })
    expect(s.campaignSupply?.provisions).toBe(8)
    const changedBook = { ...book, cabinEvenings: [{ ...cabin, bed: ['new-export-bed'], morning: { stay: 'new-morning', leave: 'new-leave' } }] }
    s = restored(chooseCabinOutcome(s, changedBook, 1, night(s), 0))
    s = finish(s, changedBook)
    expect(night(s).scene).toBe('bed-a')
    s = restored(leaveCabinEarly(s, 1, night(s)))
    expect(night(s)).toMatchObject({ phase: 'leave', scene: 'changed-mind', outcome: 'leave' })
    s = finish(s, changedBook)
    expect(night(s).scene).toBe('left-morning')
    expect(s.campaignSupply?.provisions).toBe(6)
  })

  it('rotates chats per companion/stage and keeps friendship complete without offering an overnight', () => {
    const { book, save } = fixture()
    save.crew[0]!.bond.path = 'trust'
    expect(cabinStage(save, book, cabin)).toBe('friend')
    expect(canStay(save, book, cabin)).toBe(false)
    let s = restored(startCabinEvening(save, book, cabin, 1))
    expect(night(s)).toMatchObject({ scene: 'friend-a', plan: { invitation: null } })
    s = finish(finish(s, book), book)
    s = restored(startCabinEvening(s, book, cabin, 2))
    expect(night(s).scene).toBe('friend-b')
    expect(s.cabinVisits['first-cabin-partner']).toBeUndefined()
    expect(s.crew[0]!.bond.path).toBe('trust')
  })

  it('requires established Heart and current availability; a stale invitation can still choose leave', () => {
    const { book, save } = fixture()
    save.crew[0]!.bond.rank = 9
    expect(canStay(save, book, cabin)).toBe(false)
    save.crew[0]!.bond.rank = 10
    let s = finish(startCabinEvening(save, book, cabin, 1), book)
    s = { ...s, crew: s.crew.filter(c => c.outfit !== officer) }
    expect(cabinAvailable(s, book, cabin)).toBe(false)
    expect(chooseCabinOutcome(s, book, 1, night(s), 0)).toBe(s)
    s = restored(chooseCabinOutcome(s, book, 1, night(s), 1))
    expect(night(s).outcome).toBe('leave')
  })

  it('charges an existing shortage once and preserves legacy pending mornings on migration', () => {
    const { book, save } = fixture()
    save.campaignSupply!.provisions = 0
    save.crew[0]!.bond.path = 'trust'
    let s = finish(startCabinEvening(save, book, cabin, 1), book)
    const shortage = JSON.stringify(s.campaignSupply)
    s = finish(s, book)
    expect(JSON.stringify(s.campaignSupply)).toBe(shortage)
    const { cabinVisits: _, ...old } = save
    const migrated = parseSave({ ...old, version: 16, campaignDay: { day: 4, pending: { kind: 'morning', companion: officer, scene: 'legacy-morning' } } })
    expect(migrated.cabinVisits).toEqual({})
    expect(migrated.account.updatedAt).toBe(now)
    expect(migrated.campaignDay).toEqual({ day: 4, pending: { kind: 'morning', companion: officer, scene: 'legacy-morning' } })
  })

  it('requires the existing shared evening, release and co-location without inferring romance from housing', () => {
    const { book, save } = fixture()
    const shared: CabinEvening = { ...cabin, id: 'shared-cabin', source: { sector: 'sector' }, chatRapport: 0 }
    const sector = { id: 'sector', title: 'Sector', port: 'port', officer, qualification: 'pilot' as const, liberation: 'joined', appointment: 'appointment',
      alloy: 1, contribution: 'Support', former: { speaker: 'commander', custody: 'custody', released: 'released', aboard: 'aboard', ashore: 'ashore' },
      shared: { after: 'joined', visit: 'first-shared', morning: 'first-shared-morning' } }
    book.sectors = [sector]; book.cabinEvenings = [shared]
    expect(cabinAvailable(save, book, shared)).toBe(false)
    save.story.seen.push('first-shared', 'first-shared-morning'); save.story.flags.push('released', 'aboard')
    expect(cabinAvailable(save, book, shared)).toBe(true)
    expect(cabinStage(save, book, shared)).toBe('friend')
    const started = startCabinEvening(save, book, shared, 1)
    expect(night(started).plan.invitation).not.toBeNull()
    save.story.flags.push('custody')
    expect(cabinAvailable(save, book, shared)).toBe(false)
    expect(startCabinEvening(save, book, shared, 1)).toBe(save)
  })

  it('refuses malformed or ambiguous saved outcomes rather than replaying a different branch', () => {
    const { book, save } = fixture(), started = startCabinEvening(save, book, cabin, 1)
    const p = night(started)
    expect(() => parseSave({ ...started, campaignDay: { day: 1, pending: { ...p, phase: 'bed', outcome: 'leave' } } })).toThrow()
    expect(() => parseSave({ ...started, campaignDay: { day: 1, pending: { ...p, phase: 'invitation', scene: 'different-scene' } } })).toThrow()
    expect(() => parseSave({ ...started, campaignDay: { day: 1, pending: { ...p, plan: { ...p.plan, invitation: { ...p.plan.invitation, leave: 0 } } } } })).toThrow()
  })
})
