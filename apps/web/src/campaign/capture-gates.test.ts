import { campaignCaptures, newSave, parseSave, type CampaignBook, type CampaignQuest, type CampaignTier } from '@cyber/domain'
import { expect, it } from 'vitest'
import { questAvailable, questComplete, recruitOnBoard } from './quests'

const opening: CampaignQuest = { id: 'opening', title: 'Opening', scene: 'opening' }
const signal: CampaignQuest = { id: 'signal', title: 'The Signal', scene: 'signal', after: opening.id }
const core: CampaignQuest = { id: 'core', title: 'Core I', scene: 'core', after: signal.id }
const settlement: CampaignQuest = { id: 'core-clear', title: 'Core cleared', scene: 'core-clear', after: core.id }
const recruit = { outfit: 200001, signOn: 'sign-on', request: 'Request', story: [] }
const signOn: CampaignQuest = { id: recruit.signOn, title: 'Sign on', scene: 'sign-on', after: opening.id, port: 'dock' }
const captures = Array.from({ length: 10 }, (_, index) => ({ outfit: 100001 + index, encounter: 'rescue-' + index, flag: 'captured-' + index }))
const tier: CampaignTier = { number: 1, captures, signal: signal.id, core: { after: core.id, settles: settlement.id } }
const second: CampaignTier = { number: 2, captures: [{ outfit: recruit.outfit, encounter: 'other', flag: 'other-flag' }], signal: 'second-signal' }
const book = { quests: [opening, signal, core, settlement, signOn], tiers: [tier, second], recruits: [recruit], pairs: [] } as unknown as CampaignBook

function saveWithCaptures(count: number, seen: string[] = []) {
  const base = newSave('local', '2026-11-22T12:00:00Z')
  const flags = captures.map(({ flag }) => flag).concat('other-flag', captures[0]!.flag)
  const missions = captures.slice(0, count).map(({ encounter }) => encounter).concat('other', 'rescue-0')
  return parseSave(JSON.parse(JSON.stringify({ ...base, story: { ...base.story, flags, seen: [opening.scene, ...seen] },
    worlds: { ...base.worlds, missions } })))
}

it('counts only distinct settled Tier 1 captures and gates the signal at five', () => {
  expect(campaignCaptures(tier, saveWithCaptures(4))).toBe(4)
  expect(questAvailable(saveWithCaptures(4), book, signal)).toBe(false)
  expect(questComplete(saveWithCaptures(4, [signal.scene]), signal, book)).toBe(false)
  expect(questAvailable(saveWithCaptures(5), book, signal)).toBe(true)
  expect(questAvailable(saveWithCaptures(5, [signal.scene]), book, signal)).toBe(false)
  const save = saveWithCaptures(5)
  expect(campaignCaptures(tier, { ...save, story: { ...save.story, flags: [] } })).toBe(0)
})

it('gates Core I at ten and keeps next-tier sign-on gated until the Core settles', () => {
  expect(questAvailable(saveWithCaptures(9, [signal.scene]), book, core)).toBe(false)
  expect(questAvailable(saveWithCaptures(10), book, core)).toBe(false)
  expect(questAvailable(saveWithCaptures(10, [signal.scene]), book, core)).toBe(true)
  expect(recruitOnBoard(saveWithCaptures(10, [signal.scene, core.scene]), book, recruit)).toBe(false)
  expect(recruitOnBoard(saveWithCaptures(10, [signal.scene, core.scene, settlement.scene]), book, recruit)).toBe(true)
})
