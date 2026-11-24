import { awayMembers, campaignSupport, resting, seeScene, type CampaignBook, type CampaignQuest, type Chapter, type EffectStep, type Mission, type Save } from '@cyber/domain'
import { applyStep, setSquad, startMission } from '../mission/director'
import { optionalCampaignTraining, questAvailable } from './quests'

export function beginCampaignEncounter(save: Save, book: CampaignBook, quest: CampaignQuest, chapter: Chapter, mission: Mission,
  effects: readonly EffectStep[], port?: string): Save {
  if (save.mission || save.pairScene || save.campaignDay.pending || quest.encounter !== mission.id || !questAvailable(save, book, quest, port)) return save
  const next = effects.reduce((state, step) => applyStep(state, book.story, step), save)
  const started = startMission({ ...next, story: seeScene(next.story, quest.scene) }, chapter, mission)
  const combat = book.ground.get(mission.id)?.combat
  if (combat?.kind === 'combined') {
    const roster = [...combat.members.filter(({ role }) => role === 'laser'), ...combat.members.filter(({ role }) => role !== 'laser')]
    return setSquad(started, roster.flatMap(({ outfit }) => outfit === undefined ? [] : [outfit]))
  }
  const { ashore } = campaignSupport(book, next)
  const away = awayMembers(save.operations, save.squads)
  const available = next.crew.filter((member) => !ashore.has(member.outfit) && !away.includes(member.outfit) && !resting(member)).map(({ outfit }) => outfit)
  const training = optionalCampaignTraining(book, quest)
  const candidates = training ? available.slice(0, 1) : started.mission!.squad.filter((outfit) => !ashore.has(outfit) && (!book.sectors || available.includes(outfit)))
  const squad = candidates.length || !book.sectors ? candidates : available.slice(0, 4)
  return !squad.length && !book.commands.has(mission.id) ? save : setSquad(started, squad)
}
