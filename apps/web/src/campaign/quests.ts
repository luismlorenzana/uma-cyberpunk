import { awayMembers, canTakeOrdinaryAssignment, briefingReady, campaignCaptures, campaignSupport, CORE_CAPTURES, fleetMobilized, newMember, rehabilitationQuestIds, seeScene, setFlag, SIGNAL_CAPTURES, type CampaignBook, type CampaignQuest, type CampaignRecruit, type EffectStep, type Save } from '@cyber/domain'
import { applyStep } from '../mission/director'
import { commitExpedition, expeditionForQuest, expeditionQuestBlock } from './expedition'
import { clearCampaignPosts, homeQuestReady } from './pair'
import { formationReady } from './specialist-input'

export function questScene(save: Save, quest: CampaignQuest): string {
  const variant = quest.sceneWhen
  return variant && save.story.flags.includes(variant.flag) ? variant.scene : quest.scene
}

function captureGate(save: Save, book: CampaignBook | undefined, quest: CampaignQuest): boolean {
  const tier = book?.tiers?.find(tier => tier.signal === quest.id || tier.core?.after === quest.id || tier.core?.settles === quest.id)
  return !tier || campaignCaptures(tier, save) >= (tier.signal === quest.id ? SIGNAL_CAPTURES : CORE_CAPTURES)
}

export function personalMissionLead(book: CampaignBook, quest: CampaignQuest): number | undefined {
  return quest.encounter ? book.fourAct?.personalQuestOwners.get(quest.id) : undefined
}

export function personalMissionBlock(save: Save, book: CampaignBook, quest: CampaignQuest): string | null {
  const lead = personalMissionLead(book, quest)
  const required = lead === undefined && book.fourAct && quest.encounter && !optionalCampaignTraining(book, quest)
    ? Object.values(book.story.chapters).find(chapter => chapter.scenes.some(scene => scene.id === quest.scene))?.leads ?? []
    : lead === undefined ? [] : [lead]
  if (!required.length) return null
  if (required.some(outfit => !save.crew.some(member => member.outfit === outfit && !member.expeditionOnly))) return 'Sign on the mission leads'
  if (required.some(outfit => awayMembers(save.operations, save.squads).includes(outfit))) return 'Recall the mission leads'
  if (required.some(outfit => campaignSupport(book, save).ashore.has(outfit))) return 'Bring the mission leads aboard'
  return null
}

export function questComplete(save: Save, quest: CampaignQuest, book?: CampaignBook): boolean {
  const recruit = book?.recruits?.find(({ signOn }) => signOn === quest.id)
  if (recruit) return save.crew.some(({ outfit }) => outfit === recruit.outfit)
  const seen = book?.fourAct
    ? save.story.seen.includes(quest.scene) || (!!quest.sceneWhen && save.story.seen.includes(quest.sceneWhen.scene))
    : save.story.seen.includes(questScene(save, quest))
  return seen && (!quest.encounter || save.worlds.missions.includes(quest.encounter))
    && captureGate(save, book, quest)
}

