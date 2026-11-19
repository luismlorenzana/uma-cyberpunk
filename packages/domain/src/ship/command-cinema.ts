import type { CampaignComposition } from '../story/campaign'
import { commandStart, commandTurn, type CommandAction, type CommandInput, type CommandOrder, type CommandStation, type CommandState } from './command'
import type { Speaker } from '../story/types'

export const ORDER_STATION: Record<CommandOrder, CommandStation> = { evade: 'pilot', brace: 'shields', fire: 'gunnery', intercept: 'pilot', strike: 'pilot', reroute: 'engineering' }
export interface CommandParticipant { speaker: Speaker; name: string }
/** Presentation identity travels with the frozen numeric input, including free retries. */
export interface CommandCast {
  crew: Partial<Record<CommandStation, CommandParticipant>>
  present: CommandParticipant[]
  objective: string
  commander?: CommandParticipant
}
export interface CommandCinemaState {
  fast: boolean
  retries: number
  pending: { encounter: string; turn: number; beat: number } | null
}
export interface CommandActorArt {
  speaker: Speaker
  role: 'crew' | 'enemy' | 'ally'
  base: string
  profile?: string
  poseSlot: string
  pose?: string
  poseFallback?: string
  composition?: CampaignComposition
  orders?: Record<CommandOrder, { captain: string; acknowledgement: string; result: string }>
  states?: Partial<Record<'victory' | 'loss' | 'disabled' | 'damage' | 'noDamage', string>>
}
export interface CommandCinematics {
  stations: { station: CommandStation; backdrop: string }[]
  actors: CommandActorArt[]
  effects?: { kind: CommandEffectKey; slot: string; composition?: CampaignComposition }[]
  encounters: { encounter: string; objective: string; commander?: Speaker;
    preparation?: string; victory?: string; withdrawal?: string; retry?: string; disabled?: string;
    enemy?: { contact: string; disabled: string; withdrawal: string } }[]
}
export const COMMAND_EFFECT_KEYS = ['shields', 'guns', 'fighter-strike', 'intercept', 'hit', 'emitter-hit', 'emitter-disabled', 'friendly-damage', 'power'] as const
export type CommandEffectKey = typeof COMMAND_EFFECT_KEYS[number]
export interface ResolvedCommand {
  turn: number
  action: CommandAction
  before: CommandState
  after: CommandState
  station: CommandStation
  actor?: CommandParticipant
  commander?: CommandParticipant
  objective: string
  disabled: boolean
}

/** A cinematic is a projection of one committed action. It never writes an action or resolves a new one. */
export function resolvedCommand(input: CommandInput, actions: readonly CommandAction[], turn: number): ResolvedCommand | null {
  if (!Number.isInteger(turn) || turn < 1 || turn > actions.length) return null
  let before = commandStart(input)
  for (let i = 0; i < turn; i++) {
    const action = actions[i]!
    const after = commandTurn(input, before, action)
    if (before === after) return null
    if (i === turn - 1) {
      const station = ORDER_STATION[action.order]
      return { turn, action, before, after, station, actor: input.presentation?.crew[station], commander: input.presentation?.commander,
        objective: input.presentation?.objective ?? (input.version === 1 ? 'Protected vessel' : 'Boarding shuttle'),
        disabled: before.emitter !== null && before.emitter > 0 && after.emitter === 0 }
    }
    before = after
  }
  return null
}

export function commandFacts(event: ResolvedCommand): string {
  const last = event.after.last!
  const outcome = event.after.result === 'lost' ? 'Withdrawal' : event.after.result === 'won' ? 'Immediate objective secured' : 'Awaiting next order'
  return `Shields ${event.action.shields} · guns ${event.action.guns} · fighters ${event.action.fighters} · ${event.action.target === 'emitter' ? 'Emitter' : 'Opposing ship'} · ${last.blocked} blocked · ${last.intercepted} intercepted · ${last.hit} enemy damage · ${last.emitterHit} emitter damage · ${last.hullDamage} hull damage · ${last.transportDamage} objective damage · ${event.objective} ${event.after.transport} · next power ${event.after.power} · ${outcome}`
}

export function commandEffectKeys(event: ResolvedCommand): CommandEffectKey[] {
  const last = event.after.last!, effects: CommandEffectKey[] = []
  if (last.blocked > 0) effects.push('shields')
  if (event.action.order === 'fire' && event.action.guns > 0 && (last.hit > 0 || last.emitterHit > 0)) effects.push('guns')
  if (event.action.order === 'strike' && (last.hit > 0 || last.emitterHit > 0)) effects.push('fighter-strike')
  if (event.action.order === 'intercept' && last.intercepted > 0) effects.push('intercept')
  if (last.hit > 0) effects.push('hit')
  if (last.emitterHit > 0) effects.push(event.disabled ? 'emitter-disabled' : 'emitter-hit')
  if (last.hullDamage > 0 || last.transportDamage > 0) effects.push('friendly-damage')
  if (event.action.order === 'reroute' && event.after.power > event.before.power) effects.push('power')
  return effects
}
