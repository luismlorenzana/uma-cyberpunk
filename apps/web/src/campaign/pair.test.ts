import {
  finishCampaignNightScene, newMember, newSave, pairProgress, pairVisit, parseSave, setFlag, startCampaignNight,
  type CampaignBook, type CampaignPair, type EffectStep, type Save,
} from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { closePairScene, openPairScene, pairAvailable, recordPairScene } from './pair'

const now = '2026-11-17T00:00:00.000Z'
const first = 9000111, second = 9000112
const pair: CampaignPair = {
  id: 'pair', after: 'liberation', capture: 'took-custody', members: [{ outfit: first, trust: 'kept-word' }, { outfit: second, trust: 'gave-account' }],
  recovery: ['first-visit', 'last-visit'], testimony: 'testimony', release: 'release',
  bond: { scene: 'bond', romance: 'dates', friendship: 'friends' },
  residency: { scene: 'room', shared: 'share-quarters', separate: 'separate-quarters' },
  rooms: { shared: { move: 'shared-move', visit: 'shared-visit', morning: 'shared-morning' }, separate: { move: 'separate-move', visit: 'separate-visit', morning: 'separate-morning' } },
}
const book: CampaignBook = {
  opening: 'liberation', draft: true, quests: [{ id: 'liberation', title: 'Liberation', scene: 'liberation-debrief' }], assets: [], art: [], scenes: new Map(), commands: new Map(), ground: new Map(), pairs: [pair],
  story: { casting: { schemaVersion: 1, leads: [], crewOrder: [first, second], heroines: [], minor: [] }, worlds: {}, chapters: {}, calls: {}, bonds: {}, events: {},
    files: { testimony: { id: 'testimony', schemaVersion: 1, lines: [{ text: 'The witness heard the signal.', redacted: false }] } } },
}
const flag = (flag: string): EffectStep => ({ kind: 'flag', flag, set: true })
const captured = (): Save => {
  const save = newSave('captain', now)
  return { ...save, crew: [newMember(first)], story: { ...setFlag(save.story, pair.capture), seen: ['liberation-debrief'] } }
}
const reload = (save: Save): Save => parseSave(JSON.parse(JSON.stringify(save)))
const visitOf = (save: Save) => pairVisit(pair, save.story, save.crew.map(({ outfit }) => outfit))

function night(save: Save, effects: EffectStep[] = []): Save {
  const visit = visitOf(save)!
  const opened = reload({ ...save, campaignDay: startCampaignNight(save.campaignDay, visit) })
  const campaignDay = finishCampaignNightScene(opened.campaignDay, opened.campaignDay.day, visit)
  const cleared = { ...recordPairScene(opened, book, pair, visit.scene, effects), campaignDay }
  expect(cleared.campaignDay.day).toBe(save.campaignDay.day + 1)
  expect(finishCampaignNightScene(cleared.campaignDay, opened.campaignDay.day, visit)).toBe(cleared.campaignDay)
  return reload(cleared)
}

function finishDayScene(save: Save, scene: string, effects: EffectStep[] = []): Save {
  const opened = reload(openPairScene(save, book, pair, scene))
  expect(opened.pairScene).toEqual({ pair: pair.id, scene })
  const cleared = closePairScene(opened, book, pair, scene, effects)
  expect(cleared.pairScene).toBeNull()
  expect(closePairScene(cleared, book, pair, scene, effects)).toBe(cleared)
  return reload(cleared)
}

function recovered(): Save {
  return night(night(captured(), [flag(pair.members[0].trust)]), [flag(pair.members[1].trust)])
}

describe('Selden pair recovery', () => {
  it('gates the arc on custody and liberation, then records separate trust and awards testimony before release', () => {
    const save = captured()
    expect(pairAvailable(save, book, pair)).toBe(true)
    expect(pairAvailable({ ...save, story: { ...save.story, flags: [] } }, book, pair)).toBe(false)
    expect(pairAvailable({ ...save, story: { ...save.story, seen: [] } }, book, pair)).toBe(false)
    expect(openPairScene(save, book, pair, pair.release)).toBe(save)
    expect(openPairScene(save, book, pair, pair.bond.scene)).toBe(save)
    expect(visitOf(save)?.scene).toBe(pair.recovery[0])
    const firstVisit = night(save, [flag(pair.members[0].trust)])
    expect(pairProgress(pair, firstVisit.story)).toMatchObject({ recovery: 1, trust: [true, false] })
    expect(visitOf(firstVisit)?.scene).toBe(pair.recovery[1])
    const finished = night(firstVisit, [flag(pair.members[1].trust)])
    expect(pairProgress(pair, finished.story)).toMatchObject({ recovery: 2, next: pair.release, trust: [true, true] })
    expect(finished.story.files[pair.testimony]).toEqual([0])
    expect(finished.crew.map(({ outfit }) => outfit)).toEqual([first])
    expect(recordPairScene(finished, book, pair, pair.recovery[1], [flag('duplicate')])).toBe(finished)
  })

  it.each([['friendship', 'shared'], ['friendship', 'separate'], ['romance', 'shared'], ['romance', 'separate']] as const)
  ('saves %s and %s independently with a resumable night and morning', (bond, residency) => {
    const released = finishDayScene(recovered(), pair.release, [{ kind: 'join', outfit: second }])
    expect(released.crew.map(({ outfit }) => outfit)).toEqual([first, second])
    const withBond = finishDayScene(released, pair.bond.scene, [flag(pair.bond[bond])])
    const chosen = finishDayScene(withBond, pair.residency.scene, [flag(pair.residency[residency])])
    expect(visitOf(chosen)).toBeNull()
    const room = pair.rooms[residency]
    const moved = finishDayScene(chosen, room.move)
    expect(pairProgress(pair, moved.story)).toMatchObject({ bond, residency, moved: true })
    expect(visitOf(moved)?.scene).toBe(room.visit)
    const morning = night(moved)
    expect(morning.campaignDay.pending).toEqual({ kind: 'pair-morning', pair: pair.id, scene: room.morning })
    const done = finishCampaignNightScene(morning.campaignDay, morning.campaignDay.day, morning.campaignDay.pending!)
    expect(done).toEqual({ day: moved.campaignDay.day + 1, pending: null })
    expect(morning.story.files[pair.testimony]).toEqual([0])
    expect(morning.story.flags).not.toContain(pair.residency[residency === 'shared' ? 'separate' : 'shared'])
  })

  it('keeps a solo visit when migrating a v13 save', () => {
    const { pairScene: _pair, ...previous } = captured()
    const pending = { kind: 'visit', companion: first, scene: 'solo', morning: null }
    const migrated = parseSave({ ...previous, version: 13, campaignDay: { day: 4, pending } })
    expect(migrated.campaignDay).toEqual({ day: 4, pending })
    expect(migrated.pairScene).toBeNull()
    expect(migrated.account.updatedAt).toBe(now)
  })
})
