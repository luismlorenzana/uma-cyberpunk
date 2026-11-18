import { expect, it } from 'vitest'
import { parseCampaignBook } from './campaign'
import { STAND_IN_FILES } from './stand-in'

it('loads art, Captain arcs, quests and ground encounters for four combined intakes', () => {
  const companions = Array.from({ length: 40 }, (_, index) => 9000100 + index)
  const dateScenes = companions.length * 3
  const scenes = Array.from({ length: 680 }, (_, index) => {
    const companion = companions[Math.floor(index / 3)]
    const encounter = index >= dateScenes && index < dateScenes + 520 && index % 10 === 0 ? `fight-${index}` : undefined
    return {
      id: `watch-${index}`, place: 'sw1-docks', trigger: { talk: 'sw1-docks' },
      cast: companion === undefined ? [] : [{ outfit: companion }],
      steps: encounter ? [{ battle: encounter }] : companion !== undefined && index % 3 === 1
        ? [{ path: { trust: [{ narrate: 'They make a plan.' }], heart: [{ narrate: 'They share a quiet moment.' }] } }]
        : [{ narrate: 'The watch begins.' }],
      encounter,
    }
  })
  const chapters = Object.fromEntries(Array.from({ length: 17 }, (_, index) => {
    const id = `watch-chapter-${index}`
    const section = scenes.slice(index * 40, (index + 1) * 40)
    return [`chapters/${id}.json`, { schemaVersion: 1, id, world: 'sw1', leads: [9000001],
      number: index + 2, danger: 1, scenes: section.map(({ encounter, ...scene }) => scene),
      missions: section.flatMap(({ encounter, place }) => encounter
        ? [{ id: encounter, place, objective: { kind: 'free-leader' }, enemies: [], brief: 'Free the dock crew.', scenario: 'sandbox-muster' }] : []) }]
  }))
  const book = parseCampaignBook({
    ...STAND_IN_FILES, ...chapters,
    'casting.json': { ...(STAND_IN_FILES['casting.json'] as object), crewOrder: [9000001, 9000002, 9000003, 9000004, ...companions] },
    'campaign.json': {
      schemaVersion: 1, draft: true, opening: 'opening',
      quests: [{ id: 'opening', title: 'Opening', scene: 'sw1-ch1-s1' },
        ...scenes.slice(dateScenes).map(({ id, encounter }) => ({
          id, title: 'Watch duty', scene: id, after: 'opening', ...(encounter ? { encounter } : {}),
        }))],
      evening: { after: 'opening', visits: [] },
      assets: [{ id: 'dock', file: 'dock.png' }],
      art: scenes.map(({ id }) => ({ scene: id, backdrop: 'dock', portraits: [] })),
      ground: scenes.flatMap(({ encounter }) => encounter ? [{ id: encounter, title: 'Dock patrol', win: {} }] : []),
      dates: companions.map((companion, index) => ({
        companion, after: 'opening', awards: [],
        milestones: [
          { rank: 1, rapport: 10, title: 'First watch', scene: `watch-${index * 3}` },
          { rank: 8, rapport: 10, title: 'A choice', scene: `watch-${index * 3 + 1}` },
        ],
        regular: { title: 'Off watch', scene: `watch-${index * 3 + 2}` },
      })),
    },
  })
  expect(book.art).toHaveLength(680)
  expect(book.art.at(-1)).toMatchObject({ scene: 'watch-679', backdrop: 'dock' })
  expect(book.dates?.map(({ companion }) => companion)).toEqual(companions)
  expect(book.quests).toHaveLength(561)
  expect(book.ground.size).toBe(52)
})
