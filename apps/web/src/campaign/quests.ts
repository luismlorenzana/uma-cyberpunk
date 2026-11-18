import { briefingReady, seeScene, type CampaignBook, type CampaignQuest, type CampaignRecruit, type EffectStep, type Save } from '@cyber/domain'
import { applyStep } from '../mission/director'
import { homeQuestReady } from './pair'

export function questComplete(save: Save, quest: CampaignQuest, book?: CampaignBook): boolean {
  const recruit = book?.recruits?.find(({ signOn }) => signOn === quest.id)
  if (recruit) return save.crew.some(({ outfit }) => outfit === recruit.outfit)
  return save.story.seen.includes(quest.scene) && (!quest.encounter || save.worlds.missions.includes(quest.encounter))
}

export function questAvailable(save: Save, book: CampaignBook, quest: CampaignQuest, port?: string): boolean {
  if (questComplete(save, quest, book) || (quest.port && quest.port !== port) || !homeQuestReady(save, book, quest.id)) return false
  if (book.finale?.reveal === quest.id && !briefingReady(book, save.story)) return false
  if (!quest.after) return true
  const prior = book.quests.find(({ id }) => id === quest.after)
  return !!prior && questComplete(save, prior, book)
}

export function finishCampaignDialogue(save: Save, book: CampaignBook, quest: CampaignQuest, effects: readonly EffectStep[], port?: string): Save {
  if (quest.encounter || !questAvailable(save, book, quest, port)) return save
  const next = effects.reduce((state, step) => applyStep(state, book.story, step), save)
  return { ...next, story: seeScene(next.story, quest.scene) }
}

export function recruitProgress(save: Save, book: CampaignBook, recruit: CampaignRecruit) {
  const joined = save.crew.some(({ outfit }) => outfit === recruit.outfit)
  const ids = joined ? recruit.story : [recruit.signOn]
  const next = ids.map((id) => book.quests.find((quest) => quest.id === id))
    .find((quest) => quest && !questComplete(save, quest, book))
  const first = book.quests.find(({ id }) => id === recruit.story[0])
  const started = !!first && save.story.seen.includes(first.scene)
  return { joined, next, started }
}
