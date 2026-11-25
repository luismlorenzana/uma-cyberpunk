// The Back units' actions, items and the bench support call (TC5, TC22, TC27; CY5, rules version 2).
import { harm, gainCharge, spendCharge, tileOf, unitById } from './harm'
import { distance } from './sight'
import { boardOf, cross, keyOf, setState } from './terrain'
import { inputOf } from './timeline'
import { TUNING } from './tuning'
import type { BattleState, Cue, ItemKind, PartId, Role, Tile, UnitState } from './types'

const backOf = (state: Pick<BattleState, 'input'>, id: string) => inputOf(state, id).loadout.back.kind
const empty = (state: Pick<BattleState, 'input' | 'units' | 'field'>, t: Tile, except?: string) =>
  boardOf(state).open(t[0], t[1]) && !state.units.some((u) => u.id !== except && (u.status === 'active' || u.status === 'down') && u.x === t[0] && u.y === t[1])
const adjacent = (a: Tile, b: Tile) => distance(a, b) === 1

// --- Bulwark ----------------------------------------------------------------------------------------------------------

export function barrierError(state: Pick<BattleState, 'input' | 'units' | 'field'>, unitId: string, at: Tile, from: Tile): string | null {
  if (backOf(state, unitId) !== 'bulwark') return `${unitId} has no Bulwark`
  if (unitById(state, unitId).charge < TUNING.back.barrier) return `${unitId} needs ${TUNING.back.barrier} Charge`
  if (!adjacent(at, from)) return 'a barrier goes on an adjacent tile'
  if (!empty(state, at, unitId)) return 'that tile is taken'
  return null
}

export function placeBarrier(state: BattleState, unitId: string, at: Tile, cues: Cue[]): void {
  const field = state.field!
  spendCharge(unitById(state, unitId), TUNING.back.barrier, 'barrier', cues)
  const id = `barrier-${field.nextBarrier++}`
  const role = inputOf(state, unitId).specialty
  const hp = role?.kind === 'laser' && role.subclass === 'shield' ? Math.floor(TUNING.back.barrierHp / 2) : TUNING.back.barrierHp
  field.barriers.push({ id, x: at[0], y: at[1], hp })
  cues.push({ kind: 'barrier', unit: unitId, id, at })
}

// --- Thruster: Dash is part of the move (move.ts); its Charge is spent here ------------------------------------------

export function dashError(state: Pick<BattleState, 'input' | 'units'>, unitId: string): string | null {
  if (backOf(state, unitId) !== 'thruster') return `${unitId} has no Thruster`
  if (unitById(state, unitId).charge < TUNING.back.dash) return `${unitId} needs ${TUNING.back.dash} Charge to Dash`
  return null
}

// --- Med --------------------------------------------------------------------------------------------------------------

/** What Mend or a patch does to a part: Core HP back (up to full), or a broken arm or Legs mended at 25%. */
function mendPart(u: UnitState, part: PartId, coreHp: number, pct: number): number | null {
  if (part === 'core') return u.hp.core > 0 && u.hp.core < u.maxHp.core ? Math.min(u.maxHp.core, u.hp.core + coreHp) : null
  return u.hp[part] <= 0 ? Math.max(1, Math.floor((u.maxHp[part] * pct) / 100)) : null
}

export function mendError(state: Pick<BattleState, 'input' | 'units'>, unitId: string, targetId: string, part: PartId, from: Tile): string | null {
  if (backOf(state, unitId) !== 'med') return `${unitId} has no Med unit`
  if (unitById(state, unitId).charge < TUNING.back.mend) return `${unitId} needs ${TUNING.back.mend} Charge`
  const t = state.units.find((u) => u.id === targetId)
  if (!t || t.side !== unitById(state, unitId).side || t.status !== 'active') return `${targetId} isn't a standing ally`
  if (!(t.id === unitId ? true : adjacent(from, tileOf(t)))) return 'Mend reaches an adjacent ally'
  if (mendPart(t, part, TUNING.back.mendCore, TUNING.back.mendPartPct) === null) return `nothing to mend on ${targetId}'s ${part}`
  return null
}

export function mend(state: BattleState, unitId: string, targetId: string, part: PartId, cues: Cue[], why: 'mend' | 'item' = 'mend'): void {
  const t = unitById(state, targetId)
  if (why === 'mend') spendCharge(unitById(state, unitId), TUNING.back.mend, 'mend', cues)
  const coreHp = why === 'mend' ? TUNING.back.mendCore : TUNING.items.repairCore
  const pct = why === 'mend' ? TUNING.back.mendPartPct : TUNING.items.patchPct
  t.hp[part] = mendPart(t, part, coreHp, pct)!
  cues.push({ kind: 'mended', unit: unitId, target: targetId, part, hp: t.hp[part] })
}

export function rebootError(state: Pick<BattleState, 'input' | 'units'>, unitId: string, targetId: string, from: Tile): string | null {
  if (backOf(state, unitId) !== 'med') return `${unitId} has no Med unit`
  if (unitById(state, unitId).charge < TUNING.back.reboot) return `${unitId} needs ${TUNING.back.reboot} Charge`
  const t = state.units.find((u) => u.id === targetId)
  if (!t || t.side !== unitById(state, unitId).side || t.status !== 'down') return `${targetId} isn't a kneeling ally`
  if (!adjacent(from, tileOf(t))) return 'Reboot reaches an adjacent ally'
  return null
}

