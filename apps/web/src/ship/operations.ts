// Operations through the save (CY18): the squads that can go, the outcome a squad would bring back (deterministic, so
// Comms shows it before sending), sending and recalling, the recall's report on the ship log.
import { offeredOperations, operationById, outcomeOf, powerOf, recallSquad, sendProblem, sendSquad, type Operation, type Outcome, type Save, type StoryPack } from '@cyber/domain'
import { progressOf } from '../mission/director'

export const offersNow = (pack: StoryPack, save: Save): Operation[] => offeredOperations(pack, save, progressOf(pack, save))

/** What a squad would bring back from an operation: its power against the danger. */
export function expectedOutcome(save: Save, squadId: string, op: Operation): Outcome | null {
  const squad = save.squads.find((s) => s.id === squadId)
  return squad ? outcomeOf(powerOf(save, squad), op.danger) : null
}

/** Sends a squad on an operation, if it can go. */
export function sendOperation(pack: StoryPack, save: Save, squadId: string, opId: string): Save {
  const squad = save.squads.find((s) => s.id === squadId)
  const op = operationById(pack, save, opId, progressOf(pack, save))
  return squad && op && !sendProblem(save, squad) ? sendSquad(save, squad, op) : save
}

/** Recalls a squad now: thin rewards, its report on this watch's ship-log card. */
export function recallOperation(pack: StoryPack, save: Save, squadId: string): Save {
  const r = recallSquad(pack, save, squadId, progressOf(pack, save))
  if (!r.report) return r.save
  const log = r.save.log?.watch === save.watch ? r.save.log : { watch: save.watch, lines: [], gains: { credits: 0, alloy: 0, data: 0 }, read: false }
  return { ...r.save, log: { ...log, read: false, reports: [...(log.reports ?? []).filter((x) => x.op !== r.report!.op), r.report] } }
}
