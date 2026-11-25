import type { Dir, UnitInput } from '@cyber/battle'
import { RIG_SLOTS, type Clip, type Rig, type SpriteBundle, type Track } from './combat-sprite-format'

// Share props where their board silhouettes and grips match. The frozen IDs still drive the rules and UI.
export const partVisual = {
  'core-frame': 'armor', 'core-light': 'armor', 'core-harness': 'armor', 'core-reactor': 'armor',
  'arm-standard': 'armor', 'arm-guard': 'armor', 'arm-light': 'armor',
  'legs-standard': 'armor', 'legs-runner': 'armor', 'legs-anchor': 'armor', 'legs-light': 'armor',
  'visor-basic': 'armor', 'visor-aim': 'armor',
  'coat-p': 'armor', 'coat-i': 'armor', 'coat-f': 'armor',
  'hand-blade': 'blade', 'hand-knuckles': 'gauntlet', 'hand-driver': 'gauntlet',
  'hand-greatblade': 'greatblade', 'hand-arc-axe': 'greatblade', 'hand-lance': 'greatblade',
  'hand-rifle': 'rifle', 'hand-marksman': 'rifle',
  'hand-pistol': 'pistol', 'hand-scattergun': 'pistol', 'hand-flamer': 'pistol',
  'hand-tower': 'shield', 'hand-buckler': 'shield',
  'back-bulwark': 'bulwark', 'back-thruster': 'thruster', 'back-deck': 'deck', 'back-med': 'med',
  'back-missiles': 'launcher', 'back-mortar': 'launcher', 'back-campaign-mortar': 'launcher',
  'back-sniper': 'launcher', 'back-deck-cannon': 'launcher', 'back-close-blade': 'mounted-blade',
} as const
type Visual = typeof partVisual[keyof typeof partVisual]
export const visualOf = (id: string | null): Visual | undefined => id && Object.hasOwn(partVisual, id) ? partVisual[id as keyof typeof partVisual] : undefined

export interface ComposedRig {
  rig: Rig
  left: Visual | undefined
  right: Visual | undefined
  back: Visual | undefined
  twoHand: 'left' | 'right' | undefined
  guards: { left: number; right: number }
}

export function compositionFor(bundle: SpriteBundle, unit: UnitInput): ComposedRig | undefined {
  const rig = unit.frozenRig
  const kind = typeof bundle.outfit === 'number' ? 'uma' : 'heroine'
  if (!bundle.composition || !rig || unit.ref?.kind !== kind || unit.ref.id !== String(bundle.outfit)) return
  if (Object.keys(RIG_SLOTS).some(key => {
    const id = rig[key as keyof Rig]
    return id !== null && !visualOf(id)
  })) return
  const left = visualOf(rig.leftHand), right = visualOf(rig.rightHand)
  const twoHand = unit.loadout.rightHand?.kind === 'weapon' && unit.loadout.rightHand.twoHanded ? 'right'
    : unit.loadout.leftHand?.kind === 'weapon' && unit.loadout.leftHand.twoHanded ? 'left' : undefined
  const guards = {
    left: unit.loadout.leftHand?.kind === 'shield' ? unit.loadout.leftHand.guard : 0,
    right: unit.loadout.rightHand?.kind === 'shield' ? unit.loadout.rightHand.guard : 0,
  }
  return { rig, left, right, back: visualOf(rig.back), twoHand, guards }
}

export const reflectedFacing: Record<Dir, Dir> = { S: 'S', N: 'N', W: 'E', E: 'W' }
export type CompositionClip = { clip: Clip; track: Track; flip: boolean; twoGrip: boolean; authored?: true; native?: true }

// A reverse donor opts this bundle into native handedness and per-slot prop lanes.
export const hasNativeHands = (bundle: SpriteBundle): boolean => Object.hasOwn(bundle.motions, 'mixed-reverse')
export const isBackMotion = (name: string): boolean => name === 'attack-back' || name.startsWith('back-')

const ranged = (hand: Visual | undefined): boolean => hand === 'pistol' || hand === 'rifle'
const melee = (hand: Visual | undefined): boolean => hand === 'blade' || hand === 'gauntlet' || hand === 'greatblade'

