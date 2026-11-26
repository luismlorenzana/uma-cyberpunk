import { newMember, newSave, parseCampaignBook, parseSave, startSupply, STAND_IN_FILES } from '@cyber/domain'
import { expect, it } from 'vitest'
import { finishCampaignDialogue, questAvailable, questScene, recruitOnBoard, recruitProgress } from './quests'
import { homestretchCabins, homeQuestTravel, travelForHomeQuest } from './homestretch'

const stock = { fuel: 3, provisions: 2, alloy: 1 }
const chapterFile = 'chapters/sw1-ch1.json'
const chapter = STAND_IN_FILES[chapterFile] as { scenes: unknown[] }
const scenes = [
  { id: 'last-watch', cast: [], steps: [{ narrate: 'The next watch is ready.' }] },
  { id: 'next-sign-on', cast: [{ outfit: 9000004 }], steps: [{ join: 9000004 }] },
  { id: 'next-story', cast: [], steps: [{ narrate: 'The first run starts.' }] },
].map((scene) => ({ ...scene, place: 'sw1-docks', trigger: { talk: 'sw1-docks' } }))
const opening = { id: 'first-watch', title: 'Opening', scene: 'sw1-ch1-s1' }
const ending = { id: 'last-watch', title: 'Last Watch', scene: 'last-watch', after: opening.id }
const signOn = { id: 'next-sign-on', title: 'Sign on', scene: 'next-sign-on', after: ending.id, port: 'sw1' }
const firstStory = { id: 'next-story', title: 'First run', scene: 'next-story', after: signOn.id, port: 'sw1' }
const recruit = { outfit: 9000004, request: 'Join the next watch.', signOn: signOn.id, story: [firstStory.id] }

it('reveals a later recruit on Last Watch completion without restarting the campaign', () => {
  const book = parseCampaignBook({ ...STAND_IN_FILES, [chapterFile]: { ...chapter,
    scenes: [...chapter.scenes.slice(0, -1), ...scenes, chapter.scenes.at(-1)] },
    'campaign.json': { schemaVersion: 1, draft: true, opening: opening.id, quests: [opening, ending, signOn, firstStory],
      recruits: [recruit], assets: [], art: [],
      supply: { after: opening.id, start: 'sw1', routes: [], ports: [{ id: 'sw1', name: 'Docks', scene: opening.scene,
        stock, upkeep: stock, reserve: stock, produces: stock }] } } })
  const initial = { ...newSave('test', '2026-11-18T00:00:00Z'), crew: [{ ...newMember(9000001), xp: 120 }] }
  const started = finishCampaignDialogue(initial, book, opening, [])
  expect(recruitOnBoard(started, book, recruit)).toBe(false)
  const continued = parseSave(JSON.parse(JSON.stringify(finishCampaignDialogue(started, book, ending, []))))
  expect(recruitOnBoard(continued, book, recruit)).toBe(true)
  expect(questAvailable(continued, book, signOn, 'sw2')).toBe(false)
  expect(questAvailable(continued, book, firstStory, 'sw1')).toBe(false)

  const next = finishCampaignDialogue(continued, book, signOn, [{ kind: 'join', outfit: recruit.outfit }], 'sw1')
  expect(next.crew[0]).toEqual(initial.crew[0])
  expect(recruitProgress(next, book, recruit)).toMatchObject({ joined: true, started: false, next: firstStory })
  expect(questAvailable(next, book, firstStory, 'sw1')).toBe(true)
  expect(finishCampaignDialogue(next, book, signOn, [], 'sw1')).toBe(next)
})

it('records the dialogue selected by a settled outcome and unlocks its following quest after reload', () => {
  const branch = { ...ending, sceneWhen: { flag: 'crew-used-alternate', scene: firstStory.scene } }
  const follow = { id: 'after-debrief', title: 'Sign on', scene: signOn.scene, after: branch.id }
  const book = parseCampaignBook({ ...STAND_IN_FILES, [chapterFile]: { ...chapter,
    scenes: [...chapter.scenes.slice(0, -1), ...scenes, chapter.scenes.at(-1)] },
    'campaign.json': { schemaVersion: 1, draft: true, opening: opening.id, quests: [opening, branch, follow], assets: [], art: [] } })
  const initial = finishCampaignDialogue(newSave('test', '2026-11-18T00:00:00Z'), book, opening, [])
  expect(questScene(initial, branch)).toBe(ending.scene)
  const alternate = { ...initial, story: { ...initial.story, flags: ['crew-used-alternate'] } }
  expect(questScene(alternate, branch)).toBe(firstStory.scene)
  const settled = parseSave(JSON.parse(JSON.stringify(finishCampaignDialogue(alternate, book, branch, []))))
  expect(settled.story.seen).toContain(firstStory.scene)
  expect(settled.story.seen).not.toContain(ending.scene)
  expect(questAvailable(settled, book, follow)).toBe(true)
})

