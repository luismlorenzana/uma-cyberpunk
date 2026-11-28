import { expect, it } from 'vitest'
import { COMMAND_ORDERS } from '../ship/command'
import { parseCampaignBook, parseCampaignRelease } from './campaign'
import { STAND_IN_FILES } from './stand-in'

it('loads art, Captain arcs, quests and encounters for five combined intakes', () => {
  const companions = Array.from({ length: 50 }, (_, index) => 9000100 + index)
  const dateScenes = companions.length * 3
  const groundCount = 63
  const commandCount = 56
  const scenes = Array.from({ length: 1120 }, (_, index) => {
    const companion = companions[Math.floor(index / 3)]
    const slot = (index - dateScenes) / 4
    const encounter = Number.isInteger(slot) && slot >= 0 && slot < groundCount + commandCount ? `fight-${index}` : undefined
    const command = encounter !== undefined && slot >= groundCount
    return {
      id: `watch-${index}`, place: 'sw1-docks', trigger: { talk: 'sw1-docks' },
      cast: companion === undefined ? [] : [{ outfit: companion }],
      steps: encounter ? [{ battle: encounter }] : companion !== undefined && index % 3 === 1
        ? [{ path: { trust: [{ narrate: 'They make a plan.' }], heart: [{ narrate: 'They share a quiet moment.' }] } }]
        : [{ narrate: 'The watch begins.' }],
      encounter, command,
    }
  })
  const chapters = Object.fromEntries(Array.from({ length: scenes.length / 40 }, (_, index) => {
    const id = `watch-chapter-${index}`
    const section = scenes.slice(index * 40, (index + 1) * 40)
    return [`chapters/${id}.json`, { schemaVersion: 1, id, world: 'sw1', leads: [9000001],
      number: index + 2, danger: 1, scenes: section.map(({ encounter, command, ...scene }) => scene),
      missions: section.flatMap(({ encounter, command, place }) => encounter ? [
        { id: encounter, place, objective: { kind: command ? 'escort' : 'free-leader' }, enemies: [], brief: 'Help the dock crew.',
          ...(command ? {} : { scenario: 'sandbox-muster' }) },
      ] : []) }]
  }))
  const stock = { fuel: 4, provisions: 4, alloy: 4 }
  const book = parseCampaignBook({
    ...STAND_IN_FILES, ...chapters,
    'casting.json': { ...(STAND_IN_FILES['casting.json'] as object), crewOrder: [9000001, 9000002, 9000003, 9000004, ...companions] },
    'campaign.json': {
      schemaVersion: 1, draft: true, opening: 'opening',
      quests: [{ id: 'opening', title: 'Opening', scene: 'sw1-ch1-s1' },
        ...scenes.slice(dateScenes, dateScenes + 725).map(({ id, encounter, command }) => ({
          id, title: 'Watch duty', scene: id, after: 'opening', ...(encounter ? { encounter } : {}), ...(command ? { port: 'sw1' } : {}),
        }))],
      supply: { after: 'opening', start: 'sw1', routes: [], ports: [{ id: 'sw1', name: 'Docks', scene: 'sw1-ch1-s1',
        stock, upkeep: stock, reserve: stock, produces: stock }] },
      evening: { after: 'opening', visits: [] },
      assets: [{ id: 'dock', file: 'dock.png' }],
      art: scenes.map(({ id }) => ({ scene: id, backdrop: 'dock', portraits: [] })),
      ground: scenes.flatMap(({ encounter, command }) => encounter && !command ? [{ id: encounter, title: 'Dock patrol', win: {} }] : []),
      commands: scenes.flatMap(({ encounter, command }) => command ? [
        { id: encounter, cost: { fuel: 1, provisions: 1 }, transport: 6, enemy: 5,
          threats: [{ section: 'fore', power: 1, fighters: 0 }], calls: Object.fromEntries(COMMAND_ORDERS.map((order) => [order, 'Ready.'])) },
      ] : []),
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
  expect(book.art).toHaveLength(1120)
  expect(book.art.at(-1)).toMatchObject({ scene: 'watch-1119', backdrop: 'dock' })
  expect(book.dates?.map(({ companion }) => companion)).toEqual(companions)
  expect(book.quests).toHaveLength(726)
  expect(book.ground.size).toBe(groundCount)
  expect(book.commands.size).toBe(commandCount)
})

it('accepts the larger four-act Story manifest when its pages cover every pin', () => {
  const sha256 = '1'.repeat(64), pin = { sha256, path: 'campaign/files/pack.' + sha256 + '.json', bytes: 100 }
  const story = Array.from({ length: 2056 }, (_, i) => ({ ...pin, source: 'chapters/example-' + i + '.json' }))
  const files = [{ ...pin, source: 'campaign.json' }, ...story]
  const storyPages = Array.from({ length: Math.ceil(story.length / 40) }, (_, i) => ({
    ...pin, sources: story.slice(i * 40, i * 40 + 40).map(row => row.source),
  }))
  const base = { schemaVersion: 1, campaign: 'four-act', release: 'large-campaign', files, assets: [] }
  expect(parseCampaignRelease({ ...base, storyPages }).files).toHaveLength(2057)
  expect(() => parseCampaignRelease({ ...base, storyPages: storyPages.slice(1) })).toThrow(/complete story coverage/)
  expect(() => parseCampaignRelease(base)).toThrow(/2048/)
})

it('reads a full four-act expression library while retaining the image budget for other packs', () => {
  const imageCount = 9_000
  const assets = Array.from({ length: imageCount }, (_, i) => ({ id: `art-${i}`, file: `art-${i}.png` }))
  const config = { schemaVersion: 1, opening: 'opening', draft: true,
    quests: [{ id: 'opening', title: 'Opening', scene: 'sw1-ch1-s1' }], assets, art: [] }
  const book = { ...STAND_IN_FILES, 'campaign.json': config }
  expect(parseCampaignBook(book, 'four-act').assets).toHaveLength(imageCount)
  expect(() => parseCampaignBook(book, 'pilot')).toThrow(/4096/)

  const sha256 = '1'.repeat(64)
  const release = { schemaVersion: 1, release: 'expression-library', files: [
    { source: 'campaign.json', sha256, path: `campaign/files/pack.${sha256}.json`, bytes: 100 },
  ], assets: assets.map(({ id }) => ({ id, sha256, path: `campaign/files/pack.${sha256}.png`, bytes: 100 })) }
  expect(parseCampaignRelease({ ...release, campaign: 'four-act' }).assets).toHaveLength(imageCount)
  expect(() => parseCampaignRelease({ ...release, campaign: 'pilot' })).toThrow(/4096/)
})
