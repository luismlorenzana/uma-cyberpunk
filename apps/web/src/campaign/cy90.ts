
import { awayMembers, campaignSupport, crewSpeaker, expeditionReadiness, resting, seeScene, setFlag, type CampaignBook, type CampaignQuest,
  type EffectStep, type ExpeditionRun, type FinaleProgress, type Save, type Speaker } from '@cyber/domain'
import { applyStep, finishBattle, retry } from '../mission/director'
import { nameOf } from '../story/runner'
import { questComplete } from './quests'

function progress(save: Save): FinaleProgress {
  return save.finaleProgress ?? { releases: [] }
}

export function withdrawCampaignAttempt(save: Save, encounter: string): Save {
  if (save.mission?.id !== encounter || save.mission.step !== 'battle' || save.commandCinema.pending) return save
  return finishBattle({ ...save, finaleProgress: { ...progress(save), withdrawn: encounter } }, false)
}

export function retryCampaignAttempt(save: Save): Save {
  if (!save.mission?.battle || save.mission.step !== 'results' || save.mission.won) return save
  if (save.finaleProgress?.withdrawn !== save.mission.id) return retry(save)
  const { withdrawn: _withdrawn, ...state } = save.finaleProgress
  return retry({ ...save, finaleProgress: state })
}

export function finaleReadiness(save: Save, book: CampaignBook) {
  const finale = book.fourActFinale
  if (!finale) return
  const records = new Map(book.quests.map(q => [q.id, q]))
  const capitals = finale.capitals.filter(id => questComplete(save, records.get(id)!, book))
  const released = progress(save).releases
  const courts = finale.courts.map(court => ({
    ...court,
    witness: court.witnesses.filter(row => save.story.flags.includes(row.flag))
      .sort((a, b) => released.lastIndexOf(b.flag) - released.lastIndexOf(a.flag))[0],
  }))
  return { capitals: capitals.length, courts, ready: capitals.length === 5 && courts.every(court => court.witness) }
}

export function finaleFormations(save: Save, book: CampaignBook) {
  if (!book.fourAct) return []
  const complete = new Set(book.quests.filter(q => questComplete(save, q, book)).map(q => q.id))
  const away = new Set(awayMembers(save.operations, save.squads))
  const { ashore } = campaignSupport(book, save)
  return [...book.fourAct.duos.values()].filter(duo => {
    const ready = expeditionReadiness(book.fourAct!, duo.id, complete)
    return ready?.capitals === 5 && ready.returned === 6 && ready.cleared === 2 && duo.expedition?.members.every(member => {
      if (member.role !== 'uma' && member.role !== 'boss-ally') return true
      const actor = save.crew.find(crew => member.role === 'uma' ? crew.outfit === member.outfit : crew.heroine === member.heroine)
      return !!actor && !away.has(actor.outfit) && !ashore.has(actor.outfit) && !resting(actor)
    })
  })
}

export function selectFinaleFormation(save: Save, book: CampaignBook, duo: string): Save {
  if (save.mission || save.expedition || save.campaignDay.pending || progress(save).witnesses
    || !finaleFormations(save, book).some(row => row.id === duo)) return save
  const ready = !!finaleReadiness(save, book)?.ready
  return { ...save, finaleProgress: { ...progress(save), duo }, story: setFlag(save.story, 'fa-finale-transit-ready', ready) }
}

export function finaleRun(save: Save, book: CampaignBook): ExpeditionRun | undefined {
  const duo = progress(save).duo
  const formation = duo && book.fourAct?.duos.get(duo)?.expedition
  return duo && formation ? { duo, ship: formation.ship, members: formation.members, fuel: 0, provisions: 0 } : undefined
}

export function finaleQuestReady(save: Save, book: CampaignBook, quest: CampaignQuest): boolean {
  const finale = book.fourActFinale
  if (!finale) return true
  if (quest.id === finale.start) return !!finaleReadiness(save, book)?.ready
    && !!progress(save).duo && finaleFormations(save, book).some(duo => duo.id === progress(save).duo)
  if (quest.id === finale.speakerAt) return progress(save).speaker !== undefined
  if (finale.harbor.crossings.includes(quest.id) && save.story.flags.includes(finale.harbor.flag)) return false
  if ((quest.encounter && finale.ground.includes(quest.encounter)) || quest.encounter === finale.hushApproach) {
    const frozen = progress(save).witnesses
    const witnesses = finale.courts.flatMap(court => court.witnesses).filter(row => frozen?.includes(row.flag))
    return !!finaleRun(save, book) && witnesses.length === 5 && witnesses.every(row => save.story.seen.includes(row.scene))
  }
  const recovery = finale.recoveries.get(quest.id)
  if (recovery) return progress(save).repair?.quest === quest.id && progress(save).repair?.progress === 2 && !progress(save).repair?.paused
  const survey = [...finale.recoveries.values()].find(row => row.preparation === quest.id)
  if (!survey) return true
  return !save.story.flags.includes(survey.flag) && !save.expedition && finaleFormations(save, book).some(duo => duo.id === survey.duo)
}

