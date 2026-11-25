import { describe, expect, it } from 'vitest'
import { expeditionReadiness, parseExpeditionFormation, parseFourActCampaign, type FourActCampaign } from './four-act'
import { parseCampaignBook, type CampaignQuest } from './campaign'
import { P } from './parse'
import { STAND_IN_FILES } from './stand-in'

const opening: CampaignQuest = { id: 'opening', title: 'Opening', scene: 'sw1-ch1-s1' }
const base = parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': {
  schemaVersion: 1, draft: true, opening: opening.id, quests: [opening], assets: [], art: [],
} })
const actors = Array.from({ length: 8 }, (_, index) => ({ board: 'actor-' + index, faction: 'dock-union', hold: 'collar' as const }))

function fixture() {
  const leads = [9000001, 9000002]
  const step = (id: string, after: string): CampaignQuest => ({ id, after, title: 'Quest', scene: opening.scene })
  const book = { ...base, story: { ...base.story, casting: { ...base.story.casting, heroines: actors } },
    quests: [opening, step('recruit-a', 'opening'), step('personal-a', 'recruit-a'),
      step('recruit-b', 'opening'), step('personal-b', 'recruit-b')],
    recruits: leads.map((outfit, index) => {
      const key = index ? 'b' : 'a'
      return { outfit, request: 'Sign on', signOn: 'recruit-' + key, story: ['personal-' + key] }
    }),
  }
  const catalog = { schemaVersion: 1, systems: [{ id: 'system-a' }, { id: 'system-b' }],
    arcs: leads.map((outfit, index) => ({
      outfit, system: 'system-a',
      home: { world: 'sw1', place: base.story.worlds.sw1!.locations[index]!.id },
      general: actors[index * 4]!.board, lieutenants: actors.slice(index * 4 + 1, index * 4 + 4).map(a => a.board),
    })),
    duos: [{ id: 'duo-a', umas: leads, returns: [] }],
  }
  return { book, catalog, parse: () => parseFourActCampaign(new P('campaign.json'), catalog, book) }
}

describe('the four-act campaign graph', () => {
  it('maps the two lead-owned routes and their fixed duo', () => {
    const parsed = fixture().parse()
    expect([...parsed.personalQuestOwners]).toEqual([
      ['recruit-a', 9000001], ['personal-a', 9000001], ['recruit-b', 9000002], ['personal-b', 9000002],
    ])
    expect(parsed.duos.get('duo-a')).toMatchObject({ umas: [9000001, 9000002], system: 'system-a' })
  })

  it('rejects a cross-system pairing and a reused lieutenant', () => {
    const cross = fixture()
    cross.catalog.arcs[1]!.system = 'system-b'
    expect(cross.parse).toThrow(/same system/)
    const reused = fixture()
    reused.catalog.arcs[1]!.lieutenants[0] = reused.catalog.arcs[0]!.lieutenants[0]!
    expect(reused.parse).toThrow(/distinct heroine/)
  })

  it('rejects a delayed sign-on and a dependency on someone else’s progress', () => {
    const delayed = fixture()
    delayed.book.quests[3]!.after = 'personal-a'
    expect(delayed.parse).toThrow(/directly after the shared premise/)
    const blocked = fixture()
    blocked.book.quests[4]!.requires = ['personal-a']
    expect(blocked.parse).toThrow(/reachable by their own recruit/)
  })

  it('compiles a fixed formation with only the duo’s own two generals and six lieutenant roles', () => {
    const campaign = fixture().parse()
    const pair = campaign.duos.get('duo-a')!
    const [a, b] = pair.umas.map(outfit => campaign.arcs.get(outfit)!)
    const returns = [...a!.lieutenants, ...b!.lieutenants].map(heroine => ({ heroine, quest: 'return-' + heroine }))
    const roles = ['melee-shield', 'ranged-medic', 'long-range']
    const lieutenants = returns.map(({ heroine }, index) => ({ heroine, role: roles[index % 3] }))
    const compile = () => parseExpeditionFormation(new P('campaign.json'), { ship: 'expedition-ship', lieutenants }, 'duo.expedition', [a!, b!], returns)
    expect(compile()).toEqual({ ship: 'expedition-ship', members: [
      { role: 'uma', outfit: a!.outfit }, { role: 'uma', outfit: b!.outfit },
      { role: 'boss-ally', heroine: a!.general }, { role: 'boss-ally', heroine: b!.general }, ...lieutenants,
    ] })
    lieutenants[0]!.role = 'ranged-medic'
    expect(compile).toThrow(/two lieutenants per expedition role/)
    lieutenants[0]!.heroine = b!.general
    expect(compile).toThrow(/unique lieutenant from this duo/)
  })

  it('requires five capital victories and settlements, and all six returns for the launching duo', () => {
    const campaign = fixture().parse()
    const pair = campaign.duos.get('duo-a')!
    const systems = new Map(Array.from({ length: 5 }, (_, index) => {
      const id = 'capital-' + index
      return [id, { id, capital: { operation: id + '-won', settlement: id + '-settled' } }]
    }))
    const returns = Array.from({ length: 6 }, (_, index) => ({ heroine: 'returning-' + index, quest: 'return-' + index }))
    const arcs = new Map([...campaign.arcs].map(([outfit, arc]) => [outfit, { ...arc,
      rehabilitation: { sessions: [], release: 'release', quarters: 'quarters', clearance: 'clear-' + outfit },
    }]))
    const graph: FourActCampaign = { ...campaign, systems, arcs, duos: new Map([
      ['duo-a', { ...pair, returns }], ['duo-b', { ...pair, id: 'duo-b', returns: [] }],
    ]) }
    const complete = new Set([...systems.values()].flatMap(({ capital }) => [capital.operation, capital.settlement]))
    for (const entry of returns.slice(0, 5)) complete.add(entry.quest)
    expect(expeditionReadiness(graph, 'duo-a', complete)).toEqual({ capitals: 5, returned: 5, cleared: 0, ready: false })
    complete.add(returns[5]!.quest)
    complete.delete('capital-4-won')
    expect(expeditionReadiness(graph, 'duo-a', complete)).toEqual({ capitals: 4, returned: 6, cleared: 0, ready: false })
    complete.add('capital-4-won')
    complete.add('clear-' + pair.umas[0])
    expect(expeditionReadiness(graph, 'duo-a', complete)).toEqual({ capitals: 5, returned: 6, cleared: 1, ready: false })
    complete.add('clear-' + pair.umas[1])
    expect(expeditionReadiness(graph, 'duo-a', complete)?.ready).toBe(true)
    expect(expeditionReadiness(graph, 'duo-b', complete)?.ready).toBe(false)
  })
})
