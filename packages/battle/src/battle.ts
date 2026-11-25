// The battle reducer (CY4, CY5, BP4; uma-rpg's engine is the pattern, copied in shape, never imported). A battle is a
// frozen input plus a list of actions: `applyBattleAction` returns the next state and the cues the board plays, or an
// error and no change; `replayBattle` rebuilds any state from the two. Every roll is seeded, so a replay is exact. A
// version-1 battle plays exactly as CY4's did; version 2 adds CY5's rules, gated by `v2`.
import { mountFor, resolveAttack, resolveStrike, stun, strikeOf, tileOf, unitById } from './attack'
import { gainCharge, harm, spendCharge, v2 } from './harm'
import { checkTurn } from './legal'
import { BattleInputError, inBounds, isSolid, parseMap } from './map'
import { fireVolley, startOwnTurn } from './muster'
import { armed, checkLoadout, maxHpOf, MOUNTS } from './rig'
import { hash32 } from './rng'
import { DIRS, inReach, sameTile } from './sight'
import { benchError, callBench, mend, placeBarrier, reboot, useItem } from './support'
import { outcomes, resolveHack, resolveTech } from './tech'
import { checkTalkContacts, resolveTalk } from './talk'
import { boardOf, expire, keyOf, lightsOut, liveTiles, newField } from './terrain'
import { advanceClocks, inputOf, nextTurn, roundAt } from './timeline'
import { TUNING } from './tuning'
import type { ActionResult, BattleAction, BattleInput, BattleState, Cue, DuoAction, FieldState, Objective, Role, UnitState } from './types'
import { cloneV3, DUO_TECHS, duoError, duoKey, giveOrder, landStrike, orderError, partnerOf, startV3, v3 } from './v3'
import { EXPEDITION_RULES_VERSION, EXPEDITION_SQUAD_SIZE, SUPPORTED_VERSIONS } from './version'
import { modeCost, quickPatch, quickPatchTargets, validSpecialty } from './specialists'

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,63}$/
const isBand = (v: unknown) => v === 1 || v === 2 || v === 3 || v === 4 || v === 5
const ROLES: readonly Role[] = ['vanguard', 'striker', 'gunner', 'netrunner', 'medic']