function nativeClip(bundle: SpriteBundle, rig: ComposedRig, facing: Dir, name: string): CompositionClip | undefined {
  const sources = bundle.composition!
  const body = bundle.motions[sources.body]![facing]
  const reverse = bundle.motions['mixed-reverse']![facing]
  const shield = bundle.motions.shield?.[facing]
  const armedSide = name.match(/^attack-(left|right)$/)?.[1] as 'left' | 'right' | undefined
  const side = name.match(/-one-(left|right)$/)?.[1]
  const disabled = name.endsWith('-both-arms-broken')
  const action = name.replace(/-one-(left|right)$|-both-arms-broken$/, '')
  const twoGrip = rig.twoHand !== undefined
  let track: Track = body
  let key = name
  let clip: Clip | undefined

  if (twoGrip) {
    track = bundle.motions[rig[rig.twoHand!] === 'greatblade' ? sources.blade : sources.rifle]![facing]
    if (armedSide) key = 'attack'
    if (name === 'dash-walk-degraded') key = 'walk-degraded'
    clip = track.clips[key]
    if (!clip && action === 'dash-walk' && side) clip = track.clips[`walk-one-${side}`]
    if (!clip && (isBackMotion(action) || action === 'dash-walk')) {
      const carry = track.clips[disabled ? 'idle-both-arms-broken' : side ? `idle-one-${side}` : 'idle']
      const source = track.clips[action] ?? (action === 'attack-back' ? body.clips[action] : undefined)
      const frame = carry?.frames[0]?.frame
      if (frame && source) clip = { ...source, frames: source.frames.map(({ ms }) => ({ frame, ms })) }
    }
  } else {
    const guarding = /^(guard|cover)(-right)?$/.test(name)
    const wantsReverse = armedSide ? armedSide === 'right' ? ranged(rig.right) : melee(rig.left)
      : (ranged(rig.right) && !ranged(rig.left)) || (melee(rig.left) && !melee(rig.right))
    if (rig.left === 'shield' && shield && (guarding || (!wantsReverse && name !== 'attack-back'))) {
      track = shield
      if (armedSide === 'right') key = 'attack'
    } else if (wantsReverse) track = reverse
    if (guarding) key = name.startsWith('guard') ? 'guard' : 'cover'
    if (name === 'dash-walk-degraded') key = 'walk-degraded'
    clip = track.clips[key]
  }
  return clip && { track, clip, flip: false, twoGrip, authored: true, native: true }
}

const staged = (frame: string, times: number[], cue?: string): Clip => ({
  frames: times.map(ms => ({ frame, ms })), loop: false, events: cue ? [{ frame: 1, cue }] : [],
})

export function composedClip(bundle: SpriteBundle, rig: ComposedRig, facing: Dir, name: string): CompositionClip | undefined {
  if (hasNativeHands(bundle)) {
    const native = nativeClip(bundle, rig, facing, name)
    if (native) return native
  }
  const sources = bundle.composition!
  const degraded = name.endsWith('-degraded')
  const action = degraded ? name.slice(0, -'-degraded'.length) : name
  const left = action === 'attack-left', right = action === 'attack-right'
  const hand = left ? rig.left : rig.right
  const shieldOnRight = name === 'guard-right' || name === 'cover-right'
  const guard = name === 'guard' || name === 'cover' || shieldOnRight
  const twoGrip = !degraded && rig.twoHand !== undefined && (
    ['idle', 'walk', 'settle'].includes(name) || ((left || right) && (hand === 'rifle' || hand === 'greatblade'))
    || /^(idle|walk|settle|attack)-(one-(left|right)|both-arms-broken)$/.test(name))
  if (twoGrip) {
    const visual = rig[rig.twoHand!]
    const track = bundle.motions[visual === 'greatblade' ? sources.blade : sources.rifle]![facing]
    const fallback = name.replace(/-one-(left|right)$|-both-arms-broken$/, '')
    const key = left || right ? 'attack' : name
    const clip = track.clips[key] ?? track.clips[fallback]
    if (clip) return { track, clip, flip: false, twoGrip: true }
  }
  const shot = hand === 'pistol' || hand === 'rifle'
  const flip = (left && !shot) || (right && shot) || (guard && shieldOnRight)
  const track = bundle.motions[sources.body]![flip ? reflectedFacing[facing] : facing]
  const idle = track.clips.idle!.frames[0]!.frame
  if (guard && rig.left !== 'shield' && rig.right !== 'shield') return
  if (guard) {
    const frames = track.clips['attack-left']!.frames
    return { track, flip, twoGrip: false, clip: { frames: [frames[0]!, frames[2]!, { ...frames[3]!, ms: 130 }, frames[1]!, frames[0]!],
      events: [{ frame: 2, cue: 'shield-contact' }], loop: false } }
  }
  const motion = (left || right) ? shot ? 'attack-left' : 'attack-right' : action === 'dash-walk' ? 'walk' : action
  const authored = track.clips[motion]
  if (authored) return { track, flip, clip: authored, twoGrip: false, authored: true }
  const clip = name === 'down' ? staged(idle, [1000])
    : name === 'rig-break' || name === 'reboot-rise' || name === 'hurt' ? staged(idle, [56, 64, 76, 95])
    : name === 'back-dash' || name === 'back-tech' || name === 'back-med' || name === 'back-deploy'
      ? staged(idle, [58, 96, 84, 86], 'emitter') : undefined
  return clip ? { track, flip, clip, twoGrip: false } : undefined
}
