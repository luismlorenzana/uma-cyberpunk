// The battle reducer (CY4, BP4; uma-rpg's engine is the pattern, copied in shape, never imported). A battle is a frozen
// input plus a list of actions: `applyBattleAction` returns the next state and the cues the board plays, or an error and
// no change; `replayBattle` rebuilds any state from the two. Every roll is seeded, so a replay is exact.
import { resolveAttack, tileOf, unitById } from './attack'
import { checkTurn } from './legal'
import { BattleInputError, inBounds, isSolid, parseMap } from './map'
import { checkLoadout, maxHpOf } from './rig'
import { hash32 } from './rng'
import { DIRS } from './sight'
import { advanceClocks, nextTurn, roundAt } from './timeline'
import { TUNING } from './tuning'
import type { ActionResult, BattleAction, BattleInput, BattleState, Cue, Objective, UnitState } from './types'
import { SUPPORTED_VERSIONS } from './version'

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,63}$/
const isBand = (v: unknown) => v === 1 || v === 2 || v === 3 || v === 4 || v === 5

function checkInput(input: BattleInput): void {
  if (!SUPPORTED_VERSIONS.includes(input.rulesVersion)) throw new BattleInputError('rulesVersion', `unknown rules version ${String(input.rulesVersion)}`)
  if (typeof input.seed !== 'string' || input.seed.length === 0 || input.seed.length > 64) throw new BattleInputError('seed', 'expected a string of 1–64 characters')
  const map = parseMap(input.map)
  const ids = new Set<string>()
  const spawns = { squad: new Set<number>(), enemy: new Set<number>() }
  input.units.forEach((u, i) => {
    const path = `units[${i}]`
    if (!SAFE_ID.test(u.id) || ids.has(u.id)) throw new BattleInputError(`${path}.id`, 'expected a unique id')
    ids.add(u.id)
    if (u.side !== 'squad' && u.side !== 'enemy') throw new BattleInputError(`${path}.side`, 'expected squad or enemy')
    for (const b of ['speed', 'stamina', 'power', 'guts', 'wit'] as const) if (!isBand(u.bands?.[b])) throw new BattleInputError(`${path}.bands.${b}`, 'expected 1–5')
    if (!(Number.isSafeInteger(u.chargeCap) && u.chargeCap >= TUNING.charge.cap && u.chargeCap <= 5)) throw new BattleInputError(`${path}.chargeCap`, `expected ${TUNING.charge.cap}–5`)
    if (!DIRS.includes(u.facing)) throw new BattleInputError(`${path}.facing`, 'expected N, E, S or W')
    const pool = u.side === 'squad' ? map.spawns.squad : map.spawns.enemy
    if (!(Number.isSafeInteger(u.spawn) && u.spawn >= 0 && u.spawn < pool.length) || spawns[u.side].has(u.spawn)) throw new BattleInputError(`${path}.spawn`, 'expected an unused spawn of its side')
    spawns[u.side].add(u.spawn)
    checkLoadout(u, path)
  })
  const squad = input.units.filter((u) => u.side === 'squad').length, enemies = input.units.length - squad
  if (squad < 1 || squad > TUNING.map.squad) throw new BattleInputError('units', `expected 1–${TUNING.map.squad} squad units`)
  if (enemies < 1 || enemies > TUNING.map.maxEnemies) throw new BattleInputError('units', `expected 1–${TUNING.map.maxEnemies} enemies`)
  checkObjective(input, map)
}

function checkObjective(input: BattleInput, map: BattleInput['map']): void {
  const o = input.objective
  if (o.kind === 'reach') {
    const [x, y] = o.tile
    if (!inBounds(map, x, y) || isSolid(map, x, y)) throw new BattleInputError('objective.tile', 'expected a standing tile on the map')
  } else if (o.kind === 'hold') {
    if (!(Number.isSafeInteger(o.rounds) && o.rounds >= 1 && o.rounds <= 30)) throw new BattleInputError('objective.rounds', 'expected 1–30')
  } else if (o.kind === 'defeatLeader') {
    if (input.units.filter((u) => u.side === 'enemy' && u.leader).length !== 1) throw new BattleInputError('objective', 'expected exactly one enemy leader')
  } else if (o.kind !== 'defeatAll') throw new BattleInputError('objective.kind', 'unknown objective')
}