function checkInput(input: BattleInput): void {
  if (!SUPPORTED_VERSIONS.includes(input.rulesVersion)) throw new BattleInputError('rulesVersion', `unknown rules version ${String(input.rulesVersion)}`)
  if (typeof input.seed !== 'string' || input.seed.length === 0 || input.seed.length > 64) throw new BattleInputError('seed', 'expected a string of 1–64 characters')
  const map = parseMap(input.map, 'map', input.rulesVersion === 5 && input.units?.some(unit => unit.specialty) ? 5 : 4)
  const expedition = input.rulesVersion === EXPEDITION_RULES_VERSION
  if (expedition !== (map.schemaVersion === 2)) throw new BattleInputError('map.schemaVersion', 'an expedition map requires expedition rules and vice versa')
  const later = input.rulesVersion >= 2
  const needs2 = (path: string, present: unknown) => { if (present !== undefined && !later) throw new BattleInputError(path, 'needs rules version 2') }
  needs2('map.props', input.map.props)
  needs2('map.states', input.map.states)
  needs2('items', input.items)
  needs2('bench', input.bench)
  needs2('factions', input.factions)
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
    for (const k of ['skills', 'stride', 'hold', 'holdHp', 'fixed', 'faction'] as const) needs2(`${path}.${k}`, u[k])
    if (u.skills) for (const [k, v] of Object.entries(u.skills)) if (!['double', 'switch', 'burst', 'first', 'stun'].includes(k) || !(Number.isSafeInteger(v) && v >= 0 && v <= 100)) throw new BattleInputError(`${path}.skills.${k}`, 'expected a chance skill with 0–100%')
    if (u.stride !== undefined && !['break', 'draft', 'surge', 'kick'].includes(u.stride)) throw new BattleInputError(`${path}.stride`, 'expected break, draft, surge or kick')
    if (u.hold !== undefined && !['anchor', 'collar', 'none'].includes(u.hold)) throw new BattleInputError(`${path}.hold`, 'expected anchor, collar or none')
    if (u.holdHp !== undefined && !(Number.isSafeInteger(u.holdHp) && u.holdHp >= 1 && (u.hold === 'anchor' || u.hold === 'collar'))) throw new BattleInputError(`${path}.holdHp`, 'expected a positive integer on an Anchor or a Collar')
    if (u.faction !== undefined && u.faction !== 'steel-muster') throw new BattleInputError(`${path}.faction`, 'unknown faction')
    checkLoadout(u, path, input.rulesVersion)
    if (u.signature !== undefined) {
      const s = u.signature
      if (input.rulesVersion < 6 || !s || typeof s.id !== 'string' || !SAFE_ID.test(s.id) || typeof s.label !== 'string' || !s.label.trim() || s.label.length > 64
        || !MOUNTS.includes(s.mount) || !Number.isInteger(s.charge) || s.charge < 1 || s.charge > u.chargeCap
        || !Number.isInteger(s.power) || s.power < 1 || s.power > 12) throw new BattleInputError(path + '.signature', 'invalid mounted signature')
    }
    if (u.specialty !== undefined && (input.rulesVersion < 5 || !validSpecialty(u.specialty, u))) {
      throw new BattleInputError(`${path}.specialty`, 'expected a version 5 specialist with a compatible fitting')
    }
  })
  const squad = input.units.filter((u) => u.side === 'squad').length, enemies = input.units.length - squad
  if (expedition) {
    if (squad !== EXPEDITION_SQUAD_SIZE) throw new BattleInputError('units', `expected ${EXPEDITION_SQUAD_SIZE} expedition units`)
    if (input.bench?.length) throw new BattleInputError('bench', 'the full expedition deploys')
  } else {
    const capacity = input.rulesVersion === 5 && input.units.some(unit => unit.specialty) ? 10 : TUNING.map.squad
    if (squad < 1 || squad > capacity) throw new BattleInputError('units', `expected 1–${capacity} squad units`)
  }
  if (enemies < 1 || enemies > TUNING.map.maxEnemies) throw new BattleInputError('units', `expected 1–${TUNING.map.maxEnemies} enemies`)
  if (input.items) {
    let total = 0
    for (const [k, v] of Object.entries(input.items)) {
      if (!['repair', 'patch', 'smoke', 'cell'].includes(k) || !(Number.isSafeInteger(v) && v! >= 0)) throw new BattleInputError(`items.${k}`, 'expected an item and a count')
      total += v!
    }
    if (total > TUNING.items.max) throw new BattleInputError('items', `expected ${TUNING.items.max} items at most`)
  }
  for (const [i, r] of (input.bench ?? []).entries()) if (!ROLES.includes(r)) throw new BattleInputError(`bench[${i}]`, 'expected a role')
  for (const [i, f] of (input.factions ?? []).entries()) if (f !== 'steel-muster') throw new BattleInputError(`factions[${i}]`, 'unknown faction')
  if (input.rulesVersion >= 3) checkV3(input)
  for (const p of input.map.props ?? []) {
    if (p.kind === 'terminal' && 'turret' in p.does) {
      const turret = input.units.find((u) => u.id === (p.does as { turret: string }).turret)
      if (!turret?.fixed) throw new BattleInputError(`map.props.${p.id}.does.turret`, 'expected a fixed unit')
    }
  }
  checkObjective(input, map)
  checkTalkContacts(input)
}

