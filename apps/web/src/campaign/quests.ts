import { briefingReady, type CampaignBook, type CampaignQuest, type Save } from '@cyber/domain'
import { homeQuestReady } from './pair'

export function questComplete(save: Save, quest: CampaignQuest): boolean {
  return save.story.seen.includes(quest.scene) && (!quest.encounter || save.worlds.missions.includes(quest.encounter))
}

export function questAvailable(save: Save, book: CampaignBook, quest: CampaignQuest, port?: string): boolean {
  if (questComplete(save, quest) || (quest.port && quest.port !== port) || !homeQuestReady(save, book, quest.id)) return false
  if (book.finale?.reveal === quest.id && !briefingReady(book, save.story)) return false
  if (!quest.after) return true
  const prior = book.quests.find(({ id }) => id === quest.after)
  return !!prior && questComplete(save, prior)
}