const beaten = (u: UnitState) => u.status !== 'active'

/** The objective's progress as a number out of a target, for the objective cue. */
export function objectiveProgress(state: BattleState): { value: number; of: number } {
  const o: Objective = state.input.objective
  const enemies = state.units.filter((u) => u.side === 'enemy')
  if (o.kind === 'defeatAll') return { value: enemies.filter(beaten).length, of: enemies.length }
  if (o.kind === 'defeatLeader') return { value: enemies.some((u) => beaten(u) && state.input.units.find((i) => i.id === u.id)?.leader) ? 1 : 0, of: 1 }
  if (o.kind === 'hold') return { value: Math.min(o.rounds, Math.floor(state.time / TUNING.roundTicks)), of: o.rounds }
  return { value: state.units.some((u) => u.side === 'squad' && u.status === 'active' && u.x === o.tile[0] && u.y === o.tile[1]) ? 1 : 0, of: 1 }
}

/** Ends the battle if the objective is met or every squad unit is out; beating every enemy always wins. */
function settle(state: BattleState, cues: Cue[]): boolean {
  if (state.result) return true
  const progress = objectiveProgress(state)
  const enemiesBeaten = state.units.filter((u) => u.side === 'enemy').every(beaten)
  const squadBeaten = state.units.filter((u) => u.side === 'squad').every(beaten)
  const winner = progress.value >= progress.of || enemiesBeaten ? 'squad' : squadBeaten ? 'enemy' : null
  if (!winner) return false
  state.result = { winner, reason: winner === 'squad' ? 'objective' : 'defeated' }
  state.active = null
  cues.push({ kind: 'ended', winner, reason: state.result.reason })
  return true
}

/** Runs the clock to the next turn: down units extract on theirs, and a held objective may be met on the way. */
function startNextTurn(state: BattleState, cues: Cue[]): void {
  for (;;) {
    if (settle(state, cues)) return
    const next = nextTurn(state, state.turn)
    if (!next) return
    const before = objectiveProgress(state)
    state.time += next.ticks
    advanceClocks(state.units, state, next.ticks)
    const after = objectiveProgress(state)
    if (state.input.objective.kind === 'hold' && after.value !== before.value) cues.push({ kind: 'objective', objective: 'hold', value: after.value, of: after.of })
    if (settle(state, cues)) return
    const u = unitById(state, next.id)
    if (u.status === 'down') {
      // Not rebooted by the end of her next turn: she extracts (TC25).
      u.status = 'out'
      u.clock = 0
      state.turn += 1
      cues.push({ kind: 'extracted', unit: u.id })
      continue
    }
    state.active = u.id
    cues.push({ kind: 'turnStarted', unit: u.id, round: roundAt(state.time) })
    const from = u.charge
    u.charge = Math.min(state.input.units.find((i) => i.id === u.id)!.chargeCap, u.charge + TUNING.charge.perTurn)
    if (u.charge !== from) cues.push({ kind: 'charge', unit: u.id, from, to: u.charge, why: 'turn' })
    return
  }
}

/** A battle's first state and the cues of its first turn. Throws `BattleInputError` naming the path of anything wrong. */
export function startBattle(input: BattleInput): { state: BattleState; cues: Cue[] } {
  checkInput(input)
  const units: UnitState[] = input.units.map((u) => {
    const [x, y] = (u.side === 'squad' ? input.map.spawns.squad : input.map.spawns.enemy)[u.spawn]!
    const maxHp = maxHpOf(u)
    return {
      id: u.id, side: u.side, x, y, facing: u.facing, hp: { ...maxHp }, maxHp, charge: TUNING.charge.start, clock: 0, link: u.link,
      status: 'active', holdOnUsed: false, ammo: u.loadout.back.kind === 'launcher' ? u.loadout.back.ammo ?? 0 : 0, turns: 0,
    }
  })
  const state: BattleState = { input, time: 0, turn: 0, active: null, units, result: null }
  const cues: Cue[] = []
  startNextTurn(state, cues)
  return { state, cues }
}