const ORDER_KINDS = ['sure', 'hold', 'reboot', 'resonance', 'strike', 'sweep', 'barrier', 'drone', 'reinforce']
const SYSTEM_KINDS = ['battery', 'sensors', 'shield', 'drones', 'engines']
/** Rules version 3's input (CY17): bonds, partners, Orders, systems and the meal. Below version 3 these are ignored. */
function checkV3(input: BattleInput): void {
  const ids = new Set(input.units.map((u) => u.id))
  input.units.forEach((u, i) => {
    if (u.bond !== undefined && !(Number.isSafeInteger(u.bond.rank) && u.bond.rank >= 1 && u.bond.rank <= 10 && [null, 'trust', 'heart'].includes(u.bond.path))) throw new BattleInputError(`units[${i}].bond`, 'expected a rank 1–10 and a path')
    if (u.partner !== undefined && !(ids.has(u.partner.unit) && u.partner.unit !== u.id && [1, 2, 3].includes(u.partner.level))) throw new BattleInputError(`units[${i}].partner`, 'expected another unit and a level 1–3')
  })
  if (input.orders !== undefined) {
    if (!(Number.isSafeInteger(input.orders.slots) && input.orders.slots >= 0 && input.orders.slots <= TUNING.orders.maxSlots)) throw new BattleInputError('orders.slots', `expected 0–${TUNING.orders.maxSlots}`)
    for (const [i, k] of input.orders.kinds.entries()) if (!ORDER_KINDS.includes(k)) throw new BattleInputError(`orders.kinds[${i}]`, 'unknown Order')
  }
  for (const [i, s] of (input.systems ?? []).entries()) {
    const id = typeof s === 'string' ? s : s.id
    if (!SYSTEM_KINDS.includes(id)) throw new BattleInputError(`systems[${i}]`, 'unknown system')
    if (typeof s !== 'string' && !(Number.isSafeInteger(s.level) && s.level >= 1 && s.level <= 3 && isBand(s.band))) throw new BattleInputError(`systems[${i}]`, 'expected a level 1–3 and a band')
  }
  if (input.meal !== undefined && !(input.meal in TUNING.meals)) throw new BattleInputError('meal', 'unknown meal')
  if (input.cohesion !== undefined) {
    const c = input.cohesion
    if (!(Number.isSafeInteger(c.level) && c.level >= 0 && c.level <= 5) || !ids.has(c.leader) || !c.members.every((m) => ids.has(m))) throw new BattleInputError('cohesion', 'expected a level 0–5, a leader and members in the battle')
  }
  for (const [i, k] of (input.conditions ?? []).entries()) if (!['fog', 'hazards', 'no-reinforcements'].includes(k)) throw new BattleInputError(`conditions[${i}]`, 'unknown condition')
}

function checkObjective(input: BattleInput, map: BattleInput['map']): void {
  const o = input.objective
  if (input.goalRequired !== undefined && (input.goalRequired !== true || input.rulesVersion < 6 || (o.kind !== 'reach' && o.kind !== 'hack' && o.kind !== 'hold'))) {
    throw new BattleInputError('goalRequired', 'expected a reach, hold or hack objective on rules version 6 or later')
  }
  if (input.preserve !== undefined && (input.rulesVersion < EXPEDITION_RULES_VERSION || o.kind !== 'reach'
    || !input.units.some(unit => unit.id === input.preserve && unit.side === 'enemy'))) {
    throw new BattleInputError('preserve', 'expected a living enemy in an expedition reach objective')
  }
  const tileOk = (path: string, [x, y]: readonly [number, number]) => { if (!inBounds(map, x, y) || isSolid(map, x, y)) throw new BattleInputError(path, 'expected a standing tile on the map') }
  if (['escort', 'hack', 'freeLeader'].includes(o.kind) && input.rulesVersion < 2) throw new BattleInputError('objective.kind', 'needs rules version 2')
  if (o.kind === 'reach') tileOk('objective.tile', o.tile)
  else if (o.kind === 'hold') {
    if (!(Number.isSafeInteger(o.rounds) && o.rounds >= 1 && o.rounds <= 30)) throw new BattleInputError('objective.rounds', 'expected 1–30')
  } else if (o.kind === 'defeatLeader' || o.kind === 'freeLeader') {
    const leaders = input.units.filter((u) => u.side === 'enemy' && u.leader)
    if (leaders.length !== 1) throw new BattleInputError('objective', 'expected exactly one enemy leader')
    if (o.kind === 'freeLeader' && leaders[0]!.hold === undefined) throw new BattleInputError('objective', 'the leader to free must be a heroine with a Hold')
    if (o.kind === 'freeLeader' && o.collar !== undefined
      && (input.rulesVersion < 5 || o.collar !== 'rigBreak' || leaders[0]!.hold !== 'collar'))
      throw new BattleInputError('objective.collar', 'Rig Break rescue needs a Collar leader and rules version 5')
  } else if (o.kind === 'escort') {
    if (!input.units.some((u) => u.id === o.unit && u.side === 'squad')) throw new BattleInputError('objective.unit', 'expected a squad unit')
    tileOk('objective.tile', o.tile)
  } else if (o.kind === 'hack') {
    const terminals = (map.props ?? []).filter((p) => p.kind === 'terminal').length
    if (!(Number.isSafeInteger(o.count) && o.count >= 1 && o.count <= terminals)) throw new BattleInputError('objective.count', `expected 1–${terminals} terminals`)
  } else if (o.kind !== 'defeatAll') throw new BattleInputError('objective.kind', 'unknown objective')
}

