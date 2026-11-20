// The starter parts (CY11, TC17–TC19): about thirty parts with original names, enough for every role, standard issue
// aboard (the Hangar stocks every one, any number). They're this game's own, so they're in git. Shops, salvage and
// remodels (Phase 5) add rarer parts beside them. A rig names a part per slot; `loadoutOf` turns it into the battle
// package's loadout, whose rules (Load, Capacity, Move) stay there.
import type { BackKind, DamageType, HandItem, Loadout, Role, Weapon } from '@cyber/battle'

export type PartSlot = 'core' | 'arm' | 'legs' | 'back' | 'visor' | 'hand' | 'coat'

interface Base { id: string; name: string; note: string }
export type Part =
  | (Base & { slot: 'core'; load: number; capacity?: number; hp?: number })
  | (Base & { slot: 'arm'; load: number; hp?: number })
  | (Base & { slot: 'legs'; load: number; hp?: number; move?: number })
  | (Base & { slot: 'back'; kind: Exclude<BackKind, 'none'>; load: number; capacity?: number; weapon?: Weapon; ammo?: number })
  | (Base & { slot: 'visor'; load: number; aim?: boolean })
  | (Base & { slot: 'hand'; item: HandItem })
  | (Base & { slot: 'coat'; type: DamageType })

const melee = (power: number, accuracy: number, type: DamageType, load: number, more: Partial<Weapon> = {}): Weapon =>
  ({ kind: 'weapon', band: 'melee', type, power, accuracy, range: [1, 1], hits: 1, load, ...more })
const short = (power: number, accuracy: number, type: DamageType, max: number, hits: number, load: number): Weapon =>
  ({ kind: 'weapon', band: 'short', type, power, accuracy, range: [1, max], hits, load })
const long = (power: number, accuracy: number, type: DamageType): Weapon => ({ kind: 'weapon', band: 'long', type, power, accuracy, range: [3, 6], hits: 1, load: 0 })

/** Every starter part, in the Hangar's order. */
export const STARTER_PARTS: readonly Part[] = [
  { id: 'core-frame', slot: 'core', name: 'Frame core', load: 3, note: 'The standard core' },
  { id: 'core-light', slot: 'core', name: 'Light core', load: 2, note: 'Light; nothing extra' },
  { id: 'core-harness', slot: 'core', name: 'Heavy harness', load: 5, capacity: 4, hp: 10, note: '+4 Capacity, +10 Core HP' },
  { id: 'core-reactor', slot: 'core', name: 'Reactor core', load: 4, capacity: 3, note: '+3 Capacity' },
  { id: 'arm-standard', slot: 'arm', name: 'Standard arm', load: 2, note: 'The standard arm' },
  { id: 'arm-guard', slot: 'arm', name: 'Guard arm', load: 3, hp: 6, note: '+6 arm HP' },
  { id: 'arm-light', slot: 'arm', name: 'Light arm', load: 1, note: 'Light; nothing extra' },
  { id: 'legs-standard', slot: 'legs', name: 'Standard legs', load: 2, note: 'The standard legs' },
  { id: 'legs-runner', slot: 'legs', name: 'Runner legs', load: 3, move: 1, note: '+1 Move' },
  { id: 'legs-anchor', slot: 'legs', name: 'Anchor greaves', load: 4, move: -1, hp: 8, note: '−1 Move, +8 Legs HP' },
  { id: 'legs-light', slot: 'legs', name: 'Light legs', load: 1, note: 'Light; nothing extra' },
  { id: 'back-bulwark', slot: 'back', kind: 'bulwark', name: 'Bulwark', load: 3, capacity: 4, note: 'Vanguard: deploys a one-tile barrier; +4 Capacity' },
  { id: 'back-thruster', slot: 'back', kind: 'thruster', name: 'Thruster', load: 2, note: 'Striker: dash, and jump a level higher' },
  { id: 'back-missiles', slot: 'back', kind: 'launcher', name: 'Missile pod', load: 3, weapon: long(18, 70, 'F'), ammo: 3, note: 'Gunner: Long F missiles, 3 ammo' },
  { id: 'back-mortar', slot: 'back', kind: 'launcher', name: 'Mortar rack', load: 4, weapon: long(14, 80, 'I'), ammo: 2, note: 'Gunner: Long I mortar, 2 ammo' },
  { id: 'back-deck', slot: 'back', kind: 'deck', name: 'Deck', load: 2, note: 'Netrunner: Stun, Jam, Jack-Out and terminals' },
  { id: 'back-med', slot: 'back', kind: 'med', name: 'Med unit', load: 2, note: 'Medic: mends, repairs and reboots' },
  { id: 'visor-basic', slot: 'visor', name: 'Basic visor', load: 1, note: 'The standard visor' },
  { id: 'visor-aim', slot: 'visor', name: 'Aim visor', load: 2, aim: true, note: 'Aim: pick a part at −25% hit' },
  { id: 'hand-blade', slot: 'hand', name: 'Edge blade', item: melee(12, 85, 'P', 2), note: 'Melee P' },
  { id: 'hand-knuckles', slot: 'hand', name: 'Shock knuckles', item: melee(10, 90, 'I', 2), note: 'Melee I; can Stun on the Core' },
  { id: 'hand-driver', slot: 'hand', name: 'Pile driver', item: melee(16, 75, 'P', 3), note: 'Melee P, heavy' },
  { id: 'hand-greatblade', slot: 'hand', name: 'Great blade', item: melee(18, 80, 'P', 4, { twoHanded: true }), note: 'Melee P, two-handed' },
  { id: 'hand-pistol', slot: 'hand', name: 'Machine pistol', item: short(4, 80, 'P', 2, 4, 2), note: 'Short P, 4 hits' },
  { id: 'hand-rifle', slot: 'hand', name: 'Laser rifle', item: { ...short(6, 75, 'P', 3, 3, 3), twoHanded: true }, note: 'Short P, 3 pulses, range 1–3, two-handed' },
  { id: 'hand-scattergun', slot: 'hand', name: 'Scattergun', item: short(5, 70, 'I', 2, 4, 3), note: 'Short I, 4 hits' },
  { id: 'hand-flamer', slot: 'hand', name: 'Flamer', item: short(4, 80, 'F', 2, 3, 3), note: 'Short F; sets oil alight' },
  { id: 'hand-tower', slot: 'hand', name: 'Tower shield', item: { kind: 'shield', guard: 40, load: 3 }, note: 'Guard 40%' },
  { id: 'hand-buckler', slot: 'hand', name: 'Buckler', item: { kind: 'shield', guard: 20, load: 1 }, note: 'Guard 20%' },
  { id: 'coat-p', slot: 'coat', name: 'Weave coat', type: 'P', note: 'Halves pierce' },
  { id: 'coat-i', slot: 'coat', name: 'Padded coat', type: 'I', note: 'Halves impact' },
  { id: 'coat-f', slot: 'coat', name: 'Heat coat', type: 'F', note: 'Halves fire' },
]

