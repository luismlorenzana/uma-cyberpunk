import {
  campaignHomeSupport, finishCampaignNightScene, homeOutcome, newMember, newSave, pairProgress, pairVisit, parseSave, resumeCommand,
  setFlag, startCampaignNight, startSupply, storesAt,
  type CampaignBook, type CampaignPair, type CommandEncounter, type EffectStep, type Save, type SupplyNetwork,
} from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { closePairScene, homeQuestReady, nextHomeScene, openPairScene, pairAvailable, recordPairScene } from './pair'
import { assignOfficer, issueCommand, launchCommand, settleCommand } from './command'
import { settleCampaignDay } from './watch'
import { retry } from '../mission/director'

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
    const { pairScene: _pair, campaignGear: _gear, ...previous } = captured()
    const pending = { kind: 'visit', companion: first, scene: 'solo', morning: null }
    const migrated = parseSave({ ...previous, version: 13, campaignDay: { day: 4, pending } })
    expect(migrated.campaignDay).toEqual({ day: 4, pending })
    expect(migrated.pairScene).toBeNull()
    expect(migrated.account.updatedAt).toBe(now)
  })
})

describe('return to a liberated port', () => {
  const encounter: CommandEncounter = { id: 'defend-port', cost: { fuel: 1, provisions: 2 }, transport: 7, enemy: 5,
    threats: [{ section: 'fore', power: 6, fighters: 2 }],
    calls: { fire: 'Fire', evade: 'Evade', intercept: 'Intercept', strike: 'Strike', brace: 'Brace', reroute: 'Reroute' } }
  const home = { port: 'relay', base: 'base', defense: 'defense', scene: 'home-choice', visit: 'home-visit',
    resettle: { flag: 'settled', debrief: 'local-debrief' }, stay: { flag: 'stayed', debrief: 'ship-debrief' },
    jobs: ['Engineer', 'Operator'] as [string, string], support: { alloy: 1, provisions: 1, relay: 3 } }
  const localPair: CampaignPair = { ...pair, home }
  const port = { id: home.port, name: 'Relay', scene: 'landing', liberation: { flag: 'port-freed', alloy: 2 },
    stock: { fuel: 10, provisions: 10, alloy: 10 }, produces: { fuel: 1, provisions: 1, alloy: 2 },
    upkeep: { fuel: 1, provisions: 1, alloy: 1 }, reserve: { fuel: 0, provisions: 0, alloy: 0 } }
  const supply: SupplyNetwork = { after: 'liberation', start: home.port, ports: [port], routes: [] }
  const homeBook: CampaignBook = { ...book, pairs: [localPair], supply, commands: new Map([[encounter.id, encounter]]), quests: [
    ...book.quests, { id: home.base, title: 'Base', scene: 'base-tour', port: home.port, after: pair.after },
    { id: home.defense, title: 'Defense', scene: 'defense-call', port: home.port, after: home.base, encounter: encounter.id },
  ] }
  const ready = (): Save => {
    const released = finishDayScene(recovered(), pair.release, [{ kind: 'join', outfit: second }])
    const withBond = finishDayScene(released, pair.bond.scene, [flag(pair.bond.friendship)])
    const chosen = finishDayScene(withBond, pair.residency.scene, [flag(pair.residency.separate)])
    const moved = finishDayScene(chosen, pair.rooms.separate.move)
    const officer = { outfit: second, drills: 1, trainedDay: null }
    const post = { module: 'log' as const, index: 0 }
    const crew = moved.crew.map((member) => member.outfit === second ? { ...member, post: { ...post, since: 0, mastery: 0 } } : member)
    return { ...moved, crew, story: { ...setFlag(moved.story, port.liberation.flag), seen: [...moved.story.seen, 'base-tour', pair.rooms.separate.morning] },
      campaignSupply: startSupply(supply), commandCrew: { gunnery: officer }, dutyPresets: [{ name: 'Watch', posts: { [second]: post } }] }
  }

  it('requires a completed morning, an open base and local crew before opening the decision', () => {
    const save = ready()
    expect(nextHomeScene(save, homeBook, localPair)).toBe(home.scene)
    expect(homeQuestReady(save, homeBook, home.defense)).toBe(false)
    for (const scene of ['base-tour', pair.rooms.separate.morning]) {
      const incomplete = { ...save, story: { ...save.story, seen: save.story.seen.filter((seen) => seen !== scene) } }
      expect(openPairScene(incomplete, homeBook, localPair, home.scene)).toBe(incomplete)
    }
    const away = { ...save, campaignSupply: { ...save.campaignSupply!, port: 'elsewhere' } }
    expect(openPairScene(away, homeBook, localPair, home.scene)).toBe(away)
  })

  it.each(['resettle', 'stay'] as const)('keeps a %s outcome across restore, upkeep and defense', (path) => {
    const save = ready()
    const before = reload(openPairScene(save, homeBook, localPair, home.scene))
    expect(before.pairScene).toEqual({ pair: pair.id, scene: home.scene })
    const effects = [flag(home[path].flag)]
    let next = reload(closePairScene(before, homeBook, localPair, home.scene, effects))
    expect(homeOutcome(home, next.story)).toBe(path)
    expect(homeQuestReady(next, homeBook, home.defense)).toBe(true)
    expect(next.crew.map(({ outfit }) => outfit)).toEqual([first, second])
    expect(next.campaignSupply).toEqual(before.campaignSupply)
    expect(closePairScene(next, homeBook, localPair, home.scene, effects)).toBe(next)
    const local = path === 'resettle'
    const support = campaignHomeSupport(homeBook.pairs, next.story)
    expect([...support.ashore]).toEqual(local ? [first, second] : [])
    expect(next.commandCrew.gunnery?.outfit).toBe(local ? undefined : second)
    expect(next.crew[1]?.post).toEqual(local ? null : before.crew[1]?.post)
    expect(next.dutyPresets[0]?.posts).toEqual(local ? {} : before.dutyPresets[0]?.posts)
    const day = startCampaignNight(next.campaignDay, null)
    next = reload(settleCampaignDay(next, day, homeBook))
    expect(storesAt(next.campaignSupply!, port).alloy).toBe(local ? 14 : 13)
    expect(next.campaignSupply?.provisions).toBe(local ? 3 : 2)
    expect(settleCampaignDay(next, day, homeBook)).toEqual(next)
    expect(nextHomeScene(next, homeBook, localPair)).toBeNull()
    const deploy: Save = { ...next, mission: { id: encounter.id, chapter: 'relay', step: 'deploy', squad: local ? [] : [first, second], battle: null, won: null } }
    expect(assignOfficer(deploy, 'pilot', first, support.ashore) === deploy).toBe(local)
    const run = launchCommand(deploy, next.campaignSupply!, encounter, { ashore: support.ashore, relay: local ? home.support.relay : 0 })
    expect(resumeCommand(run.mission?.battle?.input, [])?.state.transport).toBe(local ? 10 : 7)
    expect(retry(run).campaignSupply).toEqual(run.campaignSupply)
    const won = issueCommand(reload(run), encounter.id, 0, { order: 'fire', shields: 0, guns: 3, fighters: 0 })
    const settled = settleCommand(won, encounter.id)
    expect(settleCommand(settled, encounter.id)).toBe(settled)
    expect(nextHomeScene(settled, homeBook, localPair)).toBe(home[path].debrief)
    const debrief = openPairScene(settled, homeBook, localPair, home[path].debrief)
    const finished = reload(closePairScene(debrief, homeBook, localPair, home[path].debrief, []))
    expect(nextHomeScene(finished, homeBook, localPair)).toBe(local ? home.visit : null)
    expect(finished.story.files[pair.testimony]).toEqual([0])
  })
})