const beaten = (u: UnitState) => u.status !== 'active'
const leaderOf = (state: BattleState) => state.units.find((u) => u.side === 'enemy' && state.input.units.find((i) => i.id === u.id)?.leader)

/** The objective's progress as a number out of a target, for the objective cue. */
export function objectiveProgress(state: BattleState): { value: number; of: number } {
  const o: Objective = state.input.objective
  const enemies = state.units.filter((u) => u.side === 'enemy')
  const on = (id: string | null, t: readonly [number, number]) => state.units.some((u) => (id === null ? u.side === 'squad' : u.id === id) && u.status === 'active' && u.x === t[0] && u.y === t[1])
  if (o.kind === 'defeatAll') return { value: enemies.filter(beaten).length, of: enemies.length }
  if (o.kind === 'defeatLeader') return { value: enemies.some((u) => beaten(u) && state.input.units.find((i) => i.id === u.id)?.leader) ? 1 : 0, of: 1 }
  if (o.kind === 'hold') return { value: Math.min(o.rounds, Math.floor(state.time / TUNING.roundTicks)), of: o.rounds }
  if (o.kind === 'escort') return { value: on(o.unit, o.tile) ? 1 : 0, of: 1 }
  if (o.kind === 'hack') return { value: Math.min(o.count, state.field?.hacked.length ?? 0), of: o.count }
  if (o.kind === 'freeLeader') return { value: leaderOf(state)?.status === 'freed' ? 1 : 0, of: 1 }
  return { value: on(null, o.tile) ? 1 : 0, of: 1 }
}

/** Rules version 2's ways to fail: the escort is out, or the leader to free was broken instead. */
function failed(state: BattleState): boolean {
  if (state.input.preserve && unitById(state, state.input.preserve).status !== 'active') return true
  const o = state.input.objective
  if (o.kind === 'escort') return unitById(state, o.unit).status !== 'active'
  if (o.kind === 'freeLeader') {
    const l = leaderOf(state)
    return l?.status === 'down' || l?.status === 'out'
  }
  return false
}

/** Ends the battle if the objective is met or failed, or every squad unit is out; beating every enemy wins otherwise. */
function settle(state: BattleState, cues: Cue[]): boolean {
  if (state.result) return true
  const progress = objectiveProgress(state)
  const enemiesBeaten = state.units.filter((u) => u.side === 'enemy').every(beaten)
  const squadBeaten = state.units.filter((u) => u.side === 'squad').every(beaten)
  const achieved = progress.value >= progress.of || (enemiesBeaten && !state.input.goalRequired)
  const winner = failed(state) ? 'enemy' : achieved ? 'squad' : squadBeaten ? 'enemy' : null
  if (!winner) return false
  state.result = { winner, reason: winner === 'squad' ? 'objective' : 'defeated', ...(v2(state) ? { enemies: outcomes(state) } : {}) }
  state.active = null
  cues.push({ kind: 'ended', winner, reason: state.result.reason })
  return true
}

