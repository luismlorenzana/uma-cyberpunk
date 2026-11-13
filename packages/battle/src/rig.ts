// The rig and its loadout (TC17, TC18; CY4): eight slots and a Coat, Load against Capacity, part HP from Stamina, Move
// from Speed, and what each broken part takes away.
import { BattleInputError } from './map'
import { TUNING } from './tuning'
import type { HandItem, Loadout, Mount, PartHp, UnitInput, UnitState, Weapon } from './types'

/** Every slot's Load added up. */
export function loadOf(loadout: Loadout): number {
  const hand = (item: HandItem | null) => item?.load ?? 0
  return loadout.core.load + loadout.leftArm.load + loadout.rightArm.load + loadout.legs.load + loadout.back.load
    + loadout.visor.load + hand(loadout.leftHand) + hand(loadout.rightHand)
}

/** Capacity: base + 2 a Power band, plus the Core's and the Back unit's bonus (TC18). */
export function capacityOf(unit: Pick<UnitInput, 'bands' | 'loadout'>): number {
  return TUNING.capacity.base + TUNING.capacity.perBand * unit.bands.power + (unit.loadout.core.capacity ?? 0) + (unit.loadout.back.capacity ?? 0)
}

/** A light rig is a fast rig: +1 Move at 70% load or less. */
export const isLight = (unit: Pick<UnitInput, 'bands' | 'loadout'>): boolean => loadOf(unit.loadout) * 100 <= capacityOf(unit) * TUNING.lightRigPct

export function maxHpOf(unit: Pick<UnitInput, 'bands' | 'loadout'>): PartHp {
  const hp = (part: keyof PartHp, bonus: number | undefined) => TUNING.partHp[part].base + TUNING.partHp[part].perBand * unit.bands.stamina + (bonus ?? 0)
  const l = unit.loadout
  return { core: hp('core', l.core.hp), leftArm: hp('leftArm', l.leftArm.hp), rightArm: hp('rightArm', l.rightArm.hp), legs: hp('legs', l.legs.hp) }
}

/** Move points this turn: Speed's band, +1 when light, the Legs' modifier; broken Legs move 1 (TC17). */
export function moveOf(input: UnitInput, state: Pick<UnitState, 'hp'>): number {
  if (state.hp.legs <= 0) return TUNING.brokenLegsMove
  return Math.max(1, TUNING.move[input.bands.speed] + (isLight(input) ? 1 : 0) + (input.loadout.legs.move ?? 0))
}

/** Evasion %: 2 a Speed band, 0 with broken Legs. */
export const evasionOf = (input: UnitInput, state: Pick<UnitState, 'hp'>): number => (state.hp.legs <= 0 ? 0 : TUNING.speedEvasion * input.bands.speed)

const armFor = (mount: 'left' | 'right'): 'leftArm' | 'rightArm' => (mount === 'left' ? 'leftArm' : 'rightArm')

/** Both arms broken: no attack and no guard (TC17). */
export const armless = (state: Pick<UnitState, 'hp'>): boolean => state.hp.leftArm <= 0 && state.hp.rightArm <= 0

export interface Armed {
  weapon: Weapon
  /** A two-handed weapon with one arm broken fires at half accuracy. */
  halfAccuracy: boolean
}

/** The weapon a mount fires now, or null: its arm must be whole (a two-handed weapon needs one of the two), a Launcher
 * needs ammo, and nothing fires with both arms broken. */
export function armed(input: UnitInput, state: Pick<UnitState, 'hp' | 'ammo'>, mount: Mount): Armed | null {
  if (armless(state)) return null
  if (mount === 'back') {
    const w = input.loadout.back
    return w.kind === 'launcher' && w.weapon && state.ammo > 0 ? { weapon: w.weapon, halfAccuracy: false } : null
  }
  const item = mount === 'left' ? input.loadout.leftHand : input.loadout.rightHand
  if (item?.kind !== 'weapon') return null
  if (item.twoHanded) return { weapon: item, halfAccuracy: state.hp.leftArm <= 0 || state.hp.rightArm <= 0 }
  return state.hp[armFor(mount)] > 0 ? { weapon: item, halfAccuracy: false } : null
}

