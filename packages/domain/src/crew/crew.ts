// The crew (CY11, TC4, TC5, TC27, TC45, TC46): the one master-data adapter (5★ stats to bands, the best running style to
// Stride and the fallback role), a crew member's record in the save, "best for her role", the rig's numbers for the
// Hangar, and Strain. Every rule number comes from `@cyber/battle`; nothing here recomputes Load, Capacity or Move.
import { bandOf, capacityOf, isLight, loadOf, maxHpOf, moveOf, TUNING, type Bands, type Loadout, type Role, type Stride, type Weapon } from '@cyber/battle'
import type { AptitudeGrade, Stats, Strategy } from '@luismlorenzana/uma-data'
import { emptyCabin, type Cabin } from '../cabins/items'
import type { HeldPost } from '../ship/duties'
import { newBond, type Bond } from './bonds'
import { BACK_ROLE, loadoutOf, PARTS_BY_ID, partsFor, ROLE_BACK, rigProblem, type Part, type Rig } from './parts'

export const ROLES: readonly Role[] = ['vanguard', 'striker', 'gunner', 'netrunner', 'medic']
export const ROLE_NAME: Record<Role, string> = { vanguard: 'Vanguard', striker: 'Striker', gunner: 'Gunner', netrunner: 'Netrunner', medic: 'Medic' }
export const ROLE_PLAYS: Record<Role, string> = {
  vanguard: 'Holds the line, shields, Cover', striker: 'Fast melee, flanks, starts Crossfire', gunner: 'Long range, height, Aim',
  netrunner: 'Hacks heroines, hardware and terminals', medic: 'Mends and reboots',
}

/** What the game reads of an outfit: her 5★ stats and her running-style grades. From master data, or the stand-in table
 * for invented ids; null when neither has her (she plays at band 3 with no Stride). */
export interface OutfitInfo { stats: Stats; strategy: Record<Strategy, AptitudeGrade> }