/** A Rig Broken ally inside her window stands again at 25% Core, limbs still broken (TC25). */
export function reboot(state: BattleState, unitId: string, targetId: string, cues: Cue[]): void {
  spendCharge(unitById(state, unitId), TUNING.back.reboot, 'reboot', cues)
  const t = unitById(state, targetId)
  t.status = 'active'
  t.hp.core = Math.max(1, Math.floor((t.maxHp.core * TUNING.back.rebootCorePct) / 100))
  cues.push({ kind: 'rebooted', unit: unitId, target: targetId })
}

// --- Items ------------------------------------------------------------------------------------------------------------

export function itemError(state: Pick<BattleState, 'input' | 'units' | 'field'>, unitId: string, act: { item: ItemKind; target?: string; part?: PartId; at?: Tile }, from: Tile): string | null {
  const field = state.field
  const u = unitById(state, unitId)
  if (!field || u.side !== 'squad') return 'only the squad carries items'
  if ((field.items[act.item] ?? 0) <= 0) return `no ${act.item} left`
  if (act.item === 'smoke') return act.at && inBoundsOpen(state, act.at) && distance(from, act.at) <= TUNING.items.smokeRange ? null : 'a smoke charge goes on a tile in range 3'
  const t = state.units.find((x) => x.id === (act.target ?? unitId))
  if (!t || t.side !== u.side || t.status !== 'active') return 'an item goes to her or a standing ally'
  if (t.id !== unitId && !adjacent(from, tileOf(t))) return 'an item reaches an adjacent ally'
  if (act.item === 'repair' && mendPart(t, 'core', TUNING.items.repairCore, 0) === null) return 'her Core is full'
  if (act.item === 'patch' && (!act.part || act.part === 'core' || mendPart(t, act.part, 0, TUNING.items.patchPct) === null)) return 'a patch mends a broken arm or Legs'
  if (act.item === 'cell' && t.charge >= inputOf(state, t.id).chargeCap) return 'her Charge is full'
  return null
}

const inBoundsOpen = (state: Pick<BattleState, 'input'>, t: Tile) => t[0] >= 0 && t[1] >= 0 && t[0] < state.input.map.width && t[1] < state.input.map.depth

export function useItem(state: BattleState, unitId: string, act: { item: ItemKind; target?: string; part?: PartId; at?: Tile }, cues: Cue[]): void {
  const field = state.field!
  field.items[act.item] -= 1
  const target = act.target ?? unitId
  cues.push({ kind: 'item', unit: unitId, item: act.item, ...(act.item === 'smoke' ? { at: act.at } : { target }) })
  if (act.item === 'smoke') return setState(state, cross(act.at!), 'smoke', cues)
  if (act.item === 'repair') return mend(state, unitId, target, 'core', cues, 'item')
  if (act.item === 'patch') return mend(state, unitId, target, act.part!, cues, 'item')
  gainCharge(state, unitById(state, target), TUNING.items.cell, 'item', cues)
}

// --- The bench support call -------------------------------------------------------------------------------------------

export function benchError(state: Pick<BattleState, 'input' | 'units' | 'field' | 'active' | 'result'>, unitId: string, role: Role, at: Tile): string | null {
  if (state.result) return 'the battle is over'
  if (!state.field) return 'no bench in this battle'
  if (unitId !== state.active || unitById(state, unitId).side !== 'squad') return `it is not ${unitId}'s turn`
  if (state.field.benchUsed) return 'the bench has already been called'
  if (!(state.input.bench ?? []).includes(role)) return `no ${role} on the bench`
  if (!inBoundsOpen(state, at)) return 'off the map'
  if (role === 'vanguard' && !empty(state, at)) return 'that tile is taken'
  return null
}

const area = (at: Tile): Tile[] => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [at[0] + dx, at[1] + dy] as const))

/** One call a battle (TC27): Vanguard a barrier, Striker a strike on one tile, Gunner a mortar on a 3 × 3 area, Netrunner
 * a scan, Medic a repair drop on a 3 × 3 area. Fixed numbers, no rolls. */
export function callBench(state: BattleState, unitId: string, role: Role, at: Tile, cues: Cue[]): void {
  const field = state.field!
  field.benchUsed = true
  cues.push({ kind: 'bench', unit: unitId, role, at })
  const standing = (tiles: Tile[]) => state.units.filter((u) => u.status === 'active' && tiles.some((t) => t[0] === u.x && t[1] === u.y))
  if (role === 'vanguard') {
    const id = `barrier-${field.nextBarrier++}`
    field.barriers.push({ id, x: at[0], y: at[1], hp: TUNING.back.barrierHp })
    cues.push({ kind: 'barrier', unit: unitId, id, at })
  } else if (role === 'striker' || role === 'gunner') {
    const amount = role === 'striker' ? TUNING.bench.strike : TUNING.bench.mortar
    const by = role === 'striker' ? 'strike' : 'mortar'
    for (const u of standing(role === 'striker' ? [at] : area(at))) harm(state, u, 'core', amount, cues, (broke) => ({ kind: 'burn', unit: u.id, part: 'core', amount, by, broke }))
  } else if (role === 'netrunner') cues.push({ kind: 'scan', unit: unitId })
  else {
    for (const u of standing(area(at))) {
      if (u.side !== 'squad' || u.hp.core >= u.maxHp.core) continue
      u.hp.core = Math.min(u.maxHp.core, u.hp.core + TUNING.bench.drop)
      cues.push({ kind: 'mended', unit: unitId, target: u.id, part: 'core', hp: u.hp.core })
    }
  }
}

export { keyOf }
