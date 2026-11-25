import { awayMembers, canTakeOrdinaryAssignment, resting, seeScene, type CampaignBook, type CampaignQuest, type Chapter, type EffectStep, type Mission, type Save } from '@cyber/domain'
import { applyStep, setSquad, startMission } from '../mission/director'
import { optionalCampaignTraining, personalMissionLead, questAvailable } from './quests'
import { campaignCallUp, missionAshore } from './call-up'
import { expeditionForQuest, expeditionSquad } from './expedition'
import { groundSquadCapacity } from './training'

function startedExpedition(opening: Save, expedition: Save['expedition']): Save {
  if (!expedition || !opening.mission) return opening
  return { ...opening, mission: { ...opening.mission, squad: expeditionSquad(expedition) } }
}

export function beginCampaignEncounter(save: Save, book: CampaignBook, quest: CampaignQuest, chapter: Chapter, mission: Mission,
  effects: readonly EffectStep[], port?: string): Save {
  if (save.mission || save.pairScene || save.campaignDay.pending || quest.encounter !== mission.id || !questAvailable(save, book, quest, port)) return save
  const next = effects.reduce((state, step) => applyStep(state, book.story, step), save)
  const opening = startMission({ ...next, story: seeScene(next.story, quest.scene) }, chapter, mission)
  const expedition = expeditionForQuest(book, quest.id, save.expedition?.duo)
  if (expedition) {
    return startedExpedition(opening, save.expedition)
  }
  const members = quest.callUp ? campaignCallUp(book, next, quest) : []
  const started = members.length ? { ...opening, mission: { ...opening.mission!, callUp: { members } } } : opening
  const ashore = missionAshore(book, started)
  const combat = book.ground.get(mission.id)?.combat
  if (combat?.kind === 'combined') {
    const roster = [...combat.members.filter(({ role }) => role === 'laser'), ...combat.members.filter(({ role }) => role !== 'laser')]
    return setSquad(started, roster.flatMap(({ outfit }) => outfit === undefined ? [] : [outfit]))
  }
  const away = awayMembers(save.operations, save.squads)
  const available = next.crew.filter((member) => canTakeOrdinaryAssignment(member) && !ashore.has(member.outfit) && !away.includes(member.outfit) && !resting(member)).map(({ outfit }) => outfit)
  const lead = personalMissionLead(book, quest)
  if (lead !== undefined) {
    // An authored lead can take her own mission while strained. A missing or away lead cannot be substituted.
    if (ashore.has(lead) || away.includes(lead) || !next.crew.some(member => member.outfit === lead)) return save
    const supports = available.filter(outfit => outfit !== lead && !next.crew.find(member => member.outfit === outfit)?.heroine)
    const alternate = book.ground.get(mission.id)?.alternate
    const scenario = alternate && next.story.flags.includes(alternate.flag) ? alternate.scenario : mission.scenario
    const capacity = book.commands.has(mission.id) ? 4 : groundSquadCapacity(scenario)
    return setSquad(started, [lead, ...supports].slice(0, capacity))
  }
  const training = optionalCampaignTraining(book, quest)
  const candidates = training ? available.slice(0, 1) : started.mission!.squad.filter((outfit) =>
    !ashore.has(outfit) && !next.crew.some(member => member.outfit === outfit && member.expeditionOnly) && ((!book.sectors && !quest.callUp && !book.fourAct) || available.includes(outfit) || !!book.fourAct && chapter.leads.includes(outfit)))
  const squad = candidates.length || (!book.sectors && !quest.callUp) ? candidates : available.slice(0, 4)
  if ((quest.callUp || book.fourAct) && mission.scenario) {
    const alternative = book.ground.get(mission.id)?.alternate
    const scenario = alternative && next.story.flags.includes(alternative.flag) ? alternative.scenario : mission.scenario
    return squad.length ? setSquad(started, squad.slice(0, groundSquadCapacity(scenario))) : save
  }
  return !squad.length && !book.commands.has(mission.id) ? save : setSquad(started, squad)
}