export function recordFinaleOutcome(before: Save, after: Save, book: CampaignBook, quest: CampaignQuest): Save {
  const finale = book.fourActFinale
  if (!finale) return after
  const state = progress(before)
  const newRelease = finale.courts.flatMap(court => court.witnesses).find(row =>
    row.release === quest.id && after.story.flags.includes(row.flag) && !state.releases.includes(row.flag))
  if (newRelease) return { ...after, finaleProgress: { ...state, releases: [...state.releases, newRelease.flag] } }
  if (!before.story.flags.includes(finale.harbor.flag) && after.story.flags.includes(finale.harbor.flag) && after.campaignSupply) {
    return { ...after, campaignSupply: { ...after.campaignSupply, port: finale.harbor.port } }
  }
  if (state.repair?.quest === quest.id && finale.recoveries.has(quest.id)) {
    const { repair: _repair, ...rest } = state
    return { ...after, finaleProgress: rest }
  }
  if (quest.id !== finale.start || state.witnesses) return after
  const ready = finaleReadiness(before, book)
  if (!ready?.ready || !state.duo) return before
  const witnesses = ready.courts.map(court => court.witness!.flag)
  return { ...after, finaleProgress: { ...state, witnesses, releases: [...new Set([...state.releases, ...witnesses])] } }
}

export function finaleRepairOptions(save: Save, book: CampaignBook) {
  if (save.mission || save.expedition || save.campaignDay.pending || save.pairScene || !book.fourActFinale
    || !save.story.flags.includes(book.fourActFinale.returnToPlay)) return []
  const active = progress(save).repair
  return [...book.fourActFinale.recoveries].flatMap(([quest, row]) => {
    if (save.story.flags.includes(row.flag) || !save.story.seen.includes(row.preparation) || active && active.quest !== quest) return []
    const port = book.quests.find(q => q.id === quest)?.port
    if (!port || save.campaignSupply?.port !== port) return []
    const reports = book.fourActFinale!.reports.get(row.mission)!
    return [{ quest, mission: row.mission, active, reports, label: book.story.chapters[Object.keys(book.story.chapters)
      .find(id => book.story.chapters[id]?.missions.some(m => m.id === row.mission)) ?? '']?.missions.find(m => m.id === row.mission)?.brief ?? 'Restore civilian service.' }]
  })
}

export function workFinaleRepair(save: Save, book: CampaignBook, quest: string, action: 'work' | 'pause' | 'resume'): Save {
  const option = finaleRepairOptions(save, book).find(row => row.quest === quest)
  if (!option) return save
  const state = progress(save)
  const current = state.repair
  if (action !== 'work' && (!current || (action === 'resume') !== current.paused)) return save
  if (action === 'work' && (current?.paused || current?.progress === 2 || !save.campaignSupply?.provisions)) return save
  const repair = { quest, progress: (current?.progress ?? 0) + (action === 'work' ? 1 : 0), paused: action === 'pause' }
  return { ...save, finaleProgress: { ...state, repair }, ...(action === 'work' && save.campaignSupply
    ? { campaignSupply: { ...save.campaignSupply, provisions: save.campaignSupply.provisions - 1 } } : {}) }
}

function availableActor(save: Save, book: CampaignBook, actor: Speaker) {
  const member = save.crew.find(member => crewSpeaker(member) === actor)
  if (!member || awayMembers(save.operations, save.squads).includes(member.outfit)
    || campaignSupport(book, save).ashore.has(member.outfit)) return undefined
  const ally = book.allies?.find(row => row.member === member.outfit)
  const residence = ally && book.fourAct?.arcs.get(ally.partner)?.rehabilitation?.quarters
  if (residence && !book.quests.some(q => q.id === residence && questComplete(save, q, book))) return undefined
  return member
}

export function finaleVoices(save: Save, book: CampaignBook) {
  const finale = book.fourActFinale
  if (!finale || !progress(save).witnesses || progress(save).speaker !== undefined) return []
  const quest = book.quests.find(q => q.id === finale.speakerAt)
  if (!quest || ![quest.after, ...(quest.requires ?? [])].every(id => book.quests.some(q => q.id === id && questComplete(save, q, book)))) return []
  return [{ actor: 'captain' as Speaker, scene: finale.bridge }, ...[...finale.speakers].flatMap(([actor, scene]) => {
    const member = availableActor(save, book, actor)
    return member?.bond.path && member.bond.rank >= 5 ? [{ actor, scene }] : []
  })]
}