const STYLES: readonly Strategy[] = ['front', 'pace', 'late', 'end']
const GRADES: readonly AptitudeGrade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
export const STYLE_NAME: Record<Strategy, string> = { front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer' }
/** TC46: her best running style's Stride. */
export const STYLE_STRIDE: Record<Strategy, Stride> = { front: 'break', pace: 'draft', late: 'surge', end: 'kick' }
export const STRIDE_NAME: Record<Stride, string> = { break: 'Break', draft: 'Draft', surge: 'Surge', kick: 'Kick' }
export const STRIDE_DOES: Record<Stride, string> = {
  break: '+1 Move on her first turn', draft: '+1 Move when she ends next to an ally', surge: '+1 Move on the turn after she Waits',
  kick: '+2 Move while her Core is at half or less',
}
/** TC5's fallback when the story tags no role (D15): the running style's nearest job. Medic comes only from a tag or a
 * change aboard. */
export const STYLE_ROLE: Record<Strategy, Role> = { front: 'striker', pace: 'vanguard', late: 'gunner', end: 'netrunner' }

/** TC4's adapter: each 5★ stat to its band. */
export const bandsOf = (stats: Stats): Bands =>
  ({ speed: bandOf(stats.speed), stamina: bandOf(stats.stamina), power: bandOf(stats.power), guts: bandOf(stats.guts), wit: bandOf(stats.wit) })
export const STAND_IN_BANDS: Bands = { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 }

/** Her best running style: the best grade, ties to the earlier style (TC46). */
export function bestStyle(strategy: Record<Strategy, AptitudeGrade>): Strategy {
  let best: Strategy = 'front'
  for (const s of STYLES) if (GRADES.indexOf(strategy[s]) < GRADES.indexOf(strategy[best])) best = s
  return best
}

/** Her default role (TC5): the story's authored tag, else her running style's, else Striker. */
export function defaultRole(tag: Role | undefined, info: OutfitInfo | null): Role {
  if (tag) return tag
  return info ? STYLE_ROLE[bestStyle(info.strategy)] : 'striker'
}

// --- The record --------------------------------------------------------------------------------------------------------

export interface Preset { name: string; rig: Rig }

/** A crew member in the save (v4–v6): her outfit, XP, role and rig once the player sets them, three saved loadouts, Strain,
 * from v5 her bond, and from v6 her cabin. */
export interface CrewMember {
  outfit: number
  xp: number
  /** Null: her default role (`defaultRole`). */
  role: Role | null
  /** Null: "best for her role", until the player builds one in the Hangar. */
  rig: Rig | null
  /** Up to three, named by the player. */
  presets: Preset[]
  /** 0–3: at 3 she sits the next mission out, which clears it (TC27). */
  strain: number
  /** Her bond with the captain (CY13). */
  bond: Bond
  /** Her cabin: its slots, what she's revealed of her tastes, a request (CY14). */
  cabin: Cabin
  /** Her post aboard (CY16), held until changed: the module and post, the watch she took it, her mastery there. */
  post: HeldPost | null
}

export const MAX_PRESETS = 3
export const STRAIN_REST = 3
export const PRESET_NAME_MAX = 24

export const newMember = (outfit: number): CrewMember => ({ outfit, xp: 0, role: null, rig: null, presets: [], strain: 0, bond: newBond(), cabin: emptyCabin(), post: null })

/** Her level: 1 + one a hundred XP, to 50. A placeholder curve until Phase 5's economy; levels change no numbers yet. */
export const levelOf = (xp: number): number => Math.min(50, 1 + Math.floor(xp / 100))
export const resting = (m: CrewMember): boolean => m.strain >= STRAIN_REST

export const roleOf = (m: CrewMember, tag: Role | undefined, info: OutfitInfo | null): Role => m.role ?? defaultRole(tag, info)
export const rigOf = (m: CrewMember, role: Role, bands: Bands): Rig => m.rig ?? bestRig(role, bands)

/** A role change aboard: her rig keeps every part but the Back unit, which becomes the new role's starter unless she
 * already wears one of its kind. */
export function changeRole(m: CrewMember, role: Role, current: Rig): CrewMember {
  const back = current.back ? PARTS_BY_ID.get(current.back) : undefined
  const keeps = back?.slot === 'back' && BACK_ROLE[back.kind] === role
  return { ...m, role, rig: m.rig ? (keeps ? m.rig : { ...m.rig, back: ROLE_BACK[role] }) : null }
}

export function savePreset(m: CrewMember, index: number, name: string, rig: Rig): CrewMember {
  if (index < 0 || index >= MAX_PRESETS) return m
  const presets = [...m.presets]
  const entry = { name: name.trim().slice(0, PRESET_NAME_MAX) || `Loadout ${index + 1}`, rig }
  if (index < presets.length) presets[index] = entry
  else presets.push(entry)
  return { ...m, presets }
}
export const wearPreset = (m: CrewMember, index: number): CrewMember => (m.presets[index] ? { ...m, rig: m.presets[index].rig } : m)

/** After a mission, won or lost (TC25, TC27): who fought takes its XP and 1 Strain (3 at most); who rested takes half the
 * XP, and her Strain after resting: by default a rest clears Strain 3; the cabins' Comfort sheds more (CY14's
 * `restedStrain`, passed in by the caller so this module needn't know cabins). */
export function afterMission(crew: readonly CrewMember[], squad: readonly number[], xp: number, rest: (m: CrewMember) => number = (m) => (resting(m) ? 0 : m.strain)): CrewMember[] {
  return crew.map((m) => squad.includes(m.outfit)
    ? { ...m, xp: m.xp + xp, strain: Math.min(STRAIN_REST, m.strain + 1) }
    : { ...m, xp: m.xp + Math.floor(xp / 2), strain: rest(m) })
}

// --- The rig's numbers -------------------------------------------------------------------------------------------------

export interface WeaponLine { mount: 'Left hand' | 'Right hand' | 'Back unit'; name: string; band: Weapon['band']; hit: number; damage: number; hits: number }

export interface RigStats {
  load: number
  capacity: number
  /** Capacity left; negative when over. */
  left: number
  over: boolean
  /** At 70% load or less: +1 Move. */
  light: boolean
  move: number
  hp: { core: number; leftArm: number; rightArm: number; legs: number }
  guard: number
  weapons: WeaponLine[]
  /** Why she can't deploy, or null. */
  problem: string | null
}

const unitOf = (bands: Bands, loadout: Loadout) => ({ bands, loadout })

/** A weapon's base hit % (before evasion and Cover) and damage a hit (before facing, height and Coats). */
export function weaponLine(mount: WeaponLine['mount'], name: string, w: Weapon, bands: Bands): WeaponLine {
  return {
    mount, name, band: w.band, hits: w.hits,
    hit: Math.min(TUNING.hitClamp[1], w.accuracy + TUNING.witAccuracy * bands.wit),
    damage: w.power + (w.band === 'melee' ? TUNING.meleePowerPerBand * bands.power : 0),
  }
}

export function rigStats(rig: Rig, bands: Bands): RigStats {
  const loadout = loadoutOf(rig)
  const u = unitOf(bands, loadout)
  const load = loadOf(loadout), capacity = capacityOf(u)
  const hp = maxHpOf(u)
  const name = (id: string | null) => (id ? PARTS_BY_ID.get(id)?.name ?? id : '')
  const weapons: WeaponLine[] = []
  if (loadout.leftHand?.kind === 'weapon') weapons.push(weaponLine('Left hand', name(rig.leftHand), loadout.leftHand, bands))
  if (loadout.rightHand?.kind === 'weapon') weapons.push(weaponLine('Right hand', name(rig.rightHand), loadout.rightHand, bands))
  if (loadout.back.weapon) weapons.push(weaponLine('Back unit', name(rig.back), loadout.back.weapon, bands))
  const guard = Math.max(0, ...[loadout.leftHand, loadout.rightHand].map((h) => (h?.kind === 'shield' ? h.guard : 0)))
  const over = load > capacity
  const problem = rigProblem(rig) ?? (over ? `Load ${load} is over Capacity ${capacity}` : null)
  return { load, capacity, left: capacity - load, over, light: isLight(u), move: moveOf({ ...u, id: '', side: 'squad', chargeCap: 3, link: true, spawn: 0, facing: 'N' }, { hp }), hp, guard, weapons, problem }
}

// --- Best for her role -------------------------------------------------------------------------------------------------

interface Weights { hp: number; move: number; guard: number; melee: number; short: number; long: number; aim: number }
const WEIGHTS: Record<Role, Weights> = {
  vanguard: { hp: 1, move: 6, guard: 0.6, melee: 0.8, short: 1.2, long: 0.5, aim: 0 },
  striker: { hp: 0.5, move: 14, guard: 0.1, melee: 1.6, short: 0.6, long: 0.3, aim: 0 },
  gunner: { hp: 0.5, move: 6, guard: 0.1, melee: 0.3, short: 1, long: 1.2, aim: 10 },
  netrunner: { hp: 0.6, move: 12, guard: 0.3, melee: 0.4, short: 0.7, long: 0.3, aim: 0 },
  medic: { hp: 0.7, move: 12, guard: 0.3, melee: 0.4, short: 0.7, long: 0.3, aim: 0 },
}
/** Each role's default Coat (the Hangar can swap it for what a mission's enemies deal). */
export const ROLE_COAT: Record<Role, string> = { vanguard: 'coat-p', striker: 'coat-p', gunner: 'coat-f', netrunner: 'coat-i', medic: 'coat-i' }

function score(role: Role, bands: Bands, loadout: Loadout): number {
  const w = WEIGHTS[role]
  const u = unitOf(bands, loadout)
  const hp = maxHpOf(u)
  const value = (x: Weapon) => {
    const line = weaponLine('Right hand', '', x, bands)
    return line.damage * x.hits * line.hit / 100 * w[x.band === 'long' ? 'long' : x.band]
  }
  const hands = [loadout.leftHand, loadout.rightHand].flatMap((h) => (h?.kind === 'weapon' ? [value(h)] : [])).sort((a, b) => b - a)
  if (hands.length === 0) return -1000
  const back = loadout.back.weapon ? value(loadout.back.weapon) * (loadout.back.ammo ?? 1) / 3 : 0
  const guard = Math.max(0, ...[loadout.leftHand, loadout.rightHand].map((h) => (h?.kind === 'shield' ? h.guard : 0)))
  const move = TUNING.move[bands.speed] + (isLight(u) ? 1 : 0) + (loadout.legs.move ?? 0)
  return w.hp * (hp.core + hp.leftArm + hp.rightArm + hp.legs) + w.move * move + w.guard * guard + hands[0]! + 0.5 * (hands[1] ?? 0) + back
    + (loadout.visor.aim ? w.aim : 0)
}

const ids = (parts: Part[]) => parts.map((p) => p.id)
const handIds = ids(partsFor('hand'))
const twoHanded = (id: string | null) => { const p = id ? PARTS_BY_ID.get(id) : undefined; return p?.slot === 'hand' && p.item.kind === 'weapon' && !!p.item.twoHanded }
const bestCache = new Map<string, Rig>()

/** "Best for her role" in one tap (TC18): the highest-scoring rig of the parts owned (every starter part), always with her
 * role's Back unit and never over her Capacity. Deterministic: the first best in the Hangar's order. */
export function bestRig(role: Role, bands: Bands): Rig {
  const key = `${role}:${bands.speed}${bands.stamina}${bands.power}${bands.guts}${bands.wit}`
  const cached = bestCache.get(key)
  if (cached) return cached
  const backs = partsFor('back').filter((p) => p.slot === 'back' && BACK_ROLE[p.kind] === role).map((p) => p.id)
  const arms = ids(partsFor('arm'))
  let best: Rig | null = null, bestScore = -Infinity
  for (const core of ids(partsFor('core'))) for (const [li, leftArm] of arms.entries()) for (const rightArm of arms.slice(li)) for (const legs of ids(partsFor('legs')))
    for (const back of backs) for (const visor of ids(partsFor('visor'))) for (const rightHand of handIds) for (const leftHand of [null, ...handIds]) {
      if (twoHanded(leftHand) || (twoHanded(rightHand) && leftHand)) continue
      const rig: Rig = { core, leftArm, rightArm, legs, back, visor, leftHand, rightHand, coat: ROLE_COAT[role] }
      const loadout = loadoutOf(rig)
      if (loadOf(loadout) > capacityOf(unitOf(bands, loadout))) continue
      const s = score(role, bands, loadout)
      if (s > bestScore) { best = rig; bestScore = s }
    }
  // Something always fits: Capacity is at least 12, and the lightest rig with any role's Back unit and a hand weapon weighs
  // 12 at most.
  bestCache.set(key, best!)
  return best!
}