it('opens one shared capital from either saved proof and rejects a cyclic alternative', () => {
  const first = { ...ending, after: opening.id }
  const second = { ...firstStory, after: opening.id, port: undefined }
  const capital = { ...signOn, port: undefined, after: opening.id, requiresAny: [first.id, second.id] }
  const bookWith = (alternatives: string[] = capital.requiresAny) => parseCampaignBook({
    ...STAND_IN_FILES, [chapterFile]: { ...chapter, scenes: [...chapter.scenes.slice(0, -1), ...scenes, chapter.scenes.at(-1)] },
    'campaign.json': { schemaVersion: 1, draft: true, opening: opening.id, assets: [], art: [],
      quests: [opening, first, second, { ...capital, requiresAny: alternatives }] },
  }, 'four-act')
  const book = bookWith()
  const initial = finishCampaignDialogue(newSave('test', '2026-11-18T00:00:00Z'), book, opening, [])
  expect(questAvailable(initial, book, capital)).toBe(false)
  for (const proof of [first, second]) {
    const restored = parseSave(JSON.parse(JSON.stringify(finishCampaignDialogue(initial, book, proof, []))))
    expect(questAvailable(restored, book, capital)).toBe(true)
  }
  expect(() => bookWith([first.id, capital.id])).toThrow(/cycle/)
  expect(() => bookWith([first.id, 'missing-proof'])).toThrow(/unknown quest missing-proof/)
})

it('uses real jump costs from Homestretch and assigns one cabin only when the invitation is accepted', () => {
  const remoteSignOn = { ...signOn, after: opening.id, port: 'sw3' }
  const remoteStory = { ...firstStory, port: 'sw3' }
  const sw3Place = 'sw3-relay'
  const sw3Arrival = { id: 'sw3-open', place: sw3Place, trigger: { arrive: sw3Place }, cast: [], steps: [{ narrate: 'The relief ship comes alongside.' }] }
  const home = parseCampaignBook({ ...STAND_IN_FILES,
    'chapters/sw3-arrival.json': { schemaVersion: 1, id: 'sw3-arrival', world: 'sw3', number: 2, danger: 1, leads: [9000001],
      scenes: [sw3Arrival, ...scenes.slice(1).map(scene => ({ ...scene, place: sw3Place, trigger: { talk: sw3Place } }))], missions: [] },
    'campaign.json': { schemaVersion: 1, draft: true, opening: opening.id, quests: [opening, remoteSignOn, remoteStory],
      recruits: [recruit], assets: [], art: [],
      supply: { after: opening.id, start: 'sw1',
        routes: [{ from: 'sw1', to: 'sw2', fuel: 2 }, { from: 'sw2', to: 'sw3', fuel: 3 }],
        ports: [['sw1', opening.scene], ['sw2', 'sw2-ch1-s1'], ['sw3', sw3Arrival.id]].map(([id, scene]) =>
          ({ id, name: id, scene, stock, upkeep: stock, reserve: stock, produces: stock })) } } })
  const fresh = newSave('test', '2026-11-26T00:00:00Z')
  expect(homeQuestTravel(fresh, home, remoteSignOn)).toBeNull()
  const ready = finishCampaignDialogue(fresh, home, opening, [])
  expect(homeQuestTravel(ready, home, remoteSignOn)).toMatchObject({ destination: 'sw3', fuel: 5, affordable: true })
  const short = { ...ready, campaignSupply: { ...startSupply(home.supply!), fuel: 4 } }
  expect(travelForHomeQuest(short, home, remoteSignOn)).toBe(short)

  const arrived = travelForHomeQuest(ready, home, remoteSignOn)
  expect(arrived.campaignSupply).toMatchObject({ port: 'sw3', fuel: 1 })
  expect(travelForHomeQuest(arrived, home, remoteSignOn)).toBe(arrived)
  expect(homestretchCabins(home, arrived)).toEqual([])
  expect(questAvailable(arrived, home, remoteStory, 'sw3')).toBe(false)
  const joined = finishCampaignDialogue(arrived, home, remoteSignOn, [{ kind: 'join', outfit: recruit.outfit }], 'sw3')
  const restored = parseSave(JSON.parse(JSON.stringify(joined)))
  expect(homestretchCabins(home, restored)).toEqual([{ outfit: recruit.outfit, berth: 1 }])
  expect(questAvailable(restored, home, remoteStory, 'sw3')).toBe(true)
  expect(finishCampaignDialogue(restored, home, remoteSignOn, [], 'sw3')).toBe(restored)
})
