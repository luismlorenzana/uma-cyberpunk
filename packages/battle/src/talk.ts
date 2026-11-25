import { tileOf, unitById } from './harm'
import { BattleInputError } from './map'
import { distance } from './sight'
import type { BattleInput, BattleState, Cue, TalkContact, Tile } from './types'

const OUTCOME_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,63}$/

export function checkTalkContacts(input: BattleInput): void {
  if (input.talk === undefined) return
  if (input.rulesVersion < 5) throw new BattleInputError('talk', 'needs rules version 5')
  if (!Array.isArray(input.talk)) throw new BattleInputError('talk', 'expected Talk contacts')
  const targets = new Set<string>(), outcomes = new Set<string>()
  for (const [i, contact] of input.talk.entries()) {
    const path = `talk[${i}]`
    if (!contact || typeof contact !== 'object') throw new BattleInputError(path, 'expected a Talk contact')
    if (!input.units.some((u) => u.side === 'squad' && u.id === contact.actor))
      throw new BattleInputError(`${path}.actor`, 'expected a squad unit')
    if (targets.has(contact.target) || !input.units.some((u) => u.side === 'enemy' && u.id === contact.target && !u.fixed))
      throw new BattleInputError(`${path}.target`, 'expected a unique, non-fixed enemy unit')
    if (contact.requires !== 'active' && contact.requires !== 'actorHit')
      throw new BattleInputError(`${path}.requires`, 'expected active or actorHit')
    if (typeof contact.hint !== 'string' || !contact.hint.trim() || contact.hint.length > 160)
      throw new BattleInputError(`${path}.hint`, 'expected a hint of 1–160 characters')
    if (typeof contact.outcome !== 'string' || !OUTCOME_ID.test(contact.outcome) || outcomes.has(contact.outcome))
      throw new BattleInputError(`${path}.outcome`, 'expected a unique outcome id')
    targets.add(contact.target)
    outcomes.add(contact.outcome)
    if (contact.brokenOutcome !== undefined) {
      if (typeof contact.brokenOutcome !== 'string' || !OUTCOME_ID.test(contact.brokenOutcome) || outcomes.has(contact.brokenOutcome))
        throw new BattleInputError(`${path}.brokenOutcome`, 'expected a unique outcome id')
      outcomes.add(contact.brokenOutcome)
    }
  }
}

export const talkContact = (state: Pick<BattleState, 'input'>, target: string): TalkContact | undefined =>
  state.input.talk?.find((contact) => contact.target === target)

export function talkError(state: BattleState, actor: string, target: string, from: Tile): string | null {
  const contact = talkContact(state, target)
  if (!contact || contact.actor !== actor) return 'These units have no Talk action'
  const unit = unitById(state, actor), enemy = unitById(state, target)
  if (unit.side !== 'squad' || unit.status !== 'active' || unit.stunned) return 'Talk needs an active squad unit'
  if (enemy.side !== 'enemy' || enemy.status !== 'active') return 'Talk needs a standing enemy'
  if (contact.requires === 'actorHit' && !enemy.talkHit) return contact.hint
  return distance(from, tileOf(enemy)) === 1 ? null : 'Move next to the Talk target'
}

/** A settled conversation removes the target without stripping her equipment. */
export function resolveTalk(state: BattleState, actor: string, target: string, cues: Cue[]): void {
  const contact = talkContact(state, target)!
  const enemy = unitById(state, target)
  enemy.status = 'freed'
  enemy.talked = contact.outcome
  if (enemy.holdHp !== undefined) enemy.holdHp = 0
  delete enemy.stunned
  cues.push({ kind: 'talked', unit: actor, target, outcome: contact.outcome })
}
