import { briefingReady, campaignSupport, fleetMobilized, seeScene, type CampaignBook, type CampaignQuest, type CampaignRecruit, type EffectStep, type Save } from '@cyber/domain'
import { applyStep } from '../mission/director'
import { clearCampaignPosts, homeQuestReady } from './pair'
import { formationReady } from './specialist-input'

export function questComplete(save: Save, quest: CampaignQuest, book?: CampaignBook): boolean {
  const recruit = book?.recruits?.find(({ signOn }) => signOn === quest.id)
  if (recruit) return save.crew.some(({ outfit }) => outfit === recruit.outfit)
  return save.story.seen.includes(quest.scene) && (!quest.encounter || save.worlds.missions.includes(quest.encounter))
}

export function questAvailable(save: Save, book: CampaignBook, quest: CampaignQuest, port?: string): boolean {
  if (questComplete(save, quest, book) || (quest.port && quest.port !== port) || !homeQuestReady(save, book, quest.id)) return false
  if (book.finale?.reveal === quest.id && !briefingReady(book, save.story)) return false
  const operation = book.finale
  if (operation?.muster && (quest.id === operation.muster || quest.id === operation.approach)) {
    if (!briefingReady(book, save.story) || fleetMobilized(book, save.story).length !== book.sectors?.length) return false
    if (quest.id === operation.approach && !save.crew.some(({ outfit }) => !campaignSupport(book, save).ashore.has(outfit))) return false
  }
  if (optionalCampaignTraining(book, quest) && !save.crew.some(({ outfit }) => !campaignSupport(book, save).ashore.has(outfit))) return false
  if (quest.flags?.some((flag) => !save.story.flags.includes(flag))) return false
  const combat = quest.encounter ? book.ground.get(quest.encounter)?.combat : undefined
  if (combat?.kind === 'combined' && !formationReady(save, combat, shiftedCombat(save, book), campaignSupport(book, save).ashore)) return false
  if (quest.requires?.some((id) => {
    const required = book.quests.find((entry) => entry.id === id)
    return !required || !questComplete(save, required, book)
  })) return false
  if (!quest.after) return true
  const prior = book.quests.find(({ id }) => id === quest.after)
  return !!prior && questComplete(save, prior, book)
}

export const shiftedCombat = (save: Save, book: Pick<CampaignBook, 'combatShift'>): boolean =>
  !!book.combatShift && save.story.flags.includes(book.combatShift)

export function optionalCampaignTraining(book: CampaignBook, quest: CampaignQuest): boolean {
  return !!quest.encounter && !!book.recruits?.length && !book.recruits.some(({ story }) => story.includes(quest.id))
    && Object.values(book.story.chapters).some(({ missions }) => missions.some(({ id, scenario }) => id === quest.encounter && scenario === 'training'))
}

export function finishCampaignDialogue(save: Save, book: CampaignBook, quest: CampaignQuest, effects: readonly EffectStep[], port?: string): Save {
  if (save.mission || save.pairScene || save.campaignDay.pending || quest.encounter || !questAvailable(save, book, quest, port)) return save
  const next = effects.reduce((state, step) => applyStep(state, book.story, step), save)
  const marked = { ...next, story: seeScene(next.story, quest.scene) }
  const transfer = book.sectors?.find((sector) => sector.appointment === quest.id || sector.retirement === quest.id)
  const returning = book.finale?.muster && book.finale.ending === quest.id
  if (returning) return clearCampaignPosts(marked, campaignSupport(book, marked).ashore)
  return transfer ? clearCampaignPosts(marked, new Set([transfer.officer])) : marked
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

export function recruitOnBoard(save: Save, book: CampaignBook, recruit: CampaignRecruit): boolean {
  const signOn = book.quests.find(({ id }) => id === recruit.signOn)
  return !!signOn && (questComplete(save, signOn, book) || questAvailable(save, book, signOn, signOn.port))
}