/** Runs the clock to the next turn: timers run out, a signalled volley lands, down units extract on theirs, stunned
 * units lose theirs, idle turrets sit theirs out, and a held objective may be met on the way. */
function cancelSignature(unit: UnitState, cues: Cue[]) {
  if (!unit.signatureMark) return
  delete unit.signatureMark
  cues.push({ kind: 'signatureCanceled', unit: unit.id })
}

function startNextTurn(state: BattleState, cues: Cue[]): void {
  for (;;) {
    if (settle(state, cues)) return
    const next = nextTurn(state, state.turn)
    if (!next) return
    const before = objectiveProgress(state)
    state.time += next.ticks
    advanceClocks(state.units, state, next.ticks)
    if (state.field) {
      expire(state, cues)
      fireVolley(state, cues)
    }
    if (state.v3) landStrike(state, cues)
    const after = objectiveProgress(state)
    if (state.input.objective.kind === 'hold' && after.value !== before.value) cues.push({ kind: 'objective', objective: 'hold', value: after.value, of: after.of })
    if (settle(state, cues)) return
    const u = unitById(state, next.id)
    if (u.status !== 'active' && u.status !== 'down') continue
    if (u.status === 'down') {
      cancelSignature(u, cues)
      // Not rebooted by the end of her next turn: she extracts (TC25).
      u.status = 'out'
      u.clock = 0
      state.turn += 1
      cues.push({ kind: 'extracted', unit: u.id })
      continue
    }
    const idle = state.input.units.find((i) => i.id === u.id)!.fixed && lightsOut(state)
    const spent = !!state.v3?.spent.includes(u.id)
    if (u.stunned || idle || spent) {
      cancelSignature(u, cues)
      cues.push({ kind: 'skipped', unit: u.id, why: spent ? 'duo' : u.stunned ? 'stunned' : 'idle' })
      if (spent) state.v3!.spent = state.v3!.spent.filter((x) => x !== u.id)
      delete u.stunned
      delete u.windup
      startOwnTurn(state, u.id)
      u.clock = 0
      state.turn += 1
      continue
    }
    if (v2(state)) startOwnTurn(state, u.id)
    state.active = u.id
    cues.push({ kind: 'turnStarted', unit: u.id, round: roundAt(state.time) })
    const from = u.charge
    u.charge = Math.min(state.input.units.find((i) => i.id === u.id)!.chargeCap, u.charge + TUNING.charge.perTurn)
    if (u.charge !== from) cues.push({ kind: 'charge', unit: u.id, from, to: u.charge, why: 'turn' })
    const mark = u.signatureMark
    if (mark) {
      const target = unitById(state, mark.target)
      const input = inputOf(state, u.id), signature = input.signature!
      const arm = armed(input, u, signature.mount)
      if (!arm || target.status !== 'active' || !sameTile(tileOf(target), mark.tile)
        || !inReach(boardOf(state), arm.weapon, tileOf(u), mark.tile)) cancelSignature(u, cues)
      else if (target.turns > mark.targetTurn) {
        const before = objectiveProgress(state)
        delete u.signatureMark
        resolveAttack(state, u.id, signature.mount, target.id, undefined, cues, signature)
        const after = objectiveProgress(state)
        if (after.value !== before.value) cues.push({ kind: 'objective', objective: state.input.objective.kind, value: after.value, of: after.of })
        u.clock = 0
        u.turns += 1
        state.turn += 1
        state.active = null
        continue
      }
    }
    return
  }
}

