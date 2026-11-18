import { newMember, newSave, parseCampaignBook, parseSave, STAND_IN_FILES } from '@cyber/domain'
import { expect, it } from 'vitest'
import { finishCampaignDialogue, questAvailable, recruitOnBoard, recruitProgress } from './quests'

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
