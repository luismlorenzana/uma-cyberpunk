import { spendCharge, tileOf, unitById } from './harm'
import { distance } from './sight'
import { inputOf } from './timeline'
import { COMBAT_SUBCLASSES, type BattleState, type Cue, type FireMode, type Mount, type Specialty, type UnitInput, type UnitState, type Weapon } from './types'

export const FIRE_MODE_LABEL: Record<FireMode, string> = {
  thermal: 'Thermal', impact: 'Impact', area: 'Area', suppress: 'Suppress',
}
type BattleUnits = Pick<BattleState, 'input' | 'units'>

export function validSpecialty(value: Specialty, unit: UnitInput): boolean {
  switch (value?.kind) {
    case 'laser':
      return unit.side === 'squad' && Number.isInteger(value.rank) && value.rank >= 1 && value.rank <= 10
        && (value.subclass === undefined || (value.rank <= 5 && COMBAT_SUBCLASSES.includes(value.subclass)))
    case 'sniper':
      return unit.side === 'squad' && unit.loadout.back.weapon?.band === 'long'
    case 'medic':
      return unit.side === 'squad' && unit.loadout.back.kind === 'med'
    case 'wing':
      return unit.side === 'squad' && unit.loadout.back.kind === 'thruster'
    case 'shield':
      return unit.side === 'squad' && (unit.loadout.leftHand?.kind === 'shield' || unit.loadout.rightHand?.kind === 'shield')
    case 'windup':
      return unit.side === 'enemy'
    default:
      return false
  }
}

export function fireModes(input: UnitInput, mount: Mount, version: number): FireMode[] {
  if (version < 5) return []
  const role = input.specialty
  if (role?.kind === 'sniper' && mount === 'back') return ['suppress']
  const hand = input.loadout.rightHand
  if (role?.kind !== 'laser' || mount !== 'right' || hand?.kind !== 'weapon' || hand.band !== 'short' || !hand.twoHanded) return []
  const modes: FireMode[] = []
  if (role.rank >= 2) modes.push('thermal')
  if (role.rank >= 3) modes.push('impact')
  if (role.rank >= 5) modes.push('area')
  return modes
}

export const modeCost = (mode: FireMode): number => mode === 'suppress' ? 2 : 1

/** The modes replace the main shot only. Counters and Crossfire continue using the frozen fitted profiles. */
export function modeWeapon(state: BattleUnits, id: string, mount: Mount, base: Weapon, mode: FireMode | undefined): Weapon | null {
  if (!mode) return base
  const input = inputOf(state, id)
  if (!fireModes(input, mount, state.input.rulesVersion).includes(mode)) return null
  const full = input.specialty?.kind === 'laser' && input.specialty.rank >= 6
  if (mode === 'suppress') return { ...base, power: 8, type: 'I', accuracy: 82 }
  if (mode === 'area') return { ...base, power: full ? 14 : 12, type: 'P', hits: 1, blast: 1, range: [2, 3] }
  return { ...base, power: full ? 7 : 6, hits: 2, type: mode === 'thermal' ? 'F' : 'I', accuracy: mode === 'thermal' ? 80 : 84 }
}

export function quickPatchTargets(state: BattleState, actor: string): UnitState[] {
  if (state.result || state.active !== actor || state.input.rulesVersion < 5) return []
  const unit = unitById(state, actor)
  const role = inputOf(state, actor).specialty
  if (role?.kind !== 'laser' || role.subclass !== 'heal' || unit.patched || unit.charge < 1) return []
  return state.units.filter((target) => target.side === unit.side && target.status === 'active'
    && target.hp.core < target.maxHp.core && distance(tileOf(unit), tileOf(target)) <= 1)
}

export function quickPatch(state: BattleState, actor: string, targetId: string, cues: Cue[]): void {
  const unit = unitById(state, actor), target = unitById(state, targetId)
  spendCharge(unit, 1, 'patch', cues)
  unit.patched = true
  target.hp.core = Math.min(target.maxHp.core, target.hp.core + 6)
  cues.push({ kind: 'mended', unit: actor, target: targetId, part: 'core', hp: target.hp.core })
}

export function suppressionTargets(state: BattleUnits, target: UnitState): UnitState[] {
  return state.units.filter((unit) => unit.side === target.side && unit.status === 'active'
    && distance(tileOf(unit), tileOf(target)) <= 1)
}

export function applyModeEffect(state: BattleState, actor: string, targetId: string, mode: FireMode | undefined, hits: number, cues: Cue[]): void {
  if (!mode || hits === 0) return
  const target = unitById(state, targetId)
  if (mode === 'impact' && target.status === 'active' && target.charge > 0) spendCharge(target, 1, 'jam', cues)
  if (mode !== 'suppress') return
  for (const unit of suppressionTargets(state, target)) {
    const interrupted = !!unit.windup
    delete unit.windup
    unit.suppressed = true
    cues.push({ kind: 'suppressed', unit: actor, target: unit.id, interrupted })
  }
}