/** A battle's first state and the cues of its first turn. Throws `BattleInputError` naming the path of anything wrong. */
export function startBattle(input: BattleInput): { state: BattleState; cues: Cue[] } {
  checkInput(input)
  const units: UnitState[] = input.units.map((u) => {
    const [x, y] = (u.side === 'squad' ? input.map.spawns.squad : input.map.spawns.enemy)[u.spawn]!
    const maxHp = maxHpOf(u)
    const unit: UnitState = {
      id: u.id, side: u.side, x, y, facing: u.facing, hp: { ...maxHp }, maxHp, charge: TUNING.charge.start, clock: 0, link: u.link,
      status: 'active', holdOnUsed: false, ammo: u.loadout.back.kind === 'launcher' ? u.loadout.back.ammo ?? 0 : 0, turns: 0,
    }
    if (u.hold === 'anchor' || u.hold === 'collar') unit.holdHp = u.holdHp ?? TUNING.holdHp
    return unit
  })
  const state: BattleState = { input, time: 0, turn: 0, active: null, units, result: null }
  if (input.rulesVersion >= 2) state.field = newField(state)
  if (input.rulesVersion >= 3) startV3(state)
  const cues: Cue[] = []
  startNextTurn(state, cues)
  return { state, cues }
}

export const createBattle = (input: BattleInput): BattleState => startBattle(input).state

function cloneField(f: FieldState): FieldState {
  return {
    ...f, states: { ...f.states }, doors: { ...f.doors }, lifts: { ...f.lifts }, burst: [...f.burst], barriers: f.barriers.map((b) => ({ ...b })),
    hacked: [...f.hacked], volley: { ...f.volley, marked: [...f.volley.marked] }, items: { ...f.items },
  }
}

function clone(state: BattleState): BattleState {
  const next: BattleState = { ...state, units: state.units.map((u) => ({ ...u, hp: { ...u.hp } })), result: state.result && { ...state.result } }
  if (state.field) next.field = cloneField(state.field)
  if (state.v3) next.v3 = cloneV3(state.v3)
  return next
}

