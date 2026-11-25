// What the unit whose turn it is may do (CY4, CY5): every tile she can reach, and from each, waiting, doing nothing, each
// attack a mount can make on a standing enemy or a thing on the map, and (rules version 2) Tech, hacks, a barrier, Mend,
// Reboot and items. The facing is free. `checkTurn` is the reducer's gate.
import { canAim, mapTarget, mapTargets, objectStrikeOf, strikeOf, tileOf, unitById } from './attack'
import { v2 } from './harm'
import { reachable, type Reach } from './move'
import { armed, MOUNTS } from './rig'
import { DIRS, inReach, sameTile, STEP } from './sight'
import { barrierError, dashError, itemError, mendError, rebootError } from './support'
import { hackError, techError } from './tech'
import { talkError } from './talk'
import { boardOf } from './terrain'
import { inputOf } from './timeline'
import { fireModes, modeCost, modeWeapon } from './specialists'
import type { Act, BattleState, ItemKind, Tile, TurnAction } from './types'
import { PARTS } from './types'

export interface LegalTurn {
  to: Tile
  path: Tile[]
  dash?: boolean
  act: Act
}

const at = <S extends Pick<BattleState, 'input' | 'units' | 'field'>>(state: S, unitId: string, to: Tile): S =>
  ({ ...state, units: state.units.map((x) => (x.id === unitId ? { ...x, x: to[0], y: to[1] } : x)) })

/** The attacks a unit could make from a tile: standing enemies, then (rules version 2) barrels, pipes and barriers. */
export function attacksFrom(state: Pick<BattleState, 'input' | 'units' | 'field'>, unitId: string, from: Tile): Act[] {
  const u = unitById(state, unitId), input = inputOf(state, unitId)
  const board = boardOf(state)
  const out: Act[] = []
  for (const mount of MOUNTS) {
    const arm = armed(input, u, mount)
    if (!arm) continue
    const modes = fireModes(input, mount, state.input.rulesVersion)
      .filter((mode) => u.charge >= modeCost(mode))
      .map((mode) => ({ mode, weapon: modeWeapon(state, unitId, mount, arm.weapon, mode)! }))
    for (const t of state.units) {
      if (t.side === u.side || t.status !== 'active') continue
      if (inReach(board, arm.weapon, from, tileOf(t))) out.push({ kind: 'attack', with: mount, target: t.id })
      for (const { mode, weapon } of modes) {
        if (inReach(board, weapon, from, tileOf(t))) {
          out.push({ kind: 'attack', with: mount, target: t.id, mode })
        }
      }
    }
    for (const t of mapTargets(state)) {
      if (!inReach(board, arm.weapon, from, t.tile)) continue
      out.push({ kind: 'attack', with: mount, target: t.id })
      if (modes.some(({ mode }) => mode === 'thermal')) out.push({ kind: 'attack', with: mount, target: t.id, mode: 'thermal' })
    }
  }
  return out
}