/** Parts issued by an authored campaign kit. */
const CAMPAIGN_PARTS: readonly Part[] = [
  { id: 'back-close-blade', slot: 'back', kind: 'launcher', name: 'Mounted blade', load: 3, weapon: melee(15, 85, 'P', 0), ammo: 2, note: 'Backup blade · 1 tile · 2 uses' },
  { id: 'back-deck-cannon', slot: 'back', kind: 'launcher', name: 'Deck cannon', load: 3, weapon: short(12, 80, 'I', 0, 1, 3), ammo: 3, note: 'Backup cannon · 1–3 tiles · 3 shots' },
  { id: 'back-campaign-mortar', slot: 'back', kind: 'launcher', name: 'Area mortar', load: 4, weapon: { ...long(15, 80, 'I'), blast: 1 }, ammo: 2, note: 'Adjacent enemy splash · 2 shells' },
  { id: 'back-sniper', slot: 'back', kind: 'launcher', name: 'Sniper rack', load: 4, weapon: long(18, 86, 'P'), ammo: 3, note: 'Gunner: Long P precision fire, 3 ammo' },
  { id: 'hand-arc-axe', slot: 'hand', name: 'Arc axe', item: melee(21, 70, 'I', 4, { twoHanded: true }), note: 'Melee I, two-handed' },
  { id: 'hand-lance', slot: 'hand', name: 'Pulse lance', item: melee(17, 88, 'P', 4, { twoHanded: true }), note: 'Accurate Melee P, two-handed' },
  { id: 'hand-marksman', slot: 'hand', name: 'Marksman rifle', item: { ...short(17, 85, 'P', 3, 1, 4), twoHanded: true }, note: 'Short P, single shot, two-handed' },
]

export const PARTS_BY_ID: ReadonlyMap<string, Part> = new Map([...STARTER_PARTS, ...CAMPAIGN_PARTS].map((p) => [p.id, p]))
export const partsFor = (slot: PartSlot): Part[] => STARTER_PARTS.filter((p) => p.slot === slot)
export const loadOfPart = (p: Part): number => (p.slot === 'hand' ? p.item.load : p.slot === 'coat' ? 0 : p.load)