/** Fire burns the Legs (F: a Fire Coat halves it); current hits the Core and ignores Coats. */
function terrainHarm(state: BattleState, u: UnitState, by: 'fire' | 'live', cues: Cue[]): void {
  if (u.status !== 'active') return
  const t = TUNING.terrain
  let part: 'legs' | 'core' = by === 'fire' ? 'legs' : 'core'
  if (part === 'legs' && u.hp.legs <= 0) part = 'core'
  const coat = by === 'fire' && state.input.units.find((i) => i.id === u.id)!.loadout.coat === 'F'
  const amount = by === 'fire' ? Math.max(TUNING.minDamage, Math.floor((t.fireDamage * (coat ? TUNING.coatPct : 100)) / 100)) : t.liveDamage
  harm(state, u, part, amount, cues, (broke) => ({ kind: 'burn', unit: u.id, part, amount, by, broke }))
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
  if (action.kind === 'quickPatch') {
    if (!quickPatchTargets(state, action.unit).some((unit) => unit.id === action.target)) {
      return { state, cues: [], error: 'Emergency patch is unavailable' }
    }
    const next = clone(state), cues: Cue[] = []
    quickPatch(next, action.unit, action.target, cues)
    return { state: next, cues, error: null }
  }
  if (action.kind === 'order') {
    const error = orderError(state, action)
    if (error) return { state, cues: [], error }
    const next = clone(state)
    const cues: Cue[] = []
    giveOrder(next, action, cues, callBench)
    settle(next, cues)
    return { state: next, cues, error: null }
  }
  if (action.kind === 'duo') return duo(state, action)
  if (action.kind === 'bench') {
    if (!v2(state)) return { state, cues: [], error: 'no bench in rules version 1' }
    const error = benchError(state, action.unit, action.role, action.at)
    if (error) return { state, cues: [], error }
    const next = clone(state)
    const cues: Cue[] = []
    callBench(next, action.unit, action.role, action.at, cues)
    if (unitById(next, action.unit).status !== 'active') {
      next.active = null
      next.turn += 1
      startNextTurn(next, cues)
    } else settle(next, cues)
    return { state: next, cues, error: null }
  }
  if (action.kind !== 'turn') return { state, cues: [], error: 'unknown action' }
  const checked = checkTurn(state, action)
  if ('error' in checked) return { state, cues: [], error: checked.error }
  const next = clone(state)
  const cues: Cue[] = []
  const u = unitById(next, action.unit)
  const progressBefore = objectiveProgress(next)
  if (action.dash) {
    spendCharge(u, TUNING.back.dash, 'dash', cues)
    cues.push({ kind: 'dash', unit: u.id })
  }
  if (checked.reach.path.length > 1) {
    const [x, y] = checked.reach.to
    u.x = x
    u.y = y
    cues.push({ kind: 'moved', unit: u.id, path: checked.reach.path })
    if (next.field) {
      const live = liveTiles(next)
      for (const t of checked.reach.path.slice(1)) if (live.has(keyOf(t[0], t[1]))) terrainHarm(next, u, 'live', cues)
    }
  }
  let restart = 0
  const o = next.input.objective.kind
  const reached = (o === 'reach' || o === 'escort') && objectiveProgress(next).value === 1
  if (!reached && u.status === 'active') {
    const act = action.act
    if (act.kind === 'attack') {
      const input = inputOf(next, u.id), signature = act.signature ? input.signature : undefined
      if (!signature) {
        if (act.mode) spendCharge(u, modeCost(act.mode), 'mode', cues)
        resolveAttack(next, u.id, act.with, act.target, act.aim, cues, undefined, act.mode)
      }
      else if (armed(input, u, signature.mount)) {
        const target = unitById(next, act.target)
        spendCharge(u, signature.charge, 'signature', cues)
        u.signatureUsed = true
        if (u.side === 'squad') resolveAttack(next, u.id, signature.mount, act.target, undefined, cues, signature)
        else {
          u.signatureMark = { target: target.id, tile: tileOf(target), targetTurn: target.turns }
          cues.push({ kind: 'signatureWarning', unit: u.id, tile: u.signatureMark.tile, label: signature.label })
        }
      }
    } else if (act.kind === 'prepare') {
      u.windupUsed = true
      u.windup = { target: act.target, with: act.with }
      cues.push({ kind: 'prepared', unit: u.id, target: act.target })
    }
    else if (act.kind === 'wait') {
      const from = u.charge
      u.charge = Math.min(next.input.units.find((i) => i.id === u.id)!.chargeCap, u.charge + TUNING.charge.wait)
      cues.push({ kind: 'waited', unit: u.id })
      if (u.charge !== from) cues.push({ kind: 'charge', unit: u.id, from, to: u.charge, why: 'wait' })
      restart = TUNING.waitClock
    } else if (act.kind === 'tech') resolveTech(next, u.id, act.tech, act.target, cues)
    else if (act.kind === 'hack') resolveHack(next, u.id, act.terminal, cues)
    else if (act.kind === 'barrier') placeBarrier(next, u.id, act.at, cues)
    else if (act.kind === 'mend') mend(next, u.id, act.target, act.part, cues)
    else if (act.kind === 'reboot') reboot(next, u.id, act.target, cues)
    else if (act.kind === 'item') useItem(next, u.id, act, cues)
    else if (act.kind === 'talk') resolveTalk(next, u.id, act.target, cues)
    if (u.status === 'active') {
      u.facing = action.face
      cues.push({ kind: 'faced', unit: u.id, facing: action.face })
    }
    if (next.field && !next.result) {
      const here = next.field.states[keyOf(u.x, u.y)]
      if (here?.kind === 'fire') terrainHarm(next, u, 'fire', cues)
      if (liveTiles(next).has(keyOf(u.x, u.y))) terrainHarm(next, u, 'live', cues)
    }
  }
  // Surge reads whether her last turn was a Wait; only a Surge unit carries the flag.
  if (v2(next) && next.input.units.find((i) => i.id === u.id)!.stride === 'surge') {
    if (action.act.kind === 'wait' && !reached) u.waited = true
    else delete u.waited
  }
  u.clock = restart
  if (action.act.kind !== 'prepare') delete u.windup
  u.turns += 1
  if (next.v3) {
    if (next.v3.sure === u.id) next.v3.sure = null
    if (next.v3.resonating === u.id) next.v3.resonating = null
  }
  next.turn += 1
  next.active = null
  const progressAfter = objectiveProgress(next)
  if (o !== 'hold' && progressAfter.value !== progressBefore.value) cues.push({ kind: 'objective', objective: o, value: progressAfter.value, of: progressAfter.of })
  startNextTurn(next, cues)
  return { state: next, cues, error: null }
}