/** Rules version 2's other actions from a tile. Smoke charges are offered on her own tile and each standing enemy's. */
export function supportFrom(state: BattleState, unitId: string, from: Tile): Act[] {
  if (!v2(state)) return []
  const placed = at(state, unitId, from)
  const out: Act[] = []
  const u = unitById(state, unitId)
  const input = inputOf(state, unitId), signature = input.signature
  const signatureArm = signature && !u.signatureUsed && u.charge >= signature.charge ? armed(input, u, signature.mount) : null
  for (const { target, actor } of state.input.talk ?? [])
    if (actor === unitId && !talkError(placed, unitId, target, from)) out.push({ kind: 'talk', target })
  for (const t of state.units) {
    if (signature && signatureArm && t.side !== u.side && t.status === 'active' && inReach(boardOf(placed), signatureArm.weapon, from, tileOf(t)))
      out.push({ kind: 'attack', with: signature.mount, target: t.id, signature: true })
    for (const tech of ['stun', 'jam', 'jackout'] as const) if (!techError(placed, unitId, tech, t.id, from)) out.push({ kind: 'tech', tech, target: t.id })
    for (const part of PARTS) if (!mendError(placed, unitId, t.id, part, from)) out.push({ kind: 'mend', target: t.id, part })
    if (!rebootError(placed, unitId, t.id, from)) out.push({ kind: 'reboot', target: t.id })
  }
  for (const p of state.input.map.props ?? []) if (p.kind === 'terminal' && !hackError(placed, unitId, p.id, from)) out.push({ kind: 'hack', terminal: p.id })
  for (const d of DIRS) {
    const tile: Tile = [from[0] + STEP[d][0], from[1] + STEP[d][1]]
    if (!barrierError(placed, unitId, tile, from)) out.push({ kind: 'barrier', at: tile })
  }
  if (u.side === 'squad' && state.field) {
    for (const item of ['repair', 'patch', 'cell'] as ItemKind[]) {
      for (const t of state.units) {
        if (item === 'patch') {
          for (const part of ['leftArm', 'rightArm', 'legs'] as const) if (!itemError(placed, unitId, { item, target: t.id, part }, from)) out.push({ kind: 'item', item, target: t.id, part })
        } else if (!itemError(placed, unitId, { item, target: t.id }, from)) out.push({ kind: 'item', item, target: t.id })
      }
    }
    const spots = [from, ...state.units.filter((t) => t.side !== u.side && t.status === 'active').map(tileOf)]
    for (const s of spots) if (!itemError(placed, unitId, { item: 'smoke', at: s }, from)) out.push({ kind: 'item', item: 'smoke', at: s })
  }
  return out
}

/** Every legal turn for the active unit, without the facing (any of the four); Dash turns are listed too. */
export function legalTurns(state: BattleState): LegalTurn[] {
  if (!state.active || state.result) return []
  const out: LegalTurn[] = []
  const id = state.active
  const dashes = v2(state) && !dashError(state, id) ? [false, true] : [false]
  for (const dash of dashes) {
    const charged = dash ? { ...state, units: state.units.map((x) => (x.id === id ? { ...x, charge: x.charge - 1 } : x)) } : state
    for (const r of reachable(state, id, { dash })) {
      if (dash && reachable(state, id).some((n) => sameTile(n.to, r.to))) continue
      const extra = dash ? { dash: true } : {}
      out.push({ to: r.to, path: r.path, ...extra, act: { kind: 'none' } }, { to: r.to, path: r.path, ...extra, act: { kind: 'wait' } })
      for (const act of attacksFrom(at(charged, id, r.to), id, r.to)) out.push({ to: r.to, path: r.path, ...extra, act })
      for (const act of supportFrom(charged, id, r.to)) out.push({ to: r.to, path: r.path, ...extra, act })
    }
  }
  return out
}

/** The move a turn makes, or an error: the unit must be the active one, the tile reachable, the action legal from there
 * and the facing one of the four. */
