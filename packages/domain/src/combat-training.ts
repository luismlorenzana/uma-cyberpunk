import type { CombatSubclass, Loadout, UnitInput } from '@cyber/battle'
import { issuedCampaignRig } from './campaign-gear'
import { loadoutOf, type Rig } from './crew/parts'
import type { Save } from './save/save'

export const SUBCLASS_NAME: Record<CombatSubclass, string> = {
  melee: 'Melee', heal: 'Heal', shield: 'Shield', long: 'Long', support: 'Support',
}
export const COMBAT_SUBCLASSES = Object.keys(SUBCLASS_NAME) as CombatSubclass[]
export type FormationRole = 'laser' | 'wing' | 'shield' | 'sniper' | 'medic'
export const FORMATION_ROLES: readonly FormationRole[] = ['laser', 'wing', 'shield', 'sniper', 'medic']
export const FORMATION_NAME: Record<FormationRole, string> = {
  laser: 'Laser', wing: 'Wing', shield: 'Shield', sniper: 'Sniper', medic: 'Medic',
}
export interface FormationMember {
  role: FormationRole
  outfit?: number
  heroine?: string
  requires?: string
}
export type GroundCombat = { kind: 'uma' } | { kind: 'combined'; members: FormationMember[]; windups: string[] }

export interface CombatTraining { rank: number; subclass: CombatSubclass | null; focused?: true }

export function trainingOf(save: Pick<Save, 'combatTraining'>, outfit: number, shifted = false): CombatTraining {
  const record = save.combatTraining?.[outfit] ?? { rank: 1, subclass: null }
  return shifted || record.focused ? { ...record, rank: Math.max(6, record.rank), subclass: null } : { ...record, rank: Math.min(5, record.rank) }
}

export function chooseSubclass(save: Save, outfit: number, subclass: CombatSubclass | null): Save {
  if (!save.crew.some((member) => member.outfit === outfit && !member.heroine) || save.combatTraining?.[outfit]?.focused) return save
  const current = save.combatTraining?.[outfit] ?? { rank: 1, subclass: null }
  return { ...save, combatTraining: { ...save.combatTraining, [outfit]: { ...current, subclass } } }
}

/** Advance only deployed Laser specialists, once per settled successful encounter. */
export function advanceCombatTraining(save: Save, units: readonly UnitInput[]): Save {
  const training = { ...save.combatTraining }
  let changed = false
  for (const unit of units) {
    if (unit.side !== 'squad' || unit.ref?.kind !== 'uma' || unit.specialty?.kind !== 'laser') continue
    const outfit = Number(unit.ref.id)
    if (!save.crew.some((member) => member.outfit === outfit)) continue
    const current = training[outfit] ?? { rank: 1, subclass: null }
    const rank = Math.max(current.rank, Math.min(unit.specialty.rank < 6 ? 5 : 10, unit.specialty.rank + 1))
    if (rank === current.rank) continue
    training[outfit] = { ...current, rank }
    changed = true
  }
  return changed ? { ...save, combatTraining: training } : save
}

interface CombatFitting { rig: Rig; loadout: Loadout; specialty: NonNullable<UnitInput['specialty']> }

const withHand = (loadout: Loadout, power: number, accuracy: number, hits?: number): Loadout => {
  const weapon = loadout.rightHand
  if (weapon?.kind !== 'weapon') return loadout
  return { ...loadout, rightHand: { ...weapon, power, accuracy, ...(hits === undefined ? {} : { hits }) } }
}

export function laserFitting(progress: CombatTraining, alternate = false, expansion?: string): CombatFitting {
  const back = expansion ?? (progress.subclass === 'shield' ? 'back-bulwark'
    : progress.subclass === 'support' ? 'back-deck' : progress.subclass === 'long' ? 'back-sniper' : null)
  const blade = alternate && progress.subclass === 'melee'
  const shield = alternate && progress.subclass === 'shield'
  const halfLong = !expansion && progress.subclass === 'long'
  const rig: Rig = { ...issuedCampaignRig(blade ? 'hand-greatblade' : shield ? 'hand-blade' : 'hand-rifle'), back,
    ...(shield ? { leftHand: 'hand-buckler' } : {}),
    ...(halfLong ? { legs: 'legs-light', visor: 'visor-basic' } : {}) }
  let loadout = loadoutOf(rig)
  const rank = progress.rank
  if (blade) loadout = withHand(loadout, 12, 83)
  else if (!shield) loadout = withHand(loadout, rank >= 8 ? 8 : rank >= 4 ? 7 : 6, rank >= 9 ? 80 : rank >= 3 ? 78 : 75)
  if (halfLong && loadout.back.weapon) {
    loadout.back = { ...loadout.back, load: 3, ammo: 2, weapon: { ...loadout.back.weapon, power: 13, range: [4, 6] } }
  }
  return { rig, loadout, specialty: { kind: 'laser', rank, ...(progress.subclass ? { subclass: progress.subclass } : {}) } }
}

export function specialistFitting(role: Exclude<FormationRole, 'laser'>, slot: number): CombatFitting {
  const rig = role === 'wing' ? issuedCampaignRig(slot === 0 ? 'hand-greatblade' : 'hand-arc-axe', 'back-thruster')
    : role === 'shield' ? { ...issuedCampaignRig('hand-blade', 'back-bulwark'), leftHand: 'hand-tower' }
      : issuedCampaignRig('hand-pistol', role === 'medic' ? 'back-med' : 'back-sniper')
  let loadout = loadoutOf(rig)
  if (role === 'wing') {
    loadout = withHand(loadout, slot === 0 ? 16 : 15, slot === 0 ? 84 : 90)
    if (loadout.rightHand?.kind === 'weapon') loadout.rightHand = { ...loadout.rightHand, crit: 0 }
  }
  if (role === 'medic') loadout = withHand(loadout, 4, 82, 2)
  if (role === 'sniper' && loadout.back.weapon) {
    loadout = withHand(loadout, 3, 80, 2)
    loadout.back = { ...loadout.back, ammo: 4, weapon: { ...loadout.back.weapon!, range: [4, 7] } }
  }
  return { rig, loadout, specialty: { kind: role } }
}