/** The rig slots a save names: a part id each; the hands, the Back unit and the Coat may be empty. */
export interface Rig {
  core: string
  leftArm: string
  rightArm: string
  legs: string
  back: string | null
  visor: string
  leftHand: string | null
  rightHand: string | null
  coat: string | null
}
export type RigSlot = keyof Rig
export const RIG_SLOTS: readonly RigSlot[] = ['core', 'leftArm', 'rightArm', 'legs', 'back', 'visor', 'leftHand', 'rightHand', 'coat']
/** Which kind of part each rig slot takes. */
export const SLOT_KIND: Record<RigSlot, PartSlot> = {
  core: 'core', leftArm: 'arm', rightArm: 'arm', legs: 'legs', back: 'back', visor: 'visor', leftHand: 'hand', rightHand: 'hand', coat: 'coat',
}
export const SLOT_NAME: Record<RigSlot, string> = {
  core: 'Core', leftArm: 'Left arm', rightArm: 'Right arm', legs: 'Legs', back: 'Back unit', visor: 'Visor', leftHand: 'Left hand', rightHand: 'Right hand', coat: 'Coat',
}

/** The role each Back unit kind signs (TC5). */
export const BACK_ROLE: Record<Exclude<BackKind, 'none'>, Role> = { bulwark: 'vanguard', thruster: 'striker', launcher: 'gunner', deck: 'netrunner', med: 'medic' }
/** Each role's starter Back unit. */
export const ROLE_BACK: Record<Role, string> = { vanguard: 'back-bulwark', striker: 'back-thruster', gunner: 'back-missiles', netrunner: 'back-deck', medic: 'back-med' }

function part<S extends PartSlot>(id: string | null, slot: S, path: string): Extract<Part, { slot: S }> | null {
  if (id === null) return null
  const p = PARTS_BY_ID.get(id)
  if (!p || p.slot !== slot) throw new Error(`${path}: ${id} isn't a ${slot} part`)
  return p as Extract<Part, { slot: S }>
}

/** A rig as the battle package's loadout. Throws on a part id that isn't a part of the slot's kind. */
export function loadoutOf(rig: Rig): Loadout {
  const core = part(rig.core, 'core', 'core')!, la = part(rig.leftArm, 'arm', 'leftArm')!, ra = part(rig.rightArm, 'arm', 'rightArm')!
  const legs = part(rig.legs, 'legs', 'legs')!, back = part(rig.back, 'back', 'back'), visor = part(rig.visor, 'visor', 'visor')!
  const lh = part(rig.leftHand, 'hand', 'leftHand'), rh = part(rig.rightHand, 'hand', 'rightHand'), coat = part(rig.coat, 'coat', 'coat')
  const opt = <K extends string, V>(k: K, v: V | undefined) => (v === undefined ? {} : { [k]: v } as Record<K, V>)
  return {
    core: { load: core.load, ...opt('capacity', core.capacity), ...opt('hp', core.hp) },
    leftArm: { load: la.load, ...opt('hp', la.hp) },
    rightArm: { load: ra.load, ...opt('hp', ra.hp) },
    legs: { load: legs.load, ...opt('hp', legs.hp), ...opt('move', legs.move) },
    back: back ? { kind: back.kind, load: back.load, ...opt('capacity', back.capacity), ...opt('weapon', back.weapon), ...opt('ammo', back.ammo) } : { kind: 'none', load: 0 },
    visor: { load: visor.load, ...opt('aim', visor.aim) },
    leftHand: lh ? lh.item : null,
    rightHand: rh ? rh.item : null,
    coat: coat ? coat.type : null,
  }
}

/** Why a rig can't be worn as it is, in words, or null: a two-handed weapon with something in the left hand. Capacity is
 * checked against her bands (`overCapacity`). */
export function rigProblem(rig: Rig): string | null {
  const rh = rig.rightHand ? PARTS_BY_ID.get(rig.rightHand) : undefined
  const lh = rig.leftHand ? PARTS_BY_ID.get(rig.leftHand) : undefined
  if (lh?.slot === 'hand' && lh.item.kind === 'weapon' && lh.item.twoHanded) return 'A two-handed weapon goes in the right hand'
  if (rh?.slot === 'hand' && rh.item.kind === 'weapon' && rh.item.twoHanded && rig.leftHand) return 'The left hand is empty under a two-handed weapon'
  return null
}