export function checkTurn(state: BattleState, action: TurnAction): { reach: Reach } | { error: string } {
  if (state.result) return { error: 'the battle is over' }
  if (action.unit !== state.active) return { error: `it is not ${action.unit}'s turn` }
  if (!DIRS.includes(action.face)) return { error: `unknown facing ${String(action.face)}` }
  const u = unitById(state, action.unit)
  if (action.dash) {
    if (!v2(state)) return { error: 'no Dash in rules version 1' }
    const e = dashError(state, action.unit)
    if (e) return { error: e }
  }
  const to = action.to ?? tileOf(u)
  const reach = reachable(state, action.unit, { dash: !!action.dash }).find((r) => sameTile(r.to, to))
  if (!reach) return { error: `${action.unit} can't reach ${to[0]},${to[1]}` }
  // The board as it stands after the move, with Dash's Charge spent.
  const placed = { ...at(state, action.unit, to), units: at(state, action.unit, to).units.map((x) => (x.id === action.unit && action.dash ? { ...x, charge: x.charge - 1 } : x)) }
  const declared = action.act
  if (declared.kind === 'prepare' && (state.input.rulesVersion < 5 || inputOf(state, action.unit).specialty?.kind !== 'windup'
    || u.windupUsed || u.suppressed || !state.units.some((unit) => unit.id === declared.target && unit.side !== u.side && unit.status === 'active'))) {
    return { error: 'Cannot prepare that shot' }
  }
  const act = declared.kind === 'prepare' ? { ...declared, kind: 'attack' as const, aim: undefined, mode: undefined } : declared
  if (act.kind === 'attack') {
    if (action.act.mode) return 'Choose a signature or a firing mode'
    const signature = inputOf(state, action.unit).signature
    if (act.signature !== undefined && (act.signature !== true || !signature || signature.mount !== act.with || u.signatureUsed
      || unitById(placed, u.id).charge < signature.charge || act.aim || !state.units.some(t => t.id === act.target))) {
      return { error: 'Signature unavailable' }
    }
    const arm = armed(inputOf(state, action.unit), u, act.with)
    if (!arm) return { error: `${action.unit} can't fire ${act.with}` }
    const weapon = modeWeapon(state, action.unit, act.with, arm.weapon, act.mode)
    if (!weapon) return { error: 'That firing mode is unavailable' }
    if (act.mode && unitById(placed, action.unit).charge < modeCost(act.mode)) return { error: 'Insufficient Charge for this shot' }
    if (act.aim && (act.mode === 'area' || act.mode === 'suppress')) return { error: 'Area attacks cannot aim at a part' }
    const t = state.units.find((x) => x.id === act.target)
    if (!t) {
      const thing = v2(state) ? mapTarget(state, act.target) : undefined
      if (!thing) return { error: `${act.target} isn't a standing enemy` }
      if (act.mode && act.mode !== 'thermal') return { error: 'This mode targets enemy units' }
      if (act.aim) return { error: 'things on the map take no aim' }
      if (!inReach(boardOf(state), weapon, to, thing.tile)) return { error: `${act.target} is out of reach` }
      return objectStrikeOf(placed, action.unit, act.with, act.target, to, act.mode) ? { reach } : { error: 'no strike' }
    }
    if (t.side === u.side || t.status !== 'active') return { error: `${act.target} isn't a standing enemy` }
    if (!inReach(boardOf(state), weapon, to, tileOf(t))) return { error: `${act.target} is out of reach` }
    if (act.aim) {
      if (!canAim(state, action.unit)) return { error: `${action.unit} can't aim` }
      if (act.aim === 'hold') {
        if (!v2(state) || !t.holdHp) return { error: `${act.target} has no Hold to aim at` }
      } else if (t.hp[act.aim] <= 0) return { error: `${act.target}'s ${act.aim} is already broken` }
    }
    if (!strikeOf(placed, action.unit, act.with, act.target, to, { mode: act.mode })) return { error: 'no strike' }
    return { reach }
  }
  if (act.kind === 'wait' || act.kind === 'none') return { reach }
  if (!v2(state)) return { error: 'unknown action' }
  const error =
    act.kind === 'tech' ? techError(placed, action.unit, act.tech, act.target, to)
      : act.kind === 'hack' ? hackError(placed, action.unit, act.terminal, to)
        : act.kind === 'barrier' ? barrierError(placed, action.unit, act.at, to)
          : act.kind === 'mend' ? mendError(placed, action.unit, act.target, act.part, to)
            : act.kind === 'reboot' ? rebootError(placed, action.unit, act.target, to)
              : act.kind === 'item' ? itemError(placed, action.unit, act, to)
                : act.kind === 'talk' && placed.input.rulesVersion >= 5 ? talkError(placed, action.unit, act.target, to)
                  : 'unknown action'
  return error ? { error } : { reach }
}
