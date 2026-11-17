export const COMMAND_STATIONS = ['pilot', 'shields', 'gunnery', 'engineering'] as const
export type CommandStation = typeof COMMAND_STATIONS[number]
export const COMMAND_ORDERS = ['evade', 'brace', 'fire', 'intercept', 'strike', 'reroute'] as const
export type CommandOrder = typeof COMMAND_ORDERS[number]
export type ShieldSection = 'fore' | 'aft'
export type Officer = { outfit: number; drills: number; trainedDay: number | null }
export type CommandCrew = Partial<Record<CommandStation, Officer>>

export interface ShipThreat { section: ShieldSection; power: number; fighters: number }
export interface CommandEncounter {
  id: string
  cost: { fuel: number; provisions: number }
  transport: number
  enemy: number
  threats: ShipThreat[]
  calls: Record<CommandOrder, string>
}

export interface CommandInput {
  version: 1
  transport: number
  enemy: number
  reactor: number
  threats: ShipThreat[]
  officers: Record<CommandStation, number>
}

export interface CommandAction {
  order: CommandOrder
  shields: number
  guns: number
  fighters: number
}

export interface CommandState {
  turn: number
  hull: number
  transport: number
  enemy: number
  shields: Record<ShieldSection, number>
  power: number
  result: 'won' | 'lost' | null
  last: { order: CommandOrder; blocked: number; intercepted: number; hit: number; hullDamage: number; transportDamage: number } | null
}

export const COMMAND_HULL = 12
export const COMMAND_SHIELD = 6
export const MAX_DRILLS = 2

export function commandStart(input: CommandInput): CommandState {
  return { turn: 0, hull: COMMAND_HULL, transport: input.transport, enemy: input.enemy,
    shields: { fore: 3, aft: 3 }, power: input.reactor, result: null, last: null }
}

export function commandActionError(state: CommandState, action: CommandAction): string | null {
  if (state.result) return 'The encounter has ended.'
  if (!COMMAND_ORDERS.includes(action.order)) return 'Choose an order.'
  const pips = [action.shields, action.guns, action.fighters]
  if (pips.some((p) => !Number.isSafeInteger(p) || p < 0) || pips.reduce((sum, p) => sum + p, 0) > state.power) return 'Not enough reactor power.'
  if (action.order === 'brace' && action.shields === 0) return 'Power the shields.'
  if (action.order === 'fire' && action.guns === 0) return 'Power the guns.'
  if ((action.order === 'strike' || action.order === 'intercept') && action.fighters === 0) return 'Power the fighter bay.'
  return null
}

export function commandTurn(input: CommandInput, state: CommandState, action: CommandAction): CommandState {
  const threat = input.threats[state.turn]
  if (!threat || commandActionError(state, action)) return state
  const { order } = action
  const { pilot, shields, gunnery, engineering } = input.officers
  const hit = action.guns + (order === 'fire' ? 2 + gunnery : 0) + (order === 'strike' ? 1 + action.fighters + pilot : 0)
  const enemy = Math.max(0, state.enemy - hit)
  const intercept = order === 'intercept' ? 1 + action.fighters + pilot : Math.max(0, action.fighters - 1)
  const intercepted = enemy === 0 ? 0 : Math.min(intercept, threat.fighters)
  const transportDamage = enemy === 0 ? 0 : threat.fighters - intercepted
  const transport = Math.max(0, state.transport - transportDamage)
  const sections = { ...state.shields }
  const charge = action.shields + (order === 'brace' ? 1 + shields : 0)
  const incoming = enemy === 0 ? 0 : Math.max(0, threat.power - (order === 'evade' ? 2 + pilot : 0))
  const available = Math.min(COMMAND_SHIELD, sections[threat.section] + charge)
  const blocked = Math.min(available, incoming)
  sections[threat.section] = available - blocked
  const hullDamage = incoming - blocked
  const hull = Math.max(0, state.hull - hullDamage)
  const turn = state.turn + 1
  const result = hull === 0 || transport === 0 ? 'lost' : enemy === 0 || turn === input.threats.length ? 'won' : null
  return { turn, hull, transport, enemy, shields: sections, power: input.reactor + (order === 'reroute' ? 1 + engineering : 0), result,
    last: { order, blocked, intercepted, hit: state.enemy - enemy, hullDamage, transportDamage } }
}

export function replayCommand(input: CommandInput, actions: readonly CommandAction[]): CommandState | null {
  let state = commandStart(input)
  for (const action of actions) {
    const next = commandTurn(input, state, action)
    if (next === state) return null
    state = next
  }
  return state
}
