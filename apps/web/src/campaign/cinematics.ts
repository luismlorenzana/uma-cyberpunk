import { awayMembers, commandFacts, crewSpeaker, resolvedCommand, resumeCommand, walkSteps,
  type CampaignBook, type CommandAction, type CommandCast, type Save } from '@cyber/domain'
import { retry } from '../mission/director'
import { nameOf } from '../story/runner'
import { missionAshore } from './call-up'

export function freezeCommandCast(save: Save, book: CampaignBook, encounter: string, objective: string): CommandCast {
  const ashore = missionAshore(book, save), away = awayMembers(save.operations, save.squads)
  const binding = book.commandCinematics?.encounters.find(row => row.encounter === encounter)
  const commander = binding?.commander
  return { crew: {}, objective: binding?.objective ?? objective,
    present: save.crew.filter(member => !member.expeditionOnly && !ashore.has(member.outfit) && !away.includes(member.outfit)).map(member => {
      const speaker = crewSpeaker(member)
      return { speaker, name: nameOf(book.story, speaker) }
    }),
    ...(commander === undefined ? {} : { commander: { speaker: commander, name: nameOf(book.story, commander) } }) }
}

export function savedCommandEvent(save: Save, turn = save.commandCinema.pending?.turn) {
  const mission = save.mission, battle = mission?.battle
  if (!mission || !battle || !turn) return null
  const run = resumeCommand(battle.input, battle.actions)
  return run ? resolvedCommand(run.input, battle.actions as CommandAction[], turn) : null
}

export function advanceCommandCinema(save: Save, encounter: string, turn: number, beat: number, skip = false): Save {
  const pending = save.commandCinema.pending
  if (!pending || pending.encounter !== encounter || pending.turn !== turn || pending.beat !== beat || !savedCommandEvent(save, turn)) return save
  return { ...save, commandCinema: { ...save.commandCinema, pending: beat === 3 ? null : { ...pending, beat: skip ? 3 : beat + 1 } } }
}

export function replayCommandCinema(save: Save): Save {
  const turn = save.mission?.battle?.actions.length
  if (!turn || save.commandCinema.pending || !savedCommandEvent(save, turn)) return save
  return { ...save, commandCinema: { ...save.commandCinema, pending: { encounter: save.mission!.id, turn, beat: save.commandCinema.fast ? 3 : 0 } } }
}

export function retryCommand(save: Save): Save {
  if (save.mission?.step !== 'results' || save.mission.won || !save.mission.battle || !resumeCommand(save.mission.battle.input, save.mission.battle.actions)) return save
  const next = retry(save)
  return { ...next, commandCinema: { ...next.commandCinema, retries: Math.min(1000, save.commandCinema.retries + 1) } }
}

export function commandContextScene(save: Save, book: CampaignBook, kind: 'preparation' | 'victory' | 'withdrawal' | 'retry' | 'disabled'): string | undefined {
  const mission = save.mission
  if (!mission || save.commandCinema.pending) return undefined
  const binding = book.commandCinematics?.encounters.find(row => row.encounter === mission.id), id = binding?.[kind]
  const scene = id && book.scenes.get(id)
  if (!scene) return undefined
  const run = mission.battle && resumeCommand(mission.battle.input, mission.battle.actions)
  if (kind === 'preparation' ? mission.step !== 'deploy'
    : kind === 'retry' ? mission.step !== 'battle' || run?.state.turn !== 0 || !save.commandCinema.retries
    : kind === 'disabled' ? run?.state.emitter !== 0 || run.state.result !== 'won' || mission.step !== 'results' || !mission.won
    : run?.state.result !== (kind === 'victory' ? 'won' : 'lost')) return undefined
  const cast = run?.input.presentation ?? freezeCommandCast(save, book, mission.id, '')
  const present = new Set([...cast.present.map(actor => actor.speaker), ...(cast.commander ? [cast.commander.speaker] : []), 'steward'])
  return [...walkSteps(scene.steps, '')].every(({ step }) => {
    const speaker = 'speaker' in step ? step.speaker : 'actor' in step ? step.actor : undefined
    return speaker === undefined || present.has(speaker)
  }) ? id : undefined
}

export function commandLog(save: Save) {
  const battle = save.mission?.battle, run = battle && resumeCommand(battle.input, battle.actions)
  if (!run || !battle) return []
  return battle.actions.flatMap((_, index) => {
    const event = resolvedCommand(run.input, battle.actions as CommandAction[], index + 1)
    return event ? [{ event, text: `${event.actor?.name ?? 'Watch officer'} · ${event.action.target === 'emitter' ? 'Emitter' : event.action.order} · ${commandFacts(event)}` }] : []
  })
}