export const createBattle = (input: BattleInput): BattleState => startBattle(input).state

function clone(state: BattleState): BattleState {
  return { ...state, units: state.units.map((u) => ({ ...u, hp: { ...u.hp } })), result: state.result && { ...state.result } }
}

/** One action: the next state and its cues, or an error and the state unchanged. */
export function applyBattleAction(state: BattleState, action: BattleAction): ActionResult {
  if (action.kind === 'link') {
    if (state.result) return { state, cues: [], error: 'the battle is over' }
    if (action.unit !== state.active) return { state, cues: [], error: `it is not ${action.unit}'s turn` }
    const next = clone(state)
    unitById(next, action.unit).link = action.on
    return { state: next, cues: [{ kind: 'linked', unit: action.unit, on: action.on }], error: null }
  }
  if (action.kind !== 'turn') return { state, cues: [], error: 'unknown action' }
  const checked = checkTurn(state, action)
  if ('error' in checked) return { state, cues: [], error: checked.error }
  const next = clone(state)
  const cues: Cue[] = []
  const u = unitById(next, action.unit)
  const progressBefore = objectiveProgress(next)
  if (checked.reach.path.length > 1) {
    const [x, y] = checked.reach.to
    u.x = x
    u.y = y
    cues.push({ kind: 'moved', unit: u.id, path: checked.reach.path })
  }
  let restart = 0
  const reached = next.input.objective.kind === 'reach' && objectiveProgress(next).value === 1
  if (!reached) {
    const act = action.act
    if (act.kind === 'attack') resolveAttack(next, u.id, act.with, act.target, act.aim, cues)
    else if (act.kind === 'wait') {
      const from = u.charge
      u.charge = Math.min(next.input.units.find((i) => i.id === u.id)!.chargeCap, u.charge + TUNING.charge.wait)
      cues.push({ kind: 'waited', unit: u.id })
      if (u.charge !== from) cues.push({ kind: 'charge', unit: u.id, from, to: u.charge, why: 'wait' })
      restart = TUNING.waitClock
    }
    if (u.status === 'active') {
      u.facing = action.face
      cues.push({ kind: 'faced', unit: u.id, facing: action.face })
    }
  }
  u.clock = restart
  u.turns += 1
  next.turn += 1
  next.active = null
  const progressAfter = objectiveProgress(next)
  const kind = next.input.objective.kind
  if (kind !== 'hold' && progressAfter.value !== progressBefore.value) cues.push({ kind: 'objective', objective: kind, value: progressAfter.value, of: progressAfter.of })
  startNextTurn(next, cues)
  return { state: next, cues, error: null }
}

/** Rebuilds a battle from its input and actions; stops at the first illegal action. */
export function replayBattle(input: BattleInput, actions: readonly BattleAction[]): { state: BattleState; cues: Cue[][]; error: string | null } {
  const start = startBattle(input)
  let state = start.state
  const cues: Cue[][] = [start.cues]
  for (const action of actions) {
    const r = applyBattleAction(state, action)
    if (r.error) return { state, cues, error: r.error }
    state = r.state
    cues.push(r.cues)
  }
  return { state, cues, error: null }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  return JSON.stringify(value)
}

/** A short hash of everything that changes in a battle (the input is fixed, so it's left out). */
export function battleStateHash(state: BattleState): string {
  const { input: _input, ...rest } = state
  return `cyber-battle-v1:${hash32(stable(rest)).toString(16).padStart(8, '0')}`
}

export { tileOf }
