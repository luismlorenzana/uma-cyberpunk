import { expect, it } from 'vitest'
import { parseCampaignBook } from './campaign'
import { STAND_IN_FILES } from './stand-in'

it('loads the scene art and Captain arcs for three combined intakes', () => {
  const companions = Array.from({ length: 30 }, (_, index) => 9000100 + index)
  const scenes = Array.from({ length: 520 }, (_, index) => {
    const companion = companions[Math.floor(index / 3)]
    return {
      id: `watch-${index}`, place: 'sw1-docks', trigger: { talk: 'sw1-docks' },
      cast: companion === undefined ? [] : [{ outfit: companion }],
      steps: companion !== undefined && index % 3 === 1
        ? [{ path: { trust: [{ narrate: 'They make a plan.' }], heart: [{ narrate: 'They share a quiet moment.' }] } }]
        : [{ narrate: 'The watch begins.' }],
    }
  })
  const chapters = Object.fromEntries(Array.from({ length: 13 }, (_, index) => {
    const id = `watch-chapter-${index}`
    return [`chapters/${id}.json`, { schemaVersion: 1, id, world: 'sw1', leads: [9000001],
      number: index + 2, danger: 1, scenes: scenes.slice(index * 40, (index + 1) * 40) }]
  }))
  const book = parseCampaignBook({
    ...STAND_IN_FILES, ...chapters,
    'casting.json': { ...(STAND_IN_FILES['casting.json'] as object), crewOrder: [9000001, 9000002, 9000003, 9000004, ...companions] },
    'campaign.json': {
      schemaVersion: 1, draft: true, opening: 'opening',
      quests: [{ id: 'opening', title: 'Opening', scene: 'sw1-ch1-s1' }],
      evening: { after: 'opening', visits: [] },
      assets: [{ id: 'dock', file: 'dock.png' }],
      art: scenes.map(({ id }) => ({ scene: id, backdrop: 'dock', portraits: [] })),
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
  expect(book.art).toHaveLength(520)
  expect(book.art.at(-1)).toMatchObject({ scene: 'watch-519', backdrop: 'dock' })
  expect(book.dates?.map(({ companion }) => companion)).toEqual(companions)
})