export function selectFinaleVoice(save: Save, book: CampaignBook, actor: Speaker): Save {
  if (save.mission || !finaleVoices(save, book).some(row => row.actor === actor)) return save
  return { ...save, finaleProgress: { ...progress(save), speaker: actor } }
}

function hasMaxRomance(save: Save, book: CampaignBook, actor: Speaker) {
  if (save.captain.romance === 'friends') return false
  if (typeof actor === 'number') {
    const bond = save.crew.find(member => member.outfit === actor)?.bond
    return bond?.path === 'heart' && bond.rank === 10
  }
  const visit = book.fourActFinale?.visits.find(visit => visit.kind === 'commitment' && visit.actors[0] === actor)
  return !!visit?.receipt && save.story.flags.includes(visit.receipt)
}

export function finaleActivities(save: Save, book: CampaignBook) {
  const finale = book.fourActFinale
  if (!finale || save.expedition || save.mission || save.pairScene || save.campaignDay.pending) return []
  const done = (scene: string) => save.story.seen.includes(scene)
  const afterLark = save.story.flags.includes(finale.returnToPlay)
  const port = save.campaignSupply?.port ?? book.supply?.start
  const name = (actor: Speaker) => nameOf(book.story, actor)
  const frozen = progress(save).witnesses
  const cut = book.quests.find(q => q.id === finale.witnessesAt)
  const witnesses = frozen && cut && questComplete(save, cut, book)
    ? finale.courts.flatMap(court => court.witnesses.filter(row => frozen.includes(row.flag) && !done(row.scene))
      .map(row => ({ scene: row.scene, title: 'Open the ' + court.name + ' channel' }))) : []
  const dispatches = finale.dispatches.filter(dispatch => !done(dispatch.scene)
    && dispatch.flags.every(flag => save.story.flags.includes(flag))
    && dispatch.unless.every(flag => !save.story.flags.includes(flag)))
  const result = finale.visits.flatMap(visit => {
    if (visit.port && visit.port !== port || !visit.flags.every(flag => save.story.flags.includes(flag))
      || !visit.actors.every(actor => availableActor(save, book, actor))
      || (visit.receipt ? save.story.flags.includes(visit.receipt) : done(visit.scene))) return []
    if (visit.kind !== 'commitment' && !afterLark) return []
    if ((visit.kind === 'reunion' || visit.kind === 'shared') && !visit.actors.every(actor => hasMaxRomance(save, book, actor))) return []
    if (visit.kind === 'commitment' && save.captain.romance === 'friends') return []
    const label = visit.kind === 'civic' ? 'Visit home with' : visit.kind === 'commitment' ? 'Talk about a future with'
      : visit.kind === 'shared' ? 'Arrange a shared visit with' : 'Reunite with'
    return [{ scene: visit.scene, title: label + ' ' + visit.actors.map(name).join(' and ') }]
  })
  for (const [actor, stages] of finale.visitBanks) {
    const member = availableActor(save, book, actor)
    if (!member) continue
    const commitment = finale.visits.find(visit => visit.kind === 'commitment' && visit.actors[0] === actor)
    const partner = commitment?.flags.every(flag => save.story.flags.includes(flag))
    const stage = hasMaxRomance(save, book, actor) ? 'household' : partner ? 'partner'
      : member.bond.path === 'trust' ? 'friend' : 'acquaintance'
    const pool = stages[stage]
    result.push({ scene: pool[(save.campaignDay.day - 1) % pool.length]!, title: 'Visit quarters · ' + name(actor) })
  }
  if (afterLark && !done(finale.credits)) result.push({ scene: finale.credits, title: 'Finish the homecoming' })
  if (afterLark && !save.story.flags.includes(finale.trueCredits.flag)
    && finale.visits.some(visit => visit.kind === 'reunion' && visit.receipt && save.story.flags.includes(visit.receipt))) {
    result.push({ scene: finale.trueCredits.scene, title: 'The last watch · True Ending' })
  }
  const byWatch = (save.log?.lines ?? []).flatMap(entry => {
    const member = save.crew.find(crew => crew.outfit === entry.outfit)
    if (!member || !availableActor(save, book, crewSpeaker(member))) return []
    const voice = finale.voices?.get(crewSpeaker(member))
    const scene = voice && !voice.expeditionOnly && voice.duty[entry.post]
    return scene && !done(scene) ? [{ scene, title: 'Watch report · ' + name(crewSpeaker(member)) }] : []
  })
  return [...witnesses, ...result, ...dispatches, ...byWatch]
}

export function finishFinaleActivity(save: Save, book: CampaignBook, scene: string, effects: readonly EffectStep[]): Save {
  if (!finaleActivities(save, book).some(activity => activity.scene === scene)) return save
  const applied = effects.reduce((state, step) => applyStep(state, book.story, step), save)
  return { ...applied, story: seeScene(applied.story, scene) }
}