/** The mounts that can fire now, in a fixed order (right, left, back). */
export const MOUNTS: readonly Mount[] = ['right', 'left', 'back']

/** The best Guard a whole shield arm gives, as a % cut (0 without one). */
export function guardOf(input: UnitInput, state: Pick<UnitState, 'hp'>): number {
  let best = 0
  for (const mount of ['left', 'right'] as const) {
    const item = mount === 'left' ? input.loadout.leftHand : input.loadout.rightHand
    if (item?.kind === 'shield' && state.hp[armFor(mount)] > 0) best = Math.max(best, item.guard)
  }
  return best
}

function checkWeapon(w: Weapon, path: string): void {
  const [min, max] = w.range
  if (!(Number.isSafeInteger(min) && Number.isSafeInteger(max) && min >= 1 && max >= min)) throw new BattleInputError(`${path}.range`, 'expected [min, max] with 1 ≤ min ≤ max')
  if (w.band === 'melee' && (min !== 1 || max !== 1)) throw new BattleInputError(`${path}.range`, 'a Melee weapon reaches [1, 1]')
  if (!(Number.isSafeInteger(w.hits) && w.hits >= 1 && w.hits <= 8)) throw new BattleInputError(`${path}.hits`, 'expected 1–8')
  if (w.band !== 'short' && w.hits !== 1) throw new BattleInputError(`${path}.hits`, 'only Short weapons hit more than once')
  if (!(w.power >= 1 && Number.isSafeInteger(w.power))) throw new BattleInputError(`${path}.power`, 'expected a positive integer')
  if (!(Number.isSafeInteger(w.accuracy) && w.accuracy >= 0 && w.accuracy <= 150)) throw new BattleInputError(`${path}.accuracy`, 'expected 0–150')
}

/** Refuses a rig the rules can't field: over Capacity, a two-handed weapon with something in the other hand, a Long
 * weapon in a hand, or a Launcher without its weapon and ammo. */
export function checkLoadout(unit: UnitInput, path: string): void {
  const l = unit.loadout
  for (const [hand, item] of [['leftHand', l.leftHand], ['rightHand', l.rightHand]] as const) {
    if (item?.kind === 'weapon') {
      checkWeapon(item, `${path}.loadout.${hand}`)
      if (item.band === 'long') throw new BattleInputError(`${path}.loadout.${hand}`, 'Long weapons fire from a Launcher Back unit')
      if (item.twoHanded && hand === 'leftHand') throw new BattleInputError(`${path}.loadout.leftHand`, 'a two-handed weapon goes in the right hand')
    }
    if (item?.kind === 'shield' && !(item.guard >= 0 && item.guard < 100)) throw new BattleInputError(`${path}.loadout.${hand}.guard`, 'expected 0–99')
  }
  if (l.rightHand?.kind === 'weapon' && l.rightHand.twoHanded && l.leftHand) throw new BattleInputError(`${path}.loadout.leftHand`, 'the left hand is empty under a two-handed weapon')
  if (l.back.kind === 'launcher') {
    if (!l.back.weapon || l.back.weapon.band !== 'long') throw new BattleInputError(`${path}.loadout.back.weapon`, 'a Launcher carries a Long weapon')
    checkWeapon(l.back.weapon, `${path}.loadout.back.weapon`)
    if (!(Number.isSafeInteger(l.back.ammo) && l.back.ammo! >= 1 && l.back.ammo! <= 9)) throw new BattleInputError(`${path}.loadout.back.ammo`, 'expected 1–9')
  } else if (l.back.weapon) throw new BattleInputError(`${path}.loadout.back.weapon`, 'only a Launcher carries a weapon')
  const load = loadOf(l), capacity = capacityOf(unit)
  if (load > capacity) throw new BattleInputError(`${path}.loadout`, `Load ${load} is over Capacity ${capacity}`)
}