/** A duo technique (TC58, rules version 3): both partners strike the target from where they stand, a third harder, and
 * their pair's effect lands; it takes this turn and the partner's next. */
function duo(state: BattleState, action: DuoAction): ActionResult {
  const canStrike = (unit: string, target: string) => mountFor(state, unit, tileOf(unitById(state, unit)), target, ['melee', 'short', 'long']) !== null
  const error = duoError(state, action, canStrike)
  if (error) return { state, cues: [], error }
  const next = clone(state)
  const cues: Cue[] = []
  const partner = partnerOf(next, action.unit)!.unit
  const roles = [action.unit, partner].map((id) => roleOf(next, id))
  const tech = DUO_TECHS[duoKey(roles[0]!, roles[1]!)] ?? { name: 'Duo Strike', effect: 'power' as const }
  cues.push({ kind: 'duo', unit: action.unit, partner, target: action.target, tech: tech.name })
  for (const id of [action.unit, partner]) {
    const target = unitById(next, action.target)
    if (target.status !== 'active') break
    const u = unitById(next, id)
    const mount = mountFor(next, id, tileOf(u), action.target, ['melee', 'short', 'long'])!
    const s = strikeOf(next, id, mount, action.target, tileOf(u))!
    s.damage = Math.round((s.damage * (100 + TUNING.duo.damagePct)) / 100)
    s.critDamage = Math.round((s.critDamage * (100 + TUNING.duo.damagePct)) / 100)
    if (tech.effect === 'pierce') { s.guard = 0; s.hit = Math.min(100, s.hit + 20) }
    cues.push({ kind: 'attack', unit: id, target: action.target, with: mount, band: s.weapon.band as 'melee' | 'short' | 'long', role: 'main', facing: s.facing })
    resolveStrike(next, s, 'main', cues, ':duo')
  }
  const target = unitById(next, action.target)
  if (tech.effect === 'stun' && target.status === 'active') stun(next, target, cues)
  for (const id of [action.unit, partner]) {
    const u = unitById(next, id)
    if (u.status !== 'active') continue
    if (tech.effect === 'mend') { const hp = Math.min(u.maxHp.core, u.hp.core + TUNING.duo.mend); cues.push({ kind: 'mended', unit: action.unit, target: id, part: 'core', hp }); u.hp.core = hp }
    if (tech.effect === 'charge') gainCharge(next, u, TUNING.duo.charge, 'duo', cues)
  }
  next.v3!.spent.push(partner)
  const me = unitById(next, action.unit)
  me.clock = 0
  me.turns += 1
  next.turn += 1
  next.active = null
  startNextTurn(next, cues)
  return { state: next, cues, error: null }
}

/** A unit's role for the duo table: her Back unit's role (the rig's job), as the bench and the roster read it. */
function roleOf(state: BattleState, id: string): Role {
  const back = state.input.units.find((i) => i.id === id)!.loadout.back.kind
  return back === 'bulwark' ? 'vanguard' : back === 'thruster' ? 'striker' : back === 'launcher' ? 'gunner' : back === 'deck' ? 'netrunner' : back === 'med' ? 'medic' : 'striker'
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
