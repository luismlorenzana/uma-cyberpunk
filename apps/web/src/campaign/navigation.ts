
import {
  nextCampaignStop, rehabilitationQuestIds, shipCapabilities,
  type CampaignBook, type CampaignQuest, type Save, type Speaker,
} from '@cyber/domain'
import { SCENARIOS } from '../mission/battleInput'
import { expeditionForQuest, expeditionQuestBlock } from './expedition'
import { generalPhase, personalMissionBlock, questAvailable } from './quests'

export const campaignActs = ['Act I', 'Act II', 'Act III', 'Act IV', 'Shared'] as const
export type CampaignAct = typeof campaignActs[number]
export type RosterKind = 'Uma' | 'General' | 'Lieutenant'

export interface RosterBrowse {
  kind: RosterKind
  search: string
  page: number
  selected?: Speaker
}

export const operationTypes = ['All', 'Ship', 'Ground', 'Story'] as const
export const operationStates = ['Ready', 'All', 'Completed', 'Locked'] as const
export interface OperationBrowse {
  type: typeof operationTypes[number]
  state: typeof operationStates[number]
  act: CampaignAct | 'All acts'
  search: string
  page: number
}

export interface RosterEntry {
  speaker: Speaker
  kind: RosterKind
  system?: string
  lead?: number
  quests: readonly string[]
}

export function indexCampaignNavigation(book: CampaignBook) {
  const quests = new Map(book.quests.map(quest => [quest.id, quest]))
  const byEncounter = new Map(book.quests.flatMap(quest => quest.encounter ? [[quest.encounter, quest] as const] : []))
  const acts = new Map<string, CampaignAct>()
  const roster: RosterEntry[] = []
  const tag = (id: string | undefined, act: CampaignAct) => {
    if (id && !acts.has(id)) acts.set(id, act)
  }
  const parents = (quest: CampaignQuest) => [quest.after, ...quest.requires ?? [], ...quest.requiresAny ?? []]
  function tagChain(id: string | undefined, act: CampaignAct) {
    const quest = id && quests.get(id)
    if (!quest || acts.has(quest.id) || quest.id === book.opening) return
    acts.set(quest.id, act)
    for (const parent of parents(quest)) tagChain(parent, act)
  }
  const catalog = book.fourAct
  for (const recruit of book.recruits ?? []) {
    const arc = catalog?.arcs.get(recruit.outfit)
    roster.push({ speaker: recruit.outfit, kind: 'Uma', system: arc?.system, quests: [recruit.signOn, ...recruit.story, ...rehabilitationQuestIds(arc)] })
    for (const id of [recruit.signOn, ...recruit.story]) tag(id, 'Act I')
    if (arc) {
      const rehabilitation = rehabilitationQuestIds(arc)
      roster.push({ speaker: arc.general, kind: 'General', system: arc.system, lead: recruit.outfit,
        quests: [...[arc.capture?.operation, arc.capture?.custody].filter((id): id is string => !!id), ...rehabilitation] })
      for (const id of rehabilitation) tag(id, 'Act II')
    }
  }
  for (const duo of catalog?.duos.values() ?? []) {
    for (const entry of duo.returns) {
      const lead = duo.umas.find(outfit => catalog?.arcs.get(outfit)?.lieutenants.includes(entry.heroine))
      roster.push({ speaker: entry.heroine, kind: 'Lieutenant', system: duo.system, lead,
        quests: entry.operation ? [entry.operation, entry.quest] : [entry.quest] })
      tagChain(entry.quest, 'Act II')
      tagChain(entry.operation, 'Act II')
    }
    tagChain(duo.local?.base, 'Act II')
    tagChain(duo.local?.evidence, 'Act II')
  }
  for (const system of catalog?.systems.values() ?? []) {
    tagChain(system.capital?.settlement, 'Act II')
    tagChain(system.capital?.operation, 'Act II')
  }
  for (const id of catalog?.transit?.quests ?? []) tag(id, 'Act III')
  for (const duo of catalog?.duos.values() ?? []) {
    const route = duo.expedition?.route
    if (route) for (const id of [route.launch, ...route.stops, route.return]) tagChain(id, 'Act III')
  }
  const finale = book.fourActFinale
  if (finale) {
    for (const id of [finale.start, finale.witnessesAt, finale.speakerAt, ...finale.harbor.crossings]) tagChain(id, 'Act IV')
    for (const encounter of [...finale.ground, finale.hushApproach]) tagChain(byEncounter.get(encounter)?.id, 'Act IV')
    for (const [id, repair] of finale.recoveries) {
      tagChain(id, 'Act IV')
      tagChain(repair.preparation, 'Act IV')
    }
    const homecoming = book.quests.find(quest => book.scenes.get(quest.scene)?.steps
      .some(step => step.kind === 'flag' && step.flag === finale.returnToPlay))
    tagChain(homecoming?.id, 'Act IV')
  }
  const missions = new Map(Object.values(book.story.chapters).flatMap(chapter =>
    chapter.missions.map(mission => [mission.id, { mission, chapter }] as const)))
  return { quests, acts, roster, missions }
}