export function questAvailable(save: Save, book: CampaignBook, quest: CampaignQuest, port?: string): boolean {
  if (questComplete(save, quest, book) || (quest.port && quest.port !== port) || !homeQuestReady(save, book, quest.id)) return false
  const expedition = expeditionForQuest(book, quest.id, save.expedition?.duo)
  if (expeditionQuestBlock(save, book, quest.id, expedition, q => questComplete(save, q, book))) return false
  if (!captureGate(save, book, quest) || (!expedition && personalMissionBlock(save, book, quest))) return false
  const recruit = book.recruits?.find(({ signOn }) => signOn === quest.id)
  if (recruit && book.tiers) {
    const index = book.tiers.findIndex(tier => tier.captures.some(({ outfit }) => outfit === recruit.outfit))
    const prior = index > 0 ? book.quests.find(q => q.id === book.tiers![index - 1]?.core?.settles) : undefined
    if (index > 0 && (!prior || !questComplete(save, prior, book))) return false
  }
  if (book.finale?.reveal === quest.id && !briefingReady(book, save.story)) return false
  const operation = book.finale
  if (operation?.muster && (quest.id === operation.muster || quest.id === operation.approach)) {
    if (!briefingReady(book, save.story) || fleetMobilized(book, save.story).length !== book.sectors?.length) return false
    if (quest.id === operation.approach && !save.crew.some(({ outfit }) => !campaignSupport(book, save).ashore.has(outfit))) return false
  }
  if (optionalCampaignTraining(book, quest)) {
    const ashore = campaignSupport(book, save).ashore
    if (!save.crew.some(member => canTakeOrdinaryAssignment(member) && !ashore.has(member.outfit))) return false
  }
  if (quest.flags?.some((flag) => !save.story.flags.includes(flag))) return false
  const prerequisiteMet = (id: string) => {
    const required = book.quests.find(entry => entry.id === id)
    return !!required && questComplete(save, required, book)
  }
  if (quest.requires?.some(id => !prerequisiteMet(id)) || (quest.requiresAny && !quest.requiresAny.some(prerequisiteMet))) return false
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
  const recruit = book.fourAct && book.recruits?.find(row => row.signOn === quest.id)
  if (recruit) {
    const arrivals = effects.filter(step => step.kind === 'join' || step.kind === 'aboard')
    if (arrivals.length !== 1 || arrivals[0]?.kind !== 'join' || arrivals[0].outfit !== recruit.outfit) return save
  }
  const next = effects.reduce((state, step) => applyStep(state, book.story, step), save)
  const scene = questScene(save, quest)
  let story = seeScene(next.story, scene)
  for (const candidate of book.quests) {
    const variant = candidate.sceneWhen
    if (variant?.earlier?.[0] === scene && !save.story.seen.includes(variant.earlier[1])) story = setFlag(story, variant.flag)
  }
  let marked = commitExpedition({ ...next, story }, book, quest.id, expeditionForQuest(book, quest.id))
  const release = book.allies?.find(ally => ally.release.quest === quest.id)
  if (release) {
    if (!marked.story.flags.includes(release.release.flag) || !marked.crew.some(member => member.outfit === release.partner)) return save
    const existing = marked.crew.find(member => member.outfit === release.member || member.heroine === release.heroine)
    if (existing && (existing.outfit !== release.member || existing.heroine !== release.heroine)) return save
    if (!existing) marked = { ...marked, crew: [...marked.crew, {
      ...newMember(release.member), heroine: release.heroine, role: release.role, rig: release.rig,
      ...(book.fourAct ? { expeditionOnly: true } : {}),
    }] }
  }
  const home = book.allies?.find(ally => ally.home?.quest === quest.id && marked.story.flags.includes(ally.home.flag))
  if (home) marked = clearCampaignPosts(marked, new Set([home.member, home.partner]))
  const transfer = book.sectors?.find((sector) => sector.appointment === quest.id || sector.retirement === quest.id)
  const returning = book.finale?.muster && book.finale.ending === quest.id
  if (returning) return clearCampaignPosts(marked, campaignSupport(book, marked).ashore)
  return transfer ? clearCampaignPosts(marked, new Set([transfer.officer])) : marked
}

export function generalPhase(save: Save, book: CampaignBook, outfit: number) {
  const arc = book.fourAct?.arcs.get(outfit)
  const complete = (id: string | undefined) => {
    const quest = id && book.quests.find(quest => quest.id === id)
    return !!quest && questComplete(save, quest, book)
  }
  if (!complete(arc?.capture?.custody)) return null
  const rehabilitation = arc?.rehabilitation
  if (complete(rehabilitation?.clearance)) return 'Expedition clearance'
  if (complete(rehabilitation?.quarters)) return 'Shared quarters'
  if (complete(rehabilitation?.release)) return 'Boss Ally aboard'
  if (rehabilitation?.sessions.some(complete)) return 'Rehabilitation'
  return 'In custody'
}

export function recruitProgress(save: Save, book: CampaignBook, recruit: CampaignRecruit) {
  const joined = save.crew.some(({ outfit }) => outfit === recruit.outfit)
  const ids = joined ? [...recruit.story, ...rehabilitationQuestIds(book.fourAct?.arcs.get(recruit.outfit))] : [recruit.signOn]
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