export type CampaignNavigation = ReturnType<typeof indexCampaignNavigation>

export function operationObjective(book: CampaignBook, save: Save, quest: CampaignQuest, navigation: CampaignNavigation) {
  const id = quest.encounter
  if (!id || book.commands.has(id)) return undefined
  const ground = book.ground.get(id)
  if (ground?.rescue) return 'Break the Collar and recover the leader'
  const alternate = ground?.alternate
  const scenario = alternate && save.story.flags.includes(alternate.flag) ? alternate.scenario : navigation.missions.get(id)?.mission.scenario
  const objective = scenario ? SCENARIOS[scenario]?.input.objective : undefined
  switch (objective?.kind) {
    case 'hack': return objective.last ? 'Secure the channels before the final terminal' : 'Secure ' + objective.count + (objective.count === 1 ? ' terminal' : ' terminals')
    case 'hold': return 'Hold for ' + objective.rounds + ' rounds'
    case 'escort': return 'Escort the protected unit'
    case 'reach': return 'Reach the objective zone'
    case 'freeLeader': return 'Free the leader'
    case 'defeatLeader': return 'Subdue the commander'
    case 'defeatAll': return 'Clear the opposition'
    default: return ground?.title
  }
}

export function rosterStatus(entry: RosterEntry, save: Save, book: CampaignBook, complete: ReadonlySet<string>) {
  if (entry.kind === 'Uma') return save.crew.some(member => member.outfit === entry.speaker) ? 'Recruited' : 'Recruitment'
  if (entry.kind === 'General') return generalPhase(save, book, entry.lead!) ?? 'Rival General'
  return entry.quests.every(id => complete.has(id)) ? 'Returned' : 'Return pending'
}

export function describeCampaignQuest(quest: CampaignQuest, book: CampaignBook, save: Save, port: string | undefined,
  complete: ReadonlySet<string>, navigation: CampaignNavigation) {
  const destination = book.supply?.ports.find(entry => entry.id === quest.port)
  const done = complete.has(quest.id)
  const ready = !done && questAvailable(save, book, quest, port)
  const clear = !save.mission && !save.campaignDay.pending && !save.pairScene
  const travels = clear && !done && !ready && !!destination && !!port && port !== destination.id && !save.expedition
    && questAvailable(save, book, quest, destination.id)
  const via = travels && book.supply ? nextCampaignStop(book.supply, port!, destination.id, shipCapabilities(save.ship), save.story.flags) : null
  const nextPort = book.supply?.ports.find(entry => entry.id === via)
  const byTitle = (id: string) => navigation.quests.get(id)?.title
  let reason: string | undefined
  if (!done && !ready && !travels) {
    const required = [quest.after, ...quest.requires ?? []].find(id => id && !complete.has(id))
    const branch = quest.requiresAny?.some(id => complete.has(id)) ? [] : quest.requiresAny?.flatMap(id => byTitle(id) ?? [])
    const duo = expeditionForQuest(book, quest.id, save.expedition?.duo)
    reason = required ? 'Finish ' + (byTitle(required) ?? 'the prior chapter') : branch?.length ? 'Finish ' + branch.join(' or ')
      : expeditionQuestBlock(save, book, quest.id, duo, row => complete.has(row.id))
        ?? personalMissionBlock(save, book, quest) ?? 'Awaiting campaign progress'
  }
  return { done, ready: ready && clear, destination, travels, nextPort, reason }
}
